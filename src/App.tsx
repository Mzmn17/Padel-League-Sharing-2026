/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import {
  CalendarClock,
  ExternalLink,
  LayoutDashboard,
  Menu,
  MessageSquare,
  MonitorPlay,
  RotateCcw,
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
import { WhatsAppCenterView } from './components/WhatsAppCenterView.tsx';

type ViewMode = 'organizer' | 'public' | 'led';
type OrganizerTab =
  | 'overview'
  | 'participants'
  | 'schedule'
  | 'operator'
  | 'leaderboard'
  | 'whatsapp';

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
    refresh,
    registerTeam,
    updateTeam,
    deleteTeam,
    createMatch,
    autoPairCategory,
    updateMatchSchedule,
    updateMatchScore,
    deleteMatch,
    addCourt,
    updateWhatsAppConfig,
    sendTestWhatsApp,
    resetDemo,
  } = useTournamentStream();

  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const [activeTab, setActiveTab] = useState<OrganizerTab>('overview');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-sm w-full text-center space-y-2">
          <div className="text-base font-bold text-slate-900">Memuat Data Turnamen...</div>
          <p className="text-xs text-slate-500">
            Menghubungkan ke server sinkronisasi real-time PadelLiga.
          </p>
        </div>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-red-200 rounded-xl p-8 max-w-md w-full text-center space-y-4">
          <div className="text-base font-bold text-red-900">Gagal Memuat Data Turnamen</div>
          <p className="text-xs text-red-700">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  if (!state) return null;

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
      <PublicResultsView
        state={state}
        sseConnected={sseConnected}
        onExitPublic={() => navigateViewMode('organizer')}
        onRegisterTeam={registerTeam}
      />
    );
  }

  const navItems: Array<{ id: OrganizerTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'overview', label: 'Beranda', icon: LayoutDashboard },
    { id: 'participants', label: 'Peserta & Pasangan', icon: Users },
    { id: 'schedule', label: 'Pairing & Jadwal', icon: CalendarClock },
    { id: 'operator', label: 'Operator Skor', icon: SlidersHorizontal },
    { id: 'leaderboard', label: 'Live Leaderboard', icon: Trophy },
    { id: 'whatsapp', label: 'Notifikasi WhatsApp', icon: MessageSquare },
  ];

  const handleOpenOperatorMatch = (matchId: string) => {
    setSelectedMatchId(matchId);
    setActiveTab('operator');
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 clean zones */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 -ml-2 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('overview');
              }}
              className="font-display font-extrabold text-lg tracking-tight text-slate-900 whitespace-nowrap shrink-0"
            >
              PadelLiga
            </a>
          </div>

          <nav
            aria-label="Navigasi utama"
            className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <button
              type="button"
              onClick={() => setActiveTab('participants')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'participants' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              Peserta
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'schedule' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              Jadwal
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('operator')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'operator' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              Skor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'leaderboard' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              Leaderboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('whatsapp')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'whatsapp' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              WhatsApp
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('participants');
                setShowRegisterModal(true);
              }}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Daftar Pasangan
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Body */}
      <div className="max-w-[1440px] w-full mx-auto flex-1 flex">
        {/* Sidebar Navigation (Desktop + Mobile Overlay) */}
        <aside
          className={`${
            mobileMenuOpen ? 'fixed inset-0 top-16 z-40 bg-white block' : 'hidden'
          } lg:block lg:static lg:w-64 shrink-0 border-r border-slate-200 bg-white p-4 space-y-6`}
        >
          <div className="space-y-1">
            <p className="px-3 pb-1 text-xs font-semibold text-slate-400">Menu Turnamen</p>
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
                      ? 'bg-blue-50 text-blue-800 font-semibold'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-1.5">
            <p className="px-3 pb-1 text-xs font-semibold text-slate-400">Tampilan Penonton</p>
            <button
              type="button"
              onClick={() => navigateViewMode('public')}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              <span>Link Hasil Publik</span>
            </button>
            <button
              type="button"
              onClick={() => navigateViewMode('led')}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <MonitorPlay className="w-4 h-4 shrink-0" />
              <span>Display LED Stadion</span>
            </button>
          </div>

          <div className="border-t border-slate-200 pt-4 px-3 space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {sseConnected && (
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" aria-hidden="true" />
              )}
              <span>{sseConnected ? 'Real-Time Terhubung' : 'Koneksi Terputus'}</span>
            </div>
            <button
              type="button"
              onClick={resetDemo}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Data Contoh
            </button>
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
              showRegisterModal={showRegisterModal}
              onCloseRegisterModal={() => setShowRegisterModal(false)}
              onOpenRegisterModal={() => setShowRegisterModal(true)}
              onRegisterTeam={registerTeam}
              onUpdateTeam={updateTeam}
              onDeleteTeam={deleteTeam}
            />
          )}

          {activeTab === 'schedule' && (
            <SchedulePairingView
              state={state}
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
              selectedMatchId={selectedMatchId}
              onSelectMatch={setSelectedMatchId}
              onUpdateMatchScore={updateMatchScore}
            />
          )}

          {activeTab === 'leaderboard' && (
            <LeaderboardView state={state} sseConnected={sseConnected} />
          )}

          {activeTab === 'whatsapp' && (
            <WhatsAppCenterView
              state={state}
              onUpdateConfig={updateWhatsAppConfig}
              onSendTest={sendTestWhatsApp}
            />
          )}
        </main>
      </div>
    </div>
  );
}
