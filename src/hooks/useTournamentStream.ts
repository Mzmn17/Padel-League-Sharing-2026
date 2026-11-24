import { useCallback, useEffect, useState } from 'react';
import type {
  Match,
  MatchStatus,
  PadelScoreState,
  Team,
  TeamStatus,
  TournamentState,
  WhatsAppProvider,
} from '../types/tournament.ts';

async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`) as Error & {
      status?: number;
      conflict?: unknown;
    };
    err.status = res.status;
    err.conflict = data?.conflict;
    throw err;
  }
  return data as T;
}

export function useTournamentStream() {
  const [state, setState] = useState<TournamentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(true);

  const fetchInitial = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiJson<TournamentState>('/api/state');
      setState(data);
      setError(null);
      setSseConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data turnamen');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitial();

    const eventSource = new EventSource('/api/events');
    eventSource.onopen = () => {
      setSseConnected(true);
    };
    eventSource.addEventListener('state', (event) => {
      try {
        const next = JSON.parse((event as MessageEvent).data) as TournamentState;
        setState(next);
        setLoading(false);
        setError(null);
        setSseConnected(true);
      } catch {
        // Ignore malformed SSE frame
      }
    });
    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        setSseConnected(false);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [fetchInitial]);

  const registerTeam = useCallback(
    async (payload: {
      categoryId: string;
      teamName: string;
      club: string;
      seed?: number | null;
      player1: { name: string; whatsapp: string; level: string };
      player2: { name: string; whatsapp: string; level: string };
    }) => {
      const res = await apiJson<{ team: Team; state: TournamentState }>('/api/teams', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setState(res.state);
      return res.team;
    },
    []
  );

  const updateTeam = useCallback(
    async (
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
    ) => {
      const res = await apiJson<{ team: Team; state: TournamentState }>(`/api/teams/${teamId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setState(res.state);
      return res.team;
    },
    []
  );

  const deleteTeam = useCallback(async (teamId: string) => {
    const res = await apiJson<{ state: TournamentState }>(`/api/teams/${teamId}`, {
      method: 'DELETE',
    });
    setState(res.state);
  }, []);

  const createMatch = useCallback(
    async (payload: {
      categoryId: string;
      stage: string;
      teamAId: string;
      teamBId: string;
      courtId: string | null;
      scheduledDate: string;
      scheduledTime: string;
      ignoreConflict?: boolean;
      notifyWhatsApp?: boolean;
    }) => {
      const res = await apiJson<{ match: Match; state: TournamentState }>('/api/matches', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setState(res.state);
      return res.match;
    },
    []
  );

  const autoPairCategory = useCallback(
    async (payload: {
      categoryId: string;
      mode: 'round_robin' | 'knockout';
      stage: string;
      scheduledDate: string;
      startTime: string;
    }) => {
      const res = await apiJson<{ createdCount: number; state: TournamentState }>(
        '/api/matches/auto-pair',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      setState(res.state);
      return res.createdCount;
    },
    []
  );

  const updateMatchSchedule = useCallback(
    async (
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
    ) => {
      const res = await apiJson<{ match: Match; generatedLogs: number; state: TournamentState }>(
        `/api/matches/${matchId}/schedule`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        }
      );
      setState(res.state);
      return res;
    },
    []
  );

  const updateMatchScore = useCallback(
    async (matchId: string, payload: { score: PadelScoreState; status?: MatchStatus }) => {
      const res = await apiJson<{ match: Match; state: TournamentState }>(
        `/api/matches/${matchId}/score`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        }
      );
      setState(res.state);
      return res.match;
    },
    []
  );

  const deleteMatch = useCallback(async (matchId: string) => {
    const res = await apiJson<{ state: TournamentState }>(`/api/matches/${matchId}`, {
      method: 'DELETE',
    });
    setState(res.state);
  }, []);

  const addCourt = useCallback(
    async (payload: { name: string; surface: string; isIndoor: boolean }) => {
      const res = await apiJson<{ state: TournamentState }>('/api/courts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setState(res.state);
    },
    []
  );

  const updateWhatsAppConfig = useCallback(
    async (payload: {
      provider: WhatsAppProvider;
      autoNotifyOnScheduleChange: boolean;
      webhookUrl?: string;
      token?: string;
      phoneNumberId?: string;
    }) => {
      const res = await apiJson<{ state: TournamentState }>('/api/whatsapp/config', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setState(res.state);
    },
    []
  );

  const sendTestWhatsApp = useCallback(
    async (payload: {
      recipientName: string;
      recipientNumber: string;
      message: string;
      matchId?: string | null;
    }) => {
      const res = await apiJson<{ state: TournamentState }>('/api/whatsapp/test', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setState(res.state);
    },
    []
  );

  const resetDemo = useCallback(async () => {
    const res = await apiJson<{ state: TournamentState }>('/api/reset-demo', {
      method: 'POST',
    });
    setState(res.state);
  }, []);

  return {
    state,
    loading,
    error,
    sseConnected,
    refresh: fetchInitial,
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
  };
}
