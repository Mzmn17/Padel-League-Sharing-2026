import { useState } from 'react';
import { KeyRound, LogOut, ShieldAlert, ShieldCheck, User, X } from 'lucide-react';
import type { AdminAuthStatus } from '../types/tournament.ts';

interface AdminAuthModalProps {
  authStatus: AdminAuthStatus;
  initialNotice?: string | null;
  onClose: () => void;
  onGoogleLogin: () => Promise<{ isAdmin: boolean }>;
  onStaffLogin: (username: string, password: string) => Promise<{ isAdmin: boolean }>;
  onLogout: () => Promise<void>;
}

export function AdminAuthModal({
  authStatus,
  initialNotice,
  onClose,
  onGoogleLogin,
  onStaffLogin,
  onLogout,
}: AdminAuthModalProps) {
  const [activeTab, setActiveTab] = useState<'super' | 'panitia'>('super');
  const [username, setUsername] = useState('panitia');
  const [password, setPassword] = useState('padel2026');
  const [error, setError] = useState<string | null>(initialNotice || null);
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      setSubmitting(true);
      const res = await onGoogleLogin();
      if (res.isAdmin) {
        onClose();
      } else {
        setError(
          'Akun Google ini belum terdaftar sebagai Super Admin (muhazman441@gmail.com).'
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal masuk dengan akun Google. Coba lagi.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleStaffSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Masukkan username dan kata sandi admin panitia.');
      return;
    }
    try {
      setSubmitting(true);
      await onStaffLogin(username.trim(), password);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Username atau kata sandi admin salah.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-auth-title"
      className="fixed inset-0 z-50 bg-[#030A21]/80 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-[#0A1D52] border border-[#1B3782] rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-[#1B3782] bg-[#081744] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-sky-300 shrink-0" />
            <h2 id="admin-auth-title" className="text-base sm:text-lg font-bold text-white">
              Login Akses Admin &amp; Super Admin
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog login"
            className="p-1.5 text-blue-200 hover:text-white rounded-md cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 border-b border-[#1B3782] bg-[#071540]">
          <button
            type="button"
            onClick={() => {
              setActiveTab('super');
              setError(null);
            }}
            className={`py-3 text-xs font-semibold transition-colors cursor-pointer border-b-2 ${
              activeTab === 'super'
                ? 'border-blue-500 text-white bg-[#0A1D52]'
                : 'border-transparent text-blue-300/70 hover:text-white'
            }`}
          >
            Super Admin (Google)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('panitia');
              setError(null);
            }}
            className={`py-3 text-xs font-semibold transition-colors cursor-pointer border-b-2 ${
              activeTab === 'panitia'
                ? 'border-blue-500 text-white bg-[#0A1D52]'
                : 'border-transparent text-blue-300/70 hover:text-white'
            }`}
          >
            Admin Panitia (User &amp; Pass)
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="px-3.5 py-2.5 bg-red-950/70 border border-red-500/40 text-red-200 text-xs font-medium rounded-lg flex items-start gap-2"
            >
              <ShieldAlert className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {authStatus.authenticated && (
            <div className="px-3.5 py-2.5 bg-emerald-950/60 border border-emerald-500/40 rounded-lg text-xs text-emerald-200 space-y-1">
              <p className="font-semibold text-white">Status: Sudah Masuk</p>
              <p>Akun: {authStatus.username || authStatus.email}</p>
            </div>
          )}

          {activeTab === 'super' ? (
            <div className="space-y-4">
              <p className="text-xs text-blue-200/85 leading-relaxed">
                <strong>Super Admin</strong> login menggunakan Google (<strong>muhazman441@gmail.com</strong>).
                Super Admin memiliki wewenang penuh menyimpan dan mengelola database Cloud Firestore utama.
              </p>

              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {submitting ? 'Menghubungkan ke Google...' : 'Masuk Super Admin (Google)'}
                </span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleStaffSignIn} className="space-y-4">
              <p className="text-xs text-blue-200/85 leading-relaxed">
                <strong>Admin Panitia</strong> login via Username &amp; Password untuk merubah skor,
                jadwal, dan data peserta. Data otomatis tersimpan dan sinkron ke Cloud Super Admin.
              </p>

              <div className="space-y-3">
                <div>
                  <label htmlFor="staff-user" className="block text-xs font-semibold text-blue-100 mb-1">
                    Username Admin
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-blue-300/50 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="staff-user"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Contoh: panitia"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white placeholder:text-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="staff-pass" className="block text-xs font-semibold text-blue-100 mb-1">
                    Kata Sandi Admin
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-blue-300/50 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="staff-pass"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white placeholder:text-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{submitting ? 'Memeriksa...' : 'Masuk Admin Panitia'}</span>
              </button>
            </form>
          )}

          {authStatus.signedIn || authStatus.authenticated ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={async () => {
                  await onLogout();
                  setError(null);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#06133B] hover:bg-[#0D2363] border border-[#284BA8] text-blue-200 hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar dari Akun Saat Ini</span>
              </button>
            </div>
          ) : null}

          <div className="pt-2 border-t border-[#1B3782] flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-blue-200 hover:bg-[#0E266B] hover:text-white rounded-lg cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
