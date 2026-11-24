import { useState } from 'react';
import { ExternalLink, MessageSquare, Send, Settings2 } from 'lucide-react';
import type {
  TournamentState,
  WhatsAppEventType,
  WhatsAppProvider,
} from '../types/tournament.ts';

interface WhatsAppCenterViewProps {
  state: TournamentState;
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
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Notifikasi Otomatis WhatsApp
        </h1>
        <p className="text-sm text-slate-500">
          Sistem mengirim notifikasi otomatis ke seluruh pemain setiap kali jadwal, jam main, atau
          pembagian court dibuat atau diperbarui.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gateway Configuration */}
        <section className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleSaveConfig}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Settings2 className="w-4 h-4 text-blue-700" />
              Konfigurasi Gateway WhatsApp
            </div>

            {configSaved && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg">
                {configSaved}
              </div>
            )}

            <label className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Kirim Otomatis Saat Jadwal Berubah
                </div>
                <div className="text-xs text-slate-500">
                  Aktifkan pengiriman otomatis ke 4 pemain setiap update court/jam
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoNotify}
                onChange={(e) => setAutoNotify(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
              />
            </label>

            <div>
              <label htmlFor="wa-provider" className="block text-xs font-semibold text-slate-700 mb-1">
                Provider Gateway
              </label>
              <select
                id="wa-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value as WhatsAppProvider)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="simulated">Mode Siap Kirim (Log Server + Link wa.me)</option>
                <option value="fonnte">Fonnte WhatsApp API (Indonesia)</option>
                <option value="meta_cloud">Meta WhatsApp Cloud API</option>
                <option value="webhook">Custom Webhook URL</option>
              </select>
            </div>

            {provider === 'webhook' && (
              <div>
                <label htmlFor="wa-webhook" className="block text-xs font-semibold text-slate-700 mb-1">
                  Webhook Endpoint URL
                </label>
                <input
                  id="wa-webhook"
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hook.domain.com/whatsapp"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            )}

            {provider === 'meta_cloud' && (
              <div>
                <label htmlFor="wa-phone-id" className="block text-xs font-semibold text-slate-700 mb-1">
                  Meta Phone Number ID
                </label>
                <input
                  id="wa-phone-id"
                  type="text"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder="Contoh: 109283746501"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
            )}

            {provider !== 'simulated' && (
              <div>
                <label htmlFor="wa-token" className="block text-xs font-semibold text-slate-700 mb-1">
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
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Simpan Konfigurasi Gateway
            </button>
          </form>

          {/* Manual Test Form */}
          <form
            onSubmit={handleSendManual}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Send className="w-4 h-4 text-emerald-700" />
              Kirim Uji Notifikasi WhatsApp
            </div>

            {testError && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg">
                {testError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="wa-tname" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Penerima
                </label>
                <input
                  id="wa-tname"
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="wa-tnum" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor WhatsApp
                </label>
                <input
                  id="wa-tnum"
                  type="tel"
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label htmlFor="wa-tmsg" className="block text-xs font-semibold text-slate-700 mb-1">
                Isi Pesan
              </label>
              <textarea
                id="wa-tmsg"
                rows={3}
                value={testMsg}
                onChange={(e) => setTestMsg(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              {sending ? 'Mengirim...' : 'Kirim Pesan Sekarang'}
            </button>
          </form>
        </section>

        {/* Outgoing Notification Log */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-700" />
              <h2 className="text-base font-bold text-slate-900">
                Riwayat Pengiriman Notifikasi ({state.whatsappLogs.length})
              </h2>
            </div>
            <span className="text-xs text-slate-500">Terbaru di atas</span>
          </div>

          <div className="divide-y divide-slate-200 max-h-[680px] overflow-y-auto">
            {state.whatsappLogs.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                Belum ada notifikasi WhatsApp yang tercatat.
              </p>
            ) : (
              state.whatsappLogs.map((log) => (
                <div key={log.id} className="p-5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">{log.recipientName}</span>
                      <span className="font-mono text-slate-500 tabular-nums">
                        +{log.recipientNumber}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-semibold text-blue-700">
                        {EVENT_LABEL[log.eventType]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`font-semibold ${
                          log.deliveryStatus === 'sent'
                            ? 'text-emerald-700'
                            : log.deliveryStatus === 'failed'
                              ? 'text-red-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {log.deliveryStatus === 'sent'
                          ? 'Terkirim via API'
                          : log.deliveryStatus === 'failed'
                            ? `Gagal (${log.errorDetail || 'Error'})`
                            : 'Siap Kirim (wa.me)'}
                      </span>
                      <span className="text-slate-400 font-mono tabular-nums">
                        {new Date(log.createdAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
                    {log.message}
                  </pre>

                  <div className="flex items-center justify-end">
                    <a
                      href={log.waMeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
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
