import { useState } from 'react';
import { ArrowLeft, Check, Copy, Plus, Trophy } from 'lucide-react';
import type { Team, TournamentState } from '../types/tournament.ts';
import { computeLeaderboard, formatScoreSummary } from '../utils/tournamentLogic.ts';
import { TeamFormModal } from './ParticipantsView.tsx';
import tournamentBannerImg from '../assets/images/WhatsApp Image 2026-11-24 at 11.29.56.jpeg';

interface PublicResultsViewProps {
  state: TournamentState;
  sseConnected: boolean;
  onExitPublic: () => void;
  onRegisterTeam: (payload: {
    categoryId: string;
    teamName: string;
    club: string;
    seed?: number | null;
    player1: { name: string; whatsapp: string; level: string };
    player2: { name: string; whatsapp: string; level: string };
  }) => Promise<Team>;
}

export function PublicResultsView({
  state,
  sseConnected,
  onExitPublic,
  onRegisterTeam,
}: PublicResultsViewProps) {
  const [selectedCategory, setSelectedCategory] = useState(state.categories[0]?.id || '');
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

  const liveMatches = state.matches.filter((m) => m.status === 'live');
  const categoryMatches = state.matches
    .filter((m) => m.categoryId === selectedCategory)
    .slice()
    .sort((a, b) => {
      const rank = { live: 0, scheduled: 1, completed: 2, postponed: 3 };
      const rDiff = rank[a.status] - rank[b.status];
      if (rDiff !== 0) return rDiff;
      return a.scheduledTime.localeCompare(b.scheduledTime);
    });

  const leaderboard = computeLeaderboard(state.teams, state.matches, selectedCategory);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Clean Public Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-display font-bold text-lg text-slate-900 whitespace-nowrap shrink-0">
              {state.tournament.name}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowRegModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Daftar Turnamen
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Link Tersalin' : 'Salin Link Publik'}
            </button>
            <button
              type="button"
              onClick={onExitPublic}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Mode Operator
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Public Banner */}
        <section className="rounded-xl overflow-hidden bg-white border border-slate-200">
          <div className="w-full bg-[#06133B]">
            <img
              src={tournamentBannerImg}
              alt={state.tournament.name}
              referrerPolicy="no-referrer"
              className="w-full h-auto max-h-[280px] object-contain mx-auto block"
            />
          </div>
          <div className="px-6 py-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 text-balance">
                {state.tournament.name}
              </h1>
              <p className="text-sm font-medium text-blue-700">
                {state.tournament.caption || 'Hasil Pertandingan & Jadwal Resmi'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-medium">
              <span>{state.tournament.venue}</span>
              <span aria-hidden="true">·</span>
              <span>{state.tournament.city}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                {sseConnected && (
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" aria-hidden="true" />
                )}
                {sseConnected ? 'Pembaruan Langsung Aktif' : 'Menghubungkan...'}
              </span>
            </div>
          </div>
        </section>

        {/* Live Matches Right Now */}
        {liveMatches.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">Sedang Bertanding Saat Ini</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {liveMatches.map((m) => {
                const tA = state.teams.find((t) => t.id === m.teamAId);
                const tB = state.teams.find((t) => t.id === m.teamBId);
                const crt = state.courts.find((c) => c.id === m.courtId);
                const cat = state.categories.find((c) => c.id === m.categoryId);
                return (
                  <div
                    key={m.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        {crt?.name || 'Court'} · {cat?.name}
                      </span>
                      <span className="font-semibold text-emerald-700">LIVE · {m.stage}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-semibold text-slate-900">
                          {tA?.teamName}
                          {m.score.servingTeam === 'A' ? ' •' : ''}
                        </span>
                        <div className="flex items-center gap-3 font-mono tabular-nums">
                          {m.score.sets.map((s, idx) => (
                            <span key={idx} className="w-5 text-center font-bold text-slate-800">
                              {s.teamA}
                            </span>
                          ))}
                          <span className="w-9 text-center font-bold text-blue-700 bg-blue-50 rounded py-0.5">
                            {m.score.currentPointA}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-semibold text-slate-900">
                          {tB?.teamName}
                          {m.score.servingTeam === 'B' ? ' •' : ''}
                        </span>
                        <div className="flex items-center gap-3 font-mono tabular-nums">
                          {m.score.sets.map((s, idx) => (
                            <span key={idx} className="w-5 text-center font-bold text-slate-800">
                              {s.teamB}
                            </span>
                          ))}
                          <span className="w-9 text-center font-bold text-blue-700 bg-blue-50 rounded py-0.5">
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

        {/* Category Filter Tabs */}
        <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-wrap items-center gap-1">
          {state.categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Category Matches & Standings */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">
                Jadwal &amp; Hasil Pertandingan
              </h2>
            </div>
            <div className="divide-y divide-slate-200">
              {categoryMatches.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">
                  Belum ada jadwal pertandingan di kategori ini.
                </p>
              ) : (
                categoryMatches.map((m) => {
                  const tA = state.teams.find((t) => t.id === m.teamAId);
                  const tB = state.teams.find((t) => t.id === m.teamBId);
                  const crt = state.courts.find((c) => c.id === m.courtId);
                  return (
                    <div key={m.id} className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          Match #{m.matchNumber} · {m.stage} · {crt?.name || 'Court -'}
                        </span>
                        <span className="font-mono tabular-nums">{m.scheduledTime} WIB</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span
                          className={
                            m.score.winnerSide === 'A'
                              ? 'font-bold text-slate-900'
                              : 'font-medium text-slate-800'
                          }
                        >
                          {tA?.teamName} vs {tB?.teamName}
                        </span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
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

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-600" />
              <h2 className="text-base font-bold text-slate-900">Klasemen Sementara</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4 w-10 text-center">#</th>
                    <th className="py-2.5 px-4">Pasangan</th>
                    <th className="py-2.5 px-3 text-right">M</th>
                    <th className="py-2.5 px-3 text-right">Set</th>
                    <th className="py-2.5 px-4 text-right">Poin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {leaderboard.map((row) => (
                    <tr key={row.team.id}>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-700 tabular-nums">
                        {row.rank}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{row.team.teamName}</div>
                        <div className="text-xs text-slate-500">{row.team.club}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">{row.won}</td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {row.setDiff > 0 ? `+${row.setDiff}` : row.setDiff}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-blue-700 tabular-nums">
                        {row.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {showRegModal && (
        <TeamFormModal
          state={state}
          initialTeam={null}
          onClose={() => setShowRegModal(false)}
          onSubmit={async (payload) => {
            await onRegisterTeam(payload);
            setShowRegModal(false);
          }}
        />
      )}
    </div>
  );
}
