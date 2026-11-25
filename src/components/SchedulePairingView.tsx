import { useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CalendarPlus,
  Edit3,
  Lock,
  Plus,
  Shuffle,
  Trash2,
  X,
} from 'lucide-react';
import type { Match, MatchStatus, TournamentState } from '../types/tournament.ts';
import { formatScoreSummary, formatTournamentScheduleDate } from '../utils/tournamentLogic.ts';

interface SchedulePairingViewProps {
  state: TournamentState;
  isAdmin: boolean;
  onRequireAdminLogin: () => void;
  onCreateMatch: (payload: {
    categoryId: string;
    stage: string;
    teamAId: string;
    teamBId: string;
    courtId: string | null;
    scheduledDate: string;
    scheduledTime: string;
    ignoreConflict?: boolean;
    notifyWhatsApp?: boolean;
  }) => Promise<Match>;
  onAutoPairCategory: (payload: {
    categoryId: string;
    mode: 'round_robin' | 'knockout';
    stage: string;
    scheduledDate: string;
    startTime: string;
  }) => Promise<number>;
  onUpdateMatchSchedule: (
    matchId: string,
    payload: {
      courtId?: string | null;
      scheduledDate?: string;
      scheduledTime?: string;
      status?: MatchStatus;
      stage?: string;
      ignoreConflict?: boolean;
      notifyWhatsApp?: boolean;
    }
  ) => Promise<{ match: Match; generatedLogs: number }>;
  onDeleteMatch: (matchId: string) => Promise<void>;
  onAddCourt: (payload: { name: string; surface: string; isIndoor: boolean }) => Promise<void>;
  onOpenOperatorMatch: (matchId: string) => void;
}

const STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: 'Terjadwal',
  live: 'Berlangsung',
  completed: 'Selesai',
  postponed: 'Ditunda',
};

export function SchedulePairingView({
  state,
  isAdmin,
  onRequireAdminLogin,
  onCreateMatch,
  onAutoPairCategory,
  onUpdateMatchSchedule,
  onDeleteMatch,
  onAddCourt,
  onOpenOperatorMatch,
}: SchedulePairingViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [showCourtModal, setShowCourtModal] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const filteredMatches = state.matches
    .filter((m) => (selectedCategory === 'all' ? true : m.categoryId === selectedCategory))
    .slice()
    .sort((a, b) => {
      const cmpDate = a.scheduledDate.localeCompare(b.scheduledDate);
      if (cmpDate !== 0) return cmpDate;
      const cmpTime = a.scheduledTime.localeCompare(b.scheduledTime);
      if (cmpTime !== 0) return cmpTime;
      return a.matchNumber - b.matchNumber;
    });

  const handleCallToCourt = async (match: Match) => {
    try {
      const res = await onUpdateMatchSchedule(match.id, {
        status: 'live',
        notifyWhatsApp: true,
      });
      setFeedback({
        type: 'success',
        text: `Match #${match.matchNumber} dimulai. ${res.generatedLogs} notifikasi panggilan court WhatsApp dikirim otomatis.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memulai pertandingan.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Pairing Pertandingan &amp; Jadwal Court
          </h1>
          <p className="text-sm text-blue-200/75">
            Jadwal Resmi:{' '}
            <span className="font-semibold text-sky-300">
              {formatTournamentScheduleDate(state.tournament.startDate, state.tournament.endDate)}
            </span>{' '}
            {state.tournament.startDate === state.tournament.endDate ? '(1 Hari Penuh)' : ''} ·
            Pembaruan jadwal otomatis mengirim notifikasi WhatsApp ke seluruh pemain.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => setShowAutoModal(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#0D2363] hover:bg-[#132E7D] text-white border border-[#284BA8] text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Shuffle className="w-4 h-4" />
                Auto-Pairing Kategori
              </button>
              <button
                type="button"
                onClick={() => setShowCourtModal(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#0D2363] hover:bg-[#132E7D] text-white border border-[#284BA8] text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Tambah Court
              </button>
              <button
                type="button"
                onClick={() => setShowManualModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <CalendarPlus className="w-4 h-4" />
                Buat Pertandingan
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onRequireAdminLogin}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              Login Admin untuk Kelola Jadwal
            </button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="px-4 py-3 bg-[#0A1D52] border border-[#284BA8] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-blue-100">
            <Lock className="w-4 h-4 text-sky-300 shrink-0" />
            <span>
              Mode Lihat Jadwal: Login sebagai Admin untuk membuat pairing, mengubah court/jam
              pertandingan, atau menghapus jadwal.
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

      {feedback && (
        <div
          role="status"
          className={`px-4 py-3 rounded-lg border text-sm flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/70 border-red-500/40 text-red-200'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Tutup notifikasi"
            className="cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Category Filter */}
      <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl p-3 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-blue-600 text-white'
              : 'text-blue-200 hover:bg-[#0E266B] hover:text-white'
          }`}
        >
          Semua Kategori ({state.matches.length})
        </button>
        {state.categories.map((cat) => {
          const cnt = state.matches.filter((m) => m.categoryId === cat.id).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'text-blue-200 hover:bg-[#0E266B] hover:text-white'
              }`}
            >
              {cat.name} ({cnt})
            </button>
          );
        })}
      </div>

      {/* Court Allocation Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {state.courts.map((court) => {
          const courtMatches = filteredMatches.filter((m) => m.courtId === court.id);
          return (
            <div
              key={court.id}
              className="bg-[#0A1D52] border border-[#1B3782] rounded-xl overflow-hidden flex flex-col"
            >
              <div className="px-4 py-3 bg-[#071540] border-b border-[#1B3782]">
                <div className="text-sm font-bold text-white">{court.name}</div>
                <div className="text-xs text-blue-200/75">
                  {court.surface} · {court.isIndoor ? 'Indoor' : 'Outdoor'}
                </div>
              </div>
              <div className="divide-y divide-[#1B3782] flex-1">
                {courtMatches.length === 0 ? (
                  <p className="p-4 text-xs text-blue-300/60">Belum ada jadwal di court ini.</p>
                ) : (
                  courtMatches.map((m) => {
                    const teamA = state.teams.find((t) => t.id === m.teamAId);
                    const teamB = state.teams.find((t) => t.id === m.teamBId);
                    const cat = state.categories.find((c) => c.id === m.categoryId);
                    return (
                      <div key={m.id} className="p-3.5 space-y-2">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono font-semibold text-blue-200 tabular-nums">
                            {m.scheduledTime} WIB · #{m.matchNumber}
                          </span>
                          <span
                            className={`font-semibold ${
                              m.status === 'live'
                                ? 'text-emerald-400'
                                : m.status === 'completed'
                                  ? 'text-blue-300/60'
                                  : m.status === 'postponed'
                                    ? 'text-red-400'
                                    : 'text-sky-300'
                            }`}
                          >
                            {STATUS_LABEL[m.status]}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-white leading-snug">
                          {teamA?.teamName} <span className="text-blue-300/60 font-normal">vs</span>{' '}
                          {teamB?.teamName}
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs text-blue-200/75">
                          <span>
                            {cat?.name} · {m.stage}
                          </span>
                          {(m.status === 'live' || m.status === 'completed') && (
                            <span className="font-mono font-semibold text-white tabular-nums">
                              {formatScoreSummary(m.score)}
                            </span>
                          )}
                        </div>
                        <div className="pt-1 flex items-center gap-2">
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setEditingMatch(m)}
                              className="px-2.5 py-1 text-xs font-medium text-blue-100 border border-[#284BA8] hover:bg-[#132E7D] rounded-md cursor-pointer"
                            >
                              Ubah Court/Jam
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenOperatorMatch(m.id)}
                            className="px-2.5 py-1 text-xs font-medium text-sky-300 border border-[#284BA8] hover:bg-[#132E7D] rounded-md cursor-pointer"
                          >
                            {isAdmin ? 'Skor' : 'Lihat Skor'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Full Schedule Table */}
      <section className="bg-[#0A1D52] border border-[#1B3782] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1B3782]">
          <h2 className="text-base font-bold text-white">Daftar Lengkap Jadwal Pertandingan</h2>
        </div>
        {filteredMatches.length === 0 ? (
          <div className="p-8 text-center text-sm text-blue-200/75">
            Belum ada pertandingan untuk kategori ini. Klik &ldquo;Auto-Pairing Kategori&rdquo; atau
            &ldquo;Buat Pertandingan&rdquo;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1B3782] bg-[#071540] text-xs font-semibold text-blue-200/80">
                  <th className="py-3 px-4">Match</th>
                  <th className="py-3 px-4">Kategori &amp; Babak</th>
                  <th className="py-3 px-4">Pasangan Bertanding</th>
                  <th className="py-3 px-4">Court</th>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B3782] text-sm">
                {filteredMatches.map((m) => {
                  const teamA = state.teams.find((t) => t.id === m.teamAId);
                  const teamB = state.teams.find((t) => t.id === m.teamBId);
                  const cat = state.categories.find((c) => c.id === m.categoryId);
                  const court = state.courts.find((c) => c.id === m.courtId);
                  return (
                    <tr key={m.id} className="hover:bg-[#0E2563]/60">
                      <td className="py-3 px-4 font-mono font-semibold text-blue-200 tabular-nums">
                        #{m.matchNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{cat?.name}</div>
                        <div className="text-xs text-blue-200/75">{m.stage}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">
                          {teamA?.teamName} vs {teamB?.teamName}
                        </div>
                        {(m.status === 'live' || m.status === 'completed') && (
                          <div className="text-xs font-mono text-sky-300 tabular-nums">
                            Skor: {formatScoreSummary(m.score)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-blue-100">
                        {court?.name || 'Belum ditentukan'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-blue-100 tabular-nums whitespace-nowrap">
                        {m.scheduledDate} · {m.scheduledTime} WIB
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            m.status === 'live'
                              ? 'text-emerald-400'
                              : m.status === 'completed'
                                ? 'text-blue-200/70'
                                : m.status === 'postponed'
                                  ? 'text-red-400'
                                  : 'text-sky-300'
                          }`}
                        >
                          {STATUS_LABEL[m.status]}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isAdmin ? (
                          <div className="inline-flex items-center gap-1.5">
                            {m.status === 'scheduled' && (
                              <button
                                type="button"
                                onClick={() => handleCallToCourt(m)}
                                className="px-2.5 py-1.5 text-xs font-semibold text-emerald-300 border border-emerald-500/40 hover:bg-emerald-950/60 rounded-md inline-flex items-center gap-1 cursor-pointer"
                              >
                                <BellRing className="w-3.5 h-3.5" />
                                Panggil Court
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingMatch(m)}
                              aria-label={`Edit jadwal Match #${m.matchNumber}`}
                              className="p-1.5 text-blue-200 hover:text-white border border-[#284BA8] hover:bg-[#132E7D] rounded-md cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteMatch(m.id)}
                              aria-label={`Hapus Match #${m.matchNumber}`}
                              className="p-1.5 text-red-400 hover:text-red-200 border border-[#284BA8] hover:bg-red-950/60 rounded-md cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={onRequireAdminLogin}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-300/80 hover:text-white border border-[#1B3782] hover:bg-[#132E7D] rounded-md cursor-pointer"
                          >
                            <Lock className="w-3 h-3" />
                            Edit (Admin)
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showManualModal && (
        <ManualMatchModal
          state={state}
          onClose={() => setShowManualModal(false)}
          onSubmit={async (payload) => {
            const match = await onCreateMatch(payload);
            setShowManualModal(false);
            setFeedback({
              type: 'success',
              text: `Match #${match.matchNumber} dijadwalkan & notifikasi WhatsApp otomatis dibuat.`,
            });
          }}
        />
      )}

      {showAutoModal && (
        <AutoPairModal
          state={state}
          onClose={() => setShowAutoModal(false)}
          onSubmit={async (payload) => {
            const count = await onAutoPairCategory(payload);
            setShowAutoModal(false);
            setFeedback({
              type: 'success',
              text: `${count} pertandingan berhasil di-pairing & dijadwalkan ke court beserta notifikasi WhatsApp.`,
            });
          }}
        />
      )}

      {editingMatch && (
        <EditScheduleModal
          state={state}
          match={editingMatch}
          onClose={() => setEditingMatch(null)}
          onSubmit={async (payload) => {
            const res = await onUpdateMatchSchedule(editingMatch.id, payload);
            setEditingMatch(null);
            setFeedback({
              type: 'success',
              text: `Jadwal Match #${res.match.matchNumber} diperbarui. ${res.generatedLogs} notifikasi WhatsApp otomatis dikirim.`,
            });
          }}
        />
      )}

      {showCourtModal && (
        <AddCourtModal
          onClose={() => setShowCourtModal(false)}
          onSubmit={async (payload) => {
            await onAddCourt(payload);
            setShowCourtModal(false);
            setFeedback({
              type: 'success',
              text: `Court "${payload.name}" berhasil ditambahkan.`,
            });
          }}
        />
      )}
    </div>
  );
}

function ManualMatchModal({
  state,
  onClose,
  onSubmit,
}: {
  state: TournamentState;
  onClose: () => void;
  onSubmit: (payload: {
    categoryId: string;
    stage: string;
    teamAId: string;
    teamBId: string;
    courtId: string | null;
    scheduledDate: string;
    scheduledTime: string;
    ignoreConflict?: boolean;
    notifyWhatsApp?: boolean;
  }) => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id || '');
  const categoryTeams = state.teams.filter(
    (t) => t.categoryId === categoryId && t.status !== 'withdrawn'
  );

  const [teamAId, setTeamAId] = useState(categoryTeams[0]?.id || '');
  const [teamBId, setTeamBId] = useState(categoryTeams[1]?.id || '');
  const [stage, setStage] = useState('Fase Grup A');
  const [courtId, setCourtId] = useState(state.courts[0]?.id || '');
  const [scheduledDate, setScheduledDate] = useState(state.tournament.startDate);
  const [scheduledTime, setScheduledTime] = useState('15:00');
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCategoryChange = (nextCat: string) => {
    setCategoryId(nextCat);
    const list = state.teams.filter((t) => t.categoryId === nextCat && t.status !== 'withdrawn');
    setTeamAId(list[0]?.id || '');
    setTeamBId(list[1]?.id || '');
  };

  const submitForm = async (ignoreConflict = false) => {
    setError(null);
    setConflictMsg(null);
    if (!teamAId || !teamBId || teamAId === teamBId) {
      setError('Pilih dua pasangan yang berbeda untuk bertanding.');
      return;
    }
    try {
      setSaving(true);
      await onSubmit({
        categoryId,
        stage,
        teamAId,
        teamBId,
        courtId: courtId || null,
        scheduledDate,
        scheduledTime,
        ignoreConflict,
        notifyWhatsApp,
      });
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 409) {
        setConflictMsg(e.message);
      } else {
        setError(e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-match-title"
      className="fixed inset-0 z-50 bg-[#030A21]/75 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-[#1B3782] bg-[#081744] flex items-center justify-between">
          <h2 id="manual-match-title" className="text-lg font-bold text-white">
            Buat Pairing &amp; Jadwal Pertandingan
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="cursor-pointer">
            <X className="w-5 h-5 text-blue-200 hover:text-white" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div role="alert" className="p-3 bg-red-950/70 border border-red-500/40 text-red-200 text-xs rounded-lg">
              {error}
            </div>
          )}

          {conflictMsg && (
            <div className="p-3 bg-amber-950/70 border border-amber-500/40 text-amber-200 text-xs rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
                <span>{conflictMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => submitForm(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-md cursor-pointer"
              >
                Tetap Simpan Jadwal Ini
              </button>
            </div>
          )}

          <div>
            <label htmlFor="m-cat" className="block text-xs font-semibold text-blue-100 mb-1">
              Kategori
            </label>
            <select
              id="m-cat"
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
            >
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="m-teamA" className="block text-xs font-semibold text-blue-100 mb-1">
                Pasangan A
              </label>
              <select
                id="m-teamA"
                value={teamAId}
                onChange={(e) => setTeamAId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
              >
                {categoryTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.teamName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="m-teamB" className="block text-xs font-semibold text-blue-100 mb-1">
                Pasangan B
              </label>
              <select
                id="m-teamB"
                value={teamBId}
                onChange={(e) => setTeamBId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
              >
                {categoryTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.teamName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="m-stage" className="block text-xs font-semibold text-blue-100 mb-1">
                Babak / Stage
              </label>
              <input
                id="m-stage"
                type="text"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
              />
            </div>
            <div>
              <label htmlFor="m-court" className="block text-xs font-semibold text-blue-100 mb-1">
                Court
              </label>
              <select
                id="m-court"
                value={courtId}
                onChange={(e) => setCourtId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
              >
                {state.courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="m-date" className="block text-xs font-semibold text-blue-100 mb-1">
                Tanggal
              </label>
              <input
                id="m-date"
                type="date"
                value={scheduledDate}
                min={state.tournament.startDate}
                max={state.tournament.endDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
              />
            </div>
            <div>
              <label htmlFor="m-time" className="block text-xs font-semibold text-blue-100 mb-1">
                Jam (WIB)
              </label>
              <input
                id="m-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-blue-100 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyWhatsApp}
              onChange={(e) => setNotifyWhatsApp(e.target.checked)}
              className="rounded border-[#284BA8]"
            />
            Kirim notifikasi WhatsApp otomatis ke ke-4 pemain
          </label>

          <div className="pt-3 border-t border-[#1B3782] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-blue-200 hover:bg-[#0E266B] hover:text-white rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => submitForm(false)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AutoPairModal({
  state,
  onClose,
  onSubmit,
}: {
  state: TournamentState;
  onClose: () => void;
  onSubmit: (payload: {
    categoryId: string;
    mode: 'round_robin' | 'knockout';
    stage: string;
    scheduledDate: string;
    startTime: string;
  }) => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id || '');
  const [mode, setMode] = useState<'round_robin' | 'knockout'>('round_robin');
  const [stage, setStage] = useState('Fase Grup');
  const [scheduledDate, setScheduledDate] = useState(state.tournament.startDate);
  const [startTime, setStartTime] = useState('14:00');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setSaving(true);
      await onSubmit({ categoryId, mode, stage, scheduledDate, startTime });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat auto-pairing.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auto-pair-title"
      className="fixed inset-0 z-50 bg-[#030A21]/75 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-[#1B3782] bg-[#081744] flex items-center justify-between">
          <h2 id="auto-pair-title" className="text-lg font-bold text-white">
            Auto-Pairing &amp; Distribusi Court
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="cursor-pointer">
            <X className="w-5 h-5 text-blue-200 hover:text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div role="alert" className="p-3 bg-red-950/70 border border-red-500/40 text-red-200 text-xs rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="ap-cat" className="block text-xs font-semibold text-blue-100 mb-1">
              Kategori
            </label>
            <select
              id="ap-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
            >
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ap-mode" className="block text-xs font-semibold text-blue-100 mb-1">
              Format Pairing
            </label>
            <select
              id="ap-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as 'round_robin' | 'knockout')}
              className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
            >
              <option value="round_robin">Round Robin (Semua Pasangan Saling Bertemu)</option>
              <option value="knockout">Babak Gugur (Pairing Berdasarkan Seed)</option>
            </select>
          </div>

          <div>
            <label htmlFor="ap-stage" className="block text-xs font-semibold text-blue-100 mb-1">
              Label Babak
            </label>
            <input
              id="ap-stage"
              type="text"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ap-date" className="block text-xs font-semibold text-blue-100 mb-1">
                Tanggal
              </label>
              <input
                id="ap-date"
                type="date"
                value={scheduledDate}
                min={state.tournament.startDate}
                max={state.tournament.endDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
              />
            </div>
            <div>
              <label htmlFor="ap-time" className="block text-xs font-semibold text-blue-100 mb-1">
                Mulai Pukul
              </label>
              <input
                id="ap-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#1B3782] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-blue-200 hover:bg-[#0E266B] hover:text-white rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              {saving ? 'Memproses...' : 'Generate Pairing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditScheduleModal({
  state,
  match,
  onClose,
  onSubmit,
}: {
  state: TournamentState;
  match: Match;
  onClose: () => void;
  onSubmit: (payload: {
    courtId: string | null;
    scheduledDate: string;
    scheduledTime: string;
    status: MatchStatus;
    stage: string;
    ignoreConflict?: boolean;
    notifyWhatsApp?: boolean;
  }) => Promise<void>;
}) {
  const [courtId, setCourtId] = useState(match.courtId || '');
  const [scheduledDate, setScheduledDate] = useState(match.scheduledDate);
  const [scheduledTime, setScheduledTime] = useState(match.scheduledTime);
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [stage, setStage] = useState(match.stage);
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const teamA = state.teams.find((t) => t.id === match.teamAId);
  const teamB = state.teams.find((t) => t.id === match.teamBId);

  const submitForm = async (ignoreConflict = false) => {
    setError(null);
    setConflictMsg(null);
    try {
      setSaving(true);
      await onSubmit({
        courtId: courtId || null,
        scheduledDate,
        scheduledTime,
        status,
        stage,
        ignoreConflict,
        notifyWhatsApp,
      });
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 409) {
        setConflictMsg(e.message);
      } else {
        setError(e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-sched-title"
      className="fixed inset-0 z-50 bg-[#030A21]/75 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-[#1B3782] bg-[#081744] flex items-center justify-between">
          <div>
            <h2 id="edit-sched-title" className="text-lg font-bold text-white">
              Atur Jadwal Match #{match.matchNumber}
            </h2>
            <p className="text-xs text-blue-200/75">
              {teamA?.teamName} vs {teamB?.teamName}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="cursor-pointer">
            <X className="w-5 h-5 text-blue-200 hover:text-white" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div role="alert" className="p-3 bg-red-950/70 border border-red-500/40 text-red-200 text-xs rounded-lg">
              {error}
            </div>
          )}

          {conflictMsg && (
            <div className="p-3 bg-amber-950/70 border border-amber-500/40 text-amber-200 text-xs rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
                <span>{conflictMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => submitForm(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-md cursor-pointer"
              >
                Tetap Simpan Jadwal
              </button>
            </div>
          )}

          <div>
            <label htmlFor="ed-court" className="block text-xs font-semibold text-blue-100 mb-1">
              Court
            </label>
            <select
              id="ed-court"
              value={courtId}
              onChange={(e) => setCourtId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
            >
              <option value="">Belum ditentukan</option>
              {state.courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ed-date" className="block text-xs font-semibold text-blue-100 mb-1">
                Tanggal
              </label>
              <input
                id="ed-date"
                type="date"
                value={scheduledDate}
                min={state.tournament.startDate}
                max={state.tournament.endDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
              />
            </div>
            <div>
              <label htmlFor="ed-time" className="block text-xs font-semibold text-blue-100 mb-1">
                Jam (WIB)
              </label>
              <input
                id="ed-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ed-stage" className="block text-xs font-semibold text-blue-100 mb-1">
                Babak
              </label>
              <input
                id="ed-stage"
                type="text"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
              />
            </div>
            <div>
              <label htmlFor="ed-status" className="block text-xs font-semibold text-blue-100 mb-1">
                Status
              </label>
              <select
                id="ed-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as MatchStatus)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
              >
                <option value="scheduled">Terjadwal</option>
                <option value="live">Berlangsung</option>
                <option value="completed">Selesai</option>
                <option value="postponed">Ditunda</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-blue-100 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyWhatsApp}
              onChange={(e) => setNotifyWhatsApp(e.target.checked)}
              className="rounded border-[#284BA8]"
            />
            Kirim notifikasi pembaruan jadwal otomatis via WhatsApp
          </label>

          <div className="pt-3 border-t border-[#1B3782] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-blue-200 hover:bg-[#0E266B] hover:text-white rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => submitForm(false)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              {saving ? 'Menyimpan...' : 'Simpan & Kirim WA'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddCourtModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (payload: { name: string; surface: string; isIndoor: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [surface, setSurface] = useState('Mondo Supercourt Blue');
  const [isIndoor, setIsIndoor] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), surface: surface.trim(), isIndoor });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-court-title"
      className="fixed inset-0 z-50 bg-[#030A21]/75 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-[#1B3782] bg-[#081744] flex items-center justify-between">
          <h2 id="add-court-title" className="text-base font-bold text-white">
            Tambah Lapangan / Court
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="cursor-pointer">
            <X className="w-5 h-5 text-blue-200 hover:text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="c-name" className="block text-xs font-semibold text-blue-100 mb-1">
              Nama Court *
            </label>
            <input
              id="c-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Court 5 · Rooftop Glass"
              className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white placeholder:text-blue-300/50"
            />
          </div>
          <div>
            <label htmlFor="c-surf" className="block text-xs font-semibold text-blue-100 mb-1">
              Jenis Lantai / Karpet
            </label>
            <input
              id="c-surf"
              type="text"
              value={surface}
              onChange={(e) => setSurface(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-blue-100 cursor-pointer">
            <input
              type="checkbox"
              checked={isIndoor}
              onChange={(e) => setIsIndoor(e.target.checked)}
              className="rounded border-[#284BA8]"
            />
            Court Indoor (Atap Tertutup)
          </label>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-blue-200 hover:bg-[#0E266B] hover:text-white rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              Simpan Court
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
