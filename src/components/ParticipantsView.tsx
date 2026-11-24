import { useState } from 'react';
import { CheckCircle2, Edit3, Plus, Search, Trash2, UserCheck, X } from 'lucide-react';
import type { Team, TeamStatus, TournamentState } from '../types/tournament.ts';
import { isValidWhatsAppNumber } from '../utils/tournamentLogic.ts';

interface ParticipantsViewProps {
  state: TournamentState;
  showRegisterModal: boolean;
  onCloseRegisterModal: () => void;
  onOpenRegisterModal: () => void;
  onRegisterTeam: (payload: {
    categoryId: string;
    teamName: string;
    club: string;
    seed?: number | null;
    player1: { name: string; whatsapp: string; level: string };
    player2: { name: string; whatsapp: string; level: string };
  }) => Promise<Team>;
  onUpdateTeam: (
    teamId: string,
    payload: Partial<{
      categoryId: string;
      teamName: string;
      club: string;
      seed: number | null;
      status: TeamStatus;
      player1: { name: string; whatsapp: string; level: string };
      player2: { name: string; whatsapp: string; level: string };
    }>
  ) => Promise<Team>;
  onDeleteTeam: (teamId: string) => Promise<void>;
}

const STATUS_LABELS: Record<TeamStatus, string> = {
  registered: 'Terdaftar',
  checked_in: 'Checked-In',
  withdrawn: 'Mengundurkan Diri',
};

export function ParticipantsView({
  state,
  showRegisterModal,
  onCloseRegisterModal,
  onOpenRegisterModal,
  onRegisterTeam,
  onUpdateTeam,
  onDeleteTeam,
}: ParticipantsViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredTeams = state.teams.filter((t) => {
    if (selectedCategory !== 'all' && t.categoryId !== selectedCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.teamName.toLowerCase().includes(q) ||
      t.player1.name.toLowerCase().includes(q) ||
      t.player2.name.toLowerCase().includes(q) ||
      t.club.toLowerCase().includes(q) ||
      t.player1.whatsapp.includes(q) ||
      t.player2.whatsapp.includes(q)
    );
  });

  const handleToggleCheckIn = async (team: Team) => {
    setActionError(null);
    try {
      const nextStatus: TeamStatus =
        team.status === 'checked_in' ? 'registered' : 'checked_in';
      await onUpdateTeam(team.id, { status: nextStatus });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal memperbarui status');
    }
  };

  const handleDelete = async (team: Team) => {
    setActionError(null);
    try {
      await onDeleteTeam(team.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menghapus pasangan');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Registrasi Peserta &amp; Data Pasangan
          </h1>
          <p className="text-sm text-slate-500">
            Kelola pendaftaran pasangan berdasarkan kategori, data pemain, dan nomor WhatsApp aktif.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenRegisterModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Daftar Pasangan Baru
        </button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="px-4 py-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg flex items-center justify-between gap-3"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Tutup pesan kesalahan"
            className="text-red-700 hover:text-red-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua ({state.teams.length})
          </button>
          {state.categories.map((cat) => {
            const count = state.teams.filter((t) => t.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat.name} ({count}/{cat.maxTeams})
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari pemain, pasangan, klub, WA..."
            aria-label="Cari peserta atau pasangan"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Pairs Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredTeams.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700">
              Belum ada pasangan yang cocok dengan filter ini.
            </p>
            <button
              type="button"
              onClick={onOpenRegisterModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Registrasi Pasangan Pertama
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Pasangan &amp; Klub</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Pemain 1 (WhatsApp)</th>
                  <th className="py-3 px-4">Pemain 2 (WhatsApp)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredTeams.map((team) => {
                  const category = state.categories.find((c) => c.id === team.categoryId);
                  return (
                    <tr key={team.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{team.teamName}</div>
                        <div className="text-xs text-slate-500">
                          {team.club}
                          {team.seed ? ` · Seed #${team.seed}` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        {category?.name || team.categoryId}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{team.player1.name}</div>
                        <div className="text-xs font-mono text-slate-500 tabular-nums">
                          +{team.player1.whatsapp} · {team.player1.level}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{team.player2.name}</div>
                        <div className="text-xs font-mono text-slate-500 tabular-nums">
                          +{team.player2.whatsapp} · {team.player2.level}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            team.status === 'checked_in'
                              ? 'text-emerald-700'
                              : team.status === 'withdrawn'
                                ? 'text-red-700'
                                : 'text-amber-700'
                          }`}
                        >
                          {team.status === 'checked_in' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {STATUS_LABELS[team.status]}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleCheckIn(team)}
                            aria-label={`Check-in ${team.teamName}`}
                            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-100 rounded-md inline-flex items-center gap-1 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            {team.status === 'checked_in' ? 'Batalkan Check-In' : 'Check-In'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTeam(team)}
                            aria-label={`Edit ${team.teamName}`}
                            className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(team)}
                            aria-label={`Hapus ${team.teamName}`}
                            className="p-1.5 text-red-600 hover:text-red-800 border border-slate-200 hover:bg-red-50 rounded-md cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(showRegisterModal || editingTeam) && (
        <TeamFormModal
          state={state}
          initialTeam={editingTeam}
          onClose={() => {
            onCloseRegisterModal();
            setEditingTeam(null);
          }}
          onSubmit={async (payload) => {
            if (editingTeam) {
              await onUpdateTeam(editingTeam.id, payload);
            } else {
              await onRegisterTeam(payload);
            }
            onCloseRegisterModal();
            setEditingTeam(null);
          }}
        />
      )}
    </div>
  );
}

interface TeamFormModalProps {
  state: TournamentState;
  initialTeam: Team | null;
  onClose: () => void;
  onSubmit: (payload: {
    categoryId: string;
    teamName: string;
    club: string;
    seed: number | null;
    player1: { name: string; whatsapp: string; level: string };
    player2: { name: string; whatsapp: string; level: string };
  }) => Promise<void>;
}

export function TeamFormModal({
  state,
  initialTeam,
  onClose,
  onSubmit,
}: TeamFormModalProps) {
  const [categoryId, setCategoryId] = useState(
    initialTeam?.categoryId || state.categories[0]?.id || ''
  );
  const [teamName, setTeamName] = useState(initialTeam?.teamName || '');
  const [club, setClub] = useState(initialTeam?.club || '');
  const [seedInput, setSeedInput] = useState(initialTeam?.seed ? String(initialTeam.seed) : '');
  const [p1Name, setP1Name] = useState(initialTeam?.player1.name || '');
  const [p1Wa, setP1Wa] = useState(initialTeam?.player1.whatsapp || '');
  const [p1Level, setP1Level] = useState(initialTeam?.player1.level || 'Level A');
  const [p2Name, setP2Name] = useState(initialTeam?.player2.name || '');
  const [p2Wa, setP2Wa] = useState(initialTeam?.player2.whatsapp || '');
  const [p2Level, setP2Level] = useState(initialTeam?.player2.level || 'Level A');

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!categoryId) {
      setFormError('Pilih kategori turnamen terlebih dahulu.');
      return;
    }
    if (!p1Name.trim() || !p2Name.trim()) {
      setFormError('Nama lengkap Pemain 1 dan Pemain 2 wajib diisi.');
      return;
    }
    if (!isValidWhatsAppNumber(p1Wa) || !isValidWhatsAppNumber(p2Wa)) {
      setFormError('Masukkan nomor WhatsApp valid (contoh: 081234567890) untuk kedua pemain.');
      return;
    }

    const parsedSeed = seedInput.trim() ? Number.parseInt(seedInput.trim(), 10) : null;
    try {
      setSubmitting(true);
      await onSubmit({
        categoryId,
        teamName: teamName.trim(),
        club: club.trim() || 'Independent',
        seed: parsedSeed && parsedSeed > 0 ? parsedSeed : null,
        player1: { name: p1Name.trim(), whatsapp: p1Wa.trim(), level: p1Level },
        player2: { name: p2Name.trim(), whatsapp: p2Wa.trim(), level: p2Level },
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan pendaftaran.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="team-modal-title" className="text-lg font-bold text-slate-900">
            {initialTeam ? `Edit Pasangan: ${initialTeam.teamName}` : 'Registrasi Pasangan Baru'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup formulir"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {formError && (
            <div role="alert" className="px-3.5 py-2.5 bg-red-50 border border-red-200 text-red-800 text-xs font-medium rounded-lg">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-category" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kategori Turnamen *
              </label>
              <select
                id="reg-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {state.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.level})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="reg-team-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nama Pasangan / Tim (Opsional)
              </label>
              <input
                id="reg-team-name"
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Otomatis dari nama pemain jika kosong"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="reg-club" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Klub / Komunitas
              </label>
              <input
                id="reg-club"
                type="text"
                value={club}
                onChange={(e) => setClub(e.target.value)}
                placeholder="Contoh: Senayan Padel"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="reg-seed" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Unggulan / Seed (Opsional)
              </label>
              <input
                id="reg-seed"
                type="number"
                min={1}
                max={64}
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                placeholder="Contoh: 1"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-800">Pemain 1</h3>
              <div>
                <label htmlFor="p1-name" className="block text-xs font-medium text-slate-600 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  id="p1-name"
                  type="text"
                  required
                  value={p1Name}
                  onChange={(e) => setP1Name(e.target.value)}
                  placeholder="Nama Pemain 1"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="p1-wa" className="block text-xs font-medium text-slate-600 mb-1">
                  Nomor WhatsApp *
                </label>
                <input
                  id="p1-wa"
                  type="tel"
                  required
                  value={p1Wa}
                  onChange={(e) => setP1Wa(e.target.value)}
                  placeholder="081234567890"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="p1-level" className="block text-xs font-medium text-slate-600 mb-1">
                  Level Bermain
                </label>
                <select
                  id="p1-level"
                  value={p1Level}
                  onChange={(e) => setP1Level(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Pro">Pro</option>
                  <option value="Level A">Level A</option>
                  <option value="Level B">Level B</option>
                  <option value="Open">Open</option>
                  <option value="Beginner">Beginner</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-800">Pemain 2 (Pasangan)</h3>
              <div>
                <label htmlFor="p2-name" className="block text-xs font-medium text-slate-600 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  id="p2-name"
                  type="text"
                  required
                  value={p2Name}
                  onChange={(e) => setP2Name(e.target.value)}
                  placeholder="Nama Pemain 2"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="p2-wa" className="block text-xs font-medium text-slate-600 mb-1">
                  Nomor WhatsApp *
                </label>
                <input
                  id="p2-wa"
                  type="tel"
                  required
                  value={p2Wa}
                  onChange={(e) => setP2Wa(e.target.value)}
                  placeholder="081298765432"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="p2-level" className="block text-xs font-medium text-slate-600 mb-1">
                  Level Bermain
                </label>
                <select
                  id="p2-level"
                  value={p2Level}
                  onChange={(e) => setP2Level(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Pro">Pro</option>
                  <option value="Level A">Level A</option>
                  <option value="Level B">Level B</option>
                  <option value="Open">Open</option>
                  <option value="Beginner">Beginner</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              {submitting ? 'Menyimpan...' : initialTeam ? 'Simpan Perubahan' : 'Simpan Pendaftaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
