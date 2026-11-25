import type {
  BracketSlot,
  CategoryBracket,
  Match,
  PadelScoreState,
  Team,
} from '../types/tournament.ts';

export const INITIAL_CATEGORY_BRACKETS: CategoryBracket[] = [
  {
    id: 'cat-mens-beginner',
    categoryId: 'cat-mens-beginner',
    title: "MEN'S BEGINNER",
    subtitle: 'SISTEM GUGUR · 9 TIM · 7 BYE / WILDCARD',
    rounds: ['PUTARAN PERTAMA (1)', 'PEREMPAT FINAL (4)', 'SEMIFINAL (2)', 'FINAL'],
    championTitle: 'JUARA 1',
    championName: '',
    thirdPlaceTitle: 'JUARA 3',
    thirdPlaceName: '',
    footerNote:
      'Garis semifinal hanya diarahkan ke final. Perebutan juara 3 tidak dihubungkan dengan garis.',
    updatedAt: '2026-11-25T00:00:00.000Z',
    slots: [
      {
        id: 'mb-m01',
        roundIndex: 0,
        roundLabel: 'PUTARAN PERTAMA',
        code: 'M-01',
        note: 'PEMENANG MASUK QF-4',
        teamALabel: 'Tim 1',
        teamBLabel: 'Tim 2',
        teamAName: 'Lukman Anas – Gazali Habibie Yunior',
        teamBName: 'Gaga Sulistio – Muh. Vehral Maretndra',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
      },
      {
        id: 'mb-qf1',
        roundIndex: 1,
        roundLabel: 'PEREMPAT FINAL',
        code: 'QF-1',
        note: 'PEREMPAT FINAL 1',
        teamALabel: 'BYE 1',
        teamBLabel: 'BYE 2',
        teamAName: 'Hafsanjani Arbi – Stanley Naranki Sitorus',
        teamBName: 'Abrianto Indra – Ady Faisal Prawidya',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
      },
      {
        id: 'mb-qf2',
        roundIndex: 1,
        roundLabel: 'PEREMPAT FINAL',
        code: 'QF-2',
        note: 'PEREMPAT FINAL 2',
        teamALabel: 'BYE 3',
        teamBLabel: 'BYE 4',
        teamAName: 'Hafizh Deannova Alfirizqi – Vincent Wijaya',
        teamBName: 'Deraldi Diyesa – Wawan Wahyudin',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
      },
      {
        id: 'mb-qf3',
        roundIndex: 1,
        roundLabel: 'PEREMPAT FINAL',
        code: 'QF-3',
        note: 'PEREMPAT FINAL 3',
        teamALabel: 'BYE 5',
        teamBLabel: 'BYE 6',
        teamAName: 'Didi Rushadi – Yudhistira',
        teamBName: 'Reza Fahlevi – Adri Yansyah',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
      },
      {
        id: 'mb-qf4',
        roundIndex: 1,
        roundLabel: 'PEREMPAT FINAL',
        code: 'QF-4',
        note: 'PEREMPAT FINAL 4',
        teamALabel: 'BYE 7',
        teamBLabel: 'M-01',
        teamAName: 'Akbar Ch. Iqbal – M. Hasbidin. HS',
        teamBName: 'PEMENANG M-01',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
        sourceB: {
          matchId: 'mb-m01',
          type: 'winner',
          placeholder: 'PEMENANG M-01',
        },
      },
      {
        id: 'mb-sf1',
        roundIndex: 2,
        roundLabel: 'SEMIFINAL',
        code: 'SF-1',
        note: 'SEMIFINAL 1',
        teamALabel: 'QF-1',
        teamBLabel: 'QF-2',
        teamAName: 'PEMENANG QF-1',
        teamBName: 'PEMENANG QF-2',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
        sourceA: {
          matchId: 'mb-qf1',
          type: 'winner',
          placeholder: 'PEMENANG QF-1',
        },
        sourceB: {
          matchId: 'mb-qf2',
          type: 'winner',
          placeholder: 'PEMENANG QF-2',
        },
      },
      {
        id: 'mb-sf2',
        roundIndex: 2,
        roundLabel: 'SEMIFINAL',
        code: 'SF-2',
        note: 'SEMIFINAL 2',
        teamALabel: 'QF-3',
        teamBLabel: 'QF-4',
        teamAName: 'PEMENANG QF-3',
        teamBName: 'PEMENANG QF-4',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
        sourceA: {
          matchId: 'mb-qf3',
          type: 'winner',
          placeholder: 'PEMENANG QF-3',
        },
        sourceB: {
          matchId: 'mb-qf4',
          type: 'winner',
          placeholder: 'PEMENANG QF-4',
        },
      },
      {
        id: 'mb-final',
        roundIndex: 3,
        roundLabel: 'FINAL',
        code: 'FINAL',
        note: 'PARTAI PUNCAK',
        teamALabel: 'SF-1',
        teamBLabel: 'SF-2',
        teamAName: 'PEMENANG SF-1',
        teamBName: 'PEMENANG SF-2',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
        sourceA: {
          matchId: 'mb-sf1',
          type: 'winner',
          placeholder: 'PEMENANG SF-1',
        },
        sourceB: {
          matchId: 'mb-sf2',
          type: 'winner',
          placeholder: 'PEMENANG SF-2',
        },
      },
      {
        id: 'mb-3rd',
        roundIndex: 3,
        roundLabel: 'PEREBUTAN JUARA 3',
        code: 'JUARA 3',
        note: 'PEREBUTAN JUARA 3',
        teamALabel: 'KALAH SF-1',
        teamBLabel: 'KALAH SF-2',
        teamAName: 'KALAH SF-1',
        teamBName: 'KALAH SF-2',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
        isThirdPlace: true,
        sourceA: {
          matchId: 'mb-sf1',
          type: 'loser',
          placeholder: 'KALAH SF-1',
        },
        sourceB: {
          matchId: 'mb-sf2',
          type: 'loser',
          placeholder: 'KALAH SF-2',
        },
      },
    ],
  },
  {
    id: 'cat-mens-intermediate',
    categoryId: 'cat-mens-intermediate',
    title: "MEN'S INTERMEDIATE",
    subtitle: 'SISTEM GUGUR · 11 TIM · 5 BYE / WILDCARD',
    rounds: ['PUTARAN PERTAMA (3)', 'PEREMPAT FINAL (4)', 'SEMIFINAL (2)', 'FINAL'],
    championTitle: 'JUARA',
    championName: '',
    updatedAt: '2026-11-25T00:00:00.000Z',
    slots: [
      {
        id: 'mi-awal1',
        roundIndex: 0,
        roundLabel: 'PUTARAN PERTAMA',
        code: 'AWAL 1',
        note: 'PEMENANG MASUK QF 3',
        teamALabel: 'Tim 1',
        teamBLabel: 'Tim 2',
        teamAName: 'Boby Rahman – Fahd Atsur',
        teamBName: 'Gidan R. – Made Bilan Asasia Binov',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
      },
      {
        id: 'mi-awal2',
        roundIndex: 0,
        roundLabel: 'PUTARAN PERTAMA',
        code: 'AWAL 2',
        note: 'PEMENANG MASUK QF 4',
        teamALabel: 'Tim 3',
        teamBLabel: 'Tim 4',
        teamAName: 'Sigit Saputra Karsa – Mardian',
        teamBName: 'Neno Agang – Henry Wijaya',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
      },
      {
        id: 'mi-awal3',
        roundIndex: 0,
        roundLabel: 'PUTARAN PERTAMA',
        code: 'AWAL 3',
        note: 'PEMENANG MASUK QF 4',
        teamALabel: 'Tim 5',
        teamBLabel: 'Tim 6',
        teamAName: 'Muh. Yusran Guntur – Alen Lokmanjaya',
        teamBName: 'Muh. Syahrir – Ahmad Fadel',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
      },
      {
        id: 'mi-qf1',
        roundIndex: 1,
        roundLabel: 'PEREMPAT FINAL',
        code: 'QF 1',
        note: 'PEREMPAT FINAL 1',
        teamALabel: 'Bye 1',
        teamBLabel: 'Bye 2',
        teamAName: 'Bintang Sri Perdana – Chairul Aqmal',
        teamBName: 'Marcelino Kuandi – Taqiy Sakti',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
      },
      {
        id: 'mi-qf2',
        roundIndex: 1,
        roundLabel: 'PEREMPAT FINAL',
        code: 'QF 2',
        note: 'PEREMPAT FINAL 2',
        teamALabel: 'Bye 3',
        teamBLabel: 'Bye 4',
        teamAName: 'Wahyu Purwatmo – Samsu Kho',
        teamBName: 'Muh. Jied Istiqlal – Achmad Rusman',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
      },
      {
        id: 'mi-qf3',
        roundIndex: 1,
        roundLabel: 'PEREMPAT FINAL',
        code: 'QF 3',
        note: 'PEREMPAT FINAL 3',
        teamALabel: 'Bye 5',
        teamBLabel: 'AWAL 1',
        teamAName: 'Arkam Kasim – Furkan',
        teamBName: 'Pemenang Awal 1',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
        sourceB: {
          matchId: 'mi-awal1',
          type: 'winner',
          placeholder: 'Pemenang Awal 1',
        },
      },
      {
        id: 'mi-qf4',
        roundIndex: 1,
        roundLabel: 'PEREMPAT FINAL',
        code: 'QF 4',
        note: 'PEREMPAT FINAL 4',
        teamALabel: 'AWAL 2',
        teamBLabel: 'AWAL 3',
        teamAName: 'Pemenang Awal 2',
        teamBName: 'Pemenang Awal 3',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
        sourceA: {
          matchId: 'mi-awal2',
          type: 'winner',
          placeholder: 'Pemenang Awal 2',
        },
        sourceB: {
          matchId: 'mi-awal3',
          type: 'winner',
          placeholder: 'Pemenang Awal 3',
        },
      },
      {
        id: 'mi-sf1',
        roundIndex: 2,
        roundLabel: 'SEMIFINAL',
        code: 'SF 1',
        note: 'SEMIFINAL 1',
        teamALabel: 'QF 1',
        teamBLabel: 'QF 2',
        teamAName: 'Pemenang QF 1',
        teamBName: 'Pemenang QF 2',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
        sourceA: {
          matchId: 'mi-qf1',
          type: 'winner',
          placeholder: 'Pemenang QF 1',
        },
        sourceB: {
          matchId: 'mi-qf2',
          type: 'winner',
          placeholder: 'Pemenang QF 2',
        },
      },
      {
        id: 'mi-sf2',
        roundIndex: 2,
        roundLabel: 'SEMIFINAL',
        code: 'SF 2',
        note: 'SEMIFINAL 2',
        teamALabel: 'QF 3',
        teamBLabel: 'QF 4',
        teamAName: 'Pemenang QF 3',
        teamBName: 'Pemenang QF 4',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
        sourceA: {
          matchId: 'mi-qf3',
          type: 'winner',
          placeholder: 'Pemenang QF 3',
        },
        sourceB: {
          matchId: 'mi-qf4',
          type: 'winner',
          placeholder: 'Pemenang QF 4',
        },
      },
      {
        id: 'mi-final',
        roundIndex: 3,
        roundLabel: 'FINAL',
        code: 'FINAL',
        note: 'FINAL',
        teamALabel: 'SF 1',
        teamBLabel: 'SF 2',
        teamAName: 'Pemenang SF 1',
        teamBName: 'Pemenang SF 2',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
        sourceA: {
          matchId: 'mi-sf1',
          type: 'winner',
          placeholder: 'Pemenang SF 1',
        },
        sourceB: {
          matchId: 'mi-sf2',
          type: 'winner',
          placeholder: 'Pemenang SF 2',
        },
      },
    ],
  },
  {
    id: 'cat-womens-doubles',
    categoryId: 'cat-womens-doubles',
    title: "WOMEN'S DOUBLES",
    subtitle: 'SISTEM GUGUR · 6 TIM · 2 TIM BYE',
    rounds: ['BABAK AWAL (2)', 'SEMIFINAL (2)', 'FINAL'],
    championTitle: 'JUARA',
    championName: '',
    updatedAt: '2026-11-25T00:00:00.000Z',
    slots: [
      {
        id: 'wd-m01',
        roundIndex: 0,
        roundLabel: 'BABAK AWAL',
        code: 'M-01',
        note: 'BABAK AWAL',
        teamALabel: 'Tim 1',
        teamBLabel: 'Tim 2',
        teamAName: 'Cici Umrah Batarai – Nindya Larazaty',
        teamBName: 'Zahra Celesta – Rahmadani Najwa',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
      },
      {
        id: 'wd-m02',
        roundIndex: 0,
        roundLabel: 'BABAK AWAL',
        code: 'M-02',
        note: 'BABAK AWAL',
        teamALabel: 'Tim 3',
        teamBLabel: 'Tim 4',
        teamAName: 'Claudia Ramadhiani Wilandari – Dian Asvira',
        teamBName: 'A. Imawati Eka Pratiwi – Satni Palimbong',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
      },
      {
        id: 'wd-sf1',
        roundIndex: 1,
        roundLabel: 'SEMIFINAL',
        code: 'SF-1',
        note: 'SEMIFINAL 1',
        teamALabel: 'BYE 1',
        teamBLabel: 'M-01',
        teamAName: 'Amy – Shavira Amalia',
        teamBName: 'Pemenang M-01',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
        sourceB: {
          matchId: 'wd-m01',
          type: 'winner',
          placeholder: 'Pemenang M-01',
        },
      },
      {
        id: 'wd-sf2',
        roundIndex: 1,
        roundLabel: 'SEMIFINAL',
        code: 'SF-2',
        note: 'SEMIFINAL 2',
        teamALabel: 'BYE 2',
        teamBLabel: 'M-02',
        teamAName: 'Hanny Asapa – Rachel Selfany',
        teamBName: 'Pemenang M-02',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
        sourceB: {
          matchId: 'wd-m02',
          type: 'winner',
          placeholder: 'Pemenang M-02',
        },
      },
      {
        id: 'wd-final',
        roundIndex: 2,
        roundLabel: 'FINAL',
        code: 'FINAL',
        note: 'FINAL',
        teamALabel: 'SF-1',
        teamBLabel: 'SF-2',
        teamAName: 'Pemenang SF-1',
        teamBName: 'Pemenang SF-2',
        scoreA: '',
        scoreB: '',
        winnerSide: null,
        sourceA: {
          matchId: 'wd-sf1',
          type: 'winner',
          placeholder: 'Pemenang SF-1',
        },
        sourceB: {
          matchId: 'wd-sf2',
          type: 'winner',
          placeholder: 'Pemenang SF-2',
        },
      },
    ],
  },
];

export function cloneInitialBrackets(): CategoryBracket[] {
  return INITIAL_CATEGORY_BRACKETS.map((b) => ({
    ...b,
    rounds: [...b.rounds],
    slots: b.slots.map((s) => ({
      ...s,
      ...(s.sourceA ? { sourceA: { ...s.sourceA } } : {}),
      ...(s.sourceB ? { sourceB: { ...s.sourceB } } : {}),
    })),
  }));
}

export function normalizeTeamLabel(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[–—\-\/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveBracketSlotTeamId(
  slot: BracketSlot,
  side: 'A' | 'B',
  allSlots: BracketSlot[],
  teams?: Team[],
  visited = new Set<string>()
): string | null {
  const rawName = side === 'A' ? slot.teamAName : slot.teamBName;
  const explicitId = side === 'A' ? slot.teamAId : slot.teamBId;
  const source = side === 'A' ? slot.sourceA : slot.sourceB;
  const trimmed = String(rawName ?? '').trim();

  const hasManualOverride =
    !source || (Boolean(trimmed) && trimmed !== source.placeholder) || Boolean(explicitId);

  if (source && !hasManualOverride) {
    const visitKey = `${slot.id}:${side}`;
    if (visited.has(visitKey)) {
      return null;
    }
    visited.add(visitKey);

    const sourceSlot = allSlots.find((s) => s.id === source.matchId);
    if (!sourceSlot || !sourceSlot.winnerSide) {
      return null;
    }

    const targetSide: 'A' | 'B' =
      source.type === 'winner'
        ? sourceSlot.winnerSide
        : sourceSlot.winnerSide === 'A'
          ? 'B'
          : 'A';

    return resolveBracketSlotTeamId(sourceSlot, targetSide, allSlots, teams, visited);
  }

  if (explicitId) {
    if (!teams) return explicitId;
    if (teams.some((t) => t.id === explicitId)) return explicitId;
  }

  if (teams && trimmed) {
    const norm = normalizeTeamLabel(trimmed);
    const matched = teams.find((t) => normalizeTeamLabel(t.teamName) === norm);
    if (matched) return matched.id;
  }

  return null;
}

export function resolveBracketSlotTeamName(
  slot: BracketSlot,
  side: 'A' | 'B',
  allSlots: BracketSlot[],
  teams?: Team[],
  visited = new Set<string>()
): string {
  const rawName = side === 'A' ? slot.teamAName : slot.teamBName;
  const explicitId = side === 'A' ? slot.teamAId : slot.teamBId;
  const source = side === 'A' ? slot.sourceA : slot.sourceB;
  const trimmed = String(rawName ?? '').trim();

  if (source && (!trimmed || trimmed === source.placeholder) && !explicitId) {
    const visitKey = `${slot.id}:${side}`;
    if (visited.has(visitKey)) {
      return trimmed || source.placeholder;
    }
    visited.add(visitKey);

    const sourceSlot = allSlots.find((s) => s.id === source.matchId);
    if (!sourceSlot || !sourceSlot.winnerSide) {
      return trimmed || source.placeholder;
    }

    const targetSide: 'A' | 'B' =
      source.type === 'winner'
        ? sourceSlot.winnerSide
        : sourceSlot.winnerSide === 'A'
          ? 'B'
          : 'A';

    return resolveBracketSlotTeamName(sourceSlot, targetSide, allSlots, teams, visited);
  }

  if (explicitId && teams) {
    const linkedTeam = teams.find((t) => t.id === explicitId);
    if (linkedTeam) {
      return linkedTeam.teamName;
    }
  }

  return rawName;
}

export function resolveBracketChampionName(
  bracket: CategoryBracket,
  teams?: Team[]
): string {
  if (bracket.championName.trim()) {
    return bracket.championName;
  }
  const finalSlot = bracket.slots.find(
    (s) => !s.isThirdPlace && s.code.toUpperCase() === 'FINAL'
  );
  if (!finalSlot || !finalSlot.winnerSide) return '';
  return resolveBracketSlotTeamName(finalSlot, finalSlot.winnerSide, bracket.slots, teams);
}

export function resolveBracketThirdPlaceName(
  bracket: CategoryBracket,
  teams?: Team[]
): string {
  if (bracket.thirdPlaceName?.trim()) {
    return bracket.thirdPlaceName;
  }
  const thirdSlot = bracket.slots.find((s) => s.isThirdPlace);
  if (!thirdSlot || !thirdSlot.winnerSide) return '';
  return resolveBracketSlotTeamName(thirdSlot, thirdSlot.winnerSide, bracket.slots, teams);
}

export function updateBracketSlotWinner(
  bracket: CategoryBracket,
  slotId: string,
  winnerSide: 'A' | 'B' | null
): CategoryBracket {
  const nextSlots = bracket.slots.map((s) =>
    s.id === slotId ? { ...s, winnerSide } : s
  );
  return {
    ...bracket,
    slots: nextSlots,
    updatedAt: new Date().toISOString(),
  };
}

export function updateBracketSlotDetails(
  bracket: CategoryBracket,
  slotId: string,
  patch: Partial<
    Pick<
      BracketSlot,
      | 'teamAName'
      | 'teamBName'
      | 'teamAId'
      | 'teamBId'
      | 'linkedMatchId'
      | 'scoreA'
      | 'scoreB'
      | 'teamALabel'
      | 'teamBLabel'
      | 'note'
      | 'winnerSide'
    >
  >
): CategoryBracket {
  const nextSlots = bracket.slots.map((s) =>
    s.id === slotId ? { ...s, ...patch } : s
  );
  return {
    ...bracket,
    slots: nextSlots,
    updatedAt: new Date().toISOString(),
  };
}

export function mergeWithDefaultBrackets(
  existing?: CategoryBracket[] | null
): CategoryBracket[] {
  const defaults = cloneInitialBrackets();
  if (!Array.isArray(existing) || existing.length === 0) {
    return defaults;
  }
  const byId = new Map(existing.map((b) => [b.categoryId || b.id, b]));
  return defaults.map((def) => byId.get(def.categoryId) || def);
}

export function formatMatchSetsForBracket(
  score: PadelScoreState,
  perspective: 'A' | 'B'
): string {
  const sets = Array.isArray(score?.sets) ? score.sets : [];
  const playedSets = sets.filter(
    (s, idx) => idx === 0 || Number(s.teamA) > 0 || Number(s.teamB) > 0
  );
  if (playedSets.length === 0) return '';
  return playedSets
    .map((s) => String(perspective === 'A' ? s.teamA : s.teamB))
    .join(' · ')
    .slice(0, 20);
}

function isStageExplicitCodeMatch(stage: string, slot: BracketSlot): boolean {
  const s = String(stage ?? '').toLowerCase().trim();
  if (!s) return false;
  if (slot.isThirdPlace) {
    return s.includes('juara 3') || s.includes('3rd');
  }
  const code = slot.code.toLowerCase().trim();
  if (code === 'final') {
    return /\bfinal\b/i.test(s) && !s.includes('semi') && !s.includes('perempat') && !s.includes('juara 3');
  }
  const sCompact = s.replace(/[\s-]+/g, '');
  const codeCompact = code.replace(/[\s-]+/g, '');
  return Boolean(codeCompact) && sCompact.includes(codeCompact);
}

export function isStageCompatibleWithSlot(stage: string, slot: BracketSlot): boolean {
  const s = String(stage ?? '').toLowerCase().trim();
  if (!s) return false;
  if (isStageExplicitCodeMatch(s, slot)) return true;

  // Never let generic group-stage matches overwrite knockout bracket slots unless explicitly linked by ID
  if (/(^|\b)(grup|group|round\s*robin|penyisihan)(\b|$)/i.test(s)) {
    return false;
  }

  if (slot.isThirdPlace) {
    return s.includes('juara 3') || s.includes('3rd');
  }

  const label = slot.roundLabel.toLowerCase();
  const isKnockoutGeneric =
    s.includes('babak gugur') || s.includes('knockout') || s.includes('playoff') || s.includes('bagan');

  if (slot.roundIndex === 0 || label.includes('putaran pertama') || label.includes('babak awal')) {
    return (
      s.includes('putaran pertama') ||
      s.includes('babak awal') ||
      s.includes('awal') ||
      isKnockoutGeneric
    );
  }
  if (label.includes('perempat')) {
    return s.includes('perempat') || s.includes('quarter') || s.includes('8 besar') || isKnockoutGeneric;
  }
  if (label.includes('semifinal')) {
    return s.includes('semi') || isKnockoutGeneric;
  }
  if (slot.code.toUpperCase() === 'FINAL') {
    return (/\bfinal\b/i.test(s) && !s.includes('semi') && !s.includes('perempat')) || s.includes('partai puncak');
  }
  return isKnockoutGeneric;
}

export function findMatchingMatchForSlot(
  slot: BracketSlot,
  categoryId: string,
  allSlots: BracketSlot[],
  teams: Team[],
  matches: Match[]
): { match: Match; swapped: boolean } | null {
  const catMatches = matches.filter((m) => m.categoryId === categoryId);
  const resolvedA = resolveBracketSlotTeamId(slot, 'A', allSlots, teams);
  const resolvedB = resolveBracketSlotTeamId(slot, 'B', allSlots, teams);

  if (slot.linkedMatchId) {
    const linked = catMatches.find((m) => m.id === slot.linkedMatchId);
    if (linked) {
      const swapped = Boolean(
        (resolvedA && linked.teamBId === resolvedA && (!resolvedB || linked.teamAId === resolvedB)) ||
          (resolvedB && linked.teamAId === resolvedB && (!resolvedA || linked.teamBId === resolvedA))
      );
      return { match: linked, swapped };
    }
  }

  if (!resolvedA || !resolvedB || resolvedA === resolvedB) {
    return null;
  }

  const teamMatches = catMatches.filter(
    (m) =>
      ((m.teamAId === resolvedA && m.teamBId === resolvedB) ||
        (m.teamAId === resolvedB && m.teamBId === resolvedA)) &&
      isStageCompatibleWithSlot(m.stage, slot)
  );

  if (teamMatches.length === 0) return null;

  const statusRank: Record<Match['status'], number> = {
    completed: 3,
    live: 2,
    scheduled: 1,
    postponed: 0,
  };

  teamMatches.sort((a, b) => {
    const explicitDiff =
      Number(isStageExplicitCodeMatch(b.stage, slot)) -
      Number(isStageExplicitCodeMatch(a.stage, slot));
    if (explicitDiff !== 0) return explicitDiff;
    const statusDiff = statusRank[b.status] - statusRank[a.status];
    if (statusDiff !== 0) return statusDiff;
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  });

  const best = teamMatches[0];
  return {
    match: best,
    swapped: best.teamAId === resolvedB && best.teamBId === resolvedA,
  };
}

export function syncBracketWithTeamsAndMatches(
  bracket: CategoryBracket,
  teams: Team[],
  matches: Match[]
): CategoryBracket {
  const catTeams = teams.filter((t) => t.categoryId === bracket.categoryId);
  const catMatches = matches.filter((m) => m.categoryId === bracket.categoryId);

  const nextSlots = bracket.slots.map((s) => ({ ...s }));
  const orderedIndices = nextSlots
    .map((slot, index) => ({ slot, index }))
    .sort((a, b) => {
      if (a.slot.roundIndex !== b.slot.roundIndex) {
        return a.slot.roundIndex - b.slot.roundIndex;
      }
      return Number(Boolean(a.slot.isThirdPlace)) - Number(Boolean(b.slot.isThirdPlace));
    })
    .map((entry) => entry.index);

  let changed = false;

  for (const idx of orderedIndices) {
    const prev = bracket.slots[idx];
    const slot = nextSlots[idx];

    // Sync Team A against Pasangan / Grup
    if (!slot.sourceA) {
      if (slot.teamAId) {
        const team = catTeams.find((t) => t.id === slot.teamAId);
        if (team) {
          if (slot.teamAName !== team.teamName) {
            slot.teamAName = team.teamName;
          }
        } else {
          slot.teamAId = null;
        }
      } else if (slot.teamAName.trim()) {
        const norm = normalizeTeamLabel(slot.teamAName);
        const byName = catTeams.find((t) => normalizeTeamLabel(t.teamName) === norm);
        if (byName) {
          slot.teamAId = byName.id;
          slot.teamAName = byName.teamName;
        }
      }
    } else if (slot.teamAId) {
      const team = catTeams.find((t) => t.id === slot.teamAId);
      if (team) {
        slot.teamAName = team.teamName;
      } else {
        slot.teamAId = null;
      }
    }

    // Sync Team B against Pasangan / Grup
    if (!slot.sourceB) {
      if (slot.teamBId) {
        const team = catTeams.find((t) => t.id === slot.teamBId);
        if (team) {
          if (slot.teamBName !== team.teamName) {
            slot.teamBName = team.teamName;
          }
        } else {
          slot.teamBId = null;
        }
      } else if (slot.teamBName.trim()) {
        const norm = normalizeTeamLabel(slot.teamBName);
        const byName = catTeams.find((t) => normalizeTeamLabel(t.teamName) === norm);
        if (byName) {
          slot.teamBId = byName.id;
          slot.teamBName = byName.teamName;
        }
      }
    } else if (slot.teamBId) {
      const team = catTeams.find((t) => t.id === slot.teamBId);
      if (team) {
        slot.teamBName = team.teamName;
      } else {
        slot.teamBId = null;
      }
    }

    // Sync Match scores & winner from linked or matching knockout match
    const found = findMatchingMatchForSlot(slot, bracket.categoryId, nextSlots, catTeams, catMatches);
    if (found) {
      slot.linkedMatchId = found.match.id;
      if (found.match.status === 'live' || found.match.status === 'completed') {
        slot.scoreA = formatMatchSetsForBracket(found.match.score, found.swapped ? 'B' : 'A');
        slot.scoreB = formatMatchSetsForBracket(found.match.score, found.swapped ? 'A' : 'B');
        if (found.match.score.winnerSide) {
          slot.winnerSide =
            found.match.score.winnerSide === 'A'
              ? found.swapped
                ? 'B'
                : 'A'
              : found.swapped
                ? 'A'
                : 'B';
        } else {
          slot.winnerSide = null;
        }
      }
    } else if (slot.linkedMatchId) {
      // Linked match no longer exists
      slot.linkedMatchId = null;
    }

    if (
      slot.teamAName !== prev.teamAName ||
      slot.teamBName !== prev.teamBName ||
      (slot.teamAId ?? null) !== (prev.teamAId ?? null) ||
      (slot.teamBId ?? null) !== (prev.teamBId ?? null) ||
      (slot.linkedMatchId ?? null) !== (prev.linkedMatchId ?? null) ||
      slot.scoreA !== prev.scoreA ||
      slot.scoreB !== prev.scoreB ||
      slot.winnerSide !== prev.winnerSide
    ) {
      changed = true;
    }
  }

  if (!changed) return bracket;
  return {
    ...bracket,
    slots: nextSlots,
    updatedAt: new Date().toISOString(),
  };
}

export function syncAllBracketsWithTeamsAndMatches(
  brackets: CategoryBracket[],
  teams: Team[],
  matches: Match[]
): CategoryBracket[] {
  return brackets.map((b) => syncBracketWithTeamsAndMatches(b, teams, matches));
}

export function populateBracketFromCategoryTeams(
  bracket: CategoryBracket,
  teams: Team[]
): CategoryBracket {
  const activeTeams = teams
    .filter((t) => t.categoryId === bracket.categoryId && t.status !== 'withdrawn')
    .sort((a, b) => {
      const seedA = a.seed ?? 9999;
      const seedB = b.seed ?? 9999;
      if (seedA !== seedB) return seedA - seedB;
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });

  const nextSlots: BracketSlot[] = bracket.slots.map((s) => ({
    ...s,
    teamAId: null,
    teamBId: null,
    linkedMatchId: null,
    scoreA: '',
    scoreB: '',
    winnerSide: null,
    ...(s.sourceA ? { teamAName: s.sourceA.placeholder } : {}),
    ...(s.sourceB ? { teamBName: s.sourceB.placeholder } : {}),
  }));

  const entryPositions: Array<{ slotIdx: number; side: 'A' | 'B' }> = [];
  const slotsByRound = nextSlots
    .map((slot, slotIdx) => ({ slot, slotIdx }))
    .filter((entry) => !entry.slot.isThirdPlace)
    .sort((a, b) => a.slot.roundIndex - b.slot.roundIndex || a.slotIdx - b.slotIdx);

  for (const { slot, slotIdx } of slotsByRound) {
    if (!slot.sourceA) entryPositions.push({ slotIdx, side: 'A' });
    if (!slot.sourceB) entryPositions.push({ slotIdx, side: 'B' });
  }

  entryPositions.forEach((pos, idx) => {
    const team = activeTeams[idx];
    const target = nextSlots[pos.slotIdx];
    if (pos.side === 'A') {
      target.teamAId = team ? team.id : null;
      target.teamAName = team ? team.teamName : 'Menunggu Pasangan';
    } else {
      target.teamBId = team ? team.id : null;
      target.teamBName = team ? team.teamName : 'Menunggu Pasangan';
    }
  });

  return {
    ...bracket,
    slots: nextSlots,
    championName: '',
    ...(bracket.thirdPlaceTitle !== undefined ? { thirdPlaceName: '' } : {}),
    updatedAt: new Date().toISOString(),
  };
}

export function findBracketSlotsForTeam(
  brackets: CategoryBracket[],
  teamId: string,
  teams?: Team[]
): Array<{
  categoryId: string;
  bracketTitle: string;
  slotId: string;
  code: string;
  roundLabel: string;
  side: 'A' | 'B';
}> {
  const results: Array<{
    categoryId: string;
    bracketTitle: string;
    slotId: string;
    code: string;
    roundLabel: string;
    side: 'A' | 'B';
  }> = [];

  for (const bracket of brackets) {
    const catTeams = teams?.filter((t) => t.categoryId === bracket.categoryId);
    for (const slot of bracket.slots) {
      const idA = resolveBracketSlotTeamId(slot, 'A', bracket.slots, catTeams);
      const idB = resolveBracketSlotTeamId(slot, 'B', bracket.slots, catTeams);
      if (idA === teamId) {
        results.push({
          categoryId: bracket.categoryId,
          bracketTitle: bracket.title,
          slotId: slot.id,
          code: slot.code,
          roundLabel: slot.roundLabel,
          side: 'A',
        });
      } else if (idB === teamId) {
        results.push({
          categoryId: bracket.categoryId,
          bracketTitle: bracket.title,
          slotId: slot.id,
          code: slot.code,
          roundLabel: slot.roundLabel,
          side: 'B',
        });
      }
    }
  }

  return results;
}
