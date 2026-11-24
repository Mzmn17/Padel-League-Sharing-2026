import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import type {
  Match,
  MatchStatus,
  PadelScoreState,
  TournamentState,
} from '../types/tournament.ts';
import {
  adjustSetGames,
  applyPadelPoint,
  createInitialScore,
  formatScoreSummary,
} from '../utils/tournamentLogic.ts';

interface OperatorScoreViewProps {
  state: TournamentState;
  selectedMatchId: string | null;
  onSelectMatch: (matchId: string) => void;
  onUpdateMatchScore: (
    matchId: string,
    payload: { score: PadelScoreState; status?: MatchStatus }
  ) => Promise<Match>;
}

export function OperatorScoreView({
  state,
  selectedMatchId,
  onSelectMatch,
  onUpdateMatchScore,
}: OperatorScoreViewProps) {
  const orderedMatches = state.matches
    .slice()
    .sort((a, b) => {
      const rank = { live: 0, scheduled: 1, postponed: 2, completed: 3 };
      const rDiff = rank[a.status] - rank[b.status];
      if (rDiff !== 0) return rDiff;
      return a.matchNumber - b.matchNumber;
    });

  const activeMatch =
    orderedMatches.find((m) => m.id === selectedMatchId) || orderedMatches[0] || null;

  const [history, setHistory] = useState<PadelScoreState[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHistory([]);
  }, [activeMatch?.id]);

  if (!activeMatch) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
        Belum ada pertandingan yang dijadwalkan. Buat pairing terlebih dahulu di menu Pairing &amp;
        Jadwal.
      </div>
    );
  }

  const teamA = state.teams.find((t) => t.id === activeMatch.teamAId);
  const teamB = state.teams.find((t) => t.id === activeMatch.teamBId);
  const category = state.categories.find((c) => c.id === activeMatch.categoryId);
  const court = state.courts.find((c) => c.id === activeMatch.courtId);

  const commitScore = async (nextScore: PadelScoreState, nextStatus?: MatchStatus) => {
    setSaving(true);
    try {
      await onUpdateMatchScore(activeMatch.id, {
        score: nextScore,
        status: nextStatus,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRallyPoint = async (side: 'A' | 'B') => {
    setHistory((prev) => [...prev.slice(-15), activeMatch.score]);
    const nextScore = applyPadelPoint(activeMatch.score, side);
    const nextStatus: MatchStatus = nextScore.winnerSide
      ? 'completed'
      : activeMatch.status === 'scheduled'
        ? 'live'
        : activeMatch.status;
    await commitScore(nextScore, nextStatus);
  };

  const handleAdjustSetGame = async (setIdx: number, side: 'A' | 'B', delta: number) => {
    setHistory((prev) => [...prev.slice(-15), activeMatch.score]);
    const nextScore = adjustSetGames(activeMatch.score, setIdx, side, delta);
    const nextStatus: MatchStatus =
      activeMatch.status === 'scheduled' ? 'live' : activeMatch.status;
    await commitScore(nextScore, nextStatus);
  };

  const handleUndo = async () => {
    if (history.length === 0) return;
    const prevScore = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    await commitScore(prevScore, activeMatch.status === 'completed' ? 'live' : activeMatch.status);
  };

  const handleToggleServing = async () => {
    const nextScore: PadelScoreState = {
      ...activeMatch.score,
      servingTeam: activeMatch.score.servingTeam === 'A' ? 'B' : 'A',
    };
    await commitScore(nextScore);
  };

  const handleToggleGoldenPoint = async () => {
    const nextScore: PadelScoreState = {
      ...activeMatch.score,
      goldenPoint: !activeMatch.score.goldenPoint,
    };
    await commitScore(nextScore);
  };

  const handleAddSetColumn = async () => {
    if (activeMatch.score.sets.length >= 3) return;
    const nextScore: PadelScoreState = {
      ...activeMatch.score,
      sets: [...activeMatch.score.sets, { teamA: 0, teamB: 0 }],
    };
    await commitScore(nextScore);
  };

  const handleMarkCompleted = async (winnerSide?: 'A' | 'B') => {
    const resolvedWinner =
      winnerSide ||
      activeMatch.score.winnerSide ||
      (() => {
        let sA = 0;
        let sB = 0;
        for (const s of activeMatch.score.sets) {
          if (s.teamA > s.teamB) sA++;
          else if (s.teamB > s.teamA) sB++;
        }
        return sA >= sB ? 'A' : 'B';
      })();

    const nextScore: PadelScoreState = {
      ...activeMatch.score,
      winnerSide: resolvedWinner,
    };
    await commitScore(nextScore, 'completed');
  };

  const handleResetMatch = async () => {
    setHistory([]);
    await commitScore(createInitialScore(state.tournament.goldenPointDefault), 'live');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Konsol Input Skor Operator
          </h1>
          <p className="text-sm text-slate-500">
            Setiap poin atau skor game yang diinput otomatis sinkron ke Live Leaderboard, Link
            Publik, dan Display LED.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Match Selector List */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-700">
            Pilih Pertandingan ({orderedMatches.length})
          </div>
          <div className="divide-y divide-slate-200 max-h-[540px] overflow-y-auto">
            {orderedMatches.map((m) => {
              const tA = state.teams.find((t) => t.id === m.teamAId);
              const tB = state.teams.find((t) => t.id === m.teamBId);
              const crt = state.courts.find((c) => c.id === m.courtId);
              const isSelected = m.id === activeMatch.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectMatch(m.id)}
                  className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold text-slate-600 tabular-nums">
                      Match #{m.matchNumber} · {crt?.name.split('·')[0].trim() || 'Court -'}
                    </span>
                    <span
                      className={`font-semibold ${
                        m.status === 'live'
                          ? 'text-emerald-700'
                          : m.status === 'completed'
                            ? 'text-slate-500'
                            : 'text-blue-700'
                      }`}
                    >
                      {m.status === 'live'
                        ? 'LIVE'
                        : m.status === 'completed'
                          ? 'Selesai'
                          : `${m.scheduledTime} WIB`}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 truncate">
                    {tA?.teamName} vs {tB?.teamName}
                  </div>
                  <div className="mt-0.5 text-xs font-mono text-slate-500 tabular-nums">
                    {formatScoreSummary(m.score)} ({m.score.currentPointA}-{m.score.currentPointB})
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Active Scoring Console */}
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold text-slate-800">
                  Match #{activeMatch.matchNumber}
                </span>
                <span aria-hidden="true">·</span>
                <span>{category?.name}</span>
                <span aria-hidden="true">·</span>
                <span>{activeMatch.stage}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-slate-800">
                  {court?.name || 'Belum ada court'}
                </span>
              </div>
              <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                {teamA?.teamName} vs {teamB?.teamName}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeMatch.status === 'scheduled' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => commitScore(activeMatch.score, 'live')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  Mulai Match (Live)
                </button>
              )}
              <button
                type="button"
                onClick={handleToggleGoldenPoint}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                  activeMatch.score.goldenPoint
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                {activeMatch.score.goldenPoint ? 'Mode: Golden Point' : 'Mode: Advantage'}
              </button>
              <button
                type="button"
                disabled={history.length === 0 || saving}
                onClick={handleUndo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Undo
              </button>
            </div>
          </div>

          {/* Live Point Control Board */}
          <div className="divide-y divide-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
              {/* Team A Zone */}
              <div
                className={`p-6 ${
                  activeMatch.score.winnerSide === 'A' ? 'bg-emerald-50/40' : 'bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Pasangan A · {teamA?.club}
                    </div>
                    <div className="text-lg font-bold text-slate-900">{teamA?.teamName}</div>
                    <div className="text-xs text-slate-500">
                      {teamA?.player1.name} &amp; {teamA?.player2.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleServing}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                      activeMatch.score.servingTeam === 'A'
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {activeMatch.score.servingTeam === 'A' ? 'Servis' : 'Penerima'}
                  </button>
                </div>

                <div className="mt-5 flex items-center justify-between gap-4">
                  <div className="font-mono text-5xl font-bold text-slate-900 tabular-nums">
                    {activeMatch.score.currentPointA}
                  </div>
                  <button
                    type="button"
                    disabled={saving || activeMatch.status === 'completed'}
                    onClick={() => handleRallyPoint('A')}
                    className="px-5 py-3 bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    +1 Poin A
                  </button>
                </div>
              </div>

              {/* Team B Zone */}
              <div
                className={`p-6 ${
                  activeMatch.score.winnerSide === 'B' ? 'bg-emerald-50/40' : 'bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Pasangan B · {teamB?.club}
                    </div>
                    <div className="text-lg font-bold text-slate-900">{teamB?.teamName}</div>
                    <div className="text-xs text-slate-500">
                      {teamB?.player1.name} &amp; {teamB?.player2.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleServing}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                      activeMatch.score.servingTeam === 'B'
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {activeMatch.score.servingTeam === 'B' ? 'Servis' : 'Penerima'}
                  </button>
                </div>

                <div className="mt-5 flex items-center justify-between gap-4">
                  <div className="font-mono text-5xl font-bold text-slate-900 tabular-nums">
                    {activeMatch.score.currentPointB}
                  </div>
                  <button
                    type="button"
                    disabled={saving || activeMatch.status === 'completed'}
                    onClick={() => handleRallyPoint('B')}
                    className="px-5 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    +1 Poin B
                  </button>
                </div>
              </div>
            </div>

            {/* Direct Set Game Editor */}
            <div>
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700">
                  Skor Game Per Set (Koreksi / Input Langsung)
                </h3>
                {activeMatch.score.sets.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddSetColumn}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer"
                  >
                    + Tambah Set
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                      <th className="py-2.5 px-6">Pasangan</th>
                      {activeMatch.score.sets.map((_, idx) => (
                        <th key={idx} className="py-2.5 px-4 text-center tabular-nums">
                          Set {idx + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    <tr>
                      <td className="py-3 px-6 font-semibold text-slate-900">{teamA?.teamName}</td>
                      {activeMatch.score.sets.map((s, idx) => (
                        <td key={idx} className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              aria-label={`Kurangi game Set ${idx + 1} ${teamA?.teamName}`}
                              onClick={() => handleAdjustSetGame(idx, 'A', -1)}
                              className="p-1.5 border border-slate-200 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center font-mono text-lg font-bold tabular-nums">
                              {s.teamA}
                            </span>
                            <button
                              type="button"
                              aria-label={`Tambah game Set ${idx + 1} ${teamA?.teamName}`}
                              onClick={() => handleAdjustSetGame(idx, 'A', 1)}
                              className="p-1.5 border border-slate-200 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-6 font-semibold text-slate-900">{teamB?.teamName}</td>
                      {activeMatch.score.sets.map((s, idx) => (
                        <td key={idx} className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              aria-label={`Kurangi game Set ${idx + 1} ${teamB?.teamName}`}
                              onClick={() => handleAdjustSetGame(idx, 'B', -1)}
                              className="p-1.5 border border-slate-200 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center font-mono text-lg font-bold tabular-nums">
                              {s.teamB}
                            </span>
                            <button
                              type="button"
                              aria-label={`Tambah game Set ${idx + 1} ${teamB?.teamName}`}
                              onClick={() => handleAdjustSetGame(idx, 'B', 1)}
                              className="p-1.5 border border-slate-200 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Controls */}
            <div className="px-6 py-4 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetMatch}
                className="px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 border border-red-200 rounded-lg cursor-pointer"
              >
                Reset Skor ke 0-0
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {activeMatch.status !== 'completed' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleMarkCompleted('A')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      Menang: {teamA?.teamName}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarkCompleted('B')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      Menang: {teamB?.teamName}
                    </button>
                  </>
                ) : (
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    Pertandingan Selesai · Pemenang:{' '}
                    {activeMatch.score.winnerSide === 'A' ? teamA?.teamName : teamB?.teamName}
                    <button
                      type="button"
                      onClick={() => commitScore({ ...activeMatch.score, winnerSide: null }, 'live')}
                      className="ml-2 px-2.5 py-1 text-slate-700 border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                    >
                      Buka Kembali
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
