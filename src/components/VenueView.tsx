import { useEffect, useState } from 'react';
import {
  Coffee,
  Compass,
  DoorOpen,
  HeartPulse,
  MapPin,
  Maximize2,
  Trophy,
  X,
} from 'lucide-react';
import type { TournamentState } from '../types/tournament.ts';
import {
  TOURNAMENT_TIME_LABEL,
  formatScoreSummary,
  formatTournamentScheduleDate,
} from '../utils/tournamentLogic.ts';

interface VenueViewProps {
  state: TournamentState;
  onOpenOperatorMatch: (matchId: string) => void;
}

const VENUE_MAP_SRC = '/assets/aistudio/WhatsApp_Image_2026-11-24_at_11.30.45_7458b829.jpeg';

const VENUE_ZONES = [
  {
    title: 'Akses, Registrasi & Pro Shop',
    icon: DoorOpen,
    accent: 'text-sky-300',
    items: [
      { name: 'Pintu Masuk & Meja Registrasi', detail: 'Sisi kanan depan · Check-in peserta' },
      { name: 'Reception Area', detail: 'Tengah depan · Pusat informasi turnamen' },
      { name: 'Pintu Keluar & Meja Merchandise', detail: 'Sisi kiri depan' },
      { name: 'Penitipan Barang & Pro Shop', detail: 'Pojok kiri depan · Perlengkapan padel' },
    ],
  },
  {
    title: 'Area Pertandingan & Main Stage',
    icon: Trophy,
    accent: 'text-lime-300',
    items: [
      { name: 'Court 1 & Court 2', detail: 'Sisi kiri arena · Area pertandingan utama' },
      { name: 'Court 4 & Court 5', detail: 'Sisi kanan arena · Area pertandingan' },
      { name: 'Main Stage Padel League & Share', detail: 'Tengah arena · Panggung utama & awarding' },
      { name: 'FOH & Round Table', detail: 'Area tengah · Kontrol acara & meja tamu' },
    ],
  },
  {
    title: 'Area VIP, Kafe & Konsumsi',
    icon: Coffee,
    accent: 'text-amber-300',
    items: [
      { name: 'VIP Patio & Meeting Sales VIP Lounge', detail: 'Kanan belakang · Dilengkapi Meja Snack' },
      { name: 'Patio Area & Beach Cafe', detail: 'Tengah belakang' },
      { name: 'Prasmanan Beach Padel & Ulu Juku', detail: 'Area Beach Cafe belakang tengah' },
      { name: 'Snack Tournament', detail: 'Tersedia di dekat Court 2 dan Court 4/5' },
    ],
  },
  {
    title: 'Layanan Medis & Fasilitas Umum',
    icon: HeartPulse,
    accent: 'text-emerald-300',
    items: [
      { name: 'Pos Medic', detail: 'Dekat Pintu Masuk (sisi kanan depan)' },
      { name: 'Fisioterapi', detail: 'Sisi kanan tengah · Pemulihan pemain' },
      { name: 'Musholla', detail: 'Pojok kiri belakang' },
      { name: 'Toilet Wanita & Toilet Pria', detail: 'Sisi kiri belakang (sebelah Musholla)' },
    ],
  },
];

export function VenueView({ state, onOpenOperatorMatch }: VenueViewProps) {
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    if (!zoomOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomOpen]);

  const liveMatches = state.matches.filter((m) => m.status === 'live');
  const scheduledMatches = state.matches.filter((m) => m.status === 'scheduled');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-300 mb-1">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>
              {state.tournament.venue} · {state.tournament.city} ·{' '}
              {formatTournamentScheduleDate(state.tournament.startDate, state.tournament.endDate)} ·{' '}
              {TOURNAMENT_TIME_LABEL}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Denah &amp; Tampilan Venue Turnamen
          </h1>
          <p className="text-sm text-blue-200/75">
            Panduan tata letak lapangan, panggung utama, area VIP, Beach Cafe, registrasi, dan
            fasilitas peserta {state.tournament.name}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
          Perbesar Denah
        </button>
      </div>

      {/* Main Floorplan Showcase Card */}
      <section className="bg-[#0A1D52] border border-[#1B3782] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 bg-[#071540] border-b border-[#1B3782] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Compass className="w-4 h-4 text-lime-300 shrink-0" />
            <span>Denah Venue — {state.tournament.venue}</span>
          </div>
          <span className="text-xs font-medium text-blue-200/75 hidden sm:inline">
            Klik gambar untuk memperbesar
          </span>
        </div>

        <div className="p-4 sm:p-6 bg-[#06133B]">
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            aria-label="Perbesar gambar Denah Venue"
            className="w-full block rounded-lg overflow-hidden border border-[#1B3782] hover:border-sky-400/60 transition-colors cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <img
              src={VENUE_MAP_SRC}
              alt={`Denah Venue ${state.tournament.name} di ${state.tournament.venue}`}
              className="w-full h-auto max-h-[680px] object-contain mx-auto block bg-[#06133B]"
            />
          </button>
        </div>
      </section>

      {/* Zone Directory + Live Court Mapping */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* 4 Venue Zones */}
        <div className="xl:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {VENUE_ZONES.map((zone) => {
            const Icon = zone.icon;
            return (
              <div
                key={zone.title}
                className="bg-[#0A1D52] border border-[#1B3782] rounded-xl overflow-hidden flex flex-col"
              >
                <div className="px-5 py-3.5 bg-[#071540] border-b border-[#1B3782] flex items-center gap-2">
                  <Icon className={`w-4 h-4 shrink-0 ${zone.accent}`} />
                  <h2 className="text-sm font-bold text-white">{zone.title}</h2>
                </div>
                <div className="divide-y divide-[#1B3782] flex-1">
                  {zone.items.map((item) => (
                    <div key={item.name} className="px-5 py-3">
                      <div className="text-sm font-semibold text-white">{item.name}</div>
                      <div className="text-xs text-blue-200/75 mt-0.5">{item.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Court Activity Summary */}
        <div className="xl:col-span-4 bg-[#0A1D52] border border-[#1B3782] rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 bg-[#071540] border-b border-[#1B3782]">
            <h2 className="text-sm font-bold text-white">Aktivitas Court di Venue</h2>
            <p className="text-xs text-blue-200/75">
              Status pertandingan aktif pada lapangan turnamen
            </p>
          </div>
          <div className="divide-y divide-[#1B3782] flex-1">
            {state.courts.map((court) => {
              const live = liveMatches.find((m) => m.courtId === court.id);
              const next = scheduledMatches
                .filter((m) => m.courtId === court.id)
                .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))[0];
              const match = live || next;
              const teamA = match ? state.teams.find((t) => t.id === match.teamAId) : undefined;
              const teamB = match ? state.teams.find((t) => t.id === match.teamBId) : undefined;

              return (
                <div key={court.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-white">{court.name}</span>
                    {live ? (
                      <span className="font-semibold text-emerald-400">LIVE</span>
                    ) : match ? (
                      <span className="font-mono text-amber-300 tabular-nums">
                        {match.scheduledTime} WITA
                      </span>
                    ) : (
                      <span className="text-blue-300/60">Kosong</span>
                    )}
                  </div>

                  {match && teamA && teamB ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-medium text-blue-100 truncate">
                          {teamA.teamName} vs {teamB.teamName}
                        </div>
                        {live && (
                          <div className="text-xs font-mono font-bold text-sky-300 tabular-nums mt-0.5">
                            {formatScoreSummary(live.score)} ({live.score.currentPointA}-
                            {live.score.currentPointB})
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenOperatorMatch(match.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Lihat Skor
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-blue-300/60">Belum ada pertandingan terjadwal.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Lightbox Modal for Fullscreen Map Inspection */}
      {zoomOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Denah Venue Layar Penuh"
          className="fixed inset-0 z-50 bg-[#030A21]/90 backdrop-blur-xs flex flex-col p-4 sm:p-6"
          onClick={() => setZoomOpen(false)}
        >
          <div className="max-w-6xl w-full mx-auto flex items-center justify-between pb-3">
            <div className="text-sm font-bold text-white">
              Denah Venue — {state.tournament.venue}
            </div>
            <button
              type="button"
              onClick={() => setZoomOpen(false)}
              aria-label="Tutup tampilan denah penuh"
              className="p-2 bg-[#0A1D52] hover:bg-[#132E7D] border border-[#284BA8] text-white rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div
            className="flex-1 min-h-0 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={VENUE_MAP_SRC}
              alt={`Denah Venue ${state.tournament.name}`}
              className="max-w-full max-h-full object-contain rounded-xl border border-[#1B3782] shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
