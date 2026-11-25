import { useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  GitBranch,
  MapPin,
  MonitorPlay,
  Trophy,
  Users,
} from 'lucide-react';
import type { TournamentState } from '../types/tournament.ts';
import {
  TOURNAMENT_TIME_LABEL,
  findTeamForParticipant,
  formatScoreSummary,
  formatTournamentScheduleDate,
} from '../utils/tournamentLogic.ts';

interface OverviewViewProps {
  state: TournamentState;
  onNavigate: (tab: string) => void;
  onOpenOperatorMatch: (matchId: string) => void;
  onOpenRegisterModal: () => void;
  onOpenPublicView: () => void;
  onOpenLedView: () => void;
}

export function OverviewView({
  state,
  onNavigate,
  onOpenOperatorMatch,
  onOpenRegisterModal,
  onOpenPublicView,
  onOpenLedView,
}: OverviewViewProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  const liveMatches = state.matches.filter((m) => m.status === 'live');
  const scheduledMatches = state.matches.filter((m) => m.status === 'scheduled');
  const completedMatches = state.matches.filter((m) => m.status === 'completed');
  const participants = state.participants || [];
  const unpairedCount = participants.filter(
    (p) => !findTeamForParticipant(p.id, state.teams)
  ).length;
  const activeTeamsCount = state.teams.filter((t) => t.status !== 'withdrawn').length;

  const publicUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/?view=public` : '/?view=public';

  const handleCopyPublic = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(publicUrl).catch(() => {});
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Tournament Label Banner + Control Header */}
      <section className="bg-[#030A21] border border-[#11245E] rounded-xl overflow-hidden">
        <div className="w-full bg-[#020718] border-b border-[#11245E]">
          <img
            src="/assets/aistudio/WhatsApp_Image_2026-11-25_at_15.16.33_d0fd0900.jpeg"
            alt="Padel League & Share 2026 — Sulawesi Edition"
            referrerPolicy="no-referrer"
            className="w-full h-auto max-h-[320px] object-contain mx-auto block"
          />
        </div>

        <div className="p-6 sm:p-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-blue-100/75">
              <span>{state.tournament.venue}</span>
              <span aria-hidden="true">·</span>
              <span>{state.tournament.city}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums font-semibold text-[#E7F028]">
                {formatTournamentScheduleDate(state.tournament.startDate, state.tournament.endDate)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums font-semibold text-white">{TOURNAMENT_TIME_LABEL}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#E7F028] text-balance">
              {state.tournament.name === 'Padel League & Share'
                ? 'Padel League & Share 2026'
                : state.tournament.name}
            </h1>
            <p className="text-sm sm:text-base font-semibold text-white">
              {state.tournament.caption &&
              (state.tournament.caption.toLowerCase().includes('retail sales') ||
                state.tournament.caption.toLowerCase().includes('awarding') ||
                state.tournament.caption.toLowerCase().includes('padel turnamen'))
                ? 'Sulawesi Edition'
                : state.tournament.caption || 'Sulawesi Edition'}
            </p>
            <p className="text-sm text-slate-300/85 leading-relaxed">
              Pusat kendali turnamen padel: kelola peserta individu &amp; region, pembentukan
              pasangan manual, pembagian court, skor langsung operator, leaderboard real-time,
              display LED arena, dan denah venue.
            </p>
          </div>

          <div className="flex flex-col gap-3 shrink-0 lg:w-80">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onOpenRegisterModal}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex-1"
              >
                <Users className="w-4 h-4" />
                Daftar Peserta
              </button>
              <button
                type="button"
                onClick={onOpenLedView}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#061238] hover:bg-[#0B1D54] text-white border border-[#19327D] text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <MonitorPlay className="w-4 h-4 text-[#E7F028]" />
                Display LED
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 bg-[#020718] border border-[#11245E] rounded-lg px-3 py-2">
              <span className="text-xs font-mono truncate text-slate-300/85">{publicUrl}</span>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyPublic}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-white hover:text-[#E7F028] whitespace-nowrap cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? 'Tersalin' : 'Salin'}
                </button>
                <button
                  type="button"
                  onClick={onOpenPublicView}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#E7F028] hover:text-[#f2f966] whitespace-nowrap cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Buka
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Column Summary KPI Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 bg-[#0A1D52] border border-[#1B3782] rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-[#1B3782]">
        <div className="p-5">
          <p className="text-xs font-medium text-blue-200/75">Peserta Terdaftar</p>
          <p className="mt-1 text-2xl font-bold text-white tabular-nums">
            {participants.length}
          </p>
          <p className="mt-1 text-xs text-blue-200/75 tabular-nums">
            {unpairedCount} belum berpasangan
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-blue-200/75">Pasangan Terbentuk</p>
          <p className="mt-1 text-2xl font-bold text-sky-300 tabular-nums">
            {activeTeamsCount}
          </p>
          <p className="mt-1 text-xs text-blue-200/75 tabular-nums">
            {state.categories.length} kategori aktif
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-blue-200/75">Pertandingan Live</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400 tabular-nums">
            {liveMatches.length}
          </p>
          <p className="mt-1 text-xs text-blue-200/75 tabular-nums">
            {scheduledMatches.length} terjadwal · {completedMatches.length} selesai
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-blue-200/75">Court Aktif</p>
          <p className="mt-1 text-2xl font-bold text-white tabular-nums">
            {state.courts.length}
          </p>
          <p className="mt-1 text-xs text-blue-200/75">
            {state.courts.map((c) => c.name.replace(/^Court\s+/i, '')).join(', ')}
          </p>
        </div>
      </section>

      {/* Live Court Status + Category Capacity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#0A1D52] border border-[#1B3782] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1B3782] flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white">Status Court Saat Ini</h2>
              <p className="text-xs text-blue-200/75">
                Klik &ldquo;Input Skor&rdquo; untuk membuka konsol operator pertandingan
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('schedule')}
              className="text-xs font-semibold text-sky-300 hover:text-sky-200 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Atur Jadwal <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#1B3782]">
            {state.courts.map((court) => {
              const liveOnCourt = liveMatches.find((m) => m.courtId === court.id);
              const nextOnCourt = scheduledMatches
                .filter((m) => m.courtId === court.id)
                .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))[0];

              const activeMatch = liveOnCourt || nextOnCourt;
              const teamA = activeMatch
                ? state.teams.find((t) => t.id === activeMatch.teamAId)
                : undefined;
              const teamB = activeMatch
                ? state.teams.find((t) => t.id === activeMatch.teamBId)
                : undefined;
              const category = activeMatch
                ? state.categories.find((c) => c.id === activeMatch.categoryId)
                : undefined;

              return (
                <div
                  key={court.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-white">{court.name}</span>
                      {liveOnCourt ? (
                        <>
                          <span aria-hidden="true" className="text-blue-400/50">
                            ·
                          </span>
                          <span className="font-semibold text-emerald-400">Sedang Berlangsung</span>
                        </>
                      ) : activeMatch ? (
                        <>
                          <span aria-hidden="true" className="text-blue-400/50">
                            ·
                          </span>
                          <span className="text-amber-300 font-medium tabular-nums">
                            Berikutnya {activeMatch.scheduledTime} WITA
                          </span>
                        </>
                      ) : null}
                    </div>

                    {activeMatch && teamA && teamB ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm text-blue-100">
                        <span className="font-semibold text-white">{teamA.teamName}</span>
                        <span className="text-blue-300/60">vs</span>
                        <span className="font-semibold text-white">{teamB.teamName}</span>
                        <span className="text-xs text-blue-200/75">
                          ({category?.name} · {activeMatch.stage})
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-blue-300/60">Belum ada pertandingan dijadwalkan</p>
                    )}
                  </div>

                  {activeMatch && (
                    <div className="flex items-center gap-3 shrink-0">
                      {liveOnCourt && (
                        <div className="text-right font-mono text-sm font-bold text-white tabular-nums">
                          <span>{formatScoreSummary(liveOnCourt.score)}</span>
                          <span className="ml-2 text-sky-300">
                            ({liveOnCourt.score.currentPointA}-{liveOnCourt.score.currentPointB})
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenOperatorMatch(activeMatch.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Input Skor
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Summary */}
        <div className="lg:col-span-5 bg-[#0A1D52] border border-[#1B3782] rounded-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-4 border-b border-[#1B3782] flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white">Kategori Turnamen</h2>
                <p className="text-xs text-blue-200/75">Kapasitas pasangan &amp; jadwal per kategori</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('participants')}
                className="text-xs font-semibold text-sky-300 hover:text-sky-200 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Kelola Peserta <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-[#1B3782]">
              {state.categories.map((cat) => {
                const count = state.teams.filter(
                  (t) => t.categoryId === cat.id && t.status !== 'withdrawn'
                ).length;
                const catMatches = state.matches.filter((m) => m.categoryId === cat.id).length;
                const pct = Math.min(100, Math.round((count / cat.maxTeams) * 100));

                return (
                  <div key={cat.id} className="px-6 py-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{cat.name}</p>
                        <p className="text-xs text-blue-200/75">
                          {cat.level} · {catMatches} pertandingan
                        </p>
                      </div>
                      <span className="text-sm font-mono font-semibold text-blue-100 tabular-nums">
                        {count}/{cat.maxTeams} tim
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#06133B] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-6 py-4 bg-[#071540] border-t border-[#1B3782] flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onNavigate('bracket')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E7F028] hover:text-[#f2f966] cursor-pointer"
            >
              <GitBranch className="w-4 h-4" />
              Bagan 3 Kategori
            </button>
            <button
              type="button"
              onClick={() => onNavigate('leaderboard')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-100 hover:text-white cursor-pointer"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              Leaderboard
            </button>
            <button
              type="button"
              onClick={() => onNavigate('venue')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-sky-200 cursor-pointer"
            >
              <MapPin className="w-4 h-4" />
              Denah Venue
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
