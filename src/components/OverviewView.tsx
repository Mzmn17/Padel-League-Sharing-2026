import { useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  MonitorPlay,
  Trophy,
  Users,
} from 'lucide-react';
import type { TournamentState } from '../types/tournament.ts';
import { formatScoreSummary } from '../utils/tournamentLogic.ts';
import tournamentBannerImg from '../assets/images/WhatsApp Image 2026-11-24 at 11.29.56.jpeg';

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
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="w-full bg-[#06133B] border-b border-slate-200">
          <img
            src={tournamentBannerImg}
            alt="Padel League & Share — Padel Turnamen & Awarding Retail Sales Sulawesi Edition"
            referrerPolicy="no-referrer"
            className="w-full h-auto max-h-[290px] object-contain mx-auto block"
          />
        </div>

        <div className="p-6 sm:p-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span>{state.tournament.venue}</span>
              <span aria-hidden="true">·</span>
              <span>{state.tournament.city}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {state.tournament.startDate} s/d {state.tournament.endDate}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              {state.tournament.name}
            </h1>
            {state.tournament.caption && (
              <p className="text-sm sm:text-base font-semibold text-blue-700">
                {state.tournament.caption}
              </p>
            )}
            <p className="text-sm text-slate-600 leading-relaxed">
              Pusat kendali turnamen padel: kelola registrasi kategori, pairing peserta, pembagian
              court, skor langsung operator, leaderboard real-time, display LED arena, dan
              notifikasi WhatsApp otomatis.
            </p>
          </div>

          <div className="flex flex-col gap-3 shrink-0 lg:w-80">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onOpenRegisterModal}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex-1"
              >
                <Users className="w-4 h-4" />
                Daftar Pasangan
              </button>
              <button
                type="button"
                onClick={onOpenLedView}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <MonitorPlay className="w-4 h-4" />
                Display LED
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <span className="text-xs font-mono truncate text-slate-600">{publicUrl}</span>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyPublic}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 whitespace-nowrap cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? 'Tersalin' : 'Salin'}
                </button>
                <button
                  type="button"
                  onClick={onOpenPublicView}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap cursor-pointer"
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
      <section className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Pasangan Terdaftar</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {state.teams.filter((t) => t.status !== 'withdrawn').length}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {state.categories.length} kategori aktif
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Pertandingan Live</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700 tabular-nums">
            {liveMatches.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {scheduledMatches.length} terjadwal · {completedMatches.length} selesai
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Court Aktif</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {state.courts.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {state.courts.filter((c) => c.isIndoor).length} indoor ·{' '}
            {state.courts.filter((c) => !c.isIndoor).length} outdoor
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Notifikasi WhatsApp</p>
          <p className="mt-1 text-2xl font-bold text-blue-700 tabular-nums">
            {state.whatsappLogs.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {state.whatsappConfig.autoNotifyOnScheduleChange
              ? 'Otomatis saat jadwal berubah'
              : 'Mode manual'}
          </p>
        </div>
      </section>

      {/* Live Court Status + Category Capacity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Status Court Saat Ini</h2>
              <p className="text-xs text-slate-500">
                Klik &ldquo;Input Skor&rdquo; untuk membuka konsol operator pertandingan
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('schedule')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Atur Jadwal <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-200">
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
                      <span className="font-semibold text-slate-900">{court.name}</span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-slate-500">{court.surface}</span>
                      {liveOnCourt ? (
                        <>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="font-semibold text-emerald-700">Sedang Berlangsung</span>
                        </>
                      ) : activeMatch ? (
                        <>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="text-amber-700 font-medium tabular-nums">
                            Berikutnya {activeMatch.scheduledTime} WIB
                          </span>
                        </>
                      ) : null}
                    </div>

                    {activeMatch && teamA && teamB ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
                        <span className="font-semibold">{teamA.teamName}</span>
                        <span className="text-slate-400">vs</span>
                        <span className="font-semibold">{teamB.teamName}</span>
                        <span className="text-xs text-slate-500">
                          ({category?.name} · {activeMatch.stage})
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">Belum ada pertandingan dijadwalkan</p>
                    )}
                  </div>

                  {activeMatch && (
                    <div className="flex items-center gap-3 shrink-0">
                      {liveOnCourt && (
                        <div className="text-right font-mono text-sm font-bold text-slate-900 tabular-nums">
                          <span>{formatScoreSummary(liveOnCourt.score)}</span>
                          <span className="ml-2 text-blue-700">
                            ({liveOnCourt.score.currentPointA}-{liveOnCourt.score.currentPointB})
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenOperatorMatch(activeMatch.id)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Kategori Turnamen</h2>
                <p className="text-xs text-slate-500">Kapasitas pasangan & jadwal per kategori</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('participants')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Kelola Peserta <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-slate-200">
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
                        <p className="text-sm font-semibold text-slate-900">{cat.name}</p>
                        <p className="text-xs text-slate-500">
                          {cat.level} · {catMatches} pertandingan
                        </p>
                      </div>
                      <span className="text-sm font-mono font-semibold text-slate-800 tabular-nums">
                        {count}/{cat.maxTeams} tim
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-700 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onNavigate('leaderboard')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
            >
              <Trophy className="w-4 h-4 text-amber-600" />
              Buka Live Leaderboard
            </button>
            <button
              type="button"
              onClick={() => onNavigate('whatsapp')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer"
            >
              <CalendarClock className="w-4 h-4" />
              Log Notifikasi WhatsApp ({state.whatsappLogs.length})
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
