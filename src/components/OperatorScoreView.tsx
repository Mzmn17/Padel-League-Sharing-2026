import { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Lock,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Save,
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
  setManualPadelScore,
} from '../utils/tournamentLogic.ts';

interface OperatorScoreViewProps {
  state: TournamentState;
  isAdmin: boolean;
  onRequireAdminLogin: () => void;
  selectedMatchId: string | null;
  onSelectMatch: (matchId: string) => void;
  onUpdateMatchScore: (
    matchId: string,
    payload: { score: PadelScoreState; status?: MatchStatus }
  ) => Promise<Match>;
}

export function OperatorScoreView({
  state,
  isAdmin,
  onRequireAdminLogin,
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
  const [savedToast, setSavedToast] = useState(false);

  const [draftPointA, setDraftPointA] = useState('0');
  const [draftPointB, setDraftPointB] = useState('0');
  const [draftSets, setDraftSets] = useState<Array<{ teamA: string; teamB: string }>>([
    { teamA: '0', teamB: '0' },
  ]);

  useEffect(() => {
    setHistory([]);
    setSavedToast(false);
  }, [activeMatch?.id]);

  useEffect(() => {
    if (!activeMatch) return;
    setDraftPointA(activeMatch.score.currentPointA || '0');
    setDraftPointB(activeMatch.score.currentPointB || '0');
    setDraftSets(
      activeMatch.score.sets.map((s) => ({
        teamA: String(s.teamA ?? 0),
        teamB: String(s.teamB ?? 0),
      }))
    );
  }, [
    activeMatch?.id,
    activeMatch?.updatedAt,
    activeMatch?.score.currentPointA,
    activeMatch?.score.currentPointB,
    activeMatch?.score.sets,
  ]);

  if (!activeMatch) {
    return (
      <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl p-10 text-center text-sm text-blue-200/75">
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
    if (!isAdmin) {
      onRequireAdminLogin();
      return;
    }
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
    if (!isAdmin) {
      onRequireAdminLogin();
      return;
    }
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
    if (!isAdmin) {
      onRequireAdminLogin();
      return;
    }
    setHistory((prev) => [...prev.slice(-15), activeMatch.score]);
    const nextScore = adjustSetGames(activeMatch.score, setIdx, side, delta);
    const nextStatus: MatchStatus =
      activeMatch.status === 'scheduled' ? 'live' : activeMatch.status;
    await commitScore(nextScore, nextStatus);
  };

  const handleApplyManualScore = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin) {
      onRequireAdminLogin();
      return;
    }
    setHistory((prev) => [...prev.slice(-15), activeMatch.score]);
    const parsedSets = draftSets.map((s) => ({
      teamA: Number.parseInt(s.teamA, 10) || 0,
      teamB: Number.parseInt(s.teamB, 10) || 0,
    }));
    const nextScore = setManualPadelScore(activeMatch.score, {
      sets: parsedSets,
      currentPointA: draftPointA,
      currentPointB: draftPointB,
    });
    const nextStatus: MatchStatus = nextScore.winnerSide
      ? 'completed'
      : activeMatch.status === 'scheduled'
        ? 'live'
        : activeMatch.status;
    await commitScore(nextScore, nextStatus);
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 2000);
  };

  const handleUndo = async () => {
    if (!isAdmin) {
      onRequireAdminLogin();
      return;
    }
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
    if (!isAdmin) {
      onRequireAdminLogin();
      return;
    }
    setHistory([]);
    await commitScore(createInitialScore(state.tournament.goldenPointDefault), 'live');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Konsol Input Skor Operator
          </h1>
          <p className="text-sm text-blue-200/75">
            Admin &amp; Panitia dapat menekan tombol poin atau mengetik skor set dan poin secara
            manual. Sinkron otomatis ke Live Leaderboard, Link Publik, dan Display LED.
          </p>
        </div>
        {!isAdmin && (
          <button
            type="button"
            onClick={onRequireAdminLogin}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            Login Admin untuk Input Skor
          </button>
        )}
      </div>

      {!isAdmin && (
        <div className="px-4 py-3 bg-[#0A1D52] border border-[#284BA8] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-blue-100">
            <Lock className="w-4 h-4 text-sky-300 shrink-0" />
            <span>
              Mode Lihat Skor: Anda sedang melihat skor langsung. Login sebagai Admin atau Panitia
              untuk mengetik skor manual, mengubah poin rally, atau mengakhiri pertandingan.
            </span>
          </div>
          <button
            type="button"
            onClick={onRequireAdminLogin}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            Login Admin
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Match Selector List */}
        <aside className="lg:col-span-4 bg-[#0A1D52] border border-[#1B3782] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1B3782] bg-[#071540] text-xs font-bold text-blue-100">
            Pilih Pertandingan ({orderedMatches.length})
          </div>
          <div className="divide-y divide-[#1B3782] max-h-[580px] overflow-y-auto">
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
                    isSelected ? 'bg-[#122D7A]' : 'hover:bg-[#0E2563]/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold text-blue-200/80 tabular-nums">
                      Match #{m.matchNumber} · {crt?.name || 'Court -'}
                    </span>
                    <span
                      className={`font-semibold ${
                        m.status === 'live'
                          ? 'text-emerald-400'
                          : m.status === 'completed'
                            ? 'text-blue-300/60'
                            : 'text-sky-300'
                      }`}
                    >
                      {m.status === 'live'
                        ? 'LIVE'
                        : m.status === 'completed'
                          ? 'Selesai'
                          : `${m.scheduledTime} WITA`}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white truncate">
                    {tA?.teamName} vs {tB?.teamName}
                  </div>
                  <div className="mt-0.5 text-xs font-mono text-blue-200/75 tabular-nums">
                    {formatScoreSummary(m.score)} ({m.score.currentPointA}-{m.score.currentPointB})
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Active Scoring Console */}
        <section className="lg:col-span-8 bg-[#0A1D52] border border-[#1B3782] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1B3782] flex flex-wrap items-center justify-between gap-3 bg-[#071540]">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-blue-200/75">
                <span className="font-mono font-semibold text-white">
                  Match #{activeMatch.matchNumber}
                </span>
                <span aria-hidden="true">·</span>
                <span>{category?.name}</span>
                <span aria-hidden="true">·</span>
                <span>{activeMatch.stage}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-sky-300">
                  {court?.name || 'Belum ada court'}
                </span>
              </div>
              <h2 className="mt-0.5 text-lg font-bold text-white">
                {teamA?.teamName} vs {teamB?.teamName}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeMatch.status === 'scheduled' && (
                <button
                  type="button"
                  disabled={!isAdmin || saving}
                  onClick={() => commitScore(activeMatch.score, 'live')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  Mulai Match (Live)
                </button>
              )}
              <button
                type="button"
                disabled={!isAdmin || saving}
                onClick={handleToggleGoldenPoint}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border disabled:opacity-50 cursor-pointer ${
                  activeMatch.score.goldenPoint
                    ? 'bg-amber-950/60 border-amber-500/40 text-amber-200'
                    : 'bg-[#0D2363] border-[#284BA8] text-blue-100 hover:text-white'
                }`}
              >
                {activeMatch.score.goldenPoint ? 'Mode: Golden Point' : 'Mode: Advantage'}
              </button>
              <button
                type="button"
                disabled={!isAdmin || history.length === 0 || saving}
                onClick={handleUndo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0D2363] hover:bg-[#132E7D] disabled:opacity-40 text-blue-100 border border-[#284BA8] text-xs font-semibold rounded-lg cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Undo
              </button>
            </div>
          </div>

          <form onSubmit={handleApplyManualScore} className="divide-y divide-[#1B3782]">
            {/* Live Point Control Board */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#1B3782]">
              {/* Team A Zone */}
              <div
                className={`p-6 ${
                  activeMatch.score.winnerSide === 'A' ? 'bg-emerald-950/35' : 'bg-[#0A1D52]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium text-blue-200/75">
                      Pasangan A · {teamA?.region || teamA?.club}
                    </div>
                    <div className="text-lg font-bold text-white">{teamA?.teamName}</div>
                    <div className="text-xs text-blue-200/75">
                      {teamA?.player1.name} &amp; {teamA?.player2.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!isAdmin || saving}
                    onClick={handleToggleServing}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md disabled:opacity-50 cursor-pointer ${
                      activeMatch.score.servingTeam === 'A'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#06133B] text-blue-200 border border-[#1B3782]'
                    }`}
                  >
                    {activeMatch.score.servingTeam === 'A' ? 'Servis' : 'Penerima'}
                  </button>
                </div>

                <div className="mt-5 flex items-center justify-between gap-4">
                  <div className="font-mono text-5xl font-bold text-white tabular-nums">
                    {activeMatch.score.currentPointA}
                  </div>
                  <button
                    type="button"
                    disabled={!isAdmin || saving || activeMatch.status === 'completed'}
                    onClick={() => handleRallyPoint('A')}
                    className="px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    +1 Poin A
                  </button>
                </div>

                {isAdmin && (
                  <div className="mt-4 pt-3 border-t border-[#1B3782]/70 flex items-center justify-between gap-3">
                    <label
                      htmlFor="manual-point-a"
                      className="text-xs font-medium text-blue-200/80 whitespace-nowrap"
                    >
                      Ketik Poin A:
                    </label>
                    <input
                      id="manual-point-a"
                      aria-label="Ketik poin manual Pasangan A"
                      type="text"
                      maxLength={8}
                      value={draftPointA}
                      onChange={(e) => setDraftPointA(e.target.value)}
                      placeholder="0 / 15 / 30 / 40 / AD"
                      className="w-28 px-2.5 py-1.5 text-center font-mono text-sm font-bold bg-[#06133B] border border-[#284BA8] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Team B Zone */}
              <div
                className={`p-6 ${
                  activeMatch.score.winnerSide === 'B' ? 'bg-emerald-950/35' : 'bg-[#0A1D52]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium text-blue-200/75">
                      Pasangan B · {teamB?.region || teamB?.club}
                    </div>
                    <div className="text-lg font-bold text-white">{teamB?.teamName}</div>
                    <div className="text-xs text-blue-200/75">
                      {teamB?.player1.name} &amp; {teamB?.player2.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!isAdmin || saving}
                    onClick={handleToggleServing}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md disabled:opacity-50 cursor-pointer ${
                      activeMatch.score.servingTeam === 'B'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#06133B] text-blue-200 border border-[#1B3782]'
                    }`}
                  >
                    {activeMatch.score.servingTeam === 'B' ? 'Servis' : 'Penerima'}
                  </button>
                </div>

                <div className="mt-5 flex items-center justify-between gap-4">
                  <div className="font-mono text-5xl font-bold text-white tabular-nums">
                    {activeMatch.score.currentPointB}
                  </div>
                  <button
                    type="button"
                    disabled={!isAdmin || saving || activeMatch.status === 'completed'}
                    onClick={() => handleRallyPoint('B')}
                    className="px-5 py-3 bg-[#132E7D] hover:bg-[#193B9E] border border-[#2F58C4] disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    +1 Poin B
                  </button>
                </div>

                {isAdmin && (
                  <div className="mt-4 pt-3 border-t border-[#1B3782]/70 flex items-center justify-between gap-3">
                    <label
                      htmlFor="manual-point-b"
                      className="text-xs font-medium text-blue-200/80 whitespace-nowrap"
                    >
                      Ketik Poin B:
                    </label>
                    <input
                      id="manual-point-b"
                      aria-label="Ketik poin manual Pasangan B"
                      type="text"
                      maxLength={8}
                      value={draftPointB}
                      onChange={(e) => setDraftPointB(e.target.value)}
                      placeholder="0 / 15 / 30 / 40 / AD"
                      className="w-28 px-2.5 py-1.5 text-center font-mono text-sm font-bold bg-[#06133B] border border-[#284BA8] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Direct Set Game Editor (Manual Typing + Stepper) */}
            <div>
              <div className="px-6 py-3 bg-[#071540] border-b border-[#1B3782] flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-blue-100">
                  Skor Game Per Set (Ketik Manual / +/- Langsung)
                </h3>
                <div className="flex items-center gap-3">
                  {isAdmin && activeMatch.score.sets.length < 3 && (
                    <button
                      type="button"
                      onClick={handleAddSetColumn}
                      className="text-xs font-semibold text-sky-300 hover:text-sky-200 cursor-pointer"
                    >
                      + Tambah Set
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E7F028] hover:bg-[#f2f966] disabled:opacity-50 text-[#06133B] text-xs font-bold rounded-md cursor-pointer"
                    >
                      {savedToast ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Tersimpan
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          Simpan Skor Manual
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#1B3782] text-xs font-semibold text-blue-200/80">
                      <th className="py-2.5 px-6">Pasangan</th>
                      {activeMatch.score.sets.map((_, idx) => (
                        <th key={idx} className="py-2.5 px-4 text-center tabular-nums">
                          Set {idx + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B3782] text-sm">
                    <tr>
                      <td className="py-3 px-6 font-semibold text-white">{teamA?.teamName}</td>
                      {activeMatch.score.sets.map((s, idx) => (
                        <td key={idx} className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              disabled={!isAdmin || saving}
                              aria-label={`Kurangi game Set ${idx + 1} ${teamA?.teamName}`}
                              onClick={() => handleAdjustSetGame(idx, 'A', -1)}
                              className="p-1.5 border border-[#284BA8] text-blue-100 hover:bg-[#132E7D] disabled:opacity-40 rounded cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            {isAdmin ? (
                              <input
                                type="number"
                                min={0}
                                max={20}
                                aria-label={`Skor Set ${idx + 1} ${teamA?.teamName}`}
                                value={draftSets[idx]?.teamA ?? String(s.teamA)}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraftSets((prev) =>
                                    prev.map((row, rIdx) =>
                                      rIdx === idx ? { ...row, teamA: val } : row
                                    )
                                  );
                                }}
                                className="w-12 py-1 text-center font-mono text-base font-bold text-white bg-[#06133B] border border-[#284BA8] rounded tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              <span className="w-8 text-center font-mono text-lg font-bold text-white tabular-nums">
                                {s.teamA}
                              </span>
                            )}
                            <button
                              type="button"
                              disabled={!isAdmin || saving}
                              aria-label={`Tambah game Set ${idx + 1} ${teamA?.teamName}`}
                              onClick={() => handleAdjustSetGame(idx, 'A', 1)}
                              className="p-1.5 border border-[#284BA8] text-blue-100 hover:bg-[#132E7D] disabled:opacity-40 rounded cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-6 font-semibold text-white">{teamB?.teamName}</td>
                      {activeMatch.score.sets.map((s, idx) => (
                        <td key={idx} className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              disabled={!isAdmin || saving}
                              aria-label={`Kurangi game Set ${idx + 1} ${teamB?.teamName}`}
                              onClick={() => handleAdjustSetGame(idx, 'B', -1)}
                              className="p-1.5 border border-[#284BA8] text-blue-100 hover:bg-[#132E7D] disabled:opacity-40 rounded cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            {isAdmin ? (
                              <input
                                type="number"
                                min={0}
                                max={20}
                                aria-label={`Skor Set ${idx + 1} ${teamB?.teamName}`}
                                value={draftSets[idx]?.teamB ?? String(s.teamB)}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraftSets((prev) =>
                                    prev.map((row, rIdx) =>
                                      rIdx === idx ? { ...row, teamB: val } : row
                                    )
                                  );
                                }}
                                className="w-12 py-1 text-center font-mono text-base font-bold text-white bg-[#06133B] border border-[#284BA8] rounded tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              <span className="w-8 text-center font-mono text-lg font-bold text-white tabular-nums">
                                {s.teamB}
                              </span>
                            )}
                            <button
                              type="button"
                              disabled={!isAdmin || saving}
                              aria-label={`Tambah game Set ${idx + 1} ${teamB?.teamName}`}
                              onClick={() => handleAdjustSetGame(idx, 'B', 1)}
                              className="p-1.5 border border-[#284BA8] text-blue-100 hover:bg-[#132E7D] disabled:opacity-40 rounded cursor-pointer"
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
            <div className="px-6 py-4 bg-[#071540] flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={!isAdmin || saving}
                onClick={handleResetMatch}
                className="px-3.5 py-2 text-xs font-semibold text-red-300 hover:bg-red-950/60 disabled:opacity-40 border border-red-500/40 rounded-lg cursor-pointer"
              >
                Reset Skor ke 0-0
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {activeMatch.status !== 'completed' ? (
                  <>
                    <button
                      type="button"
                      disabled={!isAdmin || saving}
                      onClick={() => handleMarkCompleted('A')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      Menang: {teamA?.teamName}
                    </button>
                    <button
                      type="button"
                      disabled={!isAdmin || saving}
                      onClick={() => handleMarkCompleted('B')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      Menang: {teamB?.teamName}
                    </button>
                  </>
                ) : (
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Pertandingan Selesai · Pemenang:{' '}
                    {activeMatch.score.winnerSide === 'A' ? teamA?.teamName : teamB?.teamName}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => commitScore({ ...activeMatch.score, winnerSide: null }, 'live')}
                        className="ml-2 px-2.5 py-1 text-blue-100 border border-[#284BA8] rounded hover:bg-[#132E7D] cursor-pointer"
                      >
                        Buka Kembali
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
