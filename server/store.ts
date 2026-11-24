import fs from 'node:fs';
import path from 'node:path';
import type {
  TournamentState,
  WhatsAppProvider,
} from '../src/types/tournament.ts';

export interface ServerWhatsAppSecrets {
  token: string;
}

interface PersistedData extends TournamentState {
  _secrets?: ServerWhatsAppSecrets;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'tournament.json');

function createSeedState(): PersistedData {
  const today = '2026-11-24';
  const envProvider = (process.env.WHATSAPP_PROVIDER as WhatsAppProvider) || 'simulated';

  return {
    tournament: {
      id: 'pls-2026',
      name: 'Padel League & Share',
      caption: 'Padel Turnamen & Awarding Retail Sales Sulawesi Edition',
      slug: 'padel-league-and-share',
      venue: 'Beach Padel Makassar',
      city: 'Makassar',
      startDate: '2026-11-27',
      endDate: '2026-11-27',
      scoringFormat: 'best_of_3',
      goldenPointDefault: true,
    },
    categories: [
      { id: 'cat-mens-open', name: "Men's Open", level: 'Level A / Pro', maxTeams: 16, entryFee: 850000 },
      { id: 'cat-womens-open', name: "Women's Open", level: 'Level A / B', maxTeams: 16, entryFee: 750000 },
      { id: 'cat-mixed', name: 'Mixed Doubles', level: 'Open Mix', maxTeams: 16, entryFee: 800000 },
      { id: 'cat-bronze', name: 'Bronze / Pemula', level: 'Beginner - Low Int', maxTeams: 16, entryFee: 650000 },
    ],
    courts: [
      { id: 'court-1', name: 'Court 1 · Center Panoramic', surface: 'Mondo Supercourt Blue', isIndoor: true },
      { id: 'court-2', name: 'Court 2 · North Glass', surface: 'Mondo Supercourt Blue', isIndoor: true },
      { id: 'court-3', name: 'Court 3 · South Arena', surface: 'WPT Pro Turf', isIndoor: false },
      { id: 'court-4', name: 'Court 4 · Club Court', surface: 'WPT Pro Turf', isIndoor: false },
    ],
    teams: [
      {
        id: 'team-1',
        categoryId: 'cat-mens-open',
        teamName: 'Raka / Dimas',
        club: 'Senayan Padel',
        seed: 1,
        status: 'checked_in',
        player1: { name: 'Raka Pratama', whatsapp: '6281290112233', level: 'Pro' },
        player2: { name: 'Dimas Wijaya', whatsapp: '6281290112244', level: 'Pro' },
        createdAt: '2026-11-20T09:00:00.000Z',
      },
      {
        id: 'team-2',
        categoryId: 'cat-mens-open',
        teamName: 'Kevin /Bagas',
        club: 'Kemang Smash',
        seed: 2,
        status: 'checked_in',
        player1: { name: 'Kevin Gunawan', whatsapp: '6281388001122', level: 'Level A' },
        player2: { name: 'Bagas Aditya', whatsapp: '6281388001133', level: 'Level A' },
        createdAt: '2026-11-20T10:15:00.000Z',
      },
      {
        id: 'team-3',
        categoryId: 'cat-mens-open',
        teamName: 'Reza / Andre',
        club: 'PIK Padel Club',
        seed: 3,
        status: 'checked_in',
        player1: { name: 'Reza Mahendra', whatsapp: '6281177223344', level: 'Level A' },
        player2: { name: 'Andre Tanoto', whatsapp: '6281177223355', level: 'Level A' },
        createdAt: '2026-11-20T11:30:00.000Z',
      },
      {
        id: 'team-4',
        categoryId: 'cat-mens-open',
        teamName: 'Bima / Farhan',
        club: 'SCBD Court',
        seed: 4,
        status: 'checked_in',
        player1: { name: 'Bima Santoso', whatsapp: '6281766554433', level: 'Level A' },
        player2: { name: 'Farhan Hakim', whatsapp: '6281766554422', level: 'Level A' },
        createdAt: '2026-11-20T14:00:00.000Z',
      },
      {
        id: 'team-5',
        categoryId: 'cat-womens-open',
        teamName: 'Nadia / Clarissa',
        club: 'Senayan Padel',
        seed: 1,
        status: 'checked_in',
        player1: { name: 'Nadia Kusuma', whatsapp: '6281211998877', level: 'Level A' },
        player2: { name: 'Clarissa Halim', whatsapp: '6281211998866', level: 'Level A' },
        createdAt: '2026-11-21T08:30:00.000Z',
      },
      {
        id: 'team-6',
        categoryId: 'cat-womens-open',
        teamName: 'Salsa / Maya',
        club: 'Menteng Club',
        seed: 2,
        status: 'checked_in',
        player1: { name: 'Salsa Putri', whatsapp: '6281544332211', level: 'Level A' },
        player2: { name: 'Maya Lestari', whatsapp: '6281544332200', level: 'Level B' },
        createdAt: '2026-11-21T09:45:00.000Z',
      },
      {
        id: 'team-7',
        categoryId: 'cat-womens-open',
        teamName: 'Tania / Bella',
        club: 'PIK Padel Club',
        seed: 3,
        status: 'registered',
        player1: { name: 'Tania Wijaya', whatsapp: '6281899776655', level: 'Level B' },
        player2: { name: 'Bella Kartika', whatsapp: '6281899776644', level: 'Level B' },
        createdAt: '2026-11-21T13:20:00.000Z',
      },
      {
        id: 'team-8',
        categoryId: 'cat-womens-open',
        teamName: 'Ayu / Dinda',
        club: 'Pondok Indah',
        seed: 4,
        status: 'checked_in',
        player1: { name: 'Ayu Permata', whatsapp: '6281912345670', level: 'Level B' },
        player2: { name: 'Dinda Larasati', whatsapp: '6281912345671', level: 'Level B' },
        createdAt: '2026-11-21T15:00:00.000Z',
      },
      {
        id: 'team-9',
        categoryId: 'cat-mixed',
        teamName: 'Dion / Vanessa',
        club: 'Kemang Smash',
        seed: 1,
        status: 'checked_in',
        player1: { name: 'Dion Kurniawan', whatsapp: '6281233445566', level: 'Open' },
        player2: { name: 'Vanessa Lim', whatsapp: '6281233445577', level: 'Open' },
        createdAt: '2026-11-22T10:00:00.000Z',
      },
      {
        id: 'team-10',
        categoryId: 'cat-mixed',
        teamName: 'Gilang / Kezia',
        club: 'SCBD Court',
        seed: 2,
        status: 'checked_in',
        player1: { name: 'Gilang Ramadhan', whatsapp: '6281677889900', level: 'Open' },
        player2: { name: 'Kezia Natalia', whatsapp: '6281677889911', level: 'Open' },
        createdAt: '2026-11-22T11:10:00.000Z',
      },
      {
        id: 'team-11',
        categoryId: 'cat-bronze',
        teamName: 'Yoga / Fajar',
        club: 'Bintaro Padel',
        seed: 1,
        status: 'checked_in',
        player1: { name: 'Yoga Pradipta', whatsapp: '6281255667788', level: 'Beginner' },
        player2: { name: 'Fajar Nugroho', whatsapp: '6281255667799', level: 'Beginner' },
        createdAt: '2026-11-22T14:30:00.000Z',
      },
      {
        id: 'team-12',
        categoryId: 'cat-bronze',
        teamName: 'Ilham / Rama',
        club: 'Depok Arena',
        seed: 2,
        status: 'registered',
        player1: { name: 'Ilham Saputra', whatsapp: '6281322114455', level: 'Beginner' },
        player2: { name: 'Rama Hidayat', whatsapp: '6281322114466', level: 'Beginner' },
        createdAt: '2026-11-22T16:00:00.000Z',
      },
    ],
    matches: [
      {
        id: 'match-1',
        categoryId: 'cat-mens-open',
        stage: 'Fase Grup A',
        matchNumber: 1,
        teamAId: 'team-1',
        teamBId: 'team-3',
        courtId: 'court-1',
        scheduledDate: today,
        scheduledTime: '08:30',
        status: 'completed',
        score: {
          sets: [
            { teamA: 6, teamB: 3 },
            { teamA: 6, teamB: 4 },
          ],
          currentPointA: '0',
          currentPointB: '0',
          servingTeam: 'A',
          goldenPoint: true,
          isTiebreak: false,
          winnerSide: 'A',
        },
        updatedAt: '2026-11-24T09:40:00.000Z',
      },
      {
        id: 'match-2',
        categoryId: 'cat-mens-open',
        stage: 'Fase Grup A',
        matchNumber: 2,
        teamAId: 'team-2',
        teamBId: 'team-4',
        courtId: 'court-2',
        scheduledDate: today,
        scheduledTime: '08:30',
        status: 'completed',
        score: {
          sets: [
            { teamA: 6, teamB: 4 },
            { teamA: 4, teamB: 6 },
            { teamA: 6, teamB: 2 },
          ],
          currentPointA: '0',
          currentPointB: '0',
          servingTeam: 'B',
          goldenPoint: true,
          isTiebreak: false,
          winnerSide: 'A',
        },
        updatedAt: '2026-11-24T09:55:00.000Z',
      },
      {
        id: 'match-3',
        categoryId: 'cat-mens-open',
        stage: 'Fase Grup A',
        matchNumber: 3,
        teamAId: 'team-1',
        teamBId: 'team-2',
        courtId: 'court-1',
        scheduledDate: today,
        scheduledTime: '10:30',
        status: 'live',
        score: {
          sets: [
            { teamA: 6, teamB: 4 },
            { teamA: 4, teamB: 3 },
          ],
          currentPointA: '30',
          currentPointB: '15',
          servingTeam: 'A',
          goldenPoint: true,
          isTiebreak: false,
          winnerSide: null,
        },
        updatedAt: '2026-11-24T11:12:00.000Z',
      },
      {
        id: 'match-4',
        categoryId: 'cat-womens-open',
        stage: 'Fase Grup A',
        matchNumber: 4,
        teamAId: 'team-5',
        teamBId: 'team-6',
        courtId: 'court-2',
        scheduledDate: today,
        scheduledTime: '10:30',
        status: 'live',
        score: {
          sets: [
            { teamA: 5, teamB: 5 },
          ],
          currentPointA: '40',
          currentPointB: '40',
          servingTeam: 'B',
          goldenPoint: true,
          isTiebreak: false,
          winnerSide: null,
        },
        updatedAt: '2026-11-24T11:08:00.000Z',
      },
      {
        id: 'match-5',
        categoryId: 'cat-womens-open',
        stage: 'Fase Grup A',
        matchNumber: 5,
        teamAId: 'team-7',
        teamBId: 'team-8',
        courtId: 'court-3',
        scheduledDate: today,
        scheduledTime: '11:30',
        status: 'scheduled',
        score: {
          sets: [{ teamA: 0, teamB: 0 }],
          currentPointA: '0',
          currentPointB: '0',
          servingTeam: 'A',
          goldenPoint: true,
          isTiebreak: false,
          winnerSide: null,
        },
        updatedAt: '2026-11-24T08:00:00.000Z',
      },
      {
        id: 'match-6',
        categoryId: 'cat-mixed',
        stage: 'Final Pool',
        matchNumber: 6,
        teamAId: 'team-9',
        teamBId: 'team-10',
        courtId: 'court-1',
        scheduledDate: today,
        scheduledTime: '13:00',
        status: 'scheduled',
        score: {
          sets: [{ teamA: 0, teamB: 0 }],
          currentPointA: '0',
          currentPointB: '0',
          servingTeam: 'A',
          goldenPoint: true,
          isTiebreak: false,
          winnerSide: null,
        },
        updatedAt: '2026-11-24T08:00:00.000Z',
      },
      {
        id: 'match-7',
        categoryId: 'cat-mens-open',
        stage: 'Fase Grup A',
        matchNumber: 7,
        teamAId: 'team-3',
        teamBId: 'team-4',
        courtId: 'court-3',
        scheduledDate: today,
        scheduledTime: '13:00',
        status: 'scheduled',
        score: {
          sets: [{ teamA: 0, teamB: 0 }],
          currentPointA: '0',
          currentPointB: '0',
          servingTeam: 'A',
          goldenPoint: true,
          isTiebreak: false,
          winnerSide: null,
        },
        updatedAt: '2026-11-24T08:00:00.000Z',
      },
      {
        id: 'match-8',
        categoryId: 'cat-bronze',
        stage: 'Fase Grup A',
        matchNumber: 8,
        teamAId: 'team-11',
        teamBId: 'team-12',
        courtId: 'court-4',
        scheduledDate: today,
        scheduledTime: '14:00',
        status: 'scheduled',
        score: {
          sets: [{ teamA: 0, teamB: 0 }],
          currentPointA: '0',
          currentPointB: '0',
          servingTeam: 'A',
          goldenPoint: true,
          isTiebreak: false,
          winnerSide: null,
        },
        updatedAt: '2026-11-24T08:00:00.000Z',
      },
    ],
    whatsappLogs: [
      {
        id: 'wa-seed-1',
        matchId: 'match-3',
        eventType: 'called_to_court',
        recipientName: 'Raka Pratama',
        recipientNumber: '6281290112233',
        message:
          '*PANGGILAN MASUK COURT SEKARANG*\nPadel League & Share (Beach Padel Makassar)\n\nKategori: Men\'s Open · Fase Grup A\nMatch #3: *Raka / Dimas* vs *Kevin / Bagas*\nCourt: *Court 1 · Center Panoramic*\nJadwal: 2026-11-27 pukul 10:30 WITA',
        provider: envProvider,
        deliveryStatus: 'queued_wa_me',
        waMeUrl:
          'https://wa.me/6281290112233?text=PANGGILAN%20MASUK%20COURT%20SEKARANG%20-%20Match%20%233%20Court%201',
        createdAt: '2026-11-24T10:22:00.000Z',
      },
      {
        id: 'wa-seed-2',
        matchId: 'match-6',
        eventType: 'scheduled',
        recipientName: 'Dion Kurniawan',
        recipientNumber: '6281233445566',
        message:
          '*JADWAL PERTANDINGAN BARU*\nPadel League & Share (Beach Padel Makassar)\n\nKategori: Mixed Doubles · Final Pool\nMatch #6: *Dion / Vanessa* vs *Gilang / Kezia*\nCourt: *Court 1 · Center Panoramic*\nJadwal: 2026-11-27 pukul 13:00 WITA',
        provider: envProvider,
        deliveryStatus: 'queued_wa_me',
        waMeUrl:
          'https://wa.me/6281233445566?text=JADWAL%20PERTANDINGAN%20BARU%20-%20Match%20%236%20Court%201',
        createdAt: '2026-11-24T08:05:00.000Z',
      },
    ],
    whatsappConfig: {
      provider: envProvider,
      autoNotifyOnScheduleChange: true,
      webhookUrl: process.env.WHATSAPP_WEBHOOK_URL || '',
      hasToken: Boolean(process.env.WHATSAPP_API_TOKEN),
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    },
    _secrets: {
      token: process.env.WHATSAPP_API_TOKEN || '',
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
      // Fix team-2 typo if seeded previously
      for (const t of parsed.teams) {
        if (t.teamName === 'Kevin /Bagas') {
          t.teamName = 'Kevin / Bagas';
        }
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

export function saveStore(next: PersistedData): void {
  ensureDir();
  cachedState = next;
  const tmpFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmpFile, DATA_FILE);
}

export function getPublicState(data: PersistedData): TournamentState {
  const { _secrets: _unused, ...rest } = data;
  return {
    ...rest,
    whatsappConfig: {
      ...rest.whatsappConfig,
      hasToken: Boolean(_unused?.token || process.env.WHATSAPP_API_TOKEN),
    },
  };
}

export function resetSeedStore(): PersistedData {
  const seed = createSeedState();
  for (const t of seed.teams) {
    if (t.teamName === 'Kevin /Bagas') {
      t.teamName = 'Kevin / Bagas';
    }
  }
  saveStore(seed);
  return seed;
}
