/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import {
  CalendarClock,
  ExternalLink,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPin,
  Menu,
  MonitorPlay,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useTournamentStream } from './hooks/useTournamentStream.ts';
import { OverviewView } from './components/OverviewView.tsx';
import { ParticipantsView } from './components/ParticipantsView.tsx';
import { SchedulePairingView } from './components/SchedulePairingView.tsx';
import { OperatorScoreView } from './components/OperatorScoreView.tsx';
import { LeaderboardView } from './components/LeaderboardView.tsx';
import { PublicResultsView } from './components/PublicResultsView.tsx';
import { LedDisplayView } from './components/LedDisplayView.tsx';
import { VenueView } from './components/VenueView.tsx';
import { AdminAuthModal } from './components/AdminAuthModal.tsx';
import tournamentLogoImg from './assets/images/padel_league_logo.png';

type ViewMode = 'organizer' | 'public' | 'led';
type OrganizerTab =
  | 'overview'
  | 'participants'
  | 'schedule'
  | 'operator'
  | 'leaderboard'
  | 'venue';

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'organizer';
  const params = new URLSearchParams(window.location.search);
  const v = params.get('view');
  if (v === 'public') return 'public';
  if (v === 'led') return 'led';
  return 'organizer';
}

export default function App() {
  const {
    state,
    loading,
    error,
    sseConnected,
    authStatus,
    refresh,
    signInWithGoogle,
    loginStaffAdmin,
    logoutAdmin,
    registerParticipant,
    updateParticipant,
    deleteParticipant,
    pairParticipants,
    updateTeam,
    deleteTeam,
    createMatch,
    autoPairCategory,
    updateMatchSchedule,
    updateMatchScore,
    deleteMatch,
    addCourt,
    resetDemo,
  } = useTournamentStream();

  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const [activeTab, setActiveTab] = useState<OrganizerTab>('overview');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminModalNotice, setAdminModalNotice] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const isAdmin = authStatus.authenticated;

  const openAdminLogin = (notice?: string) => {
    setAdminModalNotice(notice || null);
    setShowAdminModal(true);
    setMobileMenuOpen(false);
  };

  const navigateViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (mode === 'organizer') {
        url.searchParams.delete('view');
      } else {
        url.searchParams.set('view', mode);
      }
      window.history.pushState({}, '', url.toString());
    }
  };

  useEffect(() => {
    const onPop = () => {
      setViewMode(getInitialViewMode());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (loading && !state) {
    return (
      <div className="min-h-screen bg-[#06133B] flex items-center justify-center p-6">
        <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl p-8 max-w-sm w-full text-center space-y-2">
          <div className="text-base font-bold text-white">Memuat Data Turnamen...</div>
          <p className="text-xs text-blue-200/80">
            Menghubungkan ke server sinkronisasi real-time PadelLeague.
          </p>
        </div>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="min-h-screen bg-[#06133B] flex items-center justify-center p-6">
        <div className="bg-[#0A1D52] border border-red-500/40 rounded-xl p-8 max-w-md w-full text-center space-y-4">
          <div className="text-base font-bold text-red-300">Gagal Memuat Data Turnamen</div>
          <p className="text-xs text-red-200/90">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  if (!state) return null;

  const adminModal = showAdminModal ? (
    <AdminAuthModal
      authStatus={authStatus}
      initialNotice={adminModalNotice}
      onClose={() => {
        setShowAdminModal(false);
        setAdminModalNotice(null);
      }}
      onGoogleLogin={signInWithGoogle}
      onStaffLogin={loginStaffAdmin}
      onLogout={logoutAdmin}
    />
  ) : null;

  if (viewMode === 'led') {
    return (
      <LedDisplayView
        state={state}
        sseConnected={sseConnected}
        onExitLed={() => navigateViewMode('organizer')}
      />
    );
  }

  if (viewMode === 'public') {
    return (
      <>
        <PublicResultsView
          state={state}
          sseConnected={sseConnected}
          isAdmin={isAdmin}
          isSignedIn={Boolean(authStatus.signedIn)}
          onSignInGoogle={signInWithGoogle}
          onRequireAdminLogin={() =>
            openAdminLogin('Login sebagai Admin untuk membuka tombol Kembali ke Beranda.')
          }
          onExitPublic={() => {
            if (!isAdmin) {
              openAdminLogin('Login sebagai Admin untuk kembali ke halaman Beranda.');
              return;
            }
            navigateViewMode('organizer');
          }}
          onRegisterParticipant={registerParticipant}
        />
        {adminModal}
      </>
    );
  }

  const navItems: Array<{ id: OrganizerTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'overview', label: 'Beranda', icon: LayoutDashboard },
    { id: 'participants', label: 'Peserta & Pasangan', icon: Users },
    { id: 'schedule', label: 'Pairing & Jadwal', icon: CalendarClock },
    { id: 'operator', label: 'Operator Skor', icon: SlidersHorizontal },
    { id: 'leaderboard', label: 'Live Leaderboard', icon: Trophy },
    { id: 'venue', label: 'Denah Venue', icon: MapPin },
  ];

  const handleOpenOperatorMatch = (matchId: string) => {
    setSelectedMatchId(matchId);
    setActiveTab('operator');
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#06133B] text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 clean zones */}
      <header className="bg-[#081744] border-b border-[#1B3782] sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4 lg:gap-8">
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 -ml-2 text-blue-100 hover:bg-[#0E2563] rounded-lg cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('overview');
              }}
              className="flex items-center shrink-0"
              aria-label="Padel League & Share 2026"
            >
              <img
                src={tournamentLogoImg}
                alt="Padel League & Share 2026"
                className="h-12 sm:h-14 w-auto object-contain"
              />
            </a>
          </div>

          <nav
            aria-label="Navigasi utama"
            className="hidden lg:flex items-center gap-6 text-sm font-medium text-blue-200/80"
          >
            <button
              type="button"
              onClick={() => setActiveTab('participants')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'participants' ? 'text-white font-semibold' : ''
              }`}
            >
              Peserta
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'schedule' ? 'text-white font-semibold' : ''
              }`}
            >
              Jadwal
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('operator')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'operator' ? 'text-white font-semibold' : ''
              }`}
            >
              Skor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'leaderboard' ? 'text-white font-semibold' : ''
              }`}
            >
              Leaderboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('venue')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'venue' ? 'text-white font-semibold' : ''
              }`}
            >
              Venue
            </button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {isAdmin ? (
              <>
                <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Admin: {authStatus.username}</span>
                </div>
                <button
                  type="button"
                  onClick={logoutAdmin}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-[#0D2363] hover:bg-[#132E7D] text-blue-100 hover:text-white border border-[#284BA8] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => openAdminLogin()}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0D2363] hover:bg-[#132E7D] text-white border border-[#284BA8] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-sky-300" />
                <span>Login Admin</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setActiveTab('participants');
                setShowRegisterModal(true);
              }}
              className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Daftar Peserta
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Body */}
      <div className="max-w-[1440px] w-full mx-auto flex-1 flex">
        {/* Sidebar Navigation (Desktop + Mobile Overlay) */}
        <aside
          className={`${
            mobileMenuOpen ? 'fixed inset-0 top-16 z-40 bg-[#081744] block' : 'hidden'
          } lg:block lg:static lg:w-64 shrink-0 border-r border-[#1B3782] bg-[#081744] p-4 space-y-6`}
        >
          <div className="space-y-1">
            <p className="px-3 pb-1 text-xs font-semibold text-blue-300/60">Menu Turnamen</p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#122D7A] text-white font-semibold'
                      : 'text-blue-100/80 hover:bg-[#0D2363] hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-[#1B3782] pt-4 space-y-1.5">
            <p className="px-3 pb-1 text-xs font-semibold text-blue-300/60">Tampilan Penonton</p>
            <button
              type="button"
              onClick={() => navigateViewMode('public')}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-blue-100/80 hover:bg-[#0D2363] hover:text-white rounded-lg cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              <span>Link Hasil Publik</span>
            </button>
            <button
              type="button"
              onClick={() => navigateViewMode('led')}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-blue-100/80 hover:bg-[#0D2363] hover:text-white rounded-lg cursor-pointer"
            >
              <MonitorPlay className="w-4 h-4 shrink-0" />
              <span>Display LED Stadion</span>
            </button>
          </div>

          <div className="border-t border-[#1B3782] pt-4 px-3 space-y-3">
            <div className="flex items-center gap-2 text-xs text-blue-200/80">
              {sseConnected && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              )}
              <span>{sseConnected ? 'Real-Time Terhubung' : 'Koneksi Terputus'}</span>
            </div>

            {isAdmin ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Mode Admin ({authStatus.username})</span>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowResetConfirm(true);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-300/80 hover:text-white cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Data Contoh
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logoutAdmin();
                    }}
                    className="sm:hidden w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0D2363] hover:bg-[#132E7D] border border-[#284BA8] text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Keluar Admin
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAdminLogin();
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0D2363] hover:bg-[#132E7D] border border-[#284BA8] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-sky-300" />
                Login Admin
              </button>
            )}
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          {activeTab === 'overview' && (
            <OverviewView
              state={state}
              onNavigate={(tab) => setActiveTab(tab as OrganizerTab)}
              onOpenOperatorMatch={handleOpenOperatorMatch}
              onOpenRegisterModal={() => {
                setActiveTab('participants');
                setShowRegisterModal(true);
              }}
              onOpenPublicView={() => navigateViewMode('public')}
              onOpenLedView={() => navigateViewMode('led')}
            />
          )}

          {activeTab === 'participants' && (
            <ParticipantsView
              state={state}
              isAdmin={isAdmin}
              isSignedIn={Boolean(authStatus.signedIn)}
              onSignInGoogle={signInWithGoogle}
              onRequireAdminLogin={() =>
                openAdminLogin('Login sebagai Admin untuk memasangkan, mengedit, atau menghapus peserta.')
              }
              showRegisterModal={showRegisterModal}
              onCloseRegisterModal={() => setShowRegisterModal(false)}
              onOpenRegisterModal={() => setShowRegisterModal(true)}
              onRegisterParticipant={registerParticipant}
              onUpdateParticipant={updateParticipant}
              onDeleteParticipant={deleteParticipant}
              onPairParticipants={pairParticipants}
              onUpdateTeam={updateTeam}
              onDeleteTeam={deleteTeam}
            />
          )}

          {activeTab === 'schedule' && (
            <SchedulePairingView
              state={state}
              isAdmin={isAdmin}
              onRequireAdminLogin={() =>
                openAdminLogin('Login sebagai Admin untuk mengatur pairing, court, dan jadwal.')
              }
              onCreateMatch={createMatch}
              onAutoPairCategory={autoPairCategory}
              onUpdateMatchSchedule={updateMatchSchedule}
              onDeleteMatch={deleteMatch}
              onAddCourt={addCourt}
              onOpenOperatorMatch={handleOpenOperatorMatch}
            />
          )}

          {activeTab === 'operator' && (
            <OperatorScoreView
              state={state}
              isAdmin={isAdmin}
              onRequireAdminLogin={() =>
                openAdminLogin('Login sebagai Admin untuk menginput dan mengubah skor pertandingan.')
              }
              selectedMatchId={selectedMatchId}
              onSelectMatch={setSelectedMatchId}
              onUpdateMatchScore={updateMatchScore}
            />
          )}

          {activeTab === 'leaderboard' && (
            <LeaderboardView state={state} sseConnected={sseConnected} />
          )}

          {activeTab === 'venue' && (
            <VenueView state={state} onOpenOperatorMatch={handleOpenOperatorMatch} />
          )}
        </main>
      </div>

      {adminModal}

      {showResetConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-confirm-title"
          className="fixed inset-0 z-50 bg-[#030A21]/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h2 id="reset-confirm-title" className="text-base font-bold text-white">
              Konfirmasi Reset Data Contoh
            </h2>
            <p className="text-xs text-blue-200/85 leading-relaxed">
              Apakah Anda yakin ingin mengembalikan seluruh data turnamen di Cloud Firestore ke
              data contoh awal? Semua data peserta, pasangan, jadwal, dan skor yang telah Anda
              input akan ditimpa.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#1B3782]">
              <button
                type="button"
                disabled={resetting}
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-xs font-medium text-blue-200 hover:bg-[#0E266B] hover:text-white rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={async () => {
                  try {
                    setResetting(true);
                    await resetDemo();
                    setShowResetConfirm(false);
                  } finally {
                    setResetting(false);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {resetting ? 'Mereset...' : 'Ya, Reset Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
