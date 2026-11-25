import fs from 'node:fs';
import path from 'node:path';
import { hashPassword } from './auth.ts';
import type {
  Participant,
  TournamentState,
  WhatsAppProvider,
} from '../src/types/tournament.ts';
import {
  cloneInitialBrackets,
  mergeWithDefaultBrackets,
  syncAllBracketsWithTeamsAndMatches,
} from '../src/utils/tournamentBracket.ts';
import { INITIAL_TOURNAMENT_SEED } from '../src/utils/tournamentSeed.ts';

export interface ServerSecrets {
  token: string;
  adminUsername?: string;
  adminPasswordHash?: string;
}

interface PersistedData extends TournamentState {
  _secrets?: ServerSecrets;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'tournament.json');

function createSeedState(): PersistedData {
  const envProvider = (process.env.WHATSAPP_PROVIDER as WhatsAppProvider) || 'simulated';
  return {
    ...INITIAL_TOURNAMENT_SEED,
    revision: 1,
    updatedAtMs: Date.now(),
    whatsappConfig: {
      provider: envProvider,
      autoNotifyOnScheduleChange: true,
      webhookUrl: process.env.WHATSAPP_WEBHOOK_URL || '',
      hasToken: Boolean(process.env.WHATSAPP_API_TOKEN),
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    },
    _secrets: {
      token: process.env.WHATSAPP_API_TOKEN || '',
      adminUsername: 'panitia',
      adminPasswordHash: hashPassword('padel2026'),
    },
  };
}

let cachedState: PersistedData | null = null;

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadStore(): PersistedData {
  if (cachedState) return cachedState;

  ensureDir();
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw) as PersistedData;

      // Automatically migrate to official 52 participants & 26 teams & 11 matches if legacy demo data is detected
      const hasOldDemoData =
        !Array.isArray(parsed.participants) ||
        parsed.participants.length !== INITIAL_TOURNAMENT_SEED.participants.length ||
        parsed.teams.some((t) => t.id === 'team-1');
      if (hasOldDemoData) {
        const secrets = parsed._secrets || {
          token: process.env.WHATSAPP_API_TOKEN || '',
          adminUsername: 'panitia',
          adminPasswordHash: hashPassword('padel2026'),
        };
        const fresh = createSeedState();
        fresh._secrets = secrets;
        fresh.revision = (parsed.revision || 0) + 1;
        fresh.updatedAtMs = Date.now();
        saveStore(fresh);
        cachedState = fresh;
        return fresh;
      }
      let migrated = false;
      for (const t of parsed.teams) {
        if (t.teamName === 'Kevin /Bagas') {
          t.teamName = 'Kevin / Bagas';
          migrated = true;
        }
      }
      if (!Array.isArray(parsed.participants)) {
        const derivedParticipants: Participant[] = [];
        for (const t of parsed.teams) {
          const regionFallback = t.region || t.club || 'Makassar';
          const p1Id = t.player1Id || `part-${t.id}-1`;
          const p2Id = t.player2Id || `part-${t.id}-2`;
          t.player1Id = p1Id;
          t.player2Id = p2Id;
          t.region = t.region || regionFallback;
          delete t.player1.whatsapp;
          delete t.player2.whatsapp;
          t.player1.region = t.player1.region || regionFallback;
          t.player2.region = t.player2.region || regionFallback;

          derivedParticipants.push(
            {
              id: p1Id,
              name: t.player1.name,
              region: t.player1.region,
              categoryId: t.categoryId,
              level: t.player1.level,
              status: t.status,
              createdAt: t.createdAt,
            },
            {
              id: p2Id,
              name: t.player2.name,
              region: t.player2.region,
              categoryId: t.categoryId,
              level: t.player2.level,
              status: t.status,
              createdAt: t.createdAt,
            }
          );
        }
        const seedExtra = createSeedState().participants.slice(-4);
        parsed.participants = [...derivedParticipants, ...seedExtra];
        migrated = true;
      }
      const seedParticipantsById = new Map(
        createSeedState().participants.map((p) => [p.id, p])
      );
      for (const p of parsed.participants) {
        if (!p.representation) {
          p.representation = seedParticipantsById.get(p.id)?.representation || 'Retail Sales';
          migrated = true;
        }
      }
      const participantRepById = new Map(
        parsed.participants.map((p) => [p.id, p.representation || 'Retail Sales'])
      );
      for (const t of parsed.teams) {
        if (!t.player1.representation) {
          t.player1.representation =
            (t.player1Id && participantRepById.get(t.player1Id)) || 'Retail Sales';
          migrated = true;
        }
        if (!t.player2.representation) {
          t.player2.representation =
            (t.player2Id && participantRepById.get(t.player2Id)) || 'Retail Sales';
          migrated = true;
        }
      }

      // Migrate legacy 5 categories to the 3 official categories
      const legacyCategoryMap: Record<string, string> = {
        'cat-bronze': 'cat-mens-beginner',
        'cat-mixed': 'cat-mens-beginner',
        'cat-mens-open': 'cat-mens-intermediate',
        'cat-double-man': 'cat-mens-intermediate',
        'cat-womens-open': 'cat-womens-doubles',
      };
      const canonicalCategories = createSeedState().categories;
      const canonicalCategoryIds = new Set(canonicalCategories.map((c) => c.id));
      if (
        !Array.isArray(parsed.categories) ||
        parsed.categories.length !== canonicalCategories.length ||
        parsed.categories.some((c) => !canonicalCategoryIds.has(c.id))
      ) {
        parsed.categories = canonicalCategories;
        for (const p of parsed.participants) {
          if (legacyCategoryMap[p.categoryId]) {
            p.categoryId = legacyCategoryMap[p.categoryId];
          } else if (!canonicalCategoryIds.has(p.categoryId)) {
            p.categoryId = 'cat-mens-beginner';
          }
        }
        for (const t of parsed.teams) {
          if (legacyCategoryMap[t.categoryId]) {
            t.categoryId = legacyCategoryMap[t.categoryId];
          } else if (!canonicalCategoryIds.has(t.categoryId)) {
            t.categoryId = 'cat-mens-beginner';
          }
        }
        for (const m of parsed.matches) {
          if (legacyCategoryMap[m.categoryId]) {
            m.categoryId = legacyCategoryMap[m.categoryId];
          } else if (!canonicalCategoryIds.has(m.categoryId)) {
            m.categoryId = 'cat-mens-beginner';
          }
        }
        migrated = true;
      }

      // Migrate legacy courts & strip (Indoor) / surface display labels -> Court 1, 2, 4, 5 only
      const canonicalCourts = createSeedState().courts;
      const hasLegacyCourt =
        !Array.isArray(parsed.courts) ||
        parsed.courts.some(
          (c) =>
            c.id === 'court-3' ||
            c.name.includes('(Indoor)') ||
            c.name.includes('Center Panoramic') ||
            c.name.includes('North Glass') ||
            c.name.includes('South Arena') ||
            c.name.includes('Club Court') ||
            c.surface.includes('Mondo')
        );
      if (hasLegacyCourt) {
        const hadCourt3 = parsed.courts?.some((c) => c.id === 'court-3');
        const hadCourt5 = parsed.courts?.some((c) => c.id === 'court-5');
        const canonicalIds = new Set(canonicalCourts.map((c) => c.id));
        const customCourts = Array.isArray(parsed.courts)
          ? parsed.courts
              .filter((c) => !canonicalIds.has(c.id) && c.id !== 'court-3')
              .map((c) => ({
                ...c,
                name: c.name.replace(/\s*\(Indoor\)/gi, '').trim() || c.name,
              }))
          : [];
        parsed.courts = [...canonicalCourts, ...customCourts];
        for (const m of parsed.matches) {
          if (m.courtId === 'court-3') {
            m.courtId = 'court-4';
          } else if (hadCourt3 && !hadCourt5 && m.courtId === 'court-4') {
            m.courtId = 'court-5';
          }
        }
        migrated = true;
      }

      if (!Array.isArray(parsed.brackets) || parsed.brackets.length !== 3) {
        parsed.brackets = mergeWithDefaultBrackets(parsed.brackets);
        migrated = true;
      }
      if (typeof parsed.revision !== 'number') {
        parsed.revision = 0;
        migrated = true;
      }
      if (typeof parsed.updatedAtMs !== 'number') {
        parsed.updatedAtMs = 0;
        migrated = true;
      }

      if (parsed.tournament) {
        if (parsed.tournament.name === 'Padel League & Share') {
          parsed.tournament.name = 'Padel League & Share 2026';
          migrated = true;
        }
        if (
          parsed.tournament.caption &&
          (parsed.tournament.caption.includes('Retail Sales') ||
            parsed.tournament.caption.includes('Awarding') ||
            parsed.tournament.caption.includes('Padel Turnamen'))
        ) {
          parsed.tournament.caption = 'Sulawesi Edition';
          migrated = true;
        }
      }
      if (migrated) {
        saveStore(parsed);
      }
      cachedState = parsed;
      return cachedState;
    } catch {
      // Fall back to fresh seed if file corrupted
    }
  }

  const seed = createSeedState();
  for (const t of seed.teams) {
    if (t.teamName === 'Kevin /Bagas') {
      t.teamName = 'Kevin / Bagas';
    }
  }
  saveStore(seed);
  return seed;
}

export function touchStoreRevision(next: PersistedData): void {
  next.revision = (next.revision || 0) + 1;
  next.updatedAtMs = Date.now();
}

export function saveStore(next: PersistedData): void {
  ensureDir();
  next.brackets = syncAllBracketsWithTeamsAndMatches(
    mergeWithDefaultBrackets(next.brackets),
    next.teams || [],
    next.matches || []
  );
  cachedState = next;
  const tmpFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmpFile, DATA_FILE);
}

export function getPublicState(data: PersistedData): TournamentState {
  const { _secrets: _unused, ...rest } = data;
  return {
    ...rest,
    brackets: syncAllBracketsWithTeamsAndMatches(
      mergeWithDefaultBrackets(rest.brackets),
      rest.teams || [],
      rest.matches || []
    ),
    whatsappConfig: {
      ...rest.whatsappConfig,
      hasToken: Boolean(_unused?.token || process.env.WHATSAPP_API_TOKEN),
    },
  };
}

export function resetSeedStore(): PersistedData {
  const prev = loadStore();
  const existingSecrets = prev._secrets;
  const seed = createSeedState();
  seed.revision = (prev.revision || 0) + 1;
  seed.updatedAtMs = Date.now();
  if (existingSecrets) {
    seed._secrets = {
      token: existingSecrets.token || seed._secrets?.token || '',
      adminUsername: existingSecrets.adminUsername,
      adminPasswordHash: existingSecrets.adminPasswordHash,
    };
  }
  for (const t of seed.teams) {
    if (t.teamName === 'Kevin /Bagas') {
      t.teamName = 'Kevin / Bagas';
    }
  }
  saveStore(seed);
  return seed;
}
