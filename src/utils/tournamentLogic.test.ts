import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPadelPoint,
  buildDefaultPairName,
  buildWhatsAppScheduleMessage,
  computeLeaderboard,
  createInitialScore,
  detectScheduleConflict,
  findTeamForParticipant,
  formatPairRegion,
  formatTournamentScheduleDate,
  generateKnockoutPairings,
  generateRoundRobinPairings,
  getCourtLedFocusSlots,
  isValidWhatsAppNumber,
  normalizeWhatsAppNumber,
  setManualPadelScore,
} from './tournamentLogic.ts';
import {
  INITIAL_CATEGORY_BRACKETS,
  cloneInitialBrackets,
  findBracketSlotsForTeam,
  populateBracketFromCategoryTeams,
  resolveBracketChampionName,
  resolveBracketSlotTeamName,
  resolveBracketThirdPlaceName,
  syncBracketWithTeamsAndMatches,
  updateBracketSlotDetails,
  updateBracketSlotWinner,
} from './tournamentBracket.ts';
import type { Court, Match, Team } from '../types/tournament.ts';

function makeTeam(id: string, name: string, categoryId = 'cat-1', seed: number | null = null): Team {
  return {
    id,
    categoryId,
    teamName: name,
    club: 'Test Club',
    seed,
    status: 'checked_in',
    player1: { name: `${name} P1`, whatsapp: '081234567890', level: 'Open' },
    player2: { name: `${name} P2`, whatsapp: '081234567891', level: 'Open' },
    createdAt: '2026-11-23T00:00:00Z',
  };
}

test('normalizeWhatsAppNumber formats Indonesian local numbers to 62 prefix', () => {
  assert.equal(normalizeWhatsAppNumber('0812-3456-7890'), '6281234567890');
  assert.equal(normalizeWhatsAppNumber('+62 811 2233 4455'), '6281122334455');
  assert.equal(normalizeWhatsAppNumber('81299887766'), '6281299887766');
  assert.equal(isValidWhatsAppNumber('08123456789'), true);
  assert.equal(isValidWhatsAppNumber('12345'), false);
});

test('applyPadelPoint advances rally points and wins games in golden point mode', () => {
  let score = createInitialScore(true);
  score = applyPadelPoint(score, 'A'); // 15-0
  score = applyPadelPoint(score, 'A'); // 30-0
  score = applyPadelPoint(score, 'A'); // 40-0
  assert.equal(score.currentPointA, '40');
  score = applyPadelPoint(score, 'B'); // 40-15
  score = applyPadelPoint(score, 'B'); // 40-30
  score = applyPadelPoint(score, 'B'); // 40-40 (deuce)
  assert.equal(score.currentPointA, '40');
  assert.equal(score.currentPointB, '40');
  // Golden point winner takes the game immediately
  score = applyPadelPoint(score, 'A');
  assert.equal(score.sets[0].teamA, 1);
  assert.equal(score.sets[0].teamB, 0);
  assert.equal(score.currentPointA, '0');
  assert.equal(score.servingTeam, 'B');
});

test('applyPadelPoint handles traditional Deuce/Advantage when goldenPoint is false', () => {
  let score = createInitialScore(false);
  score = { ...score, currentPointA: '40', currentPointB: '40' };
  score = applyPadelPoint(score, 'A');
  assert.equal(score.currentPointA, 'AD');
  assert.equal(score.currentPointB, '40');
  // Opponent wins point -> back to 40-40
  score = applyPadelPoint(score, 'B');
  assert.equal(score.currentPointA, '40');
  assert.equal(score.currentPointB, '40');
  // B gets AD then wins game
  score = applyPadelPoint(score, 'B');
  score = applyPadelPoint(score, 'B');
  assert.equal(score.sets[0].teamB, 1);
});

test('computeLeaderboard ranks teams by points, set diff, then game diff', () => {
  const teams = [makeTeam('t1', 'Alpha'), makeTeam('t2', 'Beta'), makeTeam('t3', 'Gamma')];
  const matches: Match[] = [
    {
      id: 'm1',
      categoryId: 'cat-1',
      stage: 'Grup A',
      matchNumber: 1,
      teamAId: 't1',
      teamBId: 't2',
      courtId: 'c1',
      scheduledDate: '2026-11-24',
      scheduledTime: '09:00',
      status: 'completed',
      score: {
        sets: [
          { teamA: 6, teamB: 4 },
          { teamA: 6, teamB: 2 },
        ],
        currentPointA: '0',
        currentPointB: '0',
        servingTeam: 'A',
        goldenPoint: true,
        isTiebreak: false,
        winnerSide: 'A',
      },
      updatedAt: '2026-11-24T10:00:00Z',
    },
    {
      id: 'm2',
      categoryId: 'cat-1',
      stage: 'Grup A',
      matchNumber: 2,
      teamAId: 't3',
      teamBId: 't2',
      courtId: 'c1',
      scheduledDate: '2026-11-24',
      scheduledTime: '10:00',
      status: 'completed',
      score: {
        sets: [
          { teamA: 6, teamB: 4 },
          { teamA: 4, teamB: 6 },
          { teamA: 6, teamB: 3 },
        ],
        currentPointA: '0',
        currentPointB: '0',
        servingTeam: 'A',
        goldenPoint: true,
        isTiebreak: false,
        winnerSide: 'A',
      },
      updatedAt: '2026-11-24T11:00:00Z',
    },
  ];

  const board = computeLeaderboard(teams, matches, 'cat-1');
  assert.equal(board.length, 3);
  assert.equal(board[0].team.id, 't1'); // 3 pts, +2 sets
  assert.equal(board[0].gameDiff, 6);
  assert.equal(board[1].team.id, 't3'); // 3 pts, +1 set
  assert.equal(board[2].team.id, 't2'); // 0 pts
});

test('generateRoundRobinPairings avoids existing pairs and generateKnockoutPairings pairs seeds', () => {
  const teams = [
    makeTeam('t1', 'Team 1', 'cat-1', 1),
    makeTeam('t2', 'Team 2', 'cat-1', 2),
    makeTeam('t3', 'Team 3', 'cat-1', 3),
    makeTeam('t4', 'Team 4', 'cat-1', 4),
  ];
  const existing: Match[] = [
    {
      id: 'm1',
      categoryId: 'cat-1',
      stage: 'Grup',
      matchNumber: 1,
      teamAId: 't1',
      teamBId: 't2',
      courtId: null,
      scheduledDate: '2026-11-24',
      scheduledTime: '09:00',
      status: 'scheduled',
      score: createInitialScore(),
      updatedAt: '2026-11-24T08:00:00Z',
    },
  ];

  const rr = generateRoundRobinPairings(teams, 'cat-1', existing, 'Grup A');
  assert.equal(rr.length, 5); // 6 total pairs minus 1 existing

  const ko = generateKnockoutPairings(teams, 'cat-1', 'Semifinal');
  assert.equal(ko.length, 2);
  assert.equal(ko[0].teamAId, 't1');
  assert.equal(ko[0].teamBId, 't4');
});

test('detectScheduleConflict identifies court and team collisions', () => {
  const matches: Match[] = [
    {
      id: 'm1',
      categoryId: 'cat-1',
      stage: 'Grup',
      matchNumber: 1,
      teamAId: 't1',
      teamBId: 't2',
      courtId: 'c1',
      scheduledDate: '2026-11-24',
      scheduledTime: '09:00',
      status: 'scheduled',
      score: createInitialScore(),
      updatedAt: '2026-11-24T08:00:00Z',
    },
  ];

  const courtConflict = detectScheduleConflict(matches, {
    courtId: 'c1',
    scheduledDate: '2026-11-24',
    scheduledTime: '09:00',
    teamAId: 't3',
    teamBId: 't4',
  });
  assert.equal(courtConflict?.type, 'court_busy');

  const teamConflict = detectScheduleConflict(matches, {
    courtId: 'c2',
    scheduledDate: '2026-11-24',
    scheduledTime: '09:00',
    teamAId: 't1',
    teamBId: 't4',
  });
  assert.equal(teamConflict?.type, 'team_busy');
});

test('buildWhatsAppScheduleMessage includes court, time, teams, and public link', () => {
  const msg = buildWhatsAppScheduleMessage({
    tournamentName: 'Jakarta Padel Open',
    venue: 'Senayan Padel Club',
    match: {
      id: 'm1',
      categoryId: 'cat-1',
      stage: 'Semifinal',
      matchNumber: 5,
      teamAId: 't1',
      teamBId: 't2',
      courtId: 'c1',
      scheduledDate: '2026-11-24',
      scheduledTime: '14:30',
      status: 'scheduled',
      score: createInitialScore(),
      updatedAt: '2026-11-24T08:00:00Z',
    },
    teamA: makeTeam('t1', 'Raka / Dimas'),
    teamB: makeTeam('t2', 'Budi / Kevin'),
    courtName: 'Court 1 Panoramic',
    categoryName: "Men's Open",
    eventType: 'court_changed',
    publicUrl: 'https://example.com/?view=public',
  });

  assert.match(msg, /PERUBAHAN COURT PERTANDINGAN/);
  assert.match(msg, /Court 1 Panoramic/);
  assert.match(msg, /14:30 WITA/);
  assert.match(msg, /Raka \/ Dimas/);
});

test('formatTournamentScheduleDate formats single-day Friday Nov 27 2026 accurately', () => {
  assert.equal(
    formatTournamentScheduleDate('2026-11-27', '2026-11-27'),
    'Jumat, 27 November 2026'
  );
  assert.equal(
    formatTournamentScheduleDate('2026-11-27', '2026-11-28'),
    'Jumat, 27 November 2026 – Sabtu, 28 November 2026'
  );
});

test('getCourtLedFocusSlots returns 4 court focus options with live and next matches', () => {
  const courts: Court[] = [
    { id: 'court-1', name: 'Court 1', surface: 'Indoor', isIndoor: true },
    { id: 'court-2', name: 'Court 2', surface: 'Indoor', isIndoor: true },
    { id: 'court-4', name: 'Court 4', surface: 'Indoor', isIndoor: true },
    { id: 'court-5', name: 'Court 5', surface: 'Indoor', isIndoor: true },
  ];
  const matches: Match[] = [
    {
      id: 'm1',
      categoryId: 'cat-1',
      stage: 'Grup A',
      matchNumber: 1,
      teamAId: 't1',
      teamBId: 't2',
      courtId: 'court-1',
      scheduledDate: '2026-11-27',
      scheduledTime: '07:30',
      status: 'live',
      score: createInitialScore(),
      updatedAt: '2026-11-27T07:30:00Z',
    },
    {
      id: 'm2',
      categoryId: 'cat-1',
      stage: 'Grup A',
      matchNumber: 2,
      teamAId: 't3',
      teamBId: 't4',
      courtId: 'court-4',
      scheduledDate: '2026-11-27',
      scheduledTime: '08:30',
      status: 'scheduled',
      score: createInitialScore(),
      updatedAt: '2026-11-27T07:30:00Z',
    },
    {
      id: 'm3',
      categoryId: 'cat-1',
      stage: 'Grup A',
      matchNumber: 3,
      teamAId: 't5',
      teamBId: 't6',
      courtId: 'court-4',
      scheduledDate: '2026-11-27',
      scheduledTime: '09:30',
      status: 'scheduled',
      score: createInitialScore(),
      updatedAt: '2026-11-27T07:30:00Z',
    },
  ];

  const slots = getCourtLedFocusSlots(courts, matches);
  assert.equal(slots.length, 4);
  assert.equal(slots[0].shortLabel, 'Court 1');
  assert.equal(slots[0].liveMatch?.id, 'm1');
  assert.equal(slots[2].nextMatch?.id, 'm2');
  assert.equal(slots[3].liveMatch, null);
  assert.equal(slots[3].nextMatch, null);
});

test('manual pairing helpers derive pair name, combined region, and participant pairing status', () => {
  assert.equal(buildDefaultPairName('Raka Pratama', 'Dimas Wijaya'), 'Raka / Dimas');
  assert.equal(formatPairRegion('Makassar', 'makassar'), 'Makassar');
  assert.equal(formatPairRegion('Makassar', 'Manado'), 'Makassar / Manado');

  const team: Team = {
    ...makeTeam('t1', 'Raka / Dimas'),
    player1Id: 'p1',
    player2Id: 'p2',
  };
  assert.equal(findTeamForParticipant('p1', [team])?.id, 't1');
  assert.equal(findTeamForParticipant('p3', [team]), undefined);
});

test('setManualPadelScore sanitizes typed set games and points and resolves match winner', () => {
  const initial = createInitialScore(true);
  const updated = setManualPadelScore(initial, {
    sets: [
      { teamA: 6, teamB: 4 },
      { teamA: 7, teamB: 5 },
    ],
    currentPointA: '40',
    currentPointB: '15',
  });
  assert.equal(updated.sets[0].teamA, 6);
  assert.equal(updated.sets[1].teamA, 7);
  assert.equal(updated.currentPointA, '40');
  assert.equal(updated.currentPointB, '15');
  assert.equal(updated.winnerSide, 'A');

  const clamped = setManualPadelScore(initial, {
    sets: [{ teamA: -3, teamB: 99 }],
    currentPointA: ' ',
    currentPointB: 'ad',
  });
  assert.equal(clamped.sets[0].teamA, 0);
  assert.equal(clamped.sets[0].teamB, 20);
  assert.equal(clamped.currentPointA, '0');
  assert.equal(clamped.currentPointB, 'AD');
});

test('tournament brackets seed all 3 categories and propagate winners, losers, and custom edits', () => {
  assert.equal(INITIAL_CATEGORY_BRACKETS.length, 3);
  const brackets = cloneInitialBrackets();
  const beginner = brackets.find((b) => b.categoryId === 'cat-mens-beginner')!;
  const intermediate = brackets.find((b) => b.categoryId === 'cat-mens-intermediate')!;
  const womens = brackets.find((b) => b.categoryId === 'cat-womens-doubles')!;

  assert.equal(beginner.slots.length, 9);
  assert.equal(intermediate.slots.length, 10);
  assert.equal(womens.slots.length, 5);

  // Propagate M-01 winner into QF-4 Team B
  let nextBeginner = updateBracketSlotWinner(beginner, 'mb-m01', 'A');
  const qf4 = nextBeginner.slots.find((s) => s.id === 'mb-qf4')!;
  assert.equal(
    resolveBracketSlotTeamName(qf4, 'B', nextBeginner.slots),
    'Lukman Anas – Gazali Habibie Yunior'
  );

  // Propagate QF-1, QF-2, QF-3, QF-4 -> SF-1, SF-2 -> FINAL -> JUARA 1 & JUARA 3
  nextBeginner = updateBracketSlotWinner(nextBeginner, 'mb-qf1', 'A');
  nextBeginner = updateBracketSlotWinner(nextBeginner, 'mb-qf2', 'B');
  nextBeginner = updateBracketSlotWinner(nextBeginner, 'mb-qf3', 'A');
  nextBeginner = updateBracketSlotWinner(nextBeginner, 'mb-qf4', 'B');
  nextBeginner = updateBracketSlotWinner(nextBeginner, 'mb-sf1', 'A');
  nextBeginner = updateBracketSlotWinner(nextBeginner, 'mb-sf2', 'B');
  nextBeginner = updateBracketSlotWinner(nextBeginner, 'mb-final', 'B');
  nextBeginner = updateBracketSlotWinner(nextBeginner, 'mb-3rd', 'A');

  assert.equal(
    resolveBracketChampionName(nextBeginner),
    'Lukman Anas – Gazali Habibie Yunior'
  );
  assert.equal(
    resolveBracketThirdPlaceName(nextBeginner),
    'Deraldi Diyesa – Wawan Wahyudin'
  );

  // Manual team name override on downstream slot is honored over auto-propagation
  nextBeginner = updateBracketSlotDetails(nextBeginner, 'mb-qf4', {
    teamBName: 'Tim Pengganti Custom',
  });
  const editedQf4 = nextBeginner.slots.find((s) => s.id === 'mb-qf4')!;
  assert.equal(
    resolveBracketSlotTeamName(editedQf4, 'B', nextBeginner.slots),
    'Tim Pengganti Custom'
  );
});

test('syncBracketWithTeamsAndMatches integrates Pasangan/Grup teams, handles swapped match sides, and advances winners', () => {
  const teams: Team[] = [
    makeTeam('t-1', 'Andi / Budi', 'cat-mens-beginner', 1),
    makeTeam('t-2', 'Candra / Dodi', 'cat-mens-beginner', 2),
    makeTeam('t-3', 'Eko / Fajar', 'cat-mens-beginner', 3),
    makeTeam('t-4', 'Gilang / Hari', 'cat-mens-beginner', 4),
  ];

  const baseBeginner = cloneInitialBrackets().find((b) => b.categoryId === 'cat-mens-beginner')!;
  let bracket = populateBracketFromCategoryTeams(baseBeginner, teams);

  // Round 0 M-01 gets first two teams, QF-1 gets next two teams
  const m01 = bracket.slots.find((s) => s.id === 'mb-m01')!;
  const qf1 = bracket.slots.find((s) => s.id === 'mb-qf1')!;
  assert.equal(m01.teamAId, 't-1');
  assert.equal(m01.teamBId, 't-2');
  assert.equal(qf1.teamAId, 't-3');
  assert.equal(qf1.teamBId, 't-4');

  // Rename t-1 in Pasangan/Grup -> bracket reflects new name on sync
  const renamedTeams = teams.map((t) =>
    t.id === 't-1' ? { ...t, teamName: 'Andi / Budi (Updated)' } : t
  );

  // Group stage match between t-1 and t-2 MUST NOT overwrite knockout M-01 unless explicitly linked
  const groupMatch: Match = {
    id: 'm-group-1',
    categoryId: 'cat-mens-beginner',
    stage: 'Fase Grup A',
    matchNumber: 1,
    teamAId: 't-1',
    teamBId: 't-2',
    courtId: 'court-1',
    scheduledDate: '2026-11-27',
    scheduledTime: '07:30',
    status: 'completed',
    score: {
      sets: [{ teamA: 6, teamB: 0 }],
      currentPointA: '0',
      currentPointB: '0',
      servingTeam: 'A',
      goldenPoint: true,
      isTiebreak: false,
      winnerSide: 'A',
    },
    updatedAt: '2026-11-27T08:00:00Z',
  };

  bracket = syncBracketWithTeamsAndMatches(bracket, renamedTeams, [groupMatch]);
  assert.equal(bracket.slots.find((s) => s.id === 'mb-m01')?.teamAName, 'Andi / Budi (Updated)');
  assert.equal(bracket.slots.find((s) => s.id === 'mb-m01')?.winnerSide, null);

  // Completed knockout match with SWAPPED sides (t-2 is teamA in Match, t-1 is teamB in Match; t-1 wins!)
  const knockoutM01: Match = {
    id: 'm-ko-1',
    categoryId: 'cat-mens-beginner',
    stage: 'Bagan M-01 · PUTARAN PERTAMA',
    matchNumber: 2,
    teamAId: 't-2',
    teamBId: 't-1',
    courtId: 'court-1',
    scheduledDate: '2026-11-27',
    scheduledTime: '08:30',
    status: 'completed',
    score: {
      sets: [
        { teamA: 4, teamB: 6 },
        { teamA: 3, teamB: 6 },
      ],
      currentPointA: '0',
      currentPointB: '0',
      servingTeam: 'A',
      goldenPoint: true,
      isTiebreak: false,
      winnerSide: 'B', // t-1 won
    },
    updatedAt: '2026-11-27T09:15:00Z',
  };

  bracket = syncBracketWithTeamsAndMatches(bracket, renamedTeams, [groupMatch, knockoutM01]);
  const syncedM01 = bracket.slots.find((s) => s.id === 'mb-m01')!;
  assert.equal(syncedM01.linkedMatchId, 'm-ko-1');
  assert.equal(syncedM01.winnerSide, 'A'); // t-1 is side A in bracket M-01
  assert.equal(syncedM01.scoreA, '6 · 6');
  assert.equal(syncedM01.scoreB, '4 · 3');

  // Downstream QF-4 Team B should now automatically resolve to t-1 ('Andi / Budi (Updated)')
  const syncedQf4 = bracket.slots.find((s) => s.id === 'mb-qf4')!;
  assert.equal(
    resolveBracketSlotTeamName(syncedQf4, 'B', bracket.slots, renamedTeams),
    'Andi / Budi (Updated)'
  );

  // findBracketSlotsForTeam finds both mb-m01 and mb-qf4 for t-1
  const t1Slots = findBracketSlotsForTeam([bracket], 't-1', renamedTeams).map((s) => s.code);
  assert.deepEqual(t1Slots, ['M-01', 'QF-4']);
});


