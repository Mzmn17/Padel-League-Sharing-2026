import { useState } from 'react';
import { ArrowLeft, Check, Copy, GitBranch, Lock, Plus, Trophy } from 'lucide-react';
import type { Participant, TournamentState } from '../types/tournament.ts';
import {
  TOURNAMENT_TIME_LABEL,
  computeLeaderboard,
  formatScoreSummary,
  formatTournamentScheduleDate,
} from '../utils/tournamentLogic.ts';
import { ParticipantFormModal } from './ParticipantsView.tsx';
import { BracketView } from './BracketView.tsx';
import tournamentBannerImg from '../assets/images/WhatsApp Image 2026-11-24 at 11.29.56.jpeg';
import tournamentLogoImg from '../assets/images/padel_league_logo.png';

interface PublicResultsViewProps {
  state: TournamentState;
  sseConnected: boolean;
  isAdmin: boolean;
  isSignedIn?: boolean;
  onSignInGoogle?: () => Promise<unknown>;
  onRequireAdminLogin: () => void;
  onExitPublic: () => void;
  onRegisterParticipant: (payload: {
    name: string;
    region: string;
    representation?: string;
    categoryId: string;
    level: string;
  }) => Promise<Participant>;
}

export function PublicResultsView({
  state,
  sseConnected,
  isAdmin,
  isSignedIn = false,
  onSignInGoogle,
  onRequireAdminLogin,
  onExitPublic,
  onRegisterParticipant,
}: PublicResultsViewProps) {
  const [selectedCategory, setSelectedCategory] = useState(state.categories[0]?.id || '');
  const [publicSection, setPublicSection] = useState<'schedule' | 'bracket'>('schedule');
  const [copied, setCopied] = useState(false);
  const [showRegModal, setShowRegModal] = useState(false);

  const publicUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/?view=public` : '/?view=public';

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(publicUrl).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeCategoryId = state.categories.some((c) => c.id === selectedCategory)
    ? selectedCategory
    : state.categories[0]?.id || '';

  const liveMatches = state.matches.filter((m) => m.status === 'live');
  const categoryMatches = state.matches
    .filter((m) => m.categoryId === activeCategoryId)
    .slice()
    .sort((a, b) => {
      const rank = { live: 0, scheduled: 1, completed: 2, postponed: 3 };
      const rDiff = rank[a.status] - rank[b.status];
      if (rDiff !== 0) return rDiff;
      return a.scheduledTime.localeCompare(b.scheduledTime);
    });

  const leaderboard = computeLeaderboard(state.teams, state.matches, activeCategoryId);

  return (
    <div className="min-h-screen bg-[#06133B] text-slate-100">
      {/* Clean Public Header */}
      <header className="bg-[#081744] border-b border-[#1B3782]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-16 py-2.5 sm:py-0 flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={tournamentLogoImg}
              alt="Padel League & Share 2026"
              className="h-12 sm:h-14 w-auto object-contain"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRegModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Daftar Turnamen
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0D2363] hover:bg-[#132E7D] text-white border border-[#284BA8] text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Link Tersalin' : 'Salin Link Publik'}
            </button>
            {isAdmin ? (
              <button
                type="button"
                onClick={onExitPublic}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#122D7A] hover:bg-[#1B3D9E] text-xs font-semibold text-white rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Kembali ke Beranda
              </button>
            ) : (
              <button
                type="button"
                onClick={onRequireAdminLogin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0D2363] hover:bg-[#132E7D] text-blue-200 hover:text-white border border-[#284BA8] text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-sky-300" />
                Login Admin
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Public Banner */}
        <section className="rounded-xl overflow-hidden bg-[#0A1D52] border border-[#1B3782]">
          <div className="w-full bg-[#06133B]">
            <img
              src={tournamentBannerImg}
              alt={state.tournament.name}
              referrerPolicy="no-referrer"
              className="w-full h-auto max-h-[280px] object-contain mx-auto block"
            />
          </div>
          <div className="px-6 py-5 border-t border-[#1B3782] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white text-balance">
                {state.tournament.name === 'Padel League & Share'
                  ? 'Padel League & Share 2026'
                  : state.tournament.name}
              </h1>
              <p className="text-sm font-medium text-sky-300">
                {state.tournament.caption &&
                (state.tournament.caption.toLowerCase().includes('retail sales') ||
                  state.tournament.caption.toLowerCase().includes('awarding') ||
                  state.tournament.caption.toLowerCase().includes('padel turnamen'))
                  ? 'Sulawesi Edition'
                  : state.tournament.caption || 'Sulawesi Edition'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-blue-200/80 font-medium">
              <span>{state.tournament.venue}</span>
              <span aria-hidden="true">·</span>
              <span>{state.tournament.city}</span>
              <span aria-hidden="true">·</span>
              <span className="text-sky-300 font-semibold">
                {formatTournamentScheduleDate(state.tournament.startDate, state.tournament.endDate)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-white font-semibold">{TOURNAMENT_TIME_LABEL}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                {sseConnected && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                )}
                {sseConnected ? 'Pembaruan Langsung Aktif' : 'Menghubungkan...'}
              </span>
            </div>
          </div>
        </section>

        {/* Live Matches Right Now */}
        {liveMatches.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">Sedang Bertanding Saat Ini</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {liveMatches.map((m) => {
                const tA = state.teams.find((t) => t.id === m.teamAId);
                const tB = state.teams.find((t) => t.id === m.teamBId);
                const crt = state.courts.find((c) => c.id === m.courtId);
                const cat = state.categories.find((c) => c.id === m.categoryId);
                return (
                  <div
                    key={m.id}
                    className="bg-[#0A1D52] border border-[#1B3782] rounded-xl p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-blue-200">
                        {crt?.name || 'Court'} · {cat?.name}
                      </span>
                      <span className="font-semibold text-emerald-400">LIVE · {m.stage}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-semibold text-white">
                          {tA?.teamName}
                          {m.score.servingTeam === 'A' ? ' •' : ''}
                        </span>
                        <div className="flex items-center gap-3 font-mono tabular-nums">
                          {m.score.sets.map((s, idx) => (
                            <span key={idx} className="w-5 text-center font-bold text-blue-100">
                              {s.teamA}
                            </span>
                          ))}
                          <span className="w-9 text-center font-bold text-white bg-blue-600 rounded py-0.5">
                            {m.score.currentPointA}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-semibold text-white">
                          {tB?.teamName}
                          {m.score.servingTeam === 'B' ? ' •' : ''}
                        </span>
                        <div className="flex items-center gap-3 font-mono tabular-nums">
                          {m.score.sets.map((s, idx) => (
                            <span key={idx} className="w-5 text-center font-bold text-blue-100">
                              {s.teamB}
                            </span>
                          ))}
                          <span className="w-9 text-center font-bold text-white bg-blue-600 rounded py-0.5">
                            {m.score.currentPointB}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Public View Mode Switcher: Schedule/Standings vs 3-Category Brackets */}
        <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl p-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPublicSection('schedule')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                publicSection === 'schedule'
                  ? 'bg-blue-600 text-white'
                  : 'text-blue-200 hover:bg-[#0E266B] hover:text-white'
              }`}
            >
              Jadwal &amp; Klasemen
            </button>
            <button
              type="button"
              onClick={() => setPublicSection('bracket')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                publicSection === 'bracket'
                  ? 'bg-blue-600 text-white'
                  : 'text-blue-200 hover:bg-[#0E266B] hover:text-white'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              Bagan Pertandingan (3 Kategori)
            </button>
          </div>
        </div>

        {publicSection === 'bracket' ? (
          <BracketView
            state={state}
            isAdmin={false}
            readOnly
            onRequireAdminLogin={onRequireAdminLogin}
            onUpdateBracket={async (_c, b) => b}
            onResetBracket={async () => state.brackets![0]}
          />
        ) : (
          <>
            {/* Category Filter Tabs */}
            <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl p-2 flex flex-wrap items-center gap-1">
              {state.categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeCategoryId === cat.id
                      ? 'bg-blue-600 text-white'
                      : 'text-blue-200 hover:bg-[#0E266B] hover:text-white'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Category Matches & Standings */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 bg-[#0A1D52] border border-[#1B3782] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#1B3782]">
                  <h2 className="text-base font-bold text-white">
                    Jadwal &amp; Hasil Pertandingan
                  </h2>
                </div>
                <div className="divide-y divide-[#1B3782]">
                  {categoryMatches.length === 0 ? (
                    <p className="p-6 text-sm text-blue-200/75">
                      Belum ada jadwal pertandingan di kategori ini.
                    </p>
                  ) : (
                    categoryMatches.map((m) => {
                      const tA = state.teams.find((t) => t.id === m.teamAId);
                      const tB = state.teams.find((t) => t.id === m.teamBId);
                      const crt = state.courts.find((c) => c.id === m.courtId);
                      return (
                        <div key={m.id} className="p-4 space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-blue-200/75">
                            <span>
                              Match #{m.matchNumber} · {m.stage} · {crt?.name || 'Court -'}
                            </span>
                            <span className="font-mono tabular-nums">{m.scheduledTime} WITA</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span
                              className={
                                m.score.winnerSide === 'A'
                                  ? 'font-bold text-white'
                                  : 'font-medium text-blue-100'
                              }
                            >
                              {tA?.teamName} vs {tB?.teamName}
                            </span>
                            <span className="font-mono font-bold text-sky-300 tabular-nums">
                              {m.status === 'scheduled'
                                ? 'Akan Main'
                                : m.status === 'postponed'
                                  ? 'Ditunda'
                                  : formatScoreSummary(m.score)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="lg:col-span-6 bg-[#0A1D52] border border-[#1B3782] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#1B3782] flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <h2 className="text-base font-bold text-white">Klasemen Sementara</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#1B3782] bg-[#071540] text-xs font-semibold text-blue-200/80">
                        <th className="py-2.5 px-4 w-10 text-center">#</th>
                        <th className="py-2.5 px-4">Pasangan</th>
                        <th className="py-2.5 px-3 text-right">M</th>
                        <th className="py-2.5 px-3 text-right">Set</th>
                        <th className="py-2.5 px-4 text-right">Poin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1B3782] text-sm">
                      {leaderboard.map((row) => (
                        <tr key={row.team.id}>
                          <td className="py-3 px-4 text-center font-mono font-bold text-blue-200 tabular-nums">
                            {row.rank}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">{row.team.teamName}</div>
                            <div className="text-xs text-blue-200/75">
                              {row.team.region || row.team.club}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-blue-100">{row.won}</td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-blue-100">
                            {row.setDiff > 0 ? `+${row.setDiff}` : row.setDiff}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-sky-300 tabular-nums">
                            {row.points}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {showRegModal && (
        <ParticipantFormModal
          state={state}
          initialParticipant={null}
          isSignedIn={isSignedIn}
          onSignInGoogle={onSignInGoogle}
          onClose={() => setShowRegModal(false)}
          onSubmit={async (payload) => {
            await onRegisterParticipant(payload);
            setShowRegModal(false);
          }}
        />
      )}
    </div>
  );
}
