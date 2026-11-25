import { useState } from 'react';
import { ExternalLink, Lock, MessageSquare, Send, Settings2 } from 'lucide-react';
import type {
  TournamentState,
  WhatsAppEventType,
  WhatsAppProvider,
} from '../types/tournament.ts';

interface WhatsAppCenterViewProps {
  state: TournamentState;
  isAdmin: boolean;
  onRequireAdminLogin: () => void;
  onUpdateConfig: (payload: {
    provider: WhatsAppProvider;
    autoNotifyOnScheduleChange: boolean;
    webhookUrl?: string;
    token?: string;
    phoneNumberId?: string;
  }) => Promise<void>;
  onSendTest: (payload: {
    recipientName: string;
    recipientNumber: string;
    message: string;
  }) => Promise<void>;
}

const EVENT_LABEL: Record<WhatsAppEventType, string> = {
  scheduled: 'Jadwal Baru',
  updated: 'Pembaruan Jadwal',
  court_changed: 'Perubahan Court',
  called_to_court: 'Panggilan Court',
  test: 'Pesan Uji / Manual',
};

export function WhatsAppCenterView({
  state,
  isAdmin,
  onRequireAdminLogin,
  onUpdateConfig,
  onSendTest,
}: WhatsAppCenterViewProps) {
  const [provider, setProvider] = useState<WhatsAppProvider>(state.whatsappConfig.provider);
  const [autoNotify, setAutoNotify] = useState(
    state.whatsappConfig.autoNotifyOnScheduleChange
  );
  const [webhookUrl, setWebhookUrl] = useState(state.whatsappConfig.webhookUrl);
  const [phoneNumberId, setPhoneNumberId] = useState(state.whatsappConfig.phoneNumberId);
  const [apiToken, setApiToken] = useState('');
  const [configSaved, setConfigSaved] = useState<string | null>(null);

  const [testName, setTestName] = useState('Raka Pratama');
  const [testNumber, setTestNumber] = useState('081290112233');
  const [testMsg, setTestMsg] = useState(
    `Halo Tim! Jadwal pertandingan Anda di ${state.tournament.name} (${state.tournament.venue}) telah diperbarui. Silakan cek Court 1 pukul 10:30 WITA.`
  );
  const [testError, setTestError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequireAdminLogin();
      return;
    }
    setConfigSaved(null);
    await onUpdateConfig({
      provider,
      autoNotifyOnScheduleChange: autoNotify,
      webhookUrl,
      phoneNumberId,
      token: apiToken || undefined,
    });
    setApiToken('');
    setConfigSaved('Pengaturan gateway WhatsApp berhasil disimpan.');
  };

  const handleSendManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequireAdminLogin();
      return;
    }
    setTestError(null);
    try {
      setSending(true);
      await onSendTest({
        recipientName: testName,
        recipientNumber: testNumber,
        message: testMsg,
      });
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Gagal mengirim pesan WhatsApp');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">
          Notifikasi Otomatis WhatsApp
        </h1>
        <p className="text-sm text-blue-200/75">
          Sistem mengirim notifikasi otomatis ke seluruh pemain setiap kali jadwal, jam main, atau
          pembagian court dibuat atau diperbarui.
        </p>
      </div>

      {!isAdmin && (
        <div className="px-4 py-3 bg-[#0A1D52] border border-[#284BA8] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-blue-100">
            <Lock className="w-4 h-4 text-sky-300 shrink-0" />
            <span>
              Mode Lihat: Login sebagai Admin untuk mengubah pengaturan gateway atau mengirim pesan
              uji WhatsApp.
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gateway Configuration */}
        <section className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleSaveConfig}
            className="bg-[#0A1D52] border border-[#1B3782] rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Settings2 className="w-4 h-4 text-sky-300" />
              Konfigurasi Gateway WhatsApp
            </div>

            {configSaved && (
              <div className="p-3 bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs font-medium rounded-lg">
                {configSaved}
              </div>
            )}

            <label className="flex items-center justify-between gap-3 p-3 bg-[#06133B] border border-[#1B3782] rounded-lg cursor-pointer">
              <div>
                <div className="text-xs font-bold text-white">
                  Kirim Otomatis Saat Jadwal Berubah
                </div>
                <div className="text-xs text-blue-200/75">
                  Aktifkan pengiriman otomatis ke 4 pemain setiap update court/jam
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoNotify}
                onChange={(e) => setAutoNotify(e.target.checked)}
                className="w-4 h-4 rounded border-[#284BA8]"
              />
            </label>

            <div>
              <label htmlFor="wa-provider" className="block text-xs font-semibold text-blue-100 mb-1">
                Provider Gateway
              </label>
              <select
                id="wa-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value as WhatsAppProvider)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="simulated">Mode Siap Kirim (Log Server + Link wa.me)</option>
                <option value="fonnte">Fonnte WhatsApp API (Indonesia)</option>
                <option value="meta_cloud">Meta WhatsApp Cloud API</option>
                <option value="webhook">Custom Webhook URL</option>
              </select>
            </div>

            {provider === 'webhook' && (
              <div>
                <label htmlFor="wa-webhook" className="block text-xs font-semibold text-blue-100 mb-1">
                  Webhook Endpoint URL
                </label>
                <input
                  id="wa-webhook"
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hook.domain.com/whatsapp"
                  className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white placeholder:text-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {provider === 'meta_cloud' && (
              <div>
                <label htmlFor="wa-phone-id" className="block text-xs font-semibold text-blue-100 mb-1">
                  Meta Phone Number ID
                </label>
                <input
                  id="wa-phone-id"
                  type="text"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder="Contoh: 109283746501"
                  className="w-full px-3 py-2 text-sm font-mono border border-[#284BA8] rounded-lg bg-[#06133B] text-white placeholder:text-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {provider !== 'simulated' && (
              <div>
                <label htmlFor="wa-token" className="block text-xs font-semibold text-blue-100 mb-1">
                  API Token Server-Side {state.whatsappConfig.hasToken ? '(Tersimpan)' : ''}
                </label>
                <input
                  id="wa-token"
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder={
                    state.whatsappConfig.hasToken
                      ? 'Biarkan kosong untuk tetap memakai token tersimpan'
                      : 'Masukkan token gateway'
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-[#284BA8] rounded-lg bg-[#06133B] text-white placeholder:text-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={!isAdmin}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-45 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              {isAdmin ? 'Simpan Konfigurasi Gateway' : 'Login Admin untuk Menyimpan'}
            </button>
          </form>

          {/* Manual Test Form */}
          <form
            onSubmit={handleSendManual}
            className="bg-[#0A1D52] border border-[#1B3782] rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Send className="w-4 h-4 text-emerald-400" />
              Kirim Uji Notifikasi WhatsApp
            </div>

            {testError && (
              <div role="alert" className="p-3 bg-red-950/70 border border-red-500/40 text-red-200 text-xs rounded-lg">
                {testError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="wa-tname" className="block text-xs font-semibold text-blue-100 mb-1">
                  Nama Penerima
                </label>
                <input
                  id="wa-tname"
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="wa-tnum" className="block text-xs font-semibold text-blue-100 mb-1">
                  Nomor WhatsApp
                </label>
                <input
                  id="wa-tnum"
                  type="tel"
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="wa-tmsg" className="block text-xs font-semibold text-blue-100 mb-1">
                Isi Pesan
              </label>
              <textarea
                id="wa-tmsg"
                rows={3}
                value={testMsg}
                onChange={(e) => setTestMsg(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#284BA8] rounded-lg bg-[#06133B] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={!isAdmin || sending}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              {!isAdmin
                ? 'Login Admin untuk Mengirim Pesan'
                : sending
                  ? 'Mengirim...'
                  : 'Kirim Pesan Sekarang'}
            </button>
          </form>
        </section>

        {/* Outgoing Notification Log */}
        <section className="lg:col-span-7 bg-[#0A1D52] border border-[#1B3782] rounded-xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-[#1B3782] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-bold text-white">
                Riwayat Pengiriman Notifikasi ({state.whatsappLogs.length})
              </h2>
            </div>
            <span className="text-xs text-blue-200/75">Terbaru di atas</span>
          </div>

          <div className="divide-y divide-[#1B3782] max-h-[680px] overflow-y-auto">
            {state.whatsappLogs.length === 0 ? (
              <p className="p-8 text-center text-sm text-blue-200/75">
                Belum ada notifikasi WhatsApp yang tercatat.
              </p>
            ) : (
              state.whatsappLogs.map((log) => (
                <div key={log.id} className="p-5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white">{log.recipientName}</span>
                      <span className="font-mono text-blue-200/75 tabular-nums">
                        +{log.recipientNumber}
                      </span>
                      <span className="text-blue-400/50">·</span>
                      <span className="font-semibold text-sky-300">
                        {EVENT_LABEL[log.eventType]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`font-semibold ${
                          log.deliveryStatus === 'sent'
                            ? 'text-emerald-400'
                            : log.deliveryStatus === 'failed'
                              ? 'text-red-400'
                              : 'text-amber-300'
                        }`}
                      >
                        {log.deliveryStatus === 'sent'
                          ? 'Terkirim via API'
                          : log.deliveryStatus === 'failed'
                            ? `Gagal (${log.errorDetail || 'Error'})`
                            : 'Siap Kirim (wa.me)'}
                      </span>
                      <span className="text-blue-300/60 font-mono tabular-nums">
                        {new Date(log.createdAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <pre className="whitespace-pre-wrap font-sans text-xs text-blue-100 bg-[#06133B] border border-[#1B3782] rounded-lg p-3 leading-relaxed">
                    {log.message}
                  </pre>

                  <div className="flex items-center justify-end">
                    <a
                      href={log.waMeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      Buka di WhatsApp <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
