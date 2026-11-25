import { useEffect, useState } from 'react';
import { ArrowLeft, Maximize2, Minimize2, Radio } from 'lucide-react';
import type { TournamentState } from '../types/tournament.ts';
import {
  formatScoreSummary,
  formatTournamentScheduleDate,
  getCourtLedFocusSlots,
} from '../utils/tournamentLogic.ts';

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
  const [focusedCourtId, setFocusedCourtId] = useState<'all' | string>('all');
  const [autoRotate, setAutoRotate] = useState(false);
  const [rotateIndex, setRotateIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nowClock, setNowClock] = useState(() =>
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  );

  const courtSlots = getCourtLedFocusSlots(state.courts, state.matches);
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
    if (!autoRotate || courtSlots.length <= 1) return;
    const rot = setInterval(() => {
      setRotateIndex((i) => (i + 1) % courtSlots.length);
    }, 10000);
    return () => clearInterval(rot);
  }, [autoRotate, courtSlots.length]);

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

  const activeSingleSlot = autoRotate
    ? courtSlots[rotateIndex % Math.max(1, courtSlots.length)] || null
    : focusedCourtId !== 'all'
      ? courtSlots.find((s) => s.court.id === focusedCourtId) || null
      : null;

  const visibleSlots = activeSingleSlot ? [activeSingleSlot] : courtSlots;
  const isSingleFocus = visibleSlots.length === 1;
  const scheduleDateLabel = formatTournamentScheduleDate(
    state.tournament.startDate,
    state.tournament.endDate
  );

  return (
    <div
      data-testid="led-display-root"
      className="min-h-screen bg-[#050F2E] text-white flex flex-col justify-between p-4 sm:p-8 select-none"
    >
      {/* Top Broadcast Header */}
      <header className="space-y-4 pb-5 border-b border-[#1B3782]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="px-3 py-1.5 bg-blue-600 text-white font-['Barlow_Condensed'] font-extrabold text-xl tracking-wide rounded shrink-0">
              PADEL ARENA LED
            </div>
            <div>
              <h1 className="font-['Barlow_Condensed'] text-2xl sm:text-3xl font-bold tracking-wide text-white uppercase">
                {state.tournament.name === 'Padel League & Share'
                  ? 'Padel League & Share 2026'
                  : state.tournament.name}
              </h1>
              <p className="text-xs text-blue-200/75">
                {(state.tournament.caption &&
                (state.tournament.caption.toLowerCase().includes('retail sales') ||
                  state.tournament.caption.toLowerCase().includes('awarding') ||
                  state.tournament.caption.toLowerCase().includes('padel turnamen'))
                  ? 'Sulawesi Edition'
                  : state.tournament.caption || 'Sulawesi Edition') + ' · '}
                {state.tournament.venue} · {scheduleDateLabel}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2 text-xs font-mono text-blue-100 mr-1">
              {sseConnected && (
                <span className="w-2.5 h-2.5 rounded-full bg-lime-400 animate-pulse" aria-hidden="true" />
              )}
              <span>{sseConnected ? 'LIVE FEED' : 'RECONNECTING'}</span>
              <span className="text-blue-400/50">|</span>
              <span className="text-lg font-bold text-white tabular-nums">{nowClock} WIB</span>
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Layar Penuh LED"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1D52] hover:bg-[#122D7A] border border-[#284BA8] text-xs font-semibold text-blue-100 rounded-lg cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              Layar Penuh
            </button>

            <button
              type="button"
              onClick={onExitLed}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#122D7A] hover:bg-[#1B3D9E] text-xs font-semibold text-white rounded-lg cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Keluar LED
            </button>
          </div>
        </div>

        {/* 4 Court Focus Selector Strip */}
        <div
          role="group"
          aria-label="Pilihan Fokus Lapangan LED"
          className="flex flex-wrap items-center justify-between gap-3 pt-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-300/80 mr-1">
              Pilihan Fokus:
            </span>

            <button
              type="button"
              onClick={() => {
                setAutoRotate(false);
                setFocusedCourtId('all');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                focusedCourtId === 'all' && !autoRotate
                  ? 'bg-blue-600 text-white border-blue-400'
                  : 'bg-[#0A1D52] hover:bg-[#122D7A] text-blue-100 border-[#284BA8]'
              }`}
            >
              Semua {courtSlots.length} Court
            </button>

            {courtSlots.map((slot) => {
              const isSelected = !autoRotate && focusedCourtId === slot.court.id;
              const isAutoActive = autoRotate && activeSingleSlot?.court.id === slot.court.id;
              return (
                <button
                  key={slot.court.id}
                  type="button"
                  onClick={() => {
                    setAutoRotate(false);
                    setFocusedCourtId(slot.court.id);
                  }}
                  title={slot.court.name}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    isSelected || isAutoActive
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-[#0A1D52] hover:bg-[#122D7A] text-blue-100 border-[#284BA8]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      slot.liveMatch
                        ? 'bg-lime-400'
                        : slot.nextMatch
                          ? 'bg-amber-400'
                          : 'bg-blue-400/40'
                    }`}
                    aria-hidden="true"
                  />
                  <span>Fokus {slot.shortLabel}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setAutoRotate((v) => !v);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              autoRotate
                ? 'bg-lime-400 text-slate-950 border-lime-300'
                : 'bg-[#0A1D52] hover:bg-[#122D7A] text-blue-100 border-[#284BA8]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            {autoRotate ? 'Rotasi Otomatis Aktif' : 'Rotasi 4 Court'}
          </button>
        </div>
      </header>

      {/* Main Court Scoreboards (All 4 Courts or 1 Focused Court) */}
      <main className="my-6 flex-1 flex flex-col justify-center">
        {visibleSlots.length === 0 ? (
          <div className="bg-[#0A1D52] border border-[#1B3782] rounded-2xl p-12 text-center space-y-2">
            <p className="font-['Barlow_Condensed'] text-4xl font-bold text-blue-100">
              BELUM ADA LAPANGAN TERDAFTAR
            </p>
          </div>
        ) : (
          <div
            className={`grid gap-5 sm:gap-6 ${
              isSingleFocus
                ? 'grid-cols-1 max-w-5xl w-full mx-auto'
                : 'grid-cols-1 xl:grid-cols-2'
            }`}
          >
            {visibleSlots.map((slot) => {
              const activeMatch = slot.liveMatch || slot.nextMatch || slot.latestCompletedMatch;
              const tA = activeMatch ? state.teams.find((t) => t.id === activeMatch.teamAId) : null;
              const tB = activeMatch ? state.teams.find((t) => t.id === activeMatch.teamBId) : null;
              const cat = activeMatch
                ? state.categories.find((c) => c.id === activeMatch.categoryId)
                : null;

              const isLive = Boolean(slot.liveMatch);
              const isScheduledNext = !slot.liveMatch && Boolean(slot.nextMatch);

              return (
                <article
                  key={slot.court.id}
                  className="bg-[#0A1D52] border border-[#234394] rounded-2xl overflow-hidden flex flex-col"
                >
                  {/* Card Header */}
                  <div className="px-5 sm:px-6 py-4 bg-[#071540] border-b border-[#1B3782] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                      <span className="font-['Barlow_Condensed'] text-2xl sm:text-3xl font-extrabold text-lime-400 tracking-wide">
                        {slot.shortLabel}
                      </span>
                      <span className="text-blue-400/50">/</span>
                      <span className="text-xs sm:text-sm font-semibold text-blue-100 truncate">
                        {activeMatch
                          ? `${cat?.name || ''} · ${activeMatch.stage}`
                          : `${slot.court.surface} · ${slot.court.isIndoor ? 'Indoor' : 'Outdoor'}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {isLive && activeMatch ? (
                        <span className="text-xs font-mono font-bold text-lime-400 tracking-wider">
                          LIVE · {activeMatch.score.goldenPoint ? 'GOLDEN POINT' : 'ADVANTAGE'}
                        </span>
                      ) : isScheduledNext && activeMatch ? (
                        <span className="text-xs font-mono font-bold text-amber-300 tracking-wider tabular-nums">
                          BERIKUTNYA · {activeMatch.scheduledTime} WIB
                        </span>
                      ) : activeMatch ? (
                        <span className="text-xs font-mono font-bold text-sky-300 tracking-wider">
                          SELESAI
                        </span>
                      ) : (
                        <span className="text-xs font-mono font-bold text-blue-300/60 tracking-wider">
                          STANDBY
                        </span>
                      )}

                      {!isSingleFocus && (
                        <button
                          type="button"
                          onClick={() => {
                            setAutoRotate(false);
                            setFocusedCourtId(slot.court.id);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-[#0E266B] hover:bg-blue-600 text-blue-100 hover:text-white border border-[#284BA8] rounded-md cursor-pointer"
                        >
                          Fokus
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  {isLive && activeMatch && tA && tB ? (
                    <div className="divide-y divide-[#1B3782] flex-1">
                      {/* Row Team A */}
                      <div
                        className={`px-5 sm:px-6 ${
                          isSingleFocus ? 'py-8' : 'py-5'
                        } flex items-center justify-between gap-4`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            {activeMatch.score.servingTeam === 'A' && (
                              <span
                                aria-label="Sedang Servis"
                                className="w-3.5 h-3.5 rounded-full bg-lime-400 shrink-0"
                              />
                            )}
                            <h2
                              className={`font-['Barlow_Condensed'] ${
                                isSingleFocus ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'
                              } font-bold text-white truncate`}
                            >
                              {tA.teamName}
                            </h2>
                          </div>
                          <p className="mt-1 text-xs sm:text-sm text-blue-200/75 truncate">
                            {tA.player1.name} &amp; {tA.player2.name} · {tA.region || tA.club}
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5 sm:gap-3 font-mono tabular-nums shrink-0">
                          {activeMatch.score.sets.map((s, idx) => (
                            <div
                              key={idx}
                              className={`${
                                isSingleFocus
                                  ? 'w-14 sm:w-20 h-20 sm:h-24 text-4xl sm:text-5xl'
                                  : 'w-12 sm:w-16 h-16 sm:h-20 text-3xl sm:text-4xl'
                              } bg-[#06133B] border border-[#234394] rounded-xl flex items-center justify-center font-bold text-white`}
                            >
                              {s.teamA}
                            </div>
                          ))}
                          <div
                            className={`${
                              isSingleFocus
                                ? 'w-20 sm:w-28 h-20 sm:h-24 text-4xl sm:text-6xl'
                                : 'w-16 sm:w-22 h-16 sm:h-20 text-3xl sm:text-5xl'
                            } bg-blue-600 rounded-xl flex items-center justify-center font-extrabold text-lime-300`}
                          >
                            {activeMatch.score.currentPointA}
                          </div>
                        </div>
                      </div>

                      {/* Row Team B */}
                      <div
                        className={`px-5 sm:px-6 ${
                          isSingleFocus ? 'py-8' : 'py-5'
                        } flex items-center justify-between gap-4`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            {activeMatch.score.servingTeam === 'B' && (
                              <span
                                aria-label="Sedang Servis"
                                className="w-3.5 h-3.5 rounded-full bg-lime-400 shrink-0"
                              />
                            )}
                            <h2
                              className={`font-['Barlow_Condensed'] ${
                                isSingleFocus ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'
                              } font-bold text-white truncate`}
                            >
                              {tB.teamName}
                            </h2>
                          </div>
                          <p className="mt-1 text-xs sm:text-sm text-blue-200/75 truncate">
                            {tB.player1.name} &amp; {tB.player2.name} · {tB.region || tB.club}
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5 sm:gap-3 font-mono tabular-nums shrink-0">
                          {activeMatch.score.sets.map((s, idx) => (
                            <div
                              key={idx}
                              className={`${
                                isSingleFocus
                                  ? 'w-14 sm:w-20 h-20 sm:h-24 text-4xl sm:text-5xl'
                                  : 'w-12 sm:w-16 h-16 sm:h-20 text-3xl sm:text-4xl'
                              } bg-[#06133B] border border-[#234394] rounded-xl flex items-center justify-center font-bold text-white`}
                            >
                              {s.teamB}
                            </div>
                          ))}
                          <div
                            className={`${
                              isSingleFocus
                                ? 'w-20 sm:w-28 h-20 sm:h-24 text-4xl sm:text-6xl'
                                : 'w-16 sm:w-22 h-16 sm:h-20 text-3xl sm:text-5xl'
                            } bg-blue-600 rounded-xl flex items-center justify-center font-extrabold text-lime-300`}
                          >
                            {activeMatch.score.currentPointB}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : activeMatch && tA && tB ? (
                    <div
                      className={`px-6 ${
                        isSingleFocus ? 'py-12' : 'py-7'
                      } flex-1 flex flex-col justify-center space-y-5`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-mono font-bold uppercase tracking-wider text-sky-300">
                            {isScheduledNext
                              ? `Match #${activeMatch.matchNumber} · Menunggu Masuk Court`
                              : `Hasil Terakhir Match #${activeMatch.matchNumber}`}
                          </span>
                          <h2
                            className={`font-['Barlow_Condensed'] ${
                              isSingleFocus ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'
                            } font-bold text-white`}
                          >
                            {tA.teamName}{' '}
                            <span className="text-blue-400/70 font-normal">vs</span>{' '}
                            {tB.teamName}
                          </h2>
                          <p className="text-xs sm:text-sm text-blue-200/75">
                            {tA.player1.name} &amp; {tA.player2.name} vs {tB.player1.name} &amp;{' '}
                            {tB.player2.name}
                          </p>
                        </div>

                        <div className="px-5 py-3 bg-[#06133B] border border-[#234394] rounded-xl text-center shrink-0">
                          {isScheduledNext ? (
                            <>
                              <div className="text-xs font-semibold text-amber-300 uppercase">
                                Jadwal Main
                              </div>
                              <div className="font-mono text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
                                {activeMatch.scheduledTime} WIB
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-xs font-semibold text-sky-300 uppercase">
                                Skor Akhir
                              </div>
                              <div className="font-mono text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
                                {formatScoreSummary(activeMatch.score)}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`px-6 ${
                        isSingleFocus ? 'py-16' : 'py-10'
                      } flex-1 flex flex-col items-center justify-center text-center space-y-1.5`}
                    >
                      <p className="font-['Barlow_Condensed'] text-2xl sm:text-3xl font-bold text-blue-200/80">
                        LAPANGAN SIAP DIGUNAKAN
                      </p>
                      <p className="text-xs sm:text-sm text-blue-200/60">
                        Belum ada pertandingan berlangsung atau terjadwal di {slot.shortLabel}.
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Bottom Upcoming Schedule Strip */}
      <footer className="pt-4 border-t border-[#1B3782]">
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
                  className="bg-[#0A1D52] border border-[#1B3782] rounded-lg px-4 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {tA?.teamName} vs {tB?.teamName}
                    </div>
                    <div className="text-xs text-blue-200/75 truncate">
                      {crt?.name.split('·')[0].trim() || 'Court Menyusul'} · {m.stage}
                    </div>
                  </div>
                  <span className="font-mono text-sm font-bold text-sky-300 tabular-nums shrink-0">
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
