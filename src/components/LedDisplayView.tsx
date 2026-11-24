import { useEffect, useState } from 'react';
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import type { TournamentState } from '../types/tournament.ts';

interface LedDisplayViewProps {
  state: TournamentState;
  sseConnected: boolean;
  onExitLed: () => void;
}

export function LedDisplayView({
  state,
  sseConnected,
  onExitLed,
}: LedDisplayViewProps) {
  const [spotlightMode, setSpotlightMode] = useState(false);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nowClock, setNowClock] = useState(() =>
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  );

  const liveMatches = state.matches.filter((m) => m.status === 'live');
  const upcomingMatches = state.matches
    .filter((m) => m.status === 'scheduled')
    .slice()
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  useEffect(() => {
    const timer = setInterval(() => {
      setNowClock(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!spotlightMode || liveMatches.length <= 1) return;
    const rot = setInterval(() => {
      setSpotlightIndex((i) => (i + 1) % liveMatches.length);
    }, 10000);
    return () => clearInterval(rot);
  }, [spotlightMode, liveMatches.length]);

  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const displayMatches =
    spotlightMode && liveMatches.length > 0
      ? [liveMatches[spotlightIndex % liveMatches.length]]
      : liveMatches;

  return (
    <div
      data-testid="led-display-root"
      className="min-h-screen bg-[#070B14] text-white flex flex-col justify-between p-5 sm:p-8 select-none"
    >
      {/* Top Broadcast Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="px-3 py-1.5 bg-blue-600 text-white font-['Barlow_Condensed'] font-extrabold text-xl tracking-wide rounded">
            PADEL ARENA LED
          </div>
          <div>
            <h1 className="font-['Barlow_Condensed'] text-2xl sm:text-3xl font-bold tracking-wide text-white uppercase">
              {state.tournament.name}
            </h1>
            <p className="text-xs text-slate-400">
              {state.tournament.caption ? `${state.tournament.caption} · ` : ''}
              {state.tournament.venue} · {state.tournament.city}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300 mr-2">
            {sseConnected && (
              <span className="w-2.5 h-2.5 rounded-full bg-lime-400 animate-pulse" aria-hidden="true" />
            )}
            <span>{sseConnected ? 'LIVE FEED' : 'RECONNECTING'}</span>
            <span className="text-slate-600">|</span>
            <span className="text-lg font-bold text-white tabular-nums">{nowClock} WIB</span>
          </div>

          <button
            type="button"
            onClick={() => setSpotlightMode((v) => !v)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 rounded-lg cursor-pointer"
          >
            {spotlightMode ? 'Tampilkan Semua Court' : 'Mode Spotlight'}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Layar Penuh LED"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 rounded-lg cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            Layar Penuh
          </button>

          <button
            type="button"
            onClick={onExitLed}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-lg cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Keluar LED
          </button>
        </div>
      </header>

      {/* Main Court Scoreboards */}
      <main className="my-6 flex-1 flex flex-col justify-center">
        {displayMatches.length === 0 ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center space-y-2">
            <p className="font-['Barlow_Condensed'] text-4xl font-bold text-slate-200">
              TIDAK ADA PERTANDINGAN LIVE SAAT INI
            </p>
            <p className="text-sm text-slate-400">
              Pertandingan berikutnya akan tampil otomatis begitu operator memulai skor di court.
            </p>
          </div>
        ) : (
          <div
            className={`grid gap-6 ${
              displayMatches.length === 1 ? 'grid-cols-1 max-w-5xl w-full mx-auto' : 'grid-cols-1 xl:grid-cols-2'
            }`}
          >
            {displayMatches.map((m) => {
              const tA = state.teams.find((t) => t.id === m.teamAId);
              const tB = state.teams.find((t) => t.id === m.teamBId);
              const crt = state.courts.find((c) => c.id === m.courtId);
              const cat = state.categories.find((c) => c.id === m.categoryId);

              return (
                <article
                  key={m.id}
                  className="bg-[#0F172A] border border-slate-700/80 rounded-2xl overflow-hidden"
                >
                  <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="font-['Barlow_Condensed'] text-2xl sm:text-3xl font-extrabold text-lime-400 tracking-wide">
                        {crt?.name.split('·')[0].trim() || 'CENTER COURT'}
                      </span>
                      <span className="text-slate-600">/</span>
                      <span className="text-sm sm:text-base font-semibold text-slate-200">
                        {cat?.name} · {m.stage}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-lime-400 tracking-wider">
                      {m.score.goldenPoint ? 'GOLDEN POINT' : 'ADVANTAGE'}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-800">
                    {/* Row Team A */}
                    <div className="px-6 py-8 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          {m.score.servingTeam === 'A' && (
                            <span
                              aria-label="Sedang Servis"
                              className="w-3.5 h-3.5 rounded-full bg-lime-400 shrink-0"
                            />
                          )}
                          <h2 className="font-['Barlow_Condensed'] text-4xl sm:text-5xl font-bold text-white truncate">
                            {tA?.teamName}
                          </h2>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-400 truncate">
                          {tA?.player1.name} &amp; {tA?.player2.name} · {tA?.club}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4 font-mono tabular-nums shrink-0">
                        {m.score.sets.map((s, idx) => (
                          <div
                            key={idx}
                            className="w-14 sm:w-20 h-20 sm:h-24 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center text-4xl sm:text-5xl font-bold text-white"
                          >
                            {s.teamA}
                          </div>
                        ))}
                        <div className="w-20 sm:w-28 h-20 sm:h-24 bg-blue-600 rounded-xl flex items-center justify-center text-4xl sm:text-6xl font-extrabold text-lime-300">
                          {m.score.currentPointA}
                        </div>
                      </div>
                    </div>

                    {/* Row Team B */}
                    <div className="px-6 py-8 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          {m.score.servingTeam === 'B' && (
                            <span
                              aria-label="Sedang Servis"
                              className="w-3.5 h-3.5 rounded-full bg-lime-400 shrink-0"
                            />
                          )}
                          <h2 className="font-['Barlow_Condensed'] text-4xl sm:text-5xl font-bold text-white truncate">
                            {tB?.teamName}
                          </h2>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-400 truncate">
                          {tB?.player1.name} &amp; {tB?.player2.name} · {tB?.club}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4 font-mono tabular-nums shrink-0">
                        {m.score.sets.map((s, idx) => (
                          <div
                            key={idx}
                            className="w-14 sm:w-20 h-20 sm:h-24 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center text-4xl sm:text-5xl font-bold text-white"
                          >
                            {s.teamB}
                          </div>
                        ))}
                        <div className="w-20 sm:w-28 h-20 sm:h-24 bg-blue-600 rounded-xl flex items-center justify-center text-4xl sm:text-6xl font-extrabold text-lime-300">
                          {m.score.currentPointB}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Bottom Upcoming Schedule Strip */}
      <footer className="pt-4 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <span className="font-['Barlow_Condensed'] text-lg font-bold tracking-wider text-lime-400 uppercase whitespace-nowrap shrink-0">
            Jadwal Berikutnya:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            {upcomingMatches.slice(0, 3).map((m) => {
              const tA = state.teams.find((t) => t.id === m.teamAId);
              const tB = state.teams.find((t) => t.id === m.teamBId);
              const crt = state.courts.find((c) => c.id === m.courtId);
              return (
                <div
                  key={m.id}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {tA?.teamName} vs {tB?.teamName}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {crt?.name.split('·')[0].trim() || 'Court Menyusul'} · {m.stage}
                    </div>
                  </div>
                  <span className="font-mono text-sm font-bold text-blue-300 tabular-nums shrink-0">
                    {m.scheduledTime}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </footer>
    </div>
  );
}
