import 'dotenv/config';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import type {
  BracketSlot,
  CategoryBracket,
  Match,
  MatchStatus,
  Participant,
  Team,
  TeamStatus,
  WhatsAppEventType,
  WhatsAppProvider,
} from './src/types/tournament.ts';
import {
  cloneInitialBrackets,
  mergeWithDefaultBrackets,
  syncAllBracketsWithTeamsAndMatches,
  syncBracketWithTeamsAndMatches,
} from './src/utils/tournamentBracket.ts';
import {
  buildDefaultPairName,
  createInitialScore,
  detectScheduleConflict,
  findTeamForParticipant,
  formatPairRegion,
  generateKnockoutPairings,
  generateRoundRobinPairings,
  isValidWhatsAppNumber,
  normalizeWhatsAppNumber,
} from './src/utils/tournamentLogic.ts';
import {
  getPublicState,
  loadStore,
  resetSeedStore,
  saveStore,
  touchStoreRevision,
} from './server/store.ts';
import {
  dispatchMatchWhatsAppNotifications,
  dispatchSingleWhatsAppMessage,
} from './server/whatsapp.ts';
import {
  clearFailedAuthAttempts,
  createAdminToken,
  extractBearerToken,
  getAuthConfigState,
  hashPassword,
  isRateLimited,
  recordFailedAuthAttempt,
  requireAdmin,
  revokeAdminToken,
  verifyAdminCredentials,
  verifyAdminToken,
} from './server/auth.ts';

const PORT = Number(process.env.PORT) || 3000;
const app = express();
app.use(express.json({ limit: '1mb' }));

// Connected SSE clients for instant updates to Leaderboard, Public Link, and LED Display
const sseClients = new Set<express.Response>();

function broadcastState(): void {
  const store = loadStore();
  const payload = JSON.stringify(getPublicState(store));
  for (const res of sseClients) {
    res.write(`event: state\ndata: ${payload}\n\n`);
  }
}

function getBasePublicUrl(req: express.Request): string {
  if (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL') {
    return `${process.env.APP_URL.replace(/\/$/, '')}/?view=public`;
  }
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}/?view=public`;
}

// SSE endpoint
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const store = loadStore();
  res.write(`event: state\ndata: ${JSON.stringify(getPublicState(store))}\n\n`);
  sseClients.add(res);

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

// Get full tournament state
app.get('/api/state', (_req, res) => {
  const store = loadStore();
  res.json(getPublicState(store));
});

// Admin Auth Status
app.get('/api/auth/status', (req, res) => {
  const store = loadStore();
  const cfg = getAuthConfigState(store._secrets);
  const token = extractBearerToken(req);
  const payload = token ? verifyAdminToken(token) : null;
  res.json({
    authenticated: Boolean(payload),
    username: payload ? payload.sub : null,
    needsSetup: cfg.needsSetup,
    envConfigured: cfg.envConfigured,
  });
});

// One-time first-run Admin password claim when ADMIN_PASSWORD env is unset
app.post('/api/auth/setup', (req, res) => {
  const ipKey = req.ip || 'unknown';
  if (isRateLimited(ipKey)) {
    res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.' });
    return;
  }

  const store = loadStore();
  const cfg = getAuthConfigState(store._secrets);
  if (!cfg.needsSetup) {
    res.status(409).json({ error: 'Akun admin sudah dikonfigurasi. Silakan login.' });
    return;
  }

  const { username, password } = req.body ?? {};
  const cleanUsername =
    typeof username === 'string' && username.trim().length > 0 ? username.trim() : 'admin';

  if (cleanUsername.length < 3 || cleanUsername.length > 32) {
    res.status(400).json({ error: 'Username admin harus 3–32 karakter.' });
    return;
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    res.status(400).json({ error: 'Kata sandi admin minimal 6 karakter.' });
    return;
  }

  store._secrets = {
    token: store._secrets?.token || process.env.WHATSAPP_API_TOKEN || '',
    adminUsername: cleanUsername,
    adminPasswordHash: hashPassword(password),
  };
  saveStore(store);

  clearFailedAuthAttempts(ipKey);
  const token = createAdminToken(cleanUsername);
  res.status(201).json({
    authenticated: true,
    username: cleanUsername,
    token,
    needsSetup: false,
    envConfigured: false,
  });
});

// Admin Login
app.post('/api/auth/login', (req, res) => {
  const ipKey = req.ip || 'unknown';
  if (isRateLimited(ipKey)) {
    res.status(429).json({ error: 'Terlalu banyak percobaan login gagal. Coba lagi beberapa menit.' });
    return;
  }

  const store = loadStore();
  const { username = 'admin', password = '' } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string' || !password) {
    res.status(400).json({ error: 'Masukkan username dan kata sandi admin.' });
    return;
  }

  const result = verifyAdminCredentials(username, password, store._secrets);
  if (!result.ok) {
    if (result.reason === 'needs_setup') {
      res.status(400).json({ error: 'Akun admin belum dibuat. Silakan buat kata sandi admin pertama.' });
      return;
    }
    recordFailedAuthAttempt(ipKey);
    res.status(401).json({ error: 'Username atau kata sandi admin salah.' });
    return;
  }

  clearFailedAuthAttempts(ipKey);
  const cfg = getAuthConfigState(store._secrets);
  const token = createAdminToken(result.username);
  res.json({
    authenticated: true,
    username: result.username,
    token,
    needsSetup: false,
    envConfigured: cfg.envConfigured,
  });
});

// Admin Logout
app.post('/api/auth/logout', (req, res) => {
  const token = extractBearerToken(req);
  if (token) {
    revokeAdminToken(token);
  }
  res.json({ authenticated: false });
});

// Exchange Google Super Admin login for backend JWT admin token
app.post('/api/auth/google-admin', (req, res) => {
  const { email } = req.body ?? {};
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const isSuperAdmin = cleanEmail === 'muhazman441@gmail.com';
  if (!isSuperAdmin) {
    res.status(403).json({ error: 'Email bukan Super Admin yang terdaftar.' });
    return;
  }
  const token = createAdminToken(cleanEmail);
  res.json({
    authenticated: true,
    username: cleanEmail,
    token,
  });
});

// Register a single individual participant (no WhatsApp required, includes Region & Perwakilan)
app.post('/api/participants', (req, res) => {
  const store = loadStore();
  const { name, region, representation, categoryId, level } = req.body ?? {};

  if (!categoryId || !store.categories.some((c) => c.id === categoryId)) {
    res.status(400).json({ error: 'Kategori turnamen tidak valid.' });
    return;
  }
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Nama peserta wajib diisi.' });
    return;
  }
  if (typeof region !== 'string' || !region.trim()) {
    res.status(400).json({ error: 'Region peserta wajib diisi.' });
    return;
  }

  const newParticipant: Participant = {
    id: `part-${crypto.randomUUID().slice(0, 8)}`,
    name: name.trim(),
    region: region.trim(),
    representation:
      typeof representation === 'string' && representation.trim()
        ? representation.trim()
        : 'Retail Sales',
    categoryId,
    level: typeof level === 'string' && level.trim() ? level.trim() : 'Open',
    status: 'registered',
    createdAt: new Date().toISOString(),
  };

  store.participants.push(newParticipant);
  touchStoreRevision(store);
  saveStore(store);
  broadcastState();
  res.status(201).json({ participant: newParticipant, state: getPublicState(store) });
});

// Update individual participant (Admin only) & sync onto any formed pair
app.put('/api/participants/:id', requireAdmin, (req, res) => {
  const store = loadStore();
  const participant = store.participants.find((p) => p.id === req.params.id);
  if (!participant) {
    res.status(404).json({ error: 'Peserta tidak ditemukan.' });
    return;
  }

  const { name, region, representation, categoryId, level, status } = req.body ?? {};
  if (typeof name === 'string' && name.trim()) participant.name = name.trim();
  if (typeof region === 'string' && region.trim()) participant.region = region.trim();
  if (typeof representation === 'string' && representation.trim()) {
    participant.representation = representation.trim();
  }
  if (categoryId && store.categories.some((c) => c.id === categoryId)) {
    participant.categoryId = categoryId;
  }
  if (typeof level === 'string' && level.trim()) participant.level = level.trim();
  if (status && ['registered', 'checked_in', 'withdrawn'].includes(status)) {
    participant.status = status as TeamStatus;
  }

  for (const team of store.teams) {
    let changed = false;
    if (team.player1Id === participant.id) {
      team.player1.name = participant.name;
      team.player1.region = participant.region;
      team.player1.representation = participant.representation;
      team.player1.level = participant.level;
      changed = true;
    }
    if (team.player2Id === participant.id) {
      team.player2.name = participant.name;
      team.player2.region = participant.region;
      team.player2.representation = participant.representation;
      team.player2.level = participant.level;
      changed = true;
    }
    if (changed) {
      const combinedRegion = formatPairRegion(
        team.player1.region || '',
        team.player2.region || ''
      );
      team.region = combinedRegion;
      team.club = combinedRegion;
    }
  }

  touchStoreRevision(store);
  saveStore(store);
  broadcastState();
  res.json({ participant, state: getPublicState(store) });
});

// Delete an individual participant (Admin only; cascades team/matches if ?cascade=true)
app.delete('/api/participants/:id', requireAdmin, (req, res) => {
  const store = loadStore();
  const participant = store.participants.find((p) => p.id === req.params.id);
  if (!participant) {
    res.status(404).json({ error: 'Peserta tidak ditemukan.' });
    return;
  }

  const linkedTeam = findTeamForParticipant(participant.id, store.teams);
  const linkedMatches = linkedTeam
    ? store.matches.filter((m) => m.teamAId === linkedTeam.id || m.teamBId === linkedTeam.id)
    : [];
  const cascade = req.query.cascade === 'true';

  if (linkedTeam && !cascade) {
    res.status(409).json({
      error: `Peserta ini sudah tergabung dalam pasangan "${linkedTeam.teamName}"${
        linkedMatches.length > 0 ? ` (${linkedMatches.length} jadwal pertandingan)` : ''
      }. Konfirmasi untuk menghapus peserta beserta pasangan dan jadwal terkait.`,
      linkedMatchCount: linkedMatches.length,
    });
    return;
  }

  if (linkedTeam) {
    store.matches = store.matches.filter(
      (m) => m.teamAId !== linkedTeam.id && m.teamBId !== linkedTeam.id
    );
    store.teams = store.teams.filter((t) => t.id !== linkedTeam.id);
  }

  store.participants = store.participants.filter((p) => p.id !== participant.id);
  touchStoreRevision(store);
  saveStore(store);
  broadcastState();
  res.json({ state: getPublicState(store) });
});

// Manually pair two individual participants into a Team/Group (Admin only)
app.post('/api/teams/pair', requireAdmin, (req, res) => {
  const store = loadStore();
  const { participant1Id, participant2Id, categoryId, teamName, region, seed } = req.body ?? {};

  if (!participant1Id || !participant2Id || participant1Id === participant2Id) {
    res.status(400).json({ error: 'Pilih dua peserta yang berbeda untuk dipasangkan.' });
    return;
  }

  const p1 = store.participants.find((p) => p.id === participant1Id);
  const p2 = store.participants.find((p) => p.id === participant2Id);
  if (!p1 || !p2) {
    res.status(404).json({ error: 'Data peserta tidak ditemukan.' });
    return;
  }

  const existingTeam1 = findTeamForParticipant(p1.id, store.teams);
  const existingTeam2 = findTeamForParticipant(p2.id, store.teams);
  if (existingTeam1 || existingTeam2) {
    res.status(409).json({
      error: `${
        existingTeam1 ? p1.name : p2.name
      } sudah memiliki pasangan. Lepas pasangan lama terlebih dahulu jika ingin memindahkan.`,
    });
    return;
  }

  const resolvedCategoryId =
    categoryId && store.categories.some((c) => c.id === categoryId)
      ? categoryId
      : p1.categoryId;
  const category = store.categories.find((c) => c.id === resolvedCategoryId);
  if (!category) {
    res.status(400).json({ error: 'Kategori turnamen tidak valid.' });
    return;
  }

  const activeInCat = store.teams.filter(
    (t) => t.categoryId === resolvedCategoryId && t.status !== 'withdrawn'
  );
  if (activeInCat.length >= category.maxTeams) {
    res.status(400).json({ error: `Kuota pasangan kategori ${category.name} sudah penuh.` });
    return;
  }

  const resolvedRegion =
    typeof region === 'string' && region.trim()
      ? region.trim()
      : formatPairRegion(p1.region, p2.region);
  const resolvedName =
    typeof teamName === 'string' && teamName.trim()
      ? teamName.trim()
      : buildDefaultPairName(p1.name, p2.name);

  const pairStatus: TeamStatus =
    p1.status === 'checked_in' && p2.status === 'checked_in' ? 'checked_in' : 'registered';

  const newTeam: Team = {
    id: `team-${crypto.randomUUID().slice(0, 8)}`,
    categoryId: resolvedCategoryId,
    teamName: resolvedName,
    region: resolvedRegion,
    club: resolvedRegion,
    seed: typeof seed === 'number' && seed > 0 ? seed : null,
    status: pairStatus,
    player1Id: p1.id,
    player2Id: p2.id,
    player1: {
      name: p1.name,
      region: p1.region,
      representation: p1.representation || 'Retail Sales',
      level: p1.level,
    },
    player2: {
      name: p2.name,
      region: p2.region,
      representation: p2.representation || 'Retail Sales',
      level: p2.level,
    },
    createdAt: new Date().toISOString(),
  };

  store.teams.push(newTeam);
  touchStoreRevision(store);
  saveStore(store);
  broadcastState();
  res.status(201).json({ team: newTeam, state: getPublicState(store) });
});

// Register a formed pair directly (WhatsApp optional)
app.post('/api/teams', (req, res) => {
  const store = loadStore();
  const { categoryId, teamName, region, club, seed, player1, player2 } = req.body ?? {};

  if (!categoryId || !store.categories.some((c) => c.id === categoryId)) {
    res.status(400).json({ error: 'Kategori turnamen tidak valid.' });
    return;
  }
  if (!player1?.name?.trim() || !player2?.name?.trim()) {
    res.status(400).json({ error: 'Nama Pemain 1 dan Pemain 2 wajib diisi.' });
    return;
  }

  const category = store.categories.find((c) => c.id === categoryId)!;
  const activeInCat = store.teams.filter(
    (t) => t.categoryId === categoryId && t.status !== 'withdrawn'
  );
  if (activeInCat.length >= category.maxTeams) {
    res.status(400).json({ error: `Kuota kategori ${category.name} sudah penuh.` });
    return;
  }

  const p1Region =
    typeof player1.region === 'string' && player1.region.trim()
      ? player1.region.trim()
      : typeof region === 'string' && region.trim()
        ? region.trim()
        : typeof club === 'string' && club.trim()
          ? club.trim()
          : 'Makassar';
  const p2Region =
    typeof player2.region === 'string' && player2.region.trim()
      ? player2.region.trim()
      : p1Region;

  const resolvedRegion =
    typeof region === 'string' && region.trim()
      ? region.trim()
      : typeof club === 'string' && club.trim()
        ? club.trim()
        : formatPairRegion(p1Region, p2Region);

  const computedName =
    typeof teamName === 'string' && teamName.trim().length > 0
      ? teamName.trim()
      : buildDefaultPairName(player1.name, player2.name);

  const now = new Date().toISOString();
  const p1Id = `part-${crypto.randomUUID().slice(0, 8)}`;
  const p2Id = `part-${crypto.randomUUID().slice(0, 8)}`;
  const p1Level =
    typeof player1.level === 'string' && player1.level.trim() ? player1.level.trim() : 'Open';
  const p2Level =
    typeof player2.level === 'string' && player2.level.trim() ? player2.level.trim() : 'Open';
  const p1Rep =
    typeof player1.representation === 'string' && player1.representation.trim()
      ? player1.representation.trim()
      : 'Retail Sales';
  const p2Rep =
    typeof player2.representation === 'string' && player2.representation.trim()
      ? player2.representation.trim()
      : 'Retail Sales';

  store.participants.push(
    {
      id: p1Id,
      name: player1.name.trim(),
      region: p1Region,
      representation: p1Rep,
      categoryId,
      level: p1Level,
      status: 'registered',
      createdAt: now,
    },
    {
      id: p2Id,
      name: player2.name.trim(),
      region: p2Region,
      representation: p2Rep,
      categoryId,
      level: p2Level,
      status: 'registered',
      createdAt: now,
    }
  );

  const newTeam: Team = {
    id: `team-${crypto.randomUUID().slice(0, 8)}`,
    categoryId,
    teamName: computedName,
    region: resolvedRegion,
    club: resolvedRegion,
    seed: typeof seed === 'number' && seed > 0 ? seed : null,
    status: 'registered',
    player1Id: p1Id,
    player2Id: p2Id,
    player1: {
      name: player1.name.trim(),
      region: p1Region,
      representation: p1Rep,
      level: p1Level,
      ...(player1.whatsapp && isValidWhatsAppNumber(player1.whatsapp)
        ? { whatsapp: normalizeWhatsAppNumber(player1.whatsapp) }
        : {}),
    },
    player2: {
      name: player2.name.trim(),
      region: p2Region,
      representation: p2Rep,
      level: p2Level,
      ...(player2.whatsapp && isValidWhatsAppNumber(player2.whatsapp)
        ? { whatsapp: normalizeWhatsAppNumber(player2.whatsapp) }
        : {}),
    },
    createdAt: now,
  };

  store.teams.push(newTeam);
  touchStoreRevision(store);
  saveStore(store);
  broadcastState();
  res.status(201).json({ team: newTeam, state: getPublicState(store) });
});

// Update team details or check-in status (Admin only)
app.put('/api/teams/:id', requireAdmin, (req, res) => {
  const store = loadStore();
  const team = store.teams.find((t) => t.id === req.params.id);
  if (!team) {
    res.status(404).json({ error: 'Pasangan tidak ditemukan.' });
    return;
  }

  const { status, teamName, region, club, seed, player1, player2, categoryId } = req.body ?? {};
  if (status && ['registered', 'checked_in', 'withdrawn'].includes(status)) {
    team.status = status as TeamStatus;
  }
  if (typeof region === 'string' && region.trim()) {
    team.region = region.trim();
    team.club = region.trim();
  } else if (typeof club === 'string' && club.trim()) {
    team.club = club.trim();
    team.region = club.trim();
  }
  if (seed === null || (typeof seed === 'number' && seed > 0)) team.seed = seed;
  if (categoryId && store.categories.some((c) => c.id === categoryId)) {
    team.categoryId = categoryId;
  }
  if (player1?.name?.trim()) {
    team.player1.name = player1.name.trim();
    if (typeof player1.region === 'string' && player1.region.trim()) {
      team.player1.region = player1.region.trim();
    }
    if (typeof player1.representation === 'string' && player1.representation.trim()) {
      team.player1.representation = player1.representation.trim();
    }
    if (typeof player1.level === 'string' && player1.level.trim()) {
      team.player1.level = player1.level.trim();
    }
    if (team.player1Id) {
      const part1 = store.participants.find((p) => p.id === team.player1Id);
      if (part1) {
        part1.name = team.player1.name;
        if (team.player1.region) part1.region = team.player1.region;
        if (team.player1.representation) part1.representation = team.player1.representation;
        part1.level = team.player1.level;
        part1.categoryId = team.categoryId;
      }
    }
  }
  if (player2?.name?.trim()) {
    team.player2.name = player2.name.trim();
    if (typeof player2.region === 'string' && player2.region.trim()) {
      team.player2.region = player2.region.trim();
    }
    if (typeof player2.representation === 'string' && player2.representation.trim()) {
      team.player2.representation = player2.representation.trim();
    }
    if (typeof player2.level === 'string' && player2.level.trim()) {
      team.player2.level = player2.level.trim();
    }
    if (team.player2Id) {
      const part2 = store.participants.find((p) => p.id === team.player2Id);
      if (part2) {
        part2.name = team.player2.name;
        if (team.player2.region) part2.region = team.player2.region;
        if (team.player2.representation) part2.representation = team.player2.representation;
        part2.level = team.player2.level;
        part2.categoryId = team.categoryId;
      }
    }
  }
  if (typeof teamName === 'string') {
    team.teamName = teamName.trim()
      ? teamName.trim()
      : buildDefaultPairName(team.player1.name, team.player2.name);
  }

  touchStoreRevision(store);
  saveStore(store);
  broadcastState();
  res.json({ team, state: getPublicState(store) });
});

// Delete / unpair a team (Admin only; supports ?cascade=true to remove linked matches)
app.delete('/api/teams/:id', requireAdmin, (req, res) => {
  const store = loadStore();
  const teamExists = store.teams.some((t) => t.id === req.params.id);
  if (!teamExists) {
    res.status(404).json({ error: 'Pasangan tidak ditemukan.' });
    return;
  }

  const linkedMatches = store.matches.filter(
    (m) => m.teamAId === req.params.id || m.teamBId === req.params.id
  );
  const cascade = req.query.cascade === 'true';

  if (linkedMatches.length > 0 && !cascade) {
    res.status(409).json({
      error: `Pasangan ini terhubung ke ${linkedMatches.length} jadwal pertandingan. Konfirmasi untuk melepas pasangan beserta jadwal terkait.`,
      linkedMatchCount: linkedMatches.length,
    });
    return;
  }

  if (cascade && linkedMatches.length > 0) {
    store.matches = store.matches.filter(
      (m) => m.teamAId !== req.params.id && m.teamBId !== req.params.id
    );
  }

  store.teams = store.teams.filter((t) => t.id !== req.params.id);
  touchStoreRevision(store);
  saveStore(store);
  broadcastState();
  res.json({ state: getPublicState(store) });
});

// Create manual match pairing & schedule (Admin only)
app.post('/api/matches', requireAdmin, async (req, res) => {
  const store = loadStore();
  const {
    categoryId,
    stage,
    teamAId,
    teamBId,
    courtId,
    scheduledDate,
    scheduledTime,
    ignoreConflict,
    notifyWhatsApp = true,
  } = req.body ?? {};

  if (!categoryId || !teamAId || !teamBId || teamAId === teamBId) {
    res.status(400).json({ error: 'Pilih kategori dan dua pasangan yang berbeda.' });
    return;
  }

  const teamA = store.teams.find((t) => t.id === teamAId);
  const teamB = store.teams.find((t) => t.id === teamBId);
  const category = store.categories.find((c) => c.id === categoryId);
  if (!teamA || !teamB || !category) {
    res.status(400).json({ error: 'Data kategori atau pasangan tidak ditemukan.' });
    return;
  }

  const dateVal = scheduledDate || store.tournament.startDate;
  const timeVal = scheduledTime || '09:00';
  const resolvedCourtId = courtId || null;

  if (!ignoreConflict) {
    const conflict = detectScheduleConflict(store.matches, {
      courtId: resolvedCourtId,
      scheduledDate: dateVal,
      scheduledTime: timeVal,
      teamAId,
      teamBId,
    });
    if (conflict) {
      res.status(409).json({ error: conflict.message, conflict });
      return;
    }
  }

  const maxNumber = store.matches.reduce((max, m) => Math.max(max, m.matchNumber), 0);
  const newMatch: Match = {
    id: `match-${crypto.randomUUID().slice(0, 8)}`,
    categoryId,
    stage: typeof stage === 'string' && stage.trim() ? stage.trim() : 'Fase Grup',
    matchNumber: maxNumber + 1,
    teamAId,
    teamBId,
    courtId: resolvedCourtId,
    scheduledDate: dateVal,
    scheduledTime: timeVal,
    status: 'scheduled',
    score: createInitialScore(store.tournament.goldenPointDefault),
    updatedAt: new Date().toISOString(),
  };

  store.matches.push(newMatch);

  if (notifyWhatsApp && store.whatsappConfig.autoNotifyOnScheduleChange) {
    const courtName =
      store.courts.find((c) => c.id === resolvedCourtId)?.name || 'Court Belum Ditentukan';
    const logs = await dispatchMatchWhatsAppNotifications({
      tournamentName: store.tournament.name,
      venue: store.tournament.venue,
      match: newMatch,
      teamA,
      teamB,
      courtName,
      categoryName: category.name,
      eventType: 'scheduled',
      publicUrl: getBasePublicUrl(req),
      config: store.whatsappConfig,
      token: store._secrets?.token || '',
    });
    store.whatsappLogs.unshift(...logs);
  }

  touchStoreRevision(store);
  saveStore(store);
  broadcastState();
  res.status(201).json({ match: newMatch, state: getPublicState(store) });
});

// Auto-generate pairings for a category (Admin only)
app.post('/api/matches/auto-pair', requireAdmin, async (req, res) => {
  const store = loadStore();
  const { categoryId, mode = 'round_robin', stage, scheduledDate, startTime = '09:00' } =
    req.body ?? {};

  const category = store.categories.find((c) => c.id === categoryId);
  if (!category) {
    res.status(400).json({ error: 'Kategori tidak ditemukan.' });
    return;
  }

  const candidates =
    mode === 'knockout'
      ? generateKnockoutPairings(store.teams, categoryId, stage || 'Babak Gugur')
      : generateRoundRobinPairings(store.teams, categoryId, store.matches, stage || 'Fase Grup');

  if (candidates.length === 0) {
    res.status(400).json({
      error: 'Tidak ada pasangan baru yang dapat di-pairing (minimal 2 pasangan aktif atau semua pairing sudah dibuat).',
    });
    return;
  }

  const dateVal = scheduledDate || store.tournament.startDate;
  const [baseH, baseM] = String(startTime).split(':').map((n) => Number.parseInt(n, 10) || 0);
  let nextMatchNum = store.matches.reduce((max, m) => Math.max(max, m.matchNumber), 0);
  const createdMatches: Match[] = [];

  for (let idx = 0; idx < candidates.length; idx++) {
    const cand = candidates[idx];
    const court = store.courts[idx % Math.max(1, store.courts.length)] ?? null;
    const slotOffset = Math.floor(idx / Math.max(1, store.courts.length)) * 60;
    const totalMinutes = baseH * 60 + baseM + slotOffset;
    const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
    const mm = String(totalMinutes % 60).padStart(2, '0');

    nextMatchNum += 1;
    const match: Match = {
      id: `match-${crypto.randomUUID().slice(0, 8)}`,
      categoryId,
      stage: cand.stage,
      matchNumber: nextMatchNum,
      teamAId: cand.teamAId,
      teamBId: cand.teamBId,
      courtId: court?.id ?? null,
      scheduledDate: dateVal,
      scheduledTime: `${hh}:${mm}`,
      status: 'scheduled',
      score: createInitialScore(store.tournament.goldenPointDefault),
      updatedAt: new Date().toISOString(),
    };

    store.matches.push(match);
    createdMatches.push(match);

    if (store.whatsappConfig.autoNotifyOnScheduleChange) {
      const teamA = store.teams.find((t) => t.id === match.teamAId);
      const teamB = store.teams.find((t) => t.id === match.teamBId);
      if (teamA && teamB) {
        const logs = await dispatchMatchWhatsAppNotifications({
          tournamentName: store.tournament.name,
          venue: store.tournament.venue,
          match,
          teamA,
          teamB,
          courtName: court?.name || 'Court Menyusul',
          categoryName: category.name,
          eventType: 'scheduled',
          publicUrl: getBasePublicUrl(req),
          config: store.whatsappConfig,
          token: store._secrets?.token || '',
        });
        store.whatsappLogs.unshift(...logs);
      }
    }
  }

  touchStoreRevision(store);
  saveStore(store);
  broadcastState();
  res.status(201).json({ createdCount: createdMatches.length, state: getPublicState(store) });
});

// Update match court / schedule / status -> Triggers automatic WhatsApp notifications (Admin only)
app.put('/api/matches/:id/schedule', requireAdmin, async (req, res) => {
  const store = loadStore();
  const match = store.matches.find((m) => m.id === req.params.id);
  if (!match) {
    res.status(404).json({ error: 'Pertandingan tidak ditemukan.' });
    return;
  }

  const {
    courtId,
    scheduledDate,
    scheduledTime,
    status,
    stage,
    teamAId,
    teamBId,
    ignoreConflict,
    notifyWhatsApp = true,
  } = req.body ?? {};

  const nextCourtId = courtId !== undefined ? courtId : match.courtId;
  const nextDate = scheduledDate ?? match.scheduledDate;
  const nextTime = scheduledTime ?? match.scheduledTime;
  const nextTeamAId =
    teamAId && store.teams.some((t) => t.id === teamAId) ? teamAId : match.teamAId;
  const nextTeamBId =
    teamBId && store.teams.some((t) => t.id === teamBId) ? teamBId : match.teamBId;

  if (!ignoreConflict) {
    const conflict = detectScheduleConflict(store.matches, {
      id: match.id,
      courtId: nextCourtId,
      scheduledDate: nextDate,
      scheduledTime: nextTime,
      teamAId: nextTeamAId,
      teamBId: nextTeamBId,
    });
    if (conflict) {
      res.status(409).json({ error: conflict.message, conflict });
      return;
    }
  }

  match.teamAId = nextTeamAId;
  match.teamBId = nextTeamBId;

  const prevCourtId = match.courtId;
  const prevStatus = match.status;

  match.courtId = nextCourtId;
  match.scheduledDate = nextDate;
  match.scheduledTime = nextTime;
  if (typeof stage === 'string' && stage.trim()) match.stage = stage.trim();
  if (status && ['scheduled', 'live', 'completed', 'postponed'].includes(status)) {
    match.status = status as MatchStatus;
  }
  match.updatedAt = new Date().toISOString();

  let generatedLogs = 0;
  if (notifyWhatsApp && store.whatsappConfig.autoNotifyOnScheduleChange) {
    const teamA = store.teams.find((t) => t.id === match.teamAId);
    const teamB = store.teams.find((t) => t.id === match.teamBId);
    const category = store.categories.find((c) => c.id === match.categoryId);
    const courtName =
      store.courts.find((c) => c.id === match.courtId)?.name || 'Court Belum Ditentukan';

    if (teamA && teamB && category) {
      let eventType: WhatsAppEventType = 'updated';
      if (match.status === 'live' && prevStatus !== 'live') {
        eventType = 'called_to_court';
      } else if (match.courtId !== prevCourtId) {
        eventType = 'court_changed';
      }

      const logs = await dispatchMatchWhatsAppNotifications({
        tournamentName: store.tournament.name,
        venue: store.tournament.venue,
        match,
        teamA,
        teamB,
        courtName,
        categoryName: category.name,
        eventType,
        publicUrl: getBasePublicUrl(req),
        config: store.whatsappConfig,
        token: store._secrets?.token || '',
      });
      store.whatsappLogs.unshift(...logs);
      generatedLogs = logs.length;
    }
  }

  touchStoreRevision(store);
  saveStore(store);
  broadcastState();
  res.json({ match, generatedLogs, state: getPublicState(store) });
});

// Operator score updates -> Broadcasts instantaneously via SSE (Admin only)
app.put('/api/matches/:id/score', requireAdmin, (req, res) => {
  const store = loadStore();
  const match = store.matches.find((m) => m.id === req.params.id);
  if (!match) {
    res.status(404).json({ error: 'Pertandingan tidak ditemukan.' });
    return;
  }

  const { score, status } = req.body ?? {};
  if (score) {
    match.score = score;
  }
  if (status && ['scheduled', 'live', 'completed', 'postponed'].includes(status)) {
    match.status = status as MatchStatus;
  } else if (match.score.winnerSide && match.status !== 'completed') {
    match.status = 'completed';
  }
  match.updatedAt = new Date().toISOString();

  touchStoreRevision(store);
  saveStore(store);
  broadcastState();
  res.json({ match, state: getPublicState(store) });
});

// Delete match (Admin only)
app.delete('/api/matches/:id', requireAdmin, (req, res) => {
  const store = loadStore();
  store.matches = store.matches.filter((m) => m.id !== req.params.id);
  touchStoreRevision(store);
  saveStore(store);
  broadcastState();
  res.json({ state: getPublicState(store) });
});

// Add court (Admin only)
app.post('/api/courts', requireAdmin, (req, res) => {
  const store = loadStore();
  const { name, surface, isIndoor } = req.body ?? {};
  if (!name?.trim()) {
    res.status(400).json({ error: 'Nama court wajib diisi.' });
    return;
  }
  const cleanName = String(name).replace(/\s*\(Indoor\)/gi, '').trim();
  const newCourt = {
    id: `court-${crypto.randomUUID().slice(0, 8)}`,
    name: cleanName || name.trim(),
    surface: typeof surface === 'string' && surface.trim() ? surface.trim() : 'Indoor',
    isIndoor: Boolean(isIndoor ?? true),
  };
  store.courts.push(newCourt);
  touchStoreRevision(store);
  saveStore(store);
  broadcastState();
  res.status(201).json({ court: newCourt, state: getPublicState(store) });
});

// Update tournament bracket for a category (Admin only)
app.put('/api/brackets/:categoryId', requireAdmin, (req, res) => {
  const store = loadStore();
  const categoryId = req.params.categoryId;
  store.brackets = mergeWithDefaultBrackets(store.brackets);
  const idx = store.brackets.findIndex((b) => b.categoryId === categoryId || b.id === categoryId);
  if (idx === -1) {
    res.status(404).json({ error: 'Bagan kategori tidak ditemukan.' });
    return;
  }

  const existing = store.brackets[idx];
  const body = req.body ?? {};
  const nextSlots: BracketSlot[] = Array.isArray(body.slots)
    ? body.slots.slice(0, 24).map((s: BracketSlot, sIdx: number) => ({
        ...(existing.slots[sIdx] || {}),
        ...s,
        teamAName: String(s.teamAName ?? '').slice(0, 160),
        teamBName: String(s.teamBName ?? '').slice(0, 160),
        teamAId: typeof s.teamAId === 'string' && s.teamAId.trim() ? s.teamAId.trim().slice(0, 64) : null,
        teamBId: typeof s.teamBId === 'string' && s.teamBId.trim() ? s.teamBId.trim().slice(0, 64) : null,
        linkedMatchId:
          typeof s.linkedMatchId === 'string' && s.linkedMatchId.trim()
            ? s.linkedMatchId.trim().slice(0, 64)
            : null,
        scoreA: String(s.scoreA ?? '').slice(0, 20),
        scoreB: String(s.scoreB ?? '').slice(0, 20),
        winnerSide: s.winnerSide === 'A' || s.winnerSide === 'B' ? s.winnerSide : null,
      }))
    : existing.slots;

  const updatedRaw: CategoryBracket = {
    ...existing,
    title: typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 100) : existing.title,
    subtitle:
      typeof body.subtitle === 'string' && body.subtitle.trim()
        ? body.subtitle.trim().slice(0, 160)
        : existing.subtitle,
    slots: nextSlots,
    championName:
      typeof body.championName === 'string' ? body.championName.slice(0, 160) : existing.championName,
    ...(existing.thirdPlaceTitle !== undefined
      ? {
          thirdPlaceName:
            typeof body.thirdPlaceName === 'string'
              ? body.thirdPlaceName.slice(0, 160)
              : existing.thirdPlaceName || '',
        }
      : {}),
    ...(typeof body.footerNote === 'string' ? { footerNote: body.footerNote.slice(0, 300) } : {}),
    updatedAt: new Date().toISOString(),
  };

  const updated = syncBracketWithTeamsAndMatches(updatedRaw, store.teams, store.matches);
  store.brackets[idx] = updated;
  store.brackets = syncAllBracketsWithTeamsAndMatches(store.brackets, store.teams, store.matches);
  touchStoreRevision(store);
  saveStore(store);
  broadcastState();
  res.json({ bracket: store.brackets[idx], state: getPublicState(store) });
});

// Reset a single category bracket back to PDF defaults (Admin only)
app.post('/api/brackets/:categoryId/reset', requireAdmin, (req, res) => {
  const store = loadStore();
  const categoryId = req.params.categoryId;
  const def = cloneInitialBrackets().find(
    (b) => b.categoryId === categoryId || b.id === categoryId
  );
  if (!def) {
    res.status(404).json({ error: 'Bagan kategori tidak ditemukan.' });
    return;
  }
  store.brackets = mergeWithDefaultBrackets(store.brackets).map((b) =>
    b.categoryId === def.categoryId ? def : b
  );
  touchStoreRevision(store);
  saveStore(store);
  broadcastState();
  res.json({ bracket: def, state: getPublicState(store) });
});

// Configure WhatsApp Gateway (Admin only)
app.post('/api/whatsapp/config', requireAdmin, (req, res) => {
  const store = loadStore();
  const { provider, autoNotifyOnScheduleChange, webhookUrl, token, phoneNumberId } =
    req.body ?? {};

  if (provider && ['simulated', 'fonnte', 'meta_cloud', 'webhook'].includes(provider)) {
    store.whatsappConfig.provider = provider as WhatsAppProvider;
  }
  if (typeof autoNotifyOnScheduleChange === 'boolean') {
    store.whatsappConfig.autoNotifyOnScheduleChange = autoNotifyOnScheduleChange;
  }
  if (typeof webhookUrl === 'string') {
    store.whatsappConfig.webhookUrl = webhookUrl.trim();
  }
  if (typeof phoneNumberId === 'string') {
    store.whatsappConfig.phoneNumberId = phoneNumberId.trim();
  }
  if (typeof token === 'string' && token.trim().length > 0) {
    store._secrets = {
      ...store._secrets,
      token: token.trim(),
    };
    store.whatsappConfig.hasToken = true;
  }

  saveStore(store);
  broadcastState();
  res.json({ state: getPublicState(store) });
});

// Send manual or test WhatsApp notification (Admin only)
app.post('/api/whatsapp/test', requireAdmin, async (req, res) => {
  const store = loadStore();
  const { recipientName, recipientNumber, message, matchId } = req.body ?? {};

  if (!isValidWhatsAppNumber(recipientNumber || '')) {
    res.status(400).json({ error: 'Nomor WhatsApp tujuan tidak valid.' });
    return;
  }

  const log = await dispatchSingleWhatsAppMessage({
    recipientName: recipientName?.trim() || 'Peserta Turnamen',
    recipientNumber,
    message:
      message?.trim() ||
      `*INFO TURNAMEN*\n${store.tournament.name} — Uji koneksi sistem notifikasi otomatis WhatsApp berhasil.`,
    matchId: matchId || null,
    eventType: 'test',
    config: store.whatsappConfig,
    token: store._secrets?.token || '',
  });

  store.whatsappLogs.unshift(log);
  saveStore(store);
  broadcastState();
  res.status(201).json({ log, state: getPublicState(store) });
});

// Reset demo seed data (Admin only)
app.post('/api/reset-demo', requireAdmin, (_req, res) => {
  const fresh = resetSeedStore();
  broadcastState();
  res.json({ state: getPublicState(fresh) });
});

async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`PadelLeague server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
