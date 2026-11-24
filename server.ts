import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import type {
  Match,
  MatchStatus,
  Team,
  TeamStatus,
  WhatsAppEventType,
  WhatsAppProvider,
} from './src/types/tournament.ts';
import {
  createInitialScore,
  detectScheduleConflict,
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
} from './server/store.ts';
import {
  dispatchMatchWhatsAppNotifications,
  dispatchSingleWhatsAppMessage,
} from './server/whatsapp.ts';

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

// Register a new participant pair
app.post('/api/teams', (req, res) => {
  const store = loadStore();
  const { categoryId, teamName, club, seed, player1, player2 } = req.body ?? {};

  if (!categoryId || !store.categories.some((c) => c.id === categoryId)) {
    res.status(400).json({ error: 'Kategori turnamen tidak valid.' });
    return;
  }
  if (!player1?.name?.trim() || !player2?.name?.trim()) {
    res.status(400).json({ error: 'Nama Pemain 1 dan Pemain 2 wajib diisi.' });
    return;
  }
  if (!isValidWhatsAppNumber(player1.whatsapp || '') || !isValidWhatsAppNumber(player2.whatsapp || '')) {
    res.status(400).json({ error: 'Nomor WhatsApp kedua pemain wajib valid (10–15 digit).' });
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

  const computedName =
    typeof teamName === 'string' && teamName.trim().length > 0
      ? teamName.trim()
      : `${player1.name.trim().split(' ')[0]} / ${player2.name.trim().split(' ')[0]}`;

  const newTeam: Team = {
    id: `team-${crypto.randomUUID().slice(0, 8)}`,
    categoryId,
    teamName: computedName,
    club: typeof club === 'string' && club.trim() ? club.trim() : 'Independent',
    seed: typeof seed === 'number' && seed > 0 ? seed : null,
    status: 'registered',
    player1: {
      name: player1.name.trim(),
      whatsapp: normalizeWhatsAppNumber(player1.whatsapp),
      level: typeof player1.level === 'string' && player1.level.trim() ? player1.level.trim() : 'Open',
    },
    player2: {
      name: player2.name.trim(),
      whatsapp: normalizeWhatsAppNumber(player2.whatsapp),
      level: typeof player2.level === 'string' && player2.level.trim() ? player2.level.trim() : 'Open',
    },
    createdAt: new Date().toISOString(),
  };

  store.teams.push(newTeam);
  saveStore(store);
  broadcastState();
  res.status(201).json({ team: newTeam, state: getPublicState(store) });
});

// Update team details or check-in status
app.put('/api/teams/:id', (req, res) => {
  const store = loadStore();
  const team = store.teams.find((t) => t.id === req.params.id);
  if (!team) {
    res.status(404).json({ error: 'Pasangan tidak ditemukan.' });
    return;
  }

  const { status, teamName, club, seed, player1, player2, categoryId } = req.body ?? {};
  if (status && ['registered', 'checked_in', 'withdrawn'].includes(status)) {
    team.status = status as TeamStatus;
  }
  if (typeof teamName === 'string' && teamName.trim()) team.teamName = teamName.trim();
  if (typeof club === 'string' && club.trim()) team.club = club.trim();
  if (seed === null || (typeof seed === 'number' && seed > 0)) team.seed = seed;
  if (categoryId && store.categories.some((c) => c.id === categoryId)) {
    team.categoryId = categoryId;
  }
  if (player1?.name?.trim()) {
    team.player1.name = player1.name.trim();
    if (player1.whatsapp && isValidWhatsAppNumber(player1.whatsapp)) {
      team.player1.whatsapp = normalizeWhatsAppNumber(player1.whatsapp);
    }
    if (typeof player1.level === 'string' && player1.level.trim()) {
      team.player1.level = player1.level.trim();
    }
  }
  if (player2?.name?.trim()) {
    team.player2.name = player2.name.trim();
    if (player2.whatsapp && isValidWhatsAppNumber(player2.whatsapp)) {
      team.player2.whatsapp = normalizeWhatsAppNumber(player2.whatsapp);
    }
    if (typeof player2.level === 'string' && player2.level.trim()) {
      team.player2.level = player2.level.trim();
    }
  }

  saveStore(store);
  broadcastState();
  res.json({ team, state: getPublicState(store) });
});

// Delete a team if not yet in matches
app.delete('/api/teams/:id', (req, res) => {
  const store = loadStore();
  const inMatch = store.matches.some(
    (m) => m.teamAId === req.params.id || m.teamBId === req.params.id
  );
  if (inMatch) {
    res.status(400).json({
      error: 'Pasangan sudah memiliki jadwal pertandingan. Hapus pertandingan terkait terlebih dahulu.',
    });
    return;
  }
  store.teams = store.teams.filter((t) => t.id !== req.params.id);
  saveStore(store);
  broadcastState();
  res.json({ state: getPublicState(store) });
});

// Create manual match pairing & schedule
app.post('/api/matches', async (req, res) => {
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

  saveStore(store);
  broadcastState();
  res.status(201).json({ match: newMatch, state: getPublicState(store) });
});

// Auto-generate pairings for a category (round_robin or knockout)
app.post('/api/matches/auto-pair', async (req, res) => {
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

  saveStore(store);
  broadcastState();
  res.status(201).json({ createdCount: createdMatches.length, state: getPublicState(store) });
});

// Update match court / schedule / status -> Triggers automatic WhatsApp notifications
app.put('/api/matches/:id/schedule', async (req, res) => {
  const store = loadStore();
  const match = store.matches.find((m) => m.id === req.params.id);
  if (!match) {
    res.status(404).json({ error: 'Pertandingan tidak ditemukan.' });
    return;
  }

  const { courtId, scheduledDate, scheduledTime, status, stage, ignoreConflict, notifyWhatsApp = true } =
    req.body ?? {};

  const nextCourtId = courtId !== undefined ? courtId : match.courtId;
  const nextDate = scheduledDate ?? match.scheduledDate;
  const nextTime = scheduledTime ?? match.scheduledTime;

  if (!ignoreConflict) {
    const conflict = detectScheduleConflict(store.matches, {
      id: match.id,
      courtId: nextCourtId,
      scheduledDate: nextDate,
      scheduledTime: nextTime,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
    });
    if (conflict) {
      res.status(409).json({ error: conflict.message, conflict });
      return;
    }
  }

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

  saveStore(store);
  broadcastState();
  res.json({ match, generatedLogs, state: getPublicState(store) });
});

// Operator score updates -> Broadcasts instantaneously via SSE
app.put('/api/matches/:id/score', (req, res) => {
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

  saveStore(store);
  broadcastState();
  res.json({ match, state: getPublicState(store) });
});

// Delete match
app.delete('/api/matches/:id', (req, res) => {
  const store = loadStore();
  store.matches = store.matches.filter((m) => m.id !== req.params.id);
  saveStore(store);
  broadcastState();
  res.json({ state: getPublicState(store) });
});

// Add court
app.post('/api/courts', (req, res) => {
  const store = loadStore();
  const { name, surface, isIndoor } = req.body ?? {};
  if (!name?.trim()) {
    res.status(400).json({ error: 'Nama court wajib diisi.' });
    return;
  }
  const newCourt = {
    id: `court-${crypto.randomUUID().slice(0, 8)}`,
    name: name.trim(),
    surface: typeof surface === 'string' && surface.trim() ? surface.trim() : 'Mondo Supercourt',
    isIndoor: Boolean(isIndoor),
  };
  store.courts.push(newCourt);
  saveStore(store);
  broadcastState();
  res.status(201).json({ court: newCourt, state: getPublicState(store) });
});

// Configure WhatsApp Gateway
app.post('/api/whatsapp/config', (req, res) => {
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
    store._secrets = { token: token.trim() };
    store.whatsappConfig.hasToken = true;
  }

  saveStore(store);
  broadcastState();
  res.json({ state: getPublicState(store) });
});

// Send manual or test WhatsApp notification
app.post('/api/whatsapp/test', async (req, res) => {
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

// Reset demo seed data
app.post('/api/reset-demo', (_req, res) => {
  const fresh = resetSeedStore();
  broadcastState();
  res.json({ state: getPublicState(fresh) });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PadelLiga server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
