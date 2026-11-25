import { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Edit3,
  Link2,
  Lock,
  MapPin,
  Plus,
  Search,
  Trash2,
  Unlink,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  Participant,
  Team,
  TeamStatus,
  TournamentState,
} from '../types/tournament.ts';
import {
  buildDefaultPairName,
  findTeamForParticipant,
  formatPairRegion,
} from '../utils/tournamentLogic.ts';

interface ParticipantsViewProps {
  state: TournamentState;
  isAdmin: boolean;
  isSignedIn?: boolean;
  onSignInGoogle?: () => Promise<unknown>;
  onRequireAdminLogin: () => void;
  showRegisterModal: boolean;
  onCloseRegisterModal: () => void;
  onOpenRegisterModal: () => void;
  onRegisterParticipant: (payload: {
    name: string;
    region: string;
    representation?: string;
    categoryId: string;
    level: string;
  }) => Promise<Participant>;
  onUpdateParticipant: (
    participantId: string,
    payload: Partial<{
      name: string;
      region: string;
      representation: string;
      categoryId: string;
      level: string;
      status: TeamStatus;
    }>
  ) => Promise<Participant>;
  onDeleteParticipant: (participantId: string, cascade?: boolean) => Promise<void>;
  onPairParticipants: (payload: {
    participant1Id: string;
    participant2Id: string;
    categoryId: string;
    teamName?: string;
    region?: string;
    seed?: number | null;
  }) => Promise<Team>;
  onUpdateTeam: (
    teamId: string,
    payload: Partial<{
      categoryId: string;
      teamName: string;
      region: string;
      club: string;
      seed: number | null;
      status: TeamStatus;
      player1: { name: string; region?: string; representation?: string; level: string };
      player2: { name: string; region?: string; representation?: string; level: string };
    }>
  ) => Promise<Team>;
  onDeleteTeam: (teamId: string, cascade?: boolean) => Promise<void>;
}

const STATUS_LABELS: Record<TeamStatus, string> = {
  registered: 'Terdaftar',
  checked_in: 'Checked-In',
  withdrawn: 'Mengundurkan Diri',
};

const SUGGESTED_REGIONS = [
  'Makassar',
  'Gowa',
  'Maros',
  'Parepare',
  'Bone',
  'Palopo',
  'Manado',
  'Kendari',
  'Palu',
  'Gorontalo',
  'Mamuju',
];

const REPRESENTATION_CATEGORIES = [
  'Retail Sales',
  'Cabang / Branch',
  'Distributor / Partner',
  'Head Office',
  'Komunitas Padel',
  'Sponsor / VIP',
];

export function ParticipantsView({
  state,
  isAdmin,
  isSignedIn = false,
  onSignInGoogle,
  onRequireAdminLogin,
  showRegisterModal,
  onCloseRegisterModal,
  onOpenRegisterModal,
  onRegisterParticipant,
  onUpdateParticipant,
  onDeleteParticipant,
  onPairParticipants,
  onUpdateTeam,
  onDeleteTeam,
}: ParticipantsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'individuals' | 'pairs'>('individuals');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPairModal, setShowPairModal] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingCascadeTeam, setPendingCascadeTeam] = useState<{
    team: Team;
    linkedMatchCount: number;
  } | null>(null);
  const [pendingCascadeParticipant, setPendingCascadeParticipant] = useState<{
    participant: Participant;
    message: string;
  } | null>(null);

  const participants = state.participants || [];

  const unpairedParticipants = useMemo(
    () => participants.filter((p) => !findTeamForParticipant(p.id, state.teams)),
    [participants, state.teams]
  );

  const filteredParticipants = participants.filter((p) => {
    if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const linked = findTeamForParticipant(p.id, state.teams);
    return (
      p.name.toLowerCase().includes(q) ||
      p.region.toLowerCase().includes(q) ||
      (p.representation || '').toLowerCase().includes(q) ||
      p.level.toLowerCase().includes(q) ||
      (linked?.teamName.toLowerCase().includes(q) ?? false)
    );
  });

  const filteredTeams = state.teams.filter((t) => {
    if (selectedCategory !== 'all' && t.categoryId !== selectedCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const regionText = (t.region || t.club || '').toLowerCase();
    return (
      t.teamName.toLowerCase().includes(q) ||
      t.player1.name.toLowerCase().includes(q) ||
      t.player2.name.toLowerCase().includes(q) ||
      (t.player1.representation || '').toLowerCase().includes(q) ||
      (t.player2.representation || '').toLowerCase().includes(q) ||
      regionText.includes(q)
    );
  });

  const toggleSelectParticipant = (id: string) => {
    setActionError(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

  const handleOpenManualPair = () => {
    if (!isAdmin) {
      onRequireAdminLogin();
      return;
    }
    if (unpairedParticipants.length < 2) {
      setActionError('Minimal perlu 2 peserta yang belum berpasangan untuk membentuk grup/pasangan.');
      return;
    }
    setActionError(null);
    setShowPairModal(true);
  };

  const handleToggleParticipantCheckIn = async (p: Participant) => {
    if (!isAdmin) {
      onRequireAdminLogin();
      return;
    }
    setActionError(null);
    try {
      const nextStatus: TeamStatus = p.status === 'checked_in' ? 'registered' : 'checked_in';
      await onUpdateParticipant(p.id, { status: nextStatus });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal memperbarui status peserta');
    }
  };

  const handleDeleteParticipant = async (p: Participant, cascade = false) => {
    if (!isAdmin) {
      onRequireAdminLogin();
      return;
    }
    setActionError(null);
    setPendingCascadeParticipant(null);
    try {
      await onDeleteParticipant(p.id, cascade);
      setSelectedIds((prev) => prev.filter((id) => id !== p.id));
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 409) {
        setPendingCascadeParticipant({ participant: p, message: e.message });
      } else {
        setActionError(e.message || 'Gagal menghapus peserta');
      }
    }
  };

  const handleToggleTeamCheckIn = async (team: Team) => {
    if (!isAdmin) {
      onRequireAdminLogin();
      return;
    }
    setActionError(null);
    try {
      const nextStatus: TeamStatus =
        team.status === 'checked_in' ? 'registered' : 'checked_in';
      await onUpdateTeam(team.id, { status: nextStatus });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal memperbarui status pasangan');
    }
  };

  const handleDeleteTeam = async (team: Team, cascade = false) => {
    if (!isAdmin) {
      onRequireAdminLogin();
      return;
    }
    setActionError(null);
    setPendingCascadeTeam(null);
    try {
      await onDeleteTeam(team.id, cascade);
    } catch (err) {
      const e = err as Error & { status?: number; linkedMatchCount?: number };
      if (e.status === 409 && e.linkedMatchCount) {
        setPendingCascadeTeam({ team, linkedMatchCount: e.linkedMatchCount });
      } else {
        setActionError(e.message || 'Gagal melepas pasangan');
      }
    }
  };

  const selectedFirst = participants.find((p) => p.id === selectedIds[0]);
  const selectedSecond = participants.find((p) => p.id === selectedIds[1]);

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Daftar Peserta &amp; Pembentukan Pasangan
          </h1>
          <p className="text-sm text-blue-200/75">
            Peserta terdaftar sebagai nama individu beserta region asal, lalu dipasangkan menjadi
            grup secara manual.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleOpenManualPair}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0D2363] hover:bg-[#132E7D] text-white border border-[#284BA8] text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Link2 className="w-4 h-4 text-sky-300" />
            Bentuk Pasangan Manual
          </button>
          <button
            type="button"
            onClick={onOpenRegisterModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Daftar Peserta Baru
          </button>
        </div>
      </div>

      {/* Sub-Tabs: Individual Names vs Formed Pairs */}
      <div
        role="tablist"
        aria-label="Tampilan peserta dan pasangan"
        className="flex flex-wrap items-center gap-2 border-b border-[#1B3782] pb-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'individuals'}
          onClick={() => setActiveSubTab('individuals')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'individuals'
              ? 'bg-blue-600 text-white'
              : 'bg-[#0A1D52] text-blue-200 hover:bg-[#0E266B] hover:text-white border border-[#1B3782]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Daftar Peserta ({participants.length})</span>
          <span className="text-xs opacity-80 tabular-nums">
            · {unpairedParticipants.length} belum berpasangan
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'pairs'}
          onClick={() => setActiveSubTab('pairs')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'pairs'
              ? 'bg-blue-600 text-white'
              : 'bg-[#0A1D52] text-blue-200 hover:bg-[#0E266B] hover:text-white border border-[#1B3782]'
          }`}
        >
          <Link2 className="w-4 h-4" />
          <span>Pasangan / Grup ({state.teams.length})</span>
        </button>
      </div>

      {!isAdmin && (
        <div className="px-4 py-3 bg-[#0A1D52] border border-[#284BA8] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-blue-100">
            <Lock className="w-4 h-4 text-sky-300 shrink-0" />
            <span>
              Mode Pengunjung: Anda dapat melihat daftar peserta &amp; mendaftar peserta baru. Login
              Admin untuk memasangkan peserta secara manual, mengedit, atau menghapus data.
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

      {/* Selected 2 Players Floating/Inline Pairing Bar */}
      {activeSubTab === 'individuals' && selectedIds.length > 0 && (
        <div className="px-4 py-3 bg-[#0E2563] border border-sky-400/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-white">
            {selectedIds.length === 1 && selectedFirst ? (
              <span>
                Terpilih 1 peserta: <strong>{selectedFirst.name}</strong> ({selectedFirst.region}).
                Pilih 1 peserta lagi untuk membentuk pasangan.
              </span>
            ) : selectedFirst && selectedSecond ? (
              <span>
                2 peserta dipilih: <strong>{selectedFirst.name}</strong> ({selectedFirst.region})
                {' & '}
                <strong>{selectedSecond.name}</strong> ({selectedSecond.region})
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-xs font-medium text-blue-200 hover:text-white border border-[#284BA8] rounded-lg cursor-pointer"
            >
              Bersihkan
            </button>
            {selectedIds.length === 2 && (
              <button
                type="button"
                onClick={handleOpenManualPair}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                Pasangkan Sekarang
              </button>
            )}
          </div>
        </div>
      )}

      {pendingCascadeParticipant && (
        <div
          role="alert"
          className="px-4 py-3 bg-amber-950/70 border border-amber-500/40 text-amber-100 text-sm rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <span>{pendingCascadeParticipant.message}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPendingCascadeParticipant(null)}
              className="px-3 py-1.5 text-xs font-medium text-amber-200 hover:text-white border border-amber-500/40 rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() =>
                handleDeleteParticipant(pendingCascadeParticipant.participant, true)
              }
              className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg cursor-pointer"
            >
              Ya, Hapus Peserta &amp; Pasangan
            </button>
          </div>
        </div>
      )}

      {pendingCascadeTeam && (
        <div
          role="alert"
          className="px-4 py-3 bg-amber-950/70 border border-amber-500/40 text-amber-100 text-sm rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <span>
            Pasangan <strong>{pendingCascadeTeam.team.teamName}</strong> terhubung ke{' '}
            {pendingCascadeTeam.linkedMatchCount} jadwal pertandingan. Lepas pasangan beserta
            jadwal terkait?
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPendingCascadeTeam(null)}
              className="px-3 py-1.5 text-xs font-medium text-amber-200 hover:text-white border border-amber-500/40 rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => handleDeleteTeam(pendingCascadeTeam.team, true)}
              className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg cursor-pointer"
            >
              Ya, Lepas Pasangan &amp; Jadwal
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="px-4 py-3 bg-red-950/70 border border-red-500/40 text-red-200 text-sm rounded-lg flex items-center justify-between gap-3"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Tutup pesan kesalahan"
            className="text-red-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Category & Search Filter Toolbar */}
      <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#06133B] border border-[#1B3782] rounded-lg">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-blue-200 hover:text-white'
            }`}
          >
            Semua (
            {activeSubTab === 'individuals' ? participants.length : state.teams.length})
          </button>
          {state.categories.map((cat) => {
            const count =
              activeSubTab === 'individuals'
                ? participants.filter((p) => p.categoryId === cat.id).length
                : state.teams.filter((t) => t.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white'
                    : 'text-blue-200 hover:text-white'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-blue-300/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeSubTab === 'individuals'
                ? 'Cari nama peserta, region, perwakilan...'
                : 'Cari pasangan, pemain, region, perwakilan...'
            }
            aria-label="Cari peserta, region, atau perwakilan"
            className="w-full pl-9 pr-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white placeholder:text-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* TAB 1: Individual Participants Table */}
      {activeSubTab === 'individuals' && (
        <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl overflow-hidden">
          {filteredParticipants.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-medium text-blue-100">
                Belum ada peserta yang cocok dengan filter ini.
              </p>
              <button
                type="button"
                onClick={onOpenRegisterModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Daftarkan Peserta Pertama
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1B3782] bg-[#071540] text-xs font-semibold text-blue-200/80">
                    <th className="py-3 px-4 w-10 text-center">Pilih</th>
                    <th className="py-3 px-4">Nama Peserta</th>
                    <th className="py-3 px-4">Region</th>
                    <th className="py-3 px-4">Perwakilan</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Level</th>
                    <th className="py-3 px-4">Status Pasangan</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B3782] text-sm">
                  {filteredParticipants.map((p) => {
                    const category = state.categories.find((c) => c.id === p.categoryId);
                    const linkedTeam = findTeamForParticipant(p.id, state.teams);
                    const isSelected = selectedIds.includes(p.id);
                    const isPaired = Boolean(linkedTeam);

                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-[#122D7A]/70' : 'hover:bg-[#0E2563]/60'
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            disabled={isPaired}
                            checked={isSelected}
                            onChange={() => toggleSelectParticipant(p.id)}
                            aria-label={`Pilih ${p.name} untuk dipasangkan`}
                            className="w-4 h-4 accent-blue-500 rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{p.name}</div>
                          <div className="text-xs text-blue-200/70">
                            {STATUS_LABELS[p.status]}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-300">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            {p.region}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-100">
                            <Building2 className="w-3.5 h-3.5 text-sky-300/80 shrink-0" />
                            {p.representation || 'Retail Sales'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-blue-100 whitespace-nowrap">
                          {category?.name || p.categoryId}
                        </td>
                        <td className="py-3.5 px-4 text-blue-200/85 whitespace-nowrap">
                          {p.level}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {linkedTeam ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              Pasangan: {linkedTeam.teamName}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-amber-300">
                              Belum Berpasangan
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {isAdmin ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleParticipantCheckIn(p)}
                                aria-label={`Check-in ${p.name}`}
                                className="px-2.5 py-1.5 text-xs font-medium text-blue-100 hover:text-white border border-[#284BA8] hover:bg-[#132E7D] rounded-md inline-flex items-center gap-1 cursor-pointer"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                {p.status === 'checked_in' ? 'Batal Check-In' : 'Check-In'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingParticipant(p)}
                                aria-label={`Edit ${p.name}`}
                                className="p-1.5 text-blue-200 hover:text-white border border-[#284BA8] hover:bg-[#132E7D] rounded-md cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteParticipant(p)}
                                aria-label={`Hapus ${p.name}`}
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
        </div>
      )}

      {/* TAB 2: Manually Formed Pairs / Groups Table */}
      {activeSubTab === 'pairs' && (
        <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl overflow-hidden">
          {filteredTeams.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-medium text-blue-100">
                Belum ada pasangan/grup yang dibentuk pada kategori ini.
              </p>
              <button
                type="button"
                onClick={handleOpenManualPair}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                <Link2 className="w-4 h-4" />
                Bentuk Pasangan Manual
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1B3782] bg-[#071540] text-xs font-semibold text-blue-200/80">
                    <th className="py-3 px-4">Pasangan / Grup</th>
                    <th className="py-3 px-4">Region</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Pemain 1</th>
                    <th className="py-3 px-4">Pemain 2</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B3782] text-sm">
                  {filteredTeams.map((team) => {
                    const category = state.categories.find((c) => c.id === team.categoryId);
                    const displayRegion = team.region || team.club;
                    return (
                      <tr key={team.id} className="hover:bg-[#0E2563]/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{team.teamName}</div>
                          {team.seed && (
                            <div className="text-xs text-sky-300 font-medium">
                              Seed #{team.seed}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-300">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            {displayRegion}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-blue-100 whitespace-nowrap">
                          {category?.name || team.categoryId}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-white">{team.player1.name}</div>
                          <div className="text-xs text-blue-200/75">
                            {team.player1.region || displayRegion} ·{' '}
                            {team.player1.representation || 'Retail Sales'} · {team.player1.level}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-white">{team.player2.name}</div>
                          <div className="text-xs text-blue-200/75">
                            {team.player2.region || displayRegion} ·{' '}
                            {team.player2.representation || 'Retail Sales'} · {team.player2.level}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                              team.status === 'checked_in'
                                ? 'text-emerald-400'
                                : team.status === 'withdrawn'
                                  ? 'text-red-400'
                                  : 'text-amber-300'
                            }`}
                          >
                            {team.status === 'checked_in' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {STATUS_LABELS[team.status]}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {isAdmin ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleTeamCheckIn(team)}
                                aria-label={`Check-in ${team.teamName}`}
                                className="px-2.5 py-1.5 text-xs font-medium text-blue-100 hover:text-white border border-[#284BA8] hover:bg-[#132E7D] rounded-md inline-flex items-center gap-1 cursor-pointer"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                {team.status === 'checked_in' ? 'Batalkan' : 'Check-In'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTeam(team)}
                                aria-label={`Edit pasangan ${team.teamName}`}
                                className="p-1.5 text-blue-200 hover:text-white border border-[#284BA8] hover:bg-[#132E7D] rounded-md cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTeam(team)}
                                title="Lepas pasangan kembali menjadi peserta individu"
                                aria-label={`Lepas pasangan ${team.teamName}`}
                                className="p-1.5 text-red-400 hover:text-red-200 border border-[#284BA8] hover:bg-red-950/60 rounded-md cursor-pointer"
                              >
                                <Unlink className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* Modal 1: Register / Edit Single Individual Participant (With Region, No WhatsApp) */}
      {(showRegisterModal || editingParticipant) && (
        <ParticipantFormModal
          state={state}
          initialParticipant={editingParticipant}
          isSignedIn={isSignedIn}
          onSignInGoogle={onSignInGoogle}
          onClose={() => {
            onCloseRegisterModal();
            setEditingParticipant(null);
          }}
          onSubmit={async (payload) => {
            if (editingParticipant) {
              await onUpdateParticipant(editingParticipant.id, payload);
            } else {
              await onRegisterParticipant(payload);
            }
            onCloseRegisterModal();
            setEditingParticipant(null);
          }}
        />
      )}

      {/* Modal 2: Manual Pair Formation */}
      {showPairModal && (
        <ManualPairModal
          state={state}
          unpairedParticipants={unpairedParticipants}
          initialFirstId={selectedIds[0] || ''}
          initialSecondId={selectedIds[1] || ''}
          onClose={() => setShowPairModal(false)}
          onSubmit={async (payload) => {
            await onPairParticipants(payload);
            setSelectedIds([]);
            setShowPairModal(false);
            setActiveSubTab('pairs');
          }}
        />
      )}

      {/* Modal 3: Edit Existing Formed Pair (Region, No WhatsApp) */}
      {editingTeam && (
        <TeamEditModal
          state={state}
          initialTeam={editingTeam}
          onClose={() => setEditingTeam(null)}
          onSubmit={async (payload) => {
            await onUpdateTeam(editingTeam.id, payload);
            setEditingTeam(null);
          }}
        />
      )}
    </div>
  );
}

interface ParticipantFormModalProps {
  state: TournamentState;
  initialParticipant: Participant | null;
  isSignedIn?: boolean;
  onSignInGoogle?: () => Promise<unknown>;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    region: string;
    representation: string;
    categoryId: string;
    level: string;
  }) => Promise<void>;
}

export function ParticipantFormModal({
  state,
  initialParticipant,
  isSignedIn = false,
  onSignInGoogle,
  onClose,
  onSubmit,
}: ParticipantFormModalProps) {
  const initialRep = initialParticipant?.representation || 'Retail Sales';
  const isInitialPreset = REPRESENTATION_CATEGORIES.includes(initialRep);

  const [name, setName] = useState(initialParticipant?.name || '');
  const [region, setRegion] = useState(initialParticipant?.region || '');
  const [repSelect, setRepSelect] = useState(isInitialPreset ? initialRep : '__custom__');
  const [repCustom, setRepCustom] = useState(isInitialPreset ? '' : initialRep);
  const [categoryId, setCategoryId] = useState(
    initialParticipant?.categoryId || state.categories[0]?.id || ''
  );
  const [level, setLevel] = useState(initialParticipant?.level || 'Open');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resolvedRepresentation =
    repSelect === '__custom__' ? repCustom.trim() : repSelect;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Nama lengkap peserta wajib diisi.');
      return;
    }
    if (!region.trim()) {
      setFormError('Region asal peserta wajib diisi.');
      return;
    }
    if (!resolvedRepresentation) {
      setFormError('Kategori perwakilan peserta wajib dipilih atau diisi.');
      return;
    }
    if (!categoryId) {
      setFormError('Pilih kategori turnamen terlebih dahulu.');
      return;
    }

    try {
      setSubmitting(true);
      if (!isSignedIn && onSignInGoogle) {
        await onSignInGoogle();
      }
      await onSubmit({
        name: name.trim(),
        region: region.trim(),
        representation: resolvedRepresentation,
        categoryId,
        level,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan data peserta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="participant-modal-title"
      className="fixed inset-0 z-50 bg-[#030A21]/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-[#1B3782] bg-[#081744] flex items-center justify-between">
          <h2 id="participant-modal-title" className="text-lg font-bold text-white">
            {initialParticipant
              ? `Edit Peserta: ${initialParticipant.name}`
              : 'Registrasi Peserta Baru'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup formulir peserta"
            className="p-1.5 text-blue-200 hover:text-white rounded-md cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div
              role="alert"
              className="px-3.5 py-2.5 bg-red-950/70 border border-red-500/40 text-red-200 text-xs font-medium rounded-lg"
            >
              {formError}
            </div>
          )}

          <div>
            <label htmlFor="part-name" className="block text-xs font-semibold text-blue-100 mb-1.5">
              Nama Lengkap Peserta *
            </label>
            <input
              id="part-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Andi Tenri"
              className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white placeholder:text-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="part-region" className="block text-xs font-semibold text-blue-100 mb-1.5">
                Region *
              </label>
              <input
                id="part-region"
                type="text"
                required
                list="sulawesi-region-list"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Contoh: Makassar, Manado..."
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white placeholder:text-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="sulawesi-region-list">
                {SUGGESTED_REGIONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>

            <div>
              <label
                htmlFor="part-representation"
                className="block text-xs font-semibold text-blue-100 mb-1.5"
              >
                Kategori Perwakilan *
              </label>
              <select
                id="part-representation"
                value={repSelect}
                onChange={(e) => setRepSelect(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {REPRESENTATION_CATEGORIES.map((rep) => (
                  <option key={rep} value={rep}>
                    {rep}
                  </option>
                ))}
                <option value="__custom__">Lainnya (Tulis Sendiri)</option>
              </select>
            </div>
          </div>

          {repSelect === '__custom__' && (
            <div>
              <label
                htmlFor="part-representation-custom"
                className="block text-xs font-semibold text-blue-100 mb-1.5"
              >
                Nama Kategori Perwakilan *
              </label>
              <input
                id="part-representation-custom"
                type="text"
                required
                value={repCustom}
                onChange={(e) => setRepCustom(e.target.value)}
                placeholder="Tulis nama kategori perwakilan..."
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white placeholder:text-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="part-category" className="block text-xs font-semibold text-blue-100 mb-1.5">
                Kategori Turnamen *
              </label>
              <select
                id="part-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {state.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="part-level" className="block text-xs font-semibold text-blue-100 mb-1.5">
                Level Bermain
              </label>
              <select
                id="part-level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Pro">Pro</option>
                <option value="Level A">Level A</option>
                <option value="Level B">Level B</option>
                <option value="Open">Open</option>
                <option value="Beginner">Beginner</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-blue-200/70">
            Peserta baru akan tersimpan permanen di Cloud Firestore sebagai nama terpisah dan dapat
            dipasangkan menjadi grup secara manual oleh Admin.
            {!initialParticipant && !isSignedIn && onSignInGoogle
              ? ' Anda akan diminta masuk akun Google terlebih dahulu untuk keamanan data.'
              : ''}
          </p>

          <div className="border-t border-[#1B3782] pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-blue-200 hover:bg-[#0E266B] hover:text-white rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              {submitting
                ? 'Menyimpan...'
                : initialParticipant
                  ? 'Simpan Perubahan'
                  : !isSignedIn && onSignInGoogle
                    ? 'Masuk Google & Simpan'
                    : 'Simpan Peserta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ManualPairModalProps {
  state: TournamentState;
  unpairedParticipants: Participant[];
  initialFirstId: string;
  initialSecondId: string;
  onClose: () => void;
  onSubmit: (payload: {
    participant1Id: string;
    participant2Id: string;
    categoryId: string;
    teamName?: string;
    region?: string;
    seed?: number | null;
  }) => Promise<void>;
}

function ManualPairModal({
  state,
  unpairedParticipants,
  initialFirstId,
  initialSecondId,
  onClose,
  onSubmit,
}: ManualPairModalProps) {
  const defaultP1 =
    unpairedParticipants.find((p) => p.id === initialFirstId)?.id ||
    unpairedParticipants[0]?.id ||
    '';
  const defaultP2 =
    unpairedParticipants.find((p) => p.id === initialSecondId && p.id !== defaultP1)?.id ||
    unpairedParticipants.find((p) => p.id !== defaultP1)?.id ||
    '';

  const [p1Id, setP1Id] = useState(defaultP1);
  const [p2Id, setP2Id] = useState(defaultP2);
  const p1 = unpairedParticipants.find((p) => p.id === p1Id);
  const p2 = unpairedParticipants.find((p) => p.id === p2Id);

  const [categoryId, setCategoryId] = useState(
    p1?.categoryId || state.categories[0]?.id || ''
  );
  const [teamName, setTeamName] = useState('');
  const [regionOverride, setRegionOverride] = useState('');
  const [seedInput, setSeedInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const autoPairName =
    p1 && p2 ? buildDefaultPairName(p1.name, p2.name) : 'Pemain 1 / Pemain 2';
  const autoRegion =
    p1 && p2 ? formatPairRegion(p1.region, p2.region) : p1?.region || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!p1Id || !p2Id || p1Id === p2Id) {
      setFormError('Pilih dua peserta yang berbeda untuk membentuk pasangan.');
      return;
    }

    const parsedSeed = seedInput.trim() ? Number.parseInt(seedInput.trim(), 10) : null;
    try {
      setSubmitting(true);
      await onSubmit({
        participant1Id: p1Id,
        participant2Id: p2Id,
        categoryId,
        teamName: teamName.trim() || undefined,
        region: regionOverride.trim() || autoRegion || undefined,
        seed: parsedSeed && parsedSeed > 0 ? parsedSeed : null,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal membentuk pasangan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-pair-title"
      className="fixed inset-0 z-50 bg-[#030A21]/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-[#1B3782] bg-[#081744] flex items-center justify-between">
          <h2 id="manual-pair-title" className="text-lg font-bold text-white">
            Bentuk Pasangan / Grup Manual
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal pasangan"
            className="p-1.5 text-blue-200 hover:text-white rounded-md cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div
              role="alert"
              className="px-3.5 py-2.5 bg-red-950/70 border border-red-500/40 text-red-200 text-xs font-medium rounded-lg"
            >
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pair-p1" className="block text-xs font-semibold text-blue-100 mb-1.5">
                Pemain 1 *
              </label>
              <select
                id="pair-p1"
                value={p1Id}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setP1Id(nextId);
                  const nextP1 = unpairedParticipants.find((p) => p.id === nextId);
                  if (nextP1) setCategoryId(nextP1.categoryId);
                }}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {unpairedParticipants.map((p) => {
                  const cat = state.categories.find((c) => c.id === p.categoryId);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.region} · {cat?.name || p.categoryId})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label htmlFor="pair-p2" className="block text-xs font-semibold text-blue-100 mb-1.5">
                Pemain 2 (Pasangan) *
              </label>
              <select
                id="pair-p2"
                value={p2Id}
                onChange={(e) => setP2Id(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {unpairedParticipants
                  .filter((p) => p.id !== p1Id)
                  .map((p) => {
                    const cat = state.categories.find((c) => c.id === p.categoryId);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.region} · {cat?.name || p.categoryId})
                      </option>
                    );
                  })}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pair-category" className="block text-xs font-semibold text-blue-100 mb-1.5">
                Kategori Turnamen *
              </label>
              <select
                id="pair-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {state.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pair-name" className="block text-xs font-semibold text-blue-100 mb-1.5">
                Nama Pasangan / Grup (Opsional)
              </label>
              <input
                id="pair-name"
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder={`Otomatis: ${autoPairName}`}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white placeholder:text-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="pair-region" className="block text-xs font-semibold text-blue-100 mb-1.5">
                Region Pasangan
              </label>
              <input
                id="pair-region"
                type="text"
                value={regionOverride}
                onChange={(e) => setRegionOverride(e.target.value)}
                placeholder={autoRegion || 'Contoh: Makassar / Gowa'}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white placeholder:text-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="pair-seed" className="block text-xs font-semibold text-blue-100 mb-1.5">
                Seed / Unggulan (Opsional)
              </label>
              <input
                id="pair-seed"
                type="number"
                min={1}
                max={64}
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                placeholder="Contoh: 1"
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white placeholder:text-blue-300/50 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="border-t border-[#1B3782] pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-blue-200 hover:bg-[#0E266B] hover:text-white rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              {submitting ? 'Memasangkan...' : 'Simpan Pasangan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface TeamEditModalProps {
  state: TournamentState;
  initialTeam: Team;
  onClose: () => void;
  onSubmit: (payload: {
    categoryId: string;
    teamName: string;
    region: string;
    club: string;
    seed: number | null;
    player1: { name: string; region: string; representation: string; level: string };
    player2: { name: string; region: string; representation: string; level: string };
  }) => Promise<void>;
}

function TeamEditModal({ state, initialTeam, onClose, onSubmit }: TeamEditModalProps) {
  const [categoryId, setCategoryId] = useState(initialTeam.categoryId);
  const [teamName, setTeamName] = useState(initialTeam.teamName);
  const [region, setRegion] = useState(initialTeam.region || initialTeam.club);
  const [seedInput, setSeedInput] = useState(initialTeam.seed ? String(initialTeam.seed) : '');
  const [p1Name, setP1Name] = useState(initialTeam.player1.name);
  const [p1Region, setP1Region] = useState(
    initialTeam.player1.region || initialTeam.region || initialTeam.club
  );
  const [p1Rep, setP1Rep] = useState(initialTeam.player1.representation || 'Retail Sales');
  const [p1Level, setP1Level] = useState(initialTeam.player1.level || 'Open');
  const [p2Name, setP2Name] = useState(initialTeam.player2.name);
  const [p2Region, setP2Region] = useState(
    initialTeam.player2.region || initialTeam.region || initialTeam.club
  );
  const [p2Rep, setP2Rep] = useState(initialTeam.player2.representation || 'Retail Sales');
  const [p2Level, setP2Level] = useState(initialTeam.player2.level || 'Open');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!p1Name.trim() || !p2Name.trim()) {
      setFormError('Nama lengkap Pemain 1 dan Pemain 2 wajib diisi.');
      return;
    }
    const parsedSeed = seedInput.trim() ? Number.parseInt(seedInput.trim(), 10) : null;
    const resolvedRegion = region.trim() || formatPairRegion(p1Region, p2Region);
    try {
      setSubmitting(true);
      await onSubmit({
        categoryId,
        teamName: teamName.trim(),
        region: resolvedRegion,
        club: resolvedRegion,
        seed: parsedSeed && parsedSeed > 0 ? parsedSeed : null,
        player1: {
          name: p1Name.trim(),
          region: p1Region.trim(),
          representation: p1Rep.trim() || 'Retail Sales',
          level: p1Level,
        },
        player2: {
          name: p2Name.trim(),
          region: p2Region.trim(),
          representation: p2Rep.trim() || 'Retail Sales',
          level: p2Level,
        },
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan perubahan pasangan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-team-title"
      className="fixed inset-0 z-50 bg-[#030A21]/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-[#1B3782] bg-[#081744] flex items-center justify-between">
          <h2 id="edit-team-title" className="text-lg font-bold text-white">
            Edit Pasangan: {initialTeam.teamName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup formulir edit pasangan"
            className="p-1.5 text-blue-200 hover:text-white rounded-md cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {formError && (
            <div
              role="alert"
              className="px-3.5 py-2.5 bg-red-950/70 border border-red-500/40 text-red-200 text-xs font-medium rounded-lg"
            >
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-cat" className="block text-xs font-semibold text-blue-100 mb-1.5">
                Kategori Turnamen *
              </label>
              <select
                id="edit-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {state.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="edit-tname" className="block text-xs font-semibold text-blue-100 mb-1.5">
                Nama Pasangan / Grup
              </label>
              <input
                id="edit-tname"
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="edit-tregion" className="block text-xs font-semibold text-blue-100 mb-1.5">
                Region Pasangan
              </label>
              <input
                id="edit-tregion"
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="edit-tseed" className="block text-xs font-semibold text-blue-100 mb-1.5">
                Seed / Unggulan
              </label>
              <input
                id="edit-tseed"
                type="number"
                min={1}
                max={64}
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="border-t border-[#1B3782] pt-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-sky-300">Pemain 1</h3>
              <div>
                <label htmlFor="ep1-name" className="block text-xs font-medium text-blue-200/80 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  id="ep1-name"
                  type="text"
                  required
                  value={p1Name}
                  onChange={(e) => setP1Name(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="ep1-region" className="block text-xs font-medium text-blue-200/80 mb-1">
                  Region
                </label>
                <input
                  id="ep1-region"
                  type="text"
                  value={p1Region}
                  onChange={(e) => setP1Region(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="ep1-rep" className="block text-xs font-medium text-blue-200/80 mb-1">
                  Kategori Perwakilan
                </label>
                <input
                  id="ep1-rep"
                  type="text"
                  list="team-rep-list"
                  value={p1Rep}
                  onChange={(e) => setP1Rep(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="ep1-level" className="block text-xs font-medium text-blue-200/80 mb-1">
                  Level Bermain
                </label>
                <select
                  id="ep1-level"
                  value={p1Level}
                  onChange={(e) => setP1Level(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <h3 className="text-xs font-bold text-sky-300">Pemain 2</h3>
              <div>
                <label htmlFor="ep2-name" className="block text-xs font-medium text-blue-200/80 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  id="ep2-name"
                  type="text"
                  required
                  value={p2Name}
                  onChange={(e) => setP2Name(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="ep2-region" className="block text-xs font-medium text-blue-200/80 mb-1">
                  Region
                </label>
                <input
                  id="ep2-region"
                  type="text"
                  value={p2Region}
                  onChange={(e) => setP2Region(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="ep2-rep" className="block text-xs font-medium text-blue-200/80 mb-1">
                  Kategori Perwakilan
                </label>
                <input
                  id="ep2-rep"
                  type="text"
                  list="team-rep-list"
                  value={p2Rep}
                  onChange={(e) => setP2Rep(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="ep2-level" className="block text-xs font-medium text-blue-200/80 mb-1">
                  Level Bermain
                </label>
                <select
                  id="ep2-level"
                  value={p2Level}
                  onChange={(e) => setP2Level(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          <datalist id="team-rep-list">
            {REPRESENTATION_CATEGORIES.map((rep) => (
              <option key={rep} value={rep} />
            ))}
          </datalist>

          <div className="border-t border-[#1B3782] pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-blue-200 hover:bg-[#0E266B] hover:text-white rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
