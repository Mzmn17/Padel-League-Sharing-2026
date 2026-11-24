import { useState } from 'react';
import { Trophy } from 'lucide-react';
import type { TournamentState } from '../types/tournament.ts';
import { computeLeaderboard, formatScoreSummary } from '../utils/tournamentLogic.ts';

interface LeaderboardViewProps {
  state: TournamentState;
  sseConnected: boolean;
}

export function LeaderboardView({ state, sseConnected }: LeaderboardViewProps) {
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id || '');

  const leaderboard = computeLeaderboard(state.teams, state.matches, categoryId);
  const categoryMatches = state.matches
    .filter((m) => m.categoryId === categoryId && (m.status === 'completed' || m.status === 'live'))
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Live Leaderboard</h1>
          <p className="text-sm text-slate-500">
            Klasemen otomatis dihitung dari hasil pertandingan selesai (Menang = 3 poin, Tie-break:
            Selisih Set &rarr; Selisih Game).
          </p>
        </div>

        <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
          {sseConnected && (
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" aria-hidden="true" />
          )}
          <span>{sseConnected ? 'Sinkronisasi Real-Time Aktif' : 'Menghubungkan ulang...'}</span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-wrap items-center gap-1">
        {state.categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategoryId(cat.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              categoryId === cat.id
                ? 'bg-blue-700 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Standings Table */}
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-600" />
              Klasemen {state.categories.find((c) => c.id === categoryId)?.name}
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">{leaderboard.length} pasangan</span>
          </div>

          {leaderboard.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Belum ada peserta terdaftar di kategori ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Pasangan / Klub</th>
                    <th className="py-3 px-3 text-right">Main</th>
                    <th className="py-3 px-3 text-right">M</th>
                    <th className="py-3 px-3 text-right">K</th>
                    <th className="py-3 px-3 text-right">Set +/-</th>
                    <th className="py-3 px-3 text-right">Game +/-</th>
                    <th className="py-3 px-4 text-right">Poin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {leaderboard.map((row) => (
                    <tr key={row.team.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 tabular-nums">
                        {row.rank}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{row.team.teamName}</div>
                        <div className="text-xs text-slate-500">
                          {row.team.player1.name} &amp; {row.team.player2.name} · {row.team.club}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {row.played}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                        {row.won}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-500">
                        {row.lost}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {row.setDiff > 0 ? `+${row.setDiff}` : row.setDiff}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {row.gameDiff > 0 ? `+${row.gameDiff}` : row.gameDiff}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-700 tabular-nums">
                        {row.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Live & Recent Matches in Category */}
        <section className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">Skor Live &amp; Hasil Terakhir</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {categoryMatches.length === 0 ? (
              <p className="p-6 text-xs text-slate-500">
                Belum ada pertandingan selesai atau sedang berlangsung di kategori ini.
              </p>
            ) : (
              categoryMatches.map((m) => {
                const tA = state.teams.find((t) => t.id === m.teamAId);
                const tB = state.teams.find((t) => t.id === m.teamBId);
                return (
                  <div key={m.id} className="p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        Match #{m.matchNumber} · {m.stage}
                      </span>
                      <span
                        className={`font-semibold ${
                          m.status === 'live' ? 'text-emerald-700' : 'text-slate-600'
                        }`}
                      >
                        {m.status === 'live' ? 'LIVE' : 'Final'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span
                        className={
                          m.score.winnerSide === 'A' ? 'font-bold text-slate-900' : 'text-slate-700'
                        }
                      >
                        {tA?.teamName}
                      </span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {m.score.sets.map((s) => s.teamA).join('  ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span
                        className={
                          m.score.winnerSide === 'B' ? 'font-bold text-slate-900' : 'text-slate-700'
                        }
                      >
                        {tB?.teamName}
                      </span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {m.score.sets.map((s) => s.teamB).join('  ')}
                      </span>
                    </div>
                    {m.status === 'live' && (
                      <div className="text-xs font-mono text-blue-700 font-semibold tabular-nums">
                        Poin sekarang: {m.score.currentPointA} - {m.score.currentPointB}
                      </div>
                    )}
                    {m.status === 'completed' && (
                      <div className="text-xs text-slate-500">
                        Skor Set: <span className="font-mono">{formatScoreSummary(m.score)}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
