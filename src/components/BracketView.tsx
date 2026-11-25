import { useMemo, useState } from 'react';
import {
  Award,
  CalendarClock,
  Check,
  Edit3,
  GitBranch,
  Link2,
  Lock,
  Maximize2,
  Minimize2,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import type {
  BracketSlot,
  CategoryBracket,
  Match,
  Team,
  TournamentState,
} from '../types/tournament.ts';
import {
  findMatchingMatchForSlot,
  formatMatchSetsForBracket,
  mergeWithDefaultBrackets,
  normalizeTeamLabel,
  populateBracketFromCategoryTeams,
  resolveBracketChampionName,
  resolveBracketSlotTeamId,
  resolveBracketSlotTeamName,
  resolveBracketThirdPlaceName,
  syncBracketWithTeamsAndMatches,
  updateBracketSlotDetails,
} from '../utils/tournamentBracket.ts';

interface BracketViewProps {
  state: TournamentState;
  isAdmin: boolean;
  readOnly?: boolean;
  onRequireAdminLogin: () => void;
  onUpdateBracket: (categoryId: string, bracket: CategoryBracket) => Promise<CategoryBracket>;
  onResetBracket: (categoryId: string) => Promise<CategoryBracket>;
  onCreateMatch?: (payload: {
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
  onOpenOperatorMatch?: (matchId: string) => void;
  onNavigateToParticipants?: (categoryId?: string) => void;
}

interface EditingSlotTarget {
  bracket: CategoryBracket;
  slot: BracketSlot;
}

interface SchedulingSlotTarget {
  bracket: CategoryBracket;
  slot: BracketSlot;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
}

interface EditingPodiumTarget {
  bracket: CategoryBracket;
}

export function BracketView({
  state,
  isAdmin,
  readOnly = false,
  onRequireAdminLogin,
  onUpdateBracket,
  onResetBracket,
  onCreateMatch,
  onOpenOperatorMatch,
  onNavigateToParticipants,
}: BracketViewProps) {
  const brackets = useMemo(
    () => mergeWithDefaultBrackets(state.brackets),
    [state.brackets]
  );

  const [filterCategoryId, setFilterCategoryId] = useState<string>('all');
  const [editingSlot, setEditingSlot] = useState<EditingSlotTarget | null>(null);
  const [schedulingSlot, setSchedulingSlot] = useState<SchedulingSlotTarget | null>(null);
  const [editingPodium, setEditingPodium] = useState<EditingPodiumTarget | null>(null);
  const [syncConfirmCategory, setSyncConfirmCategory] = useState<CategoryBracket | null>(null);
  const [resetConfirmCategory, setResetConfirmCategory] = useState<CategoryBracket | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const canEdit = isAdmin && !readOnly;

  const visibleBrackets = useMemo(
    () =>
      filterCategoryId === 'all'
        ? brackets
        : brackets.filter((b) => b.categoryId === filterCategoryId),
    [brackets, filterCategoryId]
  );

  const handleSaveSlot = async (
    bracket: CategoryBracket,
    slotId: string,
    patch: Partial<
      Pick<
        BracketSlot,
        | 'teamAName'
        | 'teamBName'
        | 'teamAId'
        | 'teamBId'
        | 'linkedMatchId'
        | 'scoreA'
        | 'scoreB'
        | 'teamALabel'
        | 'teamBLabel'
        | 'note'
        | 'winnerSide'
      >
    >
  ) => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    setSavingId(bracket.categoryId);
    try {
      const nextBracket = updateBracketSlotDetails(bracket, slotId, patch);
      const synced = syncBracketWithTeamsAndMatches(nextBracket, state.teams, state.matches);
      await onUpdateBracket(bracket.categoryId, synced);
      setEditingSlot(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan perubahan bagan');
    } finally {
      setSavingId(null);
    }
  };

  const handleSavePodium = async (
    bracket: CategoryBracket,
    championName: string,
    thirdPlaceName?: string
  ) => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    setSavingId(bracket.categoryId);
    try {
      const nextBracket: CategoryBracket = {
        ...bracket,
        championName: championName.trim(),
        ...(bracket.thirdPlaceTitle !== undefined
          ? { thirdPlaceName: (thirdPlaceName || '').trim() }
          : {}),
        updatedAt: new Date().toISOString(),
      };
      await onUpdateBracket(bracket.categoryId, nextBracket);
      setEditingPodium(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan juara bagan');
    } finally {
      setSavingId(null);
    }
  };

  const handleSyncFromTeams = async (bracket: CategoryBracket) => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    setSavingId(bracket.categoryId);
    try {
      const populated = populateBracketFromCategoryTeams(bracket, state.teams);
      const synced = syncBracketWithTeamsAndMatches(populated, state.teams, state.matches);
      await onUpdateBracket(bracket.categoryId, synced);
      setSyncConfirmCategory(null);
      setFeedbackMsg(
        `Bagan ${bracket.title} berhasil disinkronkan dengan daftar Pasangan / Grup.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyinkronkan bagan dengan daftar grup');
    } finally {
      setSavingId(null);
    }
  };

  const handleResetCategory = async (bracket: CategoryBracket) => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    setSavingId(bracket.categoryId);
    try {
      await onResetBracket(bracket.categoryId);
      setResetConfirmCategory(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mereset bagan');
    } finally {
      setSavingId(null);
    }
  };

  const handleConfirmScheduleSlot = async (
    target: SchedulingSlotTarget,
    payload: {
      courtId: string | null;
      scheduledDate: string;
      scheduledTime: string;
      ignoreConflict?: boolean;
      openScoreAfter?: boolean;
    }
  ) => {
    if (!onCreateMatch) return;
    setErrorMsg(null);
    setFeedbackMsg(null);
    setSavingId(target.bracket.categoryId);
    try {
      const created = await onCreateMatch({
        categoryId: target.bracket.categoryId,
        stage: `Bagan ${target.slot.code} · ${target.slot.roundLabel}`,
        teamAId: target.teamAId,
        teamBId: target.teamBId,
        courtId: payload.courtId,
        scheduledDate: payload.scheduledDate,
        scheduledTime: payload.scheduledTime,
        ignoreConflict: payload.ignoreConflict,
        notifyWhatsApp: false,
      });

      const patched = updateBracketSlotDetails(target.bracket, target.slot.id, {
        teamAId: target.teamAId,
        teamBId: target.teamBId,
        teamAName: target.teamAName,
        teamBName: target.teamBName,
        linkedMatchId: created.id,
      });
      await onUpdateBracket(target.bracket.categoryId, patched);
      setSchedulingSlot(null);

      if (payload.openScoreAfter && onOpenOperatorMatch) {
        onOpenOperatorMatch(created.id);
      } else {
        setFeedbackMsg(
          `Pertandingan #${created.matchNumber} (${target.slot.code}) dibuat dan terhubung ke bagan.`
        );
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 bg-[#040C2A] overflow-auto p-4 sm:p-8 space-y-6 shadow-2xl'
          : 'space-y-6'
      }
    >
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#E7F028] mb-1">
            <GitBranch className="w-4 h-4" />
            <span>Bagan Turnamen 3 Kategori · Terintegrasi Grup &amp; Skor</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Bagan Pertandingan Resmi
          </h1>
          <p className="text-sm text-blue-200/80">
            Seluruh bagan sistem gugur terhubung langsung dengan daftar Pasangan / Grup dan Operator
            Skor sehingga pemenang otomatis maju ke babak berikutnya.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            {isFullscreen ? 'Tutup Layar Penuh' : 'Layar Penuh'}
          </button>
          {!readOnly && onNavigateToParticipants && (
            <button
              type="button"
              onClick={() => onNavigateToParticipants()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0D2363] hover:bg-[#132E7D] text-blue-100 hover:text-white border border-[#284BA8] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-sky-300" />
              Peserta &amp; Pasangan
            </button>
          )}
          {!readOnly && !isAdmin && (
            <button
              type="button"
              onClick={onRequireAdminLogin}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0D2363] hover:bg-[#132E7D] text-white border border-[#284BA8] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-sky-300" />
              Login Admin / Panitia
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Pills (keeps all 3 on 1 page by default) */}
      <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterCategoryId('all')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              filterCategoryId === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-blue-200 hover:bg-[#0E266B] hover:text-white'
            }`}
          >
            Semua Kategori ({brackets.length})
          </button>
          {brackets.map((b) => (
            <button
              key={b.categoryId}
              type="button"
              onClick={() => setFilterCategoryId(b.categoryId)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterCategoryId === b.categoryId
                  ? 'bg-blue-600 text-white'
                  : 'text-blue-200 hover:bg-[#0E266B] hover:text-white'
              }`}
            >
              {b.title}
            </button>
          ))}
        </div>

        <span className="px-2.5 text-xs text-blue-200/75">
          {canEdit
            ? 'Mode Edit Aktif · Skor selesai otomatis memperbarui pemenang di bagan'
            : 'Mode Lihat Saja · Login Admin/Panitia untuk mengubah bagan'}
        </span>
      </div>

      {feedbackMsg && (
        <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs font-medium rounded-xl px-4 py-3 flex items-center justify-between gap-2">
          <span>{feedbackMsg}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-emerald-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-950/60 border border-red-500/40 text-red-200 text-xs font-medium rounded-xl px-4 py-3 flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* All Category Brackets */}
      <div className="space-y-8">
        {visibleBrackets.map((bracket) => {
          const catTeams = state.teams.filter((t) => t.categoryId === bracket.categoryId);
          const catMatches = state.matches.filter((m) => m.categoryId === bracket.categoryId);
          return (
            <CategoryBracketCard
              key={bracket.categoryId}
              bracket={bracket}
              categoryTeams={catTeams}
              categoryMatches={catMatches}
              canEdit={canEdit}
              isSaving={savingId === bracket.categoryId}
              onEditSlot={(slot) => setEditingSlot({ bracket, slot })}
              onScheduleSlot={
                onCreateMatch
                  ? (slot, teamAId, teamBId, teamAName, teamBName) =>
                      setSchedulingSlot({
                        bracket,
                        slot,
                        teamAId,
                        teamBId,
                        teamAName,
                        teamBName,
                      })
                  : undefined
              }
              onOpenOperatorMatch={!readOnly ? onOpenOperatorMatch : undefined}
              onEditPodium={() => setEditingPodium({ bracket })}
              onRequestSync={() => setSyncConfirmCategory(bracket)}
              onRequestReset={() => setResetConfirmCategory(bracket)}
            />
          );
        })}
      </div>

      {/* Edit Slot Modal */}
      {editingSlot && (
        <BracketSlotEditorModal
          bracket={editingSlot.bracket}
          slot={editingSlot.slot}
          teams={state.teams.filter((t) => t.categoryId === editingSlot.bracket.categoryId)}
          matches={state.matches.filter((m) => m.categoryId === editingSlot.bracket.categoryId)}
          isSaving={savingId === editingSlot.bracket.categoryId}
          onClose={() => setEditingSlot(null)}
          onSave={(patch) => handleSaveSlot(editingSlot.bracket, editingSlot.slot.id, patch)}
        />
      )}

      {/* Quick Schedule Slot Modal */}
      {schedulingSlot && (
        <QuickScheduleSlotModal
          state={state}
          target={schedulingSlot}
          isSaving={savingId === schedulingSlot.bracket.categoryId}
          onClose={() => setSchedulingSlot(null)}
          onConfirm={(payload) => handleConfirmScheduleSlot(schedulingSlot, payload)}
        />
      )}

      {/* Edit Podium (Champion & 3rd Place) Modal */}
      {editingPodium && (
        <BracketPodiumModal
          bracket={editingPodium.bracket}
          teams={state.teams.filter((t) => t.categoryId === editingPodium.bracket.categoryId)}
          isSaving={savingId === editingPodium.bracket.categoryId}
          onClose={() => setEditingPodium(null)}
          onSave={(championName, thirdPlaceName) =>
            handleSavePodium(editingPodium.bracket, championName, thirdPlaceName)
          }
        />
      )}

      {/* Sync Bracket from Pasangan / Grup Modal */}
      {syncConfirmCategory && (
        <SyncTeamsConfirmModal
          bracket={syncConfirmCategory}
          teams={state.teams.filter(
            (t) => t.categoryId === syncConfirmCategory.categoryId && t.status !== 'withdrawn'
          )}
          isSaving={savingId === syncConfirmCategory.categoryId}
          onClose={() => setSyncConfirmCategory(null)}
          onConfirm={() => handleSyncFromTeams(syncConfirmCategory)}
          onNavigateToParticipants={
            onNavigateToParticipants
              ? () => {
                  const catId = syncConfirmCategory.categoryId;
                  setSyncConfirmCategory(null);
                  onNavigateToParticipants(catId);
                }
              : undefined
          }
        />
      )}

      {/* Reset Category Bracket Confirm Modal */}
      {resetConfirmCategory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-bracket-title"
          className="fixed inset-0 z-50 bg-[#030A21]/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h2 id="reset-bracket-title" className="text-base font-bold text-white">
              Reset Bagan {resetConfirmCategory.title}?
            </h2>
            <p className="text-xs text-blue-200/85 leading-relaxed">
              Seluruh nama tim, skor, dan pemenang pada bagan{' '}
              <span className="font-semibold text-white">{resetConfirmCategory.title}</span> akan
              dikembalikan sesuai susunan undian PDF awal.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#1B3782]">
              <button
                type="button"
                disabled={savingId === resetConfirmCategory.categoryId}
                onClick={() => setResetConfirmCategory(null)}
                className="px-4 py-2 text-xs font-medium text-blue-200 hover:bg-[#0E266B] hover:text-white rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={savingId === resetConfirmCategory.categoryId}
                onClick={() => handleResetCategory(resetConfirmCategory)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {savingId === resetConfirmCategory.categoryId ? 'Mereset...' : 'Ya, Reset Bagan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CategoryBracketCardProps {
  bracket: CategoryBracket;
  categoryTeams: Team[];
  categoryMatches: Match[];
  canEdit: boolean;
  isSaving: boolean;
  onEditSlot: (slot: BracketSlot) => void;
  onScheduleSlot?: (
    slot: BracketSlot,
    teamAId: string,
    teamBId: string,
    teamAName: string,
    teamBName: string
  ) => void;
  onOpenOperatorMatch?: (matchId: string) => void;
  onEditPodium: () => void;
  onRequestSync: () => void;
  onRequestReset: () => void;
}

function CategoryBracketCard({
  bracket,
  categoryTeams,
  categoryMatches,
  canEdit,
  isSaving,
  onEditSlot,
  onScheduleSlot,
  onOpenOperatorMatch,
  onEditPodium,
  onRequestSync,
  onRequestReset,
}: CategoryBracketCardProps) {
  const mainSlots = useMemo(
    () => bracket.slots.filter((s) => !s.isThirdPlace),
    [bracket.slots]
  );
  const thirdPlaceSlot = useMemo(
    () => bracket.slots.find((s) => s.isThirdPlace),
    [bracket.slots]
  );

  const activeTeamCount = useMemo(
    () => categoryTeams.filter((t) => t.status !== 'withdrawn').length,
    [categoryTeams]
  );

  const championDisplay = resolveBracketChampionName(bracket, categoryTeams);
  const thirdPlaceDisplay = resolveBracketThirdPlaceName(bracket, categoryTeams);

  return (
    <section
      aria-label={`Bagan ${bracket.title}`}
      className="bg-[#040C2A] border border-[#142C6E] rounded-xl overflow-hidden shadow-2xl"
    >
      {/* Category Banner Header */}
      <div className="px-5 sm:px-6 py-4 bg-[#05113B] border-b border-[#142C6E] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3 py-1 bg-[#E7F028] text-[#06133B] text-base font-extrabold rounded-md shadow tracking-tight">
              {bracket.title}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0D2363] border border-[#284BA8] text-[11px] font-semibold text-sky-200">
              <Users className="w-3 h-3 text-sky-300" />
              {activeTeamCount} Pasangan / Grup
            </span>
            {isSaving && (
              <span className="text-xs font-medium text-sky-300">Menyimpan...</span>
            )}
          </div>
          <p className="text-xs font-medium text-blue-200/80 mt-1">{bracket.subtitle}</p>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRequestSync}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Muat dari Pasangan / Grup
            </button>
            <button
              type="button"
              onClick={onEditPodium}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0D2363] hover:bg-[#132E7D] text-white border border-[#284BA8] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-[#E7F028]" />
              Edit Juara
            </button>
            <button
              type="button"
              onClick={onRequestReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#081744] hover:bg-[#0E266B] text-blue-200 hover:text-white border border-[#1B3782] text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Default PDF
            </button>
          </div>
        )}
      </div>

      {/* Horizontal Scrollable Bracket Tree */}
      <div className="p-4 sm:p-5 overflow-x-auto">
        <div className="min-w-[880px] flex items-stretch gap-3">
          {bracket.rounds.map((roundTitle, rIdx) => {
            const slotsInRound = mainSlots.filter((s) => s.roundIndex === rIdx);
            const hasNextRound = rIdx < bracket.rounds.length;
            return (
              <div
                key={`${bracket.categoryId}-round-${rIdx}`}
                className="flex-1 min-w-[180px] flex flex-col"
              >
                <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-[#05113B] border border-[#142C6E] text-center">
                  <span className="text-[11px] font-bold tracking-wide text-sky-300 uppercase">
                    {roundTitle}
                  </span>
                </div>

                <div className="flex-1 flex flex-col justify-around gap-3">
                  {slotsInRound.map((slot) => (
                    <div key={slot.id} className="relative flex items-center">
                      <div className="flex-1 min-w-0">
                        <BracketMatchCard
                          categoryId={bracket.categoryId}
                          bracketTitle={bracket.title}
                          slot={slot}
                          allSlots={bracket.slots}
                          categoryTeams={categoryTeams}
                          categoryMatches={categoryMatches}
                          canEdit={canEdit}
                          onEdit={() => onEditSlot(slot)}
                          onScheduleSlot={onScheduleSlot}
                          onOpenOperatorMatch={onOpenOperatorMatch}
                        />
                      </div>
                      {hasNextRound && (
                        <div
                          aria-hidden="true"
                          className="w-3 shrink-0 flex items-center"
                        >
                          <div className="w-full h-0.5 bg-[#E7F028]/70" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Champion Trophy Column */}
          <div className="w-[168px] shrink-0 flex flex-col">
            <div className="mb-3 px-3 py-1.5 rounded-lg bg-[#06133B] border border-[#E7F028]/40 text-center">
              <span className="text-[11px] font-bold tracking-wide text-[#E7F028] uppercase">
                {bracket.championTitle}
              </span>
            </div>
            <div className="flex-1 flex items-center">
              <div className="w-full rounded-xl bg-gradient-to-b from-[#0E2870] to-[#06133B] border-2 border-[#E7F028]/70 p-4 text-center space-y-2.5 shadow-lg">
                <div className="w-10 h-10 mx-auto rounded-full bg-[#E7F028]/15 border border-[#E7F028]/40 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-[#E7F028]" />
                </div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#E7F028]">
                  {bracket.championTitle}
                </div>
                <div className="text-sm font-bold text-white min-h-[2.25rem] flex items-center justify-center leading-snug">
                  {championDisplay || (
                    <span className="text-xs font-normal text-blue-200/65 italic">
                      Menunggu Final
                    </span>
                  )}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={onEditPodium}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#081744] hover:bg-[#132E7D] border border-[#284BA8] text-[11px] font-semibold text-sky-200 rounded-md cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    Ubah Juara
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Standalone 3rd Place Playoff Section (NO connector lines from Semifinal per PDF rule) */}
      {thirdPlaceSlot && (
        <div className="px-4 sm:px-6 pb-5 pt-2 border-t border-[#1B3782] bg-[#071540]/60">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-3">
            <div className="flex-1 max-w-md">
              <div className="text-[11px] font-bold uppercase tracking-wide text-amber-300 mb-2">
                {thirdPlaceSlot.roundLabel}
              </div>
              <BracketMatchCard
                categoryId={bracket.categoryId}
                bracketTitle={bracket.title}
                slot={thirdPlaceSlot}
                allSlots={bracket.slots}
                categoryTeams={categoryTeams}
                categoryMatches={categoryMatches}
                canEdit={canEdit}
                onEdit={() => onEditSlot(thirdPlaceSlot)}
                onScheduleSlot={onScheduleSlot}
                onOpenOperatorMatch={onOpenOperatorMatch}
              />
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-[#06133B] border border-amber-400/40 px-4 py-3 min-w-[230px]">
              <div className="w-9 h-9 rounded-full bg-amber-400/15 border border-amber-400/40 flex items-center justify-center shrink-0">
                <Award className="w-4 h-4 text-amber-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold uppercase text-amber-300">
                  {bracket.thirdPlaceTitle || 'JUARA 3'}
                </div>
                <div className="text-sm font-bold text-white truncate">
                  {thirdPlaceDisplay || 'Menunggu Perebutan Juara 3'}
                </div>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={onEditPodium}
                  aria-label={`Edit ${bracket.thirdPlaceTitle || 'Juara 3'} ${bracket.title}`}
                  className="p-1.5 text-blue-200 hover:text-white hover:bg-[#0D2363] rounded-md cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {bracket.footerNote && (
              <p className="text-xs text-blue-200/70 max-w-xs leading-relaxed">
                {bracket.footerNote}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

interface BracketMatchCardProps {
  categoryId: string;
  bracketTitle: string;
  slot: BracketSlot;
  allSlots: BracketSlot[];
  categoryTeams: Team[];
  categoryMatches: Match[];
  canEdit: boolean;
  onEdit: () => void;
  onScheduleSlot?: (
    slot: BracketSlot,
    teamAId: string,
    teamBId: string,
    teamAName: string,
    teamBName: string
  ) => void;
  onOpenOperatorMatch?: (matchId: string) => void;
}

function BracketMatchCard({
  categoryId,
  bracketTitle,
  slot,
  allSlots,
  categoryTeams,
  categoryMatches,
  canEdit,
  onEdit,
  onScheduleSlot,
  onOpenOperatorMatch,
}: BracketMatchCardProps) {
  const nameA = resolveBracketSlotTeamName(slot, 'A', allSlots, categoryTeams);
  const nameB = resolveBracketSlotTeamName(slot, 'B', allSlots, categoryTeams);
  const teamAId = resolveBracketSlotTeamId(slot, 'A', allSlots, categoryTeams);
  const teamBId = resolveBracketSlotTeamId(slot, 'B', allSlots, categoryTeams);
  const linkedMatchInfo = findMatchingMatchForSlot(
    slot,
    categoryId,
    allSlots,
    categoryTeams,
    categoryMatches
  );

  const isWinnerA = slot.winnerSide === 'A';
  const isWinnerB = slot.winnerSide === 'B';
  const linkedMatch = linkedMatchInfo?.match ?? null;

  const isInitialRound = slot.roundIndex === 0;

  return (
    <div
      className={`rounded-lg overflow-hidden shadow-sm transition-colors ${
        isInitialRound
          ? 'bg-[#991b1b] border-2 border-red-500'
          : 'bg-[#06133B] border-2 border-[#E7F028]'
      }`}
    >
      <div
        className={`px-3 py-1.5 flex items-center justify-between gap-2 border-b ${
          isInitialRound
            ? 'bg-[#7f1d1d] border-red-500 text-[#E7F028]'
            : 'bg-[#E7F028] text-[#06133B] border-[#cdd620]'
        }`}
      >
        <span
          className={`text-[11px] font-extrabold uppercase shrink-0 ${
            isInitialRound ? 'text-[#E7F028]' : 'text-[#06133B]'
          }`}
        >
          {slot.code}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {linkedMatch && onOpenOperatorMatch && (
            <button
              type="button"
              onClick={() => onOpenOperatorMatch(linkedMatch.id)}
              aria-label={`Buka skor ${slot.code} ${bracketTitle}`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-700/80 hover:bg-emerald-600 text-[10px] font-semibold text-white rounded transition-colors cursor-pointer"
            >
              <PlayCircle className="w-2.5 h-2.5" />
              Skor
            </button>
          )}
          {!linkedMatch && canEdit && onScheduleSlot && teamAId && teamBId && teamAId !== teamBId && (
            <button
              type="button"
              onClick={() => onScheduleSlot(slot, teamAId, teamBId, nameA, nameB)}
              aria-label={`Jadwalkan ${slot.code} ${bracketTitle}`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-600/90 hover:bg-blue-500 text-[10px] font-semibold text-white rounded transition-colors cursor-pointer"
            >
              <CalendarClock className="w-2.5 h-2.5" />
              Jadwalkan
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit bagan ${slot.code} ${bracketTitle}`}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded transition-colors shrink-0 cursor-pointer ${
                isInitialRound
                  ? 'bg-red-900 text-yellow-100 hover:bg-red-800'
                  : 'bg-[#0D2363] text-sky-200 hover:text-white hover:bg-blue-600'
              }`}
            >
              <Edit3 className="w-2.5 h-2.5" />
              Edit
            </button>
          )}
        </div>
      </div>

      {(linkedMatch || slot.note) && (
        <div
          className={`px-3 py-1 border-b flex items-center justify-between gap-2 text-[10px] ${
            isInitialRound
              ? 'bg-[#881c1c] border-red-500/50 text-yellow-100/90'
              : 'bg-[#071642] border-[#13296B] text-blue-200/80'
          }`}
        >
          {linkedMatch ? (
            <span
              className={`font-semibold ${
                linkedMatch.status === 'live'
                  ? 'text-emerald-300'
                  : linkedMatch.status === 'completed'
                    ? 'text-sky-300'
                    : 'text-blue-200/80'
              }`}
            >
              Match #{linkedMatch.matchNumber} ·{' '}
              {linkedMatch.status === 'live'
                ? 'LIVE'
                : linkedMatch.status === 'completed'
                  ? 'Selesai'
                  : linkedMatch.scheduledTime}
            </span>
          ) : (
            <span className="font-medium">
              {slot.note}
            </span>
          )}
        </div>
      )}

      <div className={`divide-y ${isInitialRound ? 'divide-red-800/60' : 'divide-[#13296B]'}`}>
        {/* Team A Row */}
        <div
          className={`px-3 py-2 flex items-center justify-between gap-2 ${
            isWinnerA ? 'bg-emerald-950/45' : ''
          }`}
        >
          <div className="min-w-0 flex-1">
            {(slot.teamALabel || teamAId) && (
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-300/75">
                {slot.teamALabel && <span>{slot.teamALabel}</span>}
                {teamAId && (
                  <span className="inline-flex items-center gap-0.5 text-sky-300">
                    <Link2 className="w-2.5 h-2.5" />
                    Grup
                  </span>
                )}
              </div>
            )}
            <div
              className={`text-xs leading-snug break-words ${
                isWinnerA ? 'font-bold text-emerald-300' : 'font-semibold text-white'
              }`}
            >
              {nameA}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {slot.scoreA && (
              <span className="px-1.5 py-0.5 rounded bg-[#0C2260] border border-[#24449B] font-mono text-[11px] font-bold text-sky-200 tabular-nums">
                {slot.scoreA}
              </span>
            )}
            {isWinnerA && (
              <span
                title="Pemenang"
                className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center"
              >
                <Check className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>

        {/* Team B Row */}
        <div
          className={`px-3 py-2 flex items-center justify-between gap-2 ${
            isWinnerB ? 'bg-emerald-950/45' : ''
          }`}
        >
          <div className="min-w-0 flex-1">
            {(slot.teamBLabel || teamBId) && (
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-300/75">
                {slot.teamBLabel && <span>{slot.teamBLabel}</span>}
                {teamBId && (
                  <span className="inline-flex items-center gap-0.5 text-sky-300">
                    <Link2 className="w-2.5 h-2.5" />
                    Grup
                  </span>
                )}
              </div>
            )}
            <div
              className={`text-xs leading-snug break-words ${
                isWinnerB ? 'font-bold text-emerald-300' : 'font-semibold text-white'
              }`}
            >
              {nameB}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {slot.scoreB && (
              <span className="px-1.5 py-0.5 rounded bg-[#0C2260] border border-[#24449B] font-mono text-[11px] font-bold text-sky-200 tabular-nums">
                {slot.scoreB}
              </span>
            )}
            {isWinnerB && (
              <span
                title="Pemenang"
                className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center"
              >
                <Check className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface BracketSlotEditorModalProps {
  bracket: CategoryBracket;
  slot: BracketSlot;
  teams: Team[];
  matches: Match[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (
    patch: Partial<
      Pick<
        BracketSlot,
        | 'teamAName'
        | 'teamBName'
        | 'teamAId'
        | 'teamBId'
        | 'linkedMatchId'
        | 'scoreA'
        | 'scoreB'
        | 'teamALabel'
        | 'teamBLabel'
        | 'note'
        | 'winnerSide'
      >
    >
  ) => Promise<void>;
}

function BracketSlotEditorModal({
  bracket,
  slot,
  teams,
  matches,
  isSaving,
  onClose,
  onSave,
}: BracketSlotEditorModalProps) {
  const resolvedA = resolveBracketSlotTeamName(slot, 'A', bracket.slots, teams);
  const resolvedB = resolveBracketSlotTeamName(slot, 'B', bracket.slots, teams);
  const initialTeamAId = resolveBracketSlotTeamId(slot, 'A', bracket.slots, teams);
  const initialTeamBId = resolveBracketSlotTeamId(slot, 'B', bracket.slots, teams);

  const [teamAId, setTeamAId] = useState<string>(slot.teamAId || (!slot.sourceA ? initialTeamAId || '' : ''));
  const [teamBId, setTeamBId] = useState<string>(slot.teamBId || (!slot.sourceB ? initialTeamBId || '' : ''));
  const [teamAName, setTeamAName] = useState(
    slot.sourceA && slot.teamAName.trim() === slot.sourceA.placeholder
      ? resolvedA
      : resolvedA
  );
  const [teamBName, setTeamBName] = useState(
    slot.sourceB && slot.teamBName.trim() === slot.sourceB.placeholder
      ? resolvedB
      : resolvedB
  );
  const [linkedMatchId, setLinkedMatchId] = useState<string>(slot.linkedMatchId || '');
  const [scoreA, setScoreA] = useState(slot.scoreA || '');
  const [scoreB, setScoreB] = useState(slot.scoreB || '');
  const [note, setNote] = useState(slot.note || '');
  const [winnerSide, setWinnerSide] = useState<'A' | 'B' | null>(slot.winnerSide);

  const datalistId = `bracket-teams-${bracket.categoryId}-${slot.id}`;

  const handleSelectTeamA = (selectedId: string) => {
    setTeamAId(selectedId);
    if (selectedId) {
      const found = teams.find((t) => t.id === selectedId);
      if (found) setTeamAName(found.teamName);
    }
  };

  const handleSelectTeamB = (selectedId: string) => {
    setTeamBId(selectedId);
    if (selectedId) {
      const found = teams.find((t) => t.id === selectedId);
      if (found) setTeamBName(found.teamName);
    }
  };

  const handleSelectMatch = (matchId: string) => {
    setLinkedMatchId(matchId);
    if (!matchId) return;
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    if (match.status === 'live' || match.status === 'completed') {
      const activeAId = teamAId || initialTeamAId;
      const activeBId = teamBId || initialTeamBId;
      const swapped = Boolean(
        (activeAId && match.teamBId === activeAId) ||
          (activeBId && match.teamAId === activeBId)
      );
      setScoreA(formatMatchSetsForBracket(match.score, swapped ? 'B' : 'A'));
      setScoreB(formatMatchSetsForBracket(match.score, swapped ? 'A' : 'B'));
      if (match.score.winnerSide) {
        setWinnerSide(
          match.score.winnerSide === 'A'
            ? swapped
              ? 'B'
              : 'A'
            : swapped
              ? 'A'
              : 'B'
        );
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTeamA =
      slot.sourceA && teamAName.trim() === '' ? slot.sourceA.placeholder : teamAName.trim();
    const finalTeamB =
      slot.sourceB && teamBName.trim() === '' ? slot.sourceB.placeholder : teamBName.trim();

    const isAutoSourceA =
      Boolean(slot.sourceA) &&
      !teamAId &&
      finalTeamA ===
        resolveBracketSlotTeamName(
          { ...slot, teamAId: null, teamAName: slot.sourceA!.placeholder },
          'A',
          bracket.slots,
          teams
        );

    const isAutoSourceB =
      Boolean(slot.sourceB) &&
      !teamBId &&
      finalTeamB ===
        resolveBracketSlotTeamName(
          { ...slot, teamBId: null, teamBName: slot.sourceB!.placeholder },
          'B',
          bracket.slots,
          teams
        );

    const matchedByNameA =
      !isAutoSourceA && !teamAId
        ? teams.find((t) => normalizeTeamLabel(t.teamName) === normalizeTeamLabel(finalTeamA))?.id || null
        : teamAId || null;

    const matchedByNameB =
      !isAutoSourceB && !teamBId
        ? teams.find((t) => normalizeTeamLabel(t.teamName) === normalizeTeamLabel(finalTeamB))?.id || null
        : teamBId || null;

    await onSave({
      teamAName: isAutoSourceA ? slot.sourceA!.placeholder : finalTeamA,
      teamBName: isAutoSourceB ? slot.sourceB!.placeholder : finalTeamB,
      teamAId: isAutoSourceA ? null : matchedByNameA,
      teamBId: isAutoSourceB ? null : matchedByNameB,
      linkedMatchId: linkedMatchId || null,
      scoreA: scoreA.trim(),
      scoreB: scoreB.trim(),
      note: note.trim(),
      winnerSide,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-bracket-slot-title"
      className="fixed inset-0 z-50 bg-[#030A21]/80 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="px-6 py-4 bg-[#071540] border-b border-[#1B3782] flex items-center justify-between gap-2">
          <div>
            <h2 id="edit-bracket-slot-title" className="text-base font-bold text-white">
              Edit Bagan {slot.code} · {bracket.title}
            </h2>
            <p className="text-xs text-blue-200/75">{slot.roundLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-1.5 text-blue-200 hover:text-white rounded-lg hover:bg-[#0D2363] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <datalist id={datalistId}>
            {teams.map((t) => (
              <option key={t.id} value={t.teamName} />
            ))}
          </datalist>

          {/* Team A */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="bracket-team-a-select"
                className="text-xs font-semibold text-blue-100"
              >
                Pasangan A {slot.teamALabel ? `(${slot.teamALabel})` : ''}
              </label>
              {slot.sourceA && (
                <button
                  type="button"
                  onClick={() => {
                    setTeamAId('');
                    setTeamAName(slot.sourceA!.placeholder);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 hover:text-sky-200 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  Otomatis ({slot.sourceA.placeholder})
                </button>
              )}
            </div>
            <select
              id="bracket-team-a-select"
              value={teamAId}
              onChange={(e) => handleSelectTeamA(e.target.value)}
              className="w-full bg-[#06133B] border border-[#1B3782] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
            >
              <option value="">-- Pilih dari Pasangan / Grup (atau ketik manual di bawah) --</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.teamName}
                  {t.region || t.club ? ` (${t.region || t.club})` : ''}
                  {t.seed ? ` · Seed #${t.seed}` : ''}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-12 gap-2">
              <input
                id="bracket-team-a"
                type="text"
                list={datalistId}
                value={teamAName}
                onChange={(e) => {
                  const val = e.target.value;
                  setTeamAName(val);
                  const exact = teams.find(
                    (t) => normalizeTeamLabel(t.teamName) === normalizeTeamLabel(val)
                  );
                  setTeamAId(exact?.id || '');
                }}
                placeholder="Nama pasangan A"
                className="col-span-8 bg-[#06133B] border border-[#1B3782] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-400"
              />
              <input
                type="text"
                aria-label="Skor Pasangan A"
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                placeholder="Skor A"
                className="col-span-4 bg-[#06133B] border border-[#1B3782] rounded-lg px-3 py-2 text-sm font-mono text-white text-center focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          {/* Team B */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="bracket-team-b-select"
                className="text-xs font-semibold text-blue-100"
              >
                Pasangan B {slot.teamBLabel ? `(${slot.teamBLabel})` : ''}
              </label>
              {slot.sourceB && (
                <button
                  type="button"
                  onClick={() => {
                    setTeamBId('');
                    setTeamBName(slot.sourceB!.placeholder);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 hover:text-sky-200 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  Otomatis ({slot.sourceB.placeholder})
                </button>
              )}
            </div>
            <select
              id="bracket-team-b-select"
              value={teamBId}
              onChange={(e) => handleSelectTeamB(e.target.value)}
              className="w-full bg-[#06133B] border border-[#1B3782] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
            >
              <option value="">-- Pilih dari Pasangan / Grup (atau ketik manual di bawah) --</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.teamName}
                  {t.region || t.club ? ` (${t.region || t.club})` : ''}
                  {t.seed ? ` · Seed #${t.seed}` : ''}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-12 gap-2">
              <input
                id="bracket-team-b"
                type="text"
                list={datalistId}
                value={teamBName}
                onChange={(e) => {
                  const val = e.target.value;
                  setTeamBName(val);
                  const exact = teams.find(
                    (t) => normalizeTeamLabel(t.teamName) === normalizeTeamLabel(val)
                  );
                  setTeamBId(exact?.id || '');
                }}
                placeholder="Nama pasangan B"
                className="col-span-8 bg-[#06133B] border border-[#1B3782] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-400"
              />
              <input
                type="text"
                aria-label="Skor Pasangan B"
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
                placeholder="Skor B"
                className="col-span-4 bg-[#06133B] border border-[#1B3782] rounded-lg px-3 py-2 text-sm font-mono text-white text-center focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          {/* Linked Match */}
          <div className="space-y-1.5">
            <label htmlFor="bracket-linked-match" className="text-xs font-semibold text-blue-100 block">
              Hubungkan Pertandingan Operator Skor (Opsional)
            </label>
            <select
              id="bracket-linked-match"
              value={linkedMatchId}
              onChange={(e) => handleSelectMatch(e.target.value)}
              className="w-full bg-[#06133B] border border-[#1B3782] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
            >
              <option value="">-- Otomatis berdasarkan Pasangan &amp; Babak --</option>
              {matches.map((m) => {
                const mA = teams.find((t) => t.id === m.teamAId)?.teamName || m.teamAId;
                const mB = teams.find((t) => t.id === m.teamBId)?.teamName || m.teamBId;
                return (
                  <option key={m.id} value={m.id}>
                    Match #{m.matchNumber} · {m.stage} · {mA} vs {mB} ({m.status})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Winner Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-blue-100 block">
              Pemenang Pertandingan (Otomatis maju ke babak berikutnya)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setWinnerSide(null)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  winnerSide === null
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : 'bg-[#06133B] border-[#1B3782] text-blue-200 hover:text-white'
                }`}
              >
                Belum Ada
              </button>
              <button
                type="button"
                onClick={() => setWinnerSide('A')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  winnerSide === 'A'
                    ? 'bg-emerald-600 border-emerald-400 text-white'
                    : 'bg-[#06133B] border-[#1B3782] text-blue-200 hover:text-white'
                }`}
              >
                Pemenang A
              </button>
              <button
                type="button"
                onClick={() => setWinnerSide('B')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  winnerSide === 'B'
                    ? 'bg-emerald-600 border-emerald-400 text-white'
                    : 'bg-[#06133B] border-[#1B3782] text-blue-200 hover:text-white'
                }`}
              >
                Pemenang B
              </button>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label htmlFor="bracket-note" className="text-xs font-semibold text-blue-100 block">
              Catatan Slot (Opsional)
            </label>
            <input
              id="bracket-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Mis. PEMENANG MASUK QF-4 / Court 1"
              className="w-full bg-[#06133B] border border-[#1B3782] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1B3782]">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-blue-200 hover:bg-[#0E266B] hover:text-white rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Bagan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface QuickScheduleSlotModalProps {
  state: TournamentState;
  target: SchedulingSlotTarget;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    courtId: string | null;
    scheduledDate: string;
    scheduledTime: string;
    ignoreConflict?: boolean;
    openScoreAfter?: boolean;
  }) => Promise<void>;
}

function QuickScheduleSlotModal({
  state,
  target,
  isSaving,
  onClose,
  onConfirm,
}: QuickScheduleSlotModalProps) {
  const [courtId, setCourtId] = useState(state.courts[0]?.id || '');
  const [scheduledDate, setScheduledDate] = useState(state.tournament.startDate || '2026-11-27');
  const [scheduledTime, setScheduledTime] = useState('08:30');
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSubmit = async (openScoreAfter: boolean, ignoreConflict = false) => {
    setError(null);
    setConflictMsg(null);
    try {
      await onConfirm({
        courtId: courtId || null,
        scheduledDate,
        scheduledTime,
        ignoreConflict,
        openScoreAfter,
      });
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 409) {
        setConflictMsg(e.message);
      } else {
        setError(e.message);
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-sched-slot-title"
      className="fixed inset-0 z-50 bg-[#030A21]/80 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-[#071540] border-b border-[#1B3782] flex items-center justify-between gap-2">
          <div>
            <h2 id="quick-sched-slot-title" className="text-base font-bold text-white">
              Jadwalkan Pertandingan {target.slot.code}
            </h2>
            <p className="text-xs text-blue-200/75">
              {target.bracket.title} · {target.slot.roundLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-1.5 text-blue-200 hover:text-white rounded-lg hover:bg-[#0D2363] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 rounded-lg bg-[#06133B] border border-[#1B3782] text-xs font-semibold text-white">
            {target.teamAName} <span className="text-blue-300/70 font-normal">vs</span>{' '}
            {target.teamBName}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-950/70 border border-red-500/40 text-xs text-red-200">
              {error}
            </div>
          )}

          {conflictMsg && (
            <div className="p-3 rounded-lg bg-amber-950/70 border border-amber-500/40 text-xs text-amber-200 space-y-2">
              <p>{conflictMsg}</p>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => runSubmit(true, true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-md cursor-pointer"
              >
                Tetap Buat &amp; Buka Skor
              </button>
            </div>
          )}

          <div>
            <label htmlFor="qs-court" className="block text-xs font-semibold text-blue-100 mb-1">
              Court
            </label>
            <select
              id="qs-court"
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="qs-date" className="block text-xs font-semibold text-blue-100 mb-1">
                Tanggal
              </label>
              <input
                id="qs-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
              />
            </div>
            <div>
              <label htmlFor="qs-time" className="block text-xs font-semibold text-blue-100 mb-1">
                Jam (WITA)
              </label>
              <input
                id="qs-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[#1B3782]">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-blue-200 hover:bg-[#0E266B] hover:text-white rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => runSubmit(false)}
              className="px-3.5 py-2 bg-[#0D2363] hover:bg-[#132E7D] border border-[#284BA8] text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Simpan Jadwal
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => runSubmit(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              {isSaving ? 'Menyimpan...' : 'Buat & Input Skor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SyncTeamsConfirmModalProps {
  bracket: CategoryBracket;
  teams: Team[];
  isSaving: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onNavigateToParticipants?: () => void;
}

function SyncTeamsConfirmModal({
  bracket,
  teams,
  isSaving,
  onClose,
  onConfirm,
  onNavigateToParticipants,
}: SyncTeamsConfirmModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-teams-bracket-title"
      className="fixed inset-0 z-50 bg-[#030A21]/80 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <h2 id="sync-teams-bracket-title" className="text-base font-bold text-white">
          Muat Pasangan / Grup ke Bagan {bracket.title}?
        </h2>

        {teams.length < 2 ? (
          <div className="space-y-3">
            <p className="text-xs text-blue-200/85 leading-relaxed">
              Kategori <span className="font-semibold text-white">{bracket.title}</span> saat ini
              memiliki {teams.length} pasangan aktif di halaman Peserta &amp; Pasangan. Bentuk
              minimal 2 pasangan pada tab <span className="font-semibold text-white">Pasangan / Grup</span>{' '}
              terlebih dahulu.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1B3782]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-blue-200 hover:bg-[#0E266B] hover:text-white rounded-lg cursor-pointer"
              >
                Tutup
              </button>
              {onNavigateToParticipants && (
                <button
                  type="button"
                  onClick={onNavigateToParticipants}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Buka Peserta &amp; Pasangan
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-blue-200/85 leading-relaxed">
              Ditemukan <span className="font-semibold text-white">{teams.length} pasangan aktif</span>{' '}
              pada daftar Pasangan / Grup. Bagan {bracket.title} akan diisi ulang sesuai urutan Seed
              &amp; daftar grup (skor/pemenang sebelumnya di bagan ini akan direset).
            </p>
            <div className="max-h-40 overflow-y-auto rounded-lg bg-[#06133B] border border-[#1B3782] p-2.5 space-y-1">
              {teams.map((t, i) => (
                <div key={t.id} className="text-xs text-blue-100 flex items-center justify-between gap-2">
                  <span className="truncate">
                    {i + 1}. {t.teamName}
                  </span>
                  {t.seed && (
                    <span className="text-[10px] font-semibold text-sky-300 shrink-0">
                      Seed #{t.seed}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#1B3782]">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-blue-200 hover:bg-[#0E266B] hover:text-white rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={onConfirm}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {isSaving ? 'Menyinkronkan...' : 'Ya, Muat ke Bagan'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface BracketPodiumModalProps {
  bracket: CategoryBracket;
  teams: TournamentState['teams'];
  isSaving: boolean;
  onClose: () => void;
  onSave: (championName: string, thirdPlaceName?: string) => Promise<void>;
}

function BracketPodiumModal({
  bracket,
  teams,
  isSaving,
  onClose,
  onSave,
}: BracketPodiumModalProps) {
  const [championName, setChampionName] = useState(bracket.championName || '');
  const [thirdPlaceName, setThirdPlaceName] = useState(bracket.thirdPlaceName || '');

  const datalistId = `podium-teams-${bracket.categoryId}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-podium-title"
      className="fixed inset-0 z-50 bg-[#030A21]/80 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-[#071540] border-b border-[#1B3782] flex items-center justify-between gap-2">
          <h2 id="edit-podium-title" className="text-base font-bold text-white">
            Edit Juara · {bracket.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-1.5 text-blue-200 hover:text-white rounded-lg hover:bg-[#0D2363] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSave(championName, thirdPlaceName);
          }}
          className="p-6 space-y-4"
        >
          <datalist id={datalistId}>
            {teams.map((t) => (
              <option key={t.id} value={t.teamName} />
            ))}
          </datalist>

          <div className="space-y-1.5">
            <label htmlFor="podium-champion" className="text-xs font-semibold text-blue-100 block">
              {bracket.championTitle} (Kosongkan untuk otomatis dari pemenang FINAL)
            </label>
            <input
              id="podium-champion"
              type="text"
              list={datalistId}
              value={championName}
              onChange={(e) => setChampionName(e.target.value)}
              placeholder="Nama pasangan juara"
              className="w-full bg-[#06133B] border border-[#1B3782] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-400"
            />
          </div>

          {bracket.thirdPlaceTitle !== undefined && (
            <div className="space-y-1.5">
              <label htmlFor="podium-third" className="text-xs font-semibold text-blue-100 block">
                {bracket.thirdPlaceTitle} (Kosongkan untuk otomatis dari Perebutan Juara 3)
              </label>
              <input
                id="podium-third"
                type="text"
                list={datalistId}
                value={thirdPlaceName}
                onChange={(e) => setThirdPlaceName(e.target.value)}
                placeholder="Nama pasangan juara 3"
                className="w-full bg-[#06133B] border border-[#1B3782] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-400"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1B3782]">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-blue-200 hover:bg-[#0E266B] hover:text-white rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Juara'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
