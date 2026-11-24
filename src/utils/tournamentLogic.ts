import type {
  LeaderboardRow,
  Match,
  PadelScoreState,
  SetScore,
  Team,
  WhatsAppEventType,
} from '../types/tournament.ts';

export function normalizeWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
}

export function isValidWhatsAppNumber(raw: string): boolean {
  const normalized = normalizeWhatsAppNumber(raw);
  return normalized.length >= 10 && normalized.length <= 15;
}

export function createInitialScore(goldenPoint = true): PadelScoreState {
  return {
    sets: [{ teamA: 0, teamB: 0 }],
    currentPointA: '0',
    currentPointB: '0',
    servingTeam: 'A',
    goldenPoint,
    isTiebreak: false,
    winnerSide: null,
  };
}

export function determineMatchWinner(sets: SetScore[]): 'A' | 'B' | null {
  let setsWonA = 0;
  let setsWonB = 0;

  for (const s of sets) {
    if ((s.teamA >= 6 && s.teamA - s.teamB >= 2) || s.teamA === 7) {
      setsWonA += 1;
    } else if ((s.teamB >= 6 && s.teamB - s.teamA >= 2) || s.teamB === 7) {
      setsWonB += 1;
    }
  }

  if (setsWonA >= 2) return 'A';
  if (setsWonB >= 2) return 'B';
  return null;
}

function isSetComplete(s: SetScore): boolean {
  return (
    (s.teamA >= 6 && s.teamA - s.teamB >= 2) ||
    (s.teamB >= 6 && s.teamB - s.teamA >= 2) ||
    s.teamA === 7 ||
    s.teamB === 7
  );
}

export function applyPadelPoint(
  prev: PadelScoreState,
  winner: 'A' | 'B'
): PadelScoreState {
  if (prev.winnerSide) {
    return prev;
  }

  const sets = prev.sets.map((s) => ({ ...s }));
  if (sets.length === 0) {
    sets.push({ teamA: 0, teamB: 0 });
  }
  const activeIdx = sets.length - 1;
  const activeSet = sets[activeIdx];

  // Tiebreak scoring at 6-6
  if (prev.isTiebreak || (activeSet.teamA === 6 && activeSet.teamB === 6)) {
    const pA = Number.parseInt(prev.currentPointA, 10) || 0;
    const pB = Number.parseInt(prev.currentPointB, 10) || 0;
    const nextA = winner === 'A' ? pA + 1 : pA;
    const nextB = winner === 'B' ? pB + 1 : pB;

    if ((nextA >= 7 || nextB >= 7) && Math.abs(nextA - nextB) >= 2) {
      if (nextA > nextB) {
        activeSet.teamA = 7;
      } else {
        activeSet.teamB = 7;
      }
      const matchWinner = determineMatchWinner(sets);
      if (!matchWinner && sets.length < 3) {
        sets.push({ teamA: 0, teamB: 0 });
      }
      return {
        ...prev,
        sets,
        currentPointA: '0',
        currentPointB: '0',
        isTiebreak: false,
        servingTeam: prev.servingTeam === 'A' ? 'B' : 'A',
        winnerSide: matchWinner,
      };
    }

    const totalTbPoints = nextA + nextB;
    const switchServe = totalTbPoints % 2 === 1;
    return {
      ...prev,
      sets,
      isTiebreak: true,
      currentPointA: String(nextA),
      currentPointB: String(nextB),
      servingTeam: switchServe
        ? prev.servingTeam === 'A'
          ? 'B'
          : 'A'
        : prev.servingTeam,
    };
  }

  const awardGame = (side: 'A' | 'B'): PadelScoreState => {
    if (side === 'A') {
      activeSet.teamA += 1;
    } else {
      activeSet.teamB += 1;
    }

    const nextServing = prev.servingTeam === 'A' ? 'B' : 'A';
    const matchWinner = determineMatchWinner(sets);
    if (matchWinner) {
      return {
        ...prev,
        sets,
        currentPointA: '0',
        currentPointB: '0',
        isTiebreak: false,
        servingTeam: nextServing,
        winnerSide: matchWinner,
      };
    }

    if (activeSet.teamA === 6 && activeSet.teamB === 6) {
      return {
        ...prev,
        sets,
        currentPointA: '0',
        currentPointB: '0',
        isTiebreak: true,
        servingTeam: nextServing,
        winnerSide: null,
      };
    }

    if (isSetComplete(activeSet) && sets.length < 3) {
      sets.push({ teamA: 0, teamB: 0 });
    }

    return {
      ...prev,
      sets,
      currentPointA: '0',
      currentPointB: '0',
      isTiebreak: false,
      servingTeam: nextServing,
      winnerSide: null,
    };
  };

  const pA = prev.currentPointA;
  const pB = prev.currentPointB;

  if (pA === '40' && pB === '40') {
    if (prev.goldenPoint) {
      return awardGame(winner);
    }
    return {
      ...prev,
      currentPointA: winner === 'A' ? 'AD' : '40',
      currentPointB: winner === 'B' ? 'AD' : '40',
    };
  }

  if (pA === 'AD' || pB === 'AD') {
    if ((winner === 'A' && pA === 'AD') || (winner === 'B' && pB === 'AD')) {
      return awardGame(winner);
    }
    return {
      ...prev,
      currentPointA: '40',
      currentPointB: '40',
    };
  }

  const progression: Record<string, string> = {
    '0': '15',
    '15': '30',
    '30': '40',
  };

  const currentWinnerPts = winner === 'A' ? pA : pB;
  if (currentWinnerPts === '40') {
    return awardGame(winner);
  }

  const nextVal = progression[currentWinnerPts] ?? '15';
  return {
    ...prev,
    currentPointA: winner === 'A' ? nextVal : pA,
    currentPointB: winner === 'B' ? nextVal : pB,
  };
}

export function adjustSetGames(
  prev: PadelScoreState,
  setIndex: number,
  side: 'A' | 'B',
  delta: number
): PadelScoreState {
  const sets = prev.sets.map((s) => ({ ...s }));
  while (sets.length <= setIndex) {
    sets.push({ teamA: 0, teamB: 0 });
  }
  const target = sets[setIndex];
  if (side === 'A') {
    target.teamA = Math.max(0, Math.min(7, target.teamA + delta));
  } else {
    target.teamB = Math.max(0, Math.min(7, target.teamB + delta));
  }

  const matchWinner = determineMatchWinner(sets);
  return {
    ...prev,
    sets,
    winnerSide: matchWinner,
  };
}

export function computeLeaderboard(
  teams: Team[],
  matches: Match[],
  categoryId?: string
): LeaderboardRow[] {
  const filteredTeams = categoryId
    ? teams.filter((t) => t.categoryId === categoryId && t.status !== 'withdrawn')
    : teams.filter((t) => t.status !== 'withdrawn');

  const statsMap = new Map<
    string,
    {
      team: Team;
      played: number;
      won: number;
      lost: number;
      setsWon: number;
      setsLost: number;
      gamesWon: number;
      gamesLost: number;
      points: number;
    }
  >();

  for (const team of filteredTeams) {
    statsMap.set(team.id, {
      team,
      played: 0,
      won: 0,
      lost: 0,
      setsWon: 0,
      setsLost: 0,
      gamesWon: 0,
      gamesLost: 0,
      points: 0,
    });
  }

  for (const match of matches) {
    if (categoryId && match.categoryId !== categoryId) continue;
    if (match.status !== 'completed') continue;

    const statA = statsMap.get(match.teamAId);
    const statB = statsMap.get(match.teamBId);
    if (!statA || !statB) continue;

    statA.played += 1;
    statB.played += 1;

    let setsA = 0;
    let setsB = 0;
    let gamesA = 0;
    let gamesB = 0;

    for (const s of match.score.sets) {
      gamesA += s.teamA;
      gamesB += s.teamB;
      if (s.teamA > s.teamB) {
        setsA += 1;
      } else if (s.teamB > s.teamA) {
        setsB += 1;
      }
    }

    statA.setsWon += setsA;
    statA.setsLost += setsB;
    statB.setsWon += setsB;
    statB.setsLost += setsA;

    statA.gamesWon += gamesA;
    statA.gamesLost += gamesB;
    statB.gamesWon += gamesB;
    statB.gamesLost += gamesA;

    const winner = match.score.winnerSide ?? (setsA > setsB ? 'A' : setsB > setsA ? 'B' : null);
    if (winner === 'A') {
      statA.won += 1;
      statA.points += 3;
      statB.lost += 1;
    } else if (winner === 'B') {
      statB.won += 1;
      statB.points += 3;
      statA.lost += 1;
    } else {
      statA.points += 1;
      statB.points += 1;
    }
  }

  const rows: LeaderboardRow[] = Array.from(statsMap.values()).map((entry) => ({
    rank: 0,
    team: entry.team,
    played: entry.played,
    won: entry.won,
    lost: entry.lost,
    setsWon: entry.setsWon,
    setsLost: entry.setsLost,
    setDiff: entry.setsWon - entry.setsLost,
    gamesWon: entry.gamesWon,
    gamesLost: entry.gamesLost,
    gameDiff: entry.gamesWon - entry.gamesLost,
    points: entry.points,
  }));

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
    if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
    return a.team.teamName.localeCompare(b.team.teamName);
  });

  return rows.map((row, idx) => ({
    ...row,
    rank: idx + 1,
  }));
}

export interface PairingCandidate {
  teamAId: string;
  teamBId: string;
  stage: string;
}

export function generateRoundRobinPairings(
  teams: Team[],
  categoryId: string,
  existingMatches: Match[],
  stage = 'Fase Grup'
): PairingCandidate[] {
  const active = teams
    .filter((t) => t.categoryId === categoryId && t.status !== 'withdrawn')
    .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));

  const existingPairs = new Set<string>();
  for (const m of existingMatches) {
    if (m.categoryId !== categoryId) continue;
    const key = [m.teamAId, m.teamBId].sort().join('::');
    existingPairs.add(key);
  }

  const candidates: PairingCandidate[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const key = [active[i].id, active[j].id].sort().join('::');
      if (!existingPairs.has(key)) {
        candidates.push({
          teamAId: active[i].id,
          teamBId: active[j].id,
          stage,
        });
      }
    }
  }
  return candidates;
}

export function generateKnockoutPairings(
  teams: Team[],
  categoryId: string,
  stage = 'Babak Gugur'
): PairingCandidate[] {
  const active = teams
    .filter((t) => t.categoryId === categoryId && t.status !== 'withdrawn')
    .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));

  const candidates: PairingCandidate[] = [];
  const pairCount = Math.floor(active.length / 2);
  for (let i = 0; i < pairCount; i++) {
    const highSeed = active[i];
    const lowSeed = active[active.length - 1 - i];
    if (highSeed && lowSeed && highSeed.id !== lowSeed.id) {
      candidates.push({
        teamAId: highSeed.id,
        teamBId: lowSeed.id,
        stage,
      });
    }
  }
  return candidates;
}

export interface ScheduleConflict {
  type: 'court_busy' | 'team_busy';
  message: string;
  conflictingMatchId: string;
}

export function detectScheduleConflict(
  matches: Match[],
  candidate: {
    id?: string;
    courtId: string | null;
    scheduledDate: string;
    scheduledTime: string;
    teamAId: string;
    teamBId: string;
  }
): ScheduleConflict | null {
  if (!candidate.scheduledDate || !candidate.scheduledTime) {
    return null;
  }

  for (const m of matches) {
    if (candidate.id && m.id === candidate.id) continue;
    if (m.status === 'completed' || m.status === 'postponed') continue;
    if (m.scheduledDate !== candidate.scheduledDate || m.scheduledTime !== candidate.scheduledTime) {
      continue;
    }

    if (candidate.courtId && m.courtId === candidate.courtId) {
      return {
        type: 'court_busy',
        message: `Court sudah terpakai oleh Match #${m.matchNumber} pada ${m.scheduledTime}.`,
        conflictingMatchId: m.id,
      };
    }

    const teamsInExisting = new Set([m.teamAId, m.teamBId]);
    if (teamsInExisting.has(candidate.teamAId) || teamsInExisting.has(candidate.teamBId)) {
      return {
        type: 'team_busy',
        message: `Salah satu pasangan sudah dijadwalkan di Match #${m.matchNumber} pada ${m.scheduledTime}.`,
        conflictingMatchId: m.id,
      };
    }
  }

  return null;
}

export function formatScoreSummary(score: PadelScoreState): string {
  return score.sets.map((s) => `${s.teamA}-${s.teamB}`).join(', ');
}

export function buildWhatsAppScheduleMessage(params: {
  tournamentName: string;
  venue: string;
  match: Match;
  teamA: Team;
  teamB: Team;
  courtName: string;
  categoryName: string;
  eventType: WhatsAppEventType;
  publicUrl: string;
}): string {
  const {
    tournamentName,
    venue,
    match,
    teamA,
    teamB,
    courtName,
    categoryName,
    eventType,
    publicUrl,
  } = params;

  const headerMap: Record<WhatsAppEventType, string> = {
    scheduled: 'JADWAL PERTANDINGAN BARU',
    updated: 'PEMBARUAN JADWAL PERTANDINGAN',
    court_changed: 'PERUBAHAN COURT PERTANDINGAN',
    called_to_court: 'PANGGILAN MASUK COURT SEKARANG',
    test: 'UJI NOTIFIKASI TURNAMEN',
  };

  const header = headerMap[eventType];
  return [
    `*${header}*`,
    `${tournamentName} (${venue})`,
    '',
    `Kategori: ${categoryName} · ${match.stage}`,
    `Match #${match.matchNumber}: *${teamA.teamName}* vs *${teamB.teamName}*`,
    `Court: *${courtName}*`,
    `Jadwal: ${match.scheduledDate} pukul ${match.scheduledTime} WIB`,
    '',
    `Pantau skor live & leaderboard: ${publicUrl}`,
  ].join('\n');
}
