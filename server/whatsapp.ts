import crypto from 'node:crypto';
import type {
  Match,
  Team,
  WhatsAppConfigPublic,
  WhatsAppEventType,
  WhatsAppLog,
} from '../src/types/tournament.ts';
import {
  buildWhatsAppScheduleMessage,
  normalizeWhatsAppNumber,
} from '../src/utils/tournamentLogic.ts';

interface DispatchParams {
  tournamentName: string;
  venue: string;
  match: Match;
  teamA: Team;
  teamB: Team;
  courtName: string;
  categoryName: string;
  eventType: WhatsAppEventType;
  publicUrl: string;
  config: WhatsAppConfigPublic;
  token: string;
}

async function sendViaProvider(
  recipientNumber: string,
  message: string,
  matchId: string | null,
  eventType: WhatsAppEventType,
  config: WhatsAppConfigPublic,
  token: string
): Promise<{ status: WhatsAppLog['deliveryStatus']; errorDetail?: string }> {
  const activeToken = token || process.env.WHATSAPP_API_TOKEN || '';

  if (config.provider === 'fonnte') {
    if (!activeToken) {
      return {
        status: 'queued_wa_me',
        errorDetail: 'Token Fonnte belum diatur; link wa.me disiapkan.',
      };
    }
    try {
      const resp = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: activeToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: recipientNumber,
          message,
        }),
      });
      if (!resp.ok) {
        return {
          status: 'failed',
          errorDetail: `Fonnte HTTP ${resp.status}`,
        };
      }
      return { status: 'sent' };
    } catch (err) {
      return {
        status: 'failed',
        errorDetail: err instanceof Error ? err.message : 'Network error',
      };
    }
  }

  if (config.provider === 'meta_cloud') {
    if (!activeToken || !config.phoneNumberId) {
      return {
        status: 'queued_wa_me',
        errorDetail: 'Token atau Phone Number ID Meta Cloud API belum diatur.',
      };
    }
    try {
      const resp = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(config.phoneNumberId)}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: recipientNumber,
            type: 'text',
            text: { body: message },
          }),
        }
      );
      if (!resp.ok) {
        return {
          status: 'failed',
          errorDetail: `Meta Cloud HTTP ${resp.status}`,
        };
      }
      return { status: 'sent' };
    } catch (err) {
      return {
        status: 'failed',
        errorDetail: err instanceof Error ? err.message : 'Network error',
      };
    }
  }

  if (config.provider === 'webhook') {
    if (!config.webhookUrl) {
      return {
        status: 'queued_wa_me',
        errorDetail: 'Webhook URL belum dikonfigurasi.',
      };
    }
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (activeToken) {
        headers.Authorization = `Bearer ${activeToken}`;
      }
      const resp = await fetch(config.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recipientNumber,
          message,
          matchId,
          eventType,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!resp.ok) {
        return {
          status: 'failed',
          errorDetail: `Webhook HTTP ${resp.status}`,
        };
      }
      return { status: 'sent' };
    } catch (err) {
      return {
        status: 'failed',
        errorDetail: err instanceof Error ? err.message : 'Network error',
      };
    }
  }

  // Default: simulated / ready for wa.me one-click
  return { status: 'queued_wa_me' };
}

export async function dispatchMatchWhatsAppNotifications(
  params: DispatchParams
): Promise<WhatsAppLog[]> {
  const message = buildWhatsAppScheduleMessage({
    tournamentName: params.tournamentName,
    venue: params.venue,
    match: params.match,
    teamA: params.teamA,
    teamB: params.teamB,
    courtName: params.courtName,
    categoryName: params.categoryName,
    eventType: params.eventType,
    publicUrl: params.publicUrl,
  });

  const recipients = [
    params.teamA.player1,
    params.teamA.player2,
    params.teamB.player1,
    params.teamB.player2,
  ];

  const logs: WhatsAppLog[] = [];
  const seenNumbers = new Set<string>();

  for (const player of recipients) {
    const normalized = normalizeWhatsAppNumber(player.whatsapp);
    if (!normalized || seenNumbers.has(normalized)) continue;
    seenNumbers.add(normalized);

    const waMeUrl = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
    const result = await sendViaProvider(
      normalized,
      message,
      params.match.id,
      params.eventType,
      params.config,
      params.token
    );

    logs.push({
      id: `wa-${crypto.randomUUID().slice(0, 8)}`,
      matchId: params.match.id,
      eventType: params.eventType,
      recipientName: player.name,
      recipientNumber: normalized,
      message,
      provider: params.config.provider,
      deliveryStatus: result.status,
      errorDetail: result.errorDetail,
      waMeUrl,
      createdAt: new Date().toISOString(),
    });
  }

  return logs;
}

export async function dispatchSingleWhatsAppMessage(params: {
  recipientName: string;
  recipientNumber: string;
  message: string;
  matchId: string | null;
  eventType: WhatsAppEventType;
  config: WhatsAppConfigPublic;
  token: string;
}): Promise<WhatsAppLog> {
  const normalized = normalizeWhatsAppNumber(params.recipientNumber);
  const waMeUrl = `https://wa.me/${normalized}?text=${encodeURIComponent(params.message)}`;
  const result = await sendViaProvider(
    normalized,
    params.message,
    params.matchId,
    params.eventType,
    params.config,
    params.token
  );

  return {
    id: `wa-${crypto.randomUUID().slice(0, 8)}`,
    matchId: params.matchId,
    eventType: params.eventType,
    recipientName: params.recipientName,
    recipientNumber: normalized,
    message: params.message,
    provider: params.config.provider,
    deliveryStatus: result.status,
    errorDetail: result.errorDetail,
    waMeUrl,
    createdAt: new Date().toISOString(),
  };
}
