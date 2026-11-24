export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'postponed';

export type TeamStatus = 'registered' | 'checked_in' | 'withdrawn';

export type WhatsAppProvider = 'simulated' | 'fonnte' | 'meta_cloud' | 'webhook';

export interface TournamentInfo {
  id: string;
  name: string;
  caption?: string;
  slug: string;
  venue: string;
  city: string;
  startDate: string;
  endDate: string;
  scoringFormat: 'best_of_3' | 'pro_set_9';
  goldenPointDefault: boolean;
}

export interface Category {
  id: string;
  name: string;
  level: string;
  maxTeams: number;
  entryFee: number;
}

export interface Court {
  id: string;
  name: string;
  surface: string;
  isIndoor: boolean;
}

export interface PlayerInfo {
  name: string;
  whatsapp: string;
  level: string;
}

export interface Team {
  id: string;
  categoryId: string;
  teamName: string;
  club: string;
  seed: number | null;
  status: TeamStatus;
  player1: PlayerInfo;
  player2: PlayerInfo;
  createdAt: string;
}

export interface SetScore {
  teamA: number;
  teamB: number;
}

export interface PadelScoreState {
  sets: SetScore[];
  currentPointA: string; // '0' | '15' | '30' | '40' | 'AD' | number string for tiebreak
  currentPointB: string;
  servingTeam: 'A' | 'B';
  goldenPoint: boolean;
  isTiebreak: boolean;
  winnerSide: 'A' | 'B' | null;
}

export interface Match {
  id: string;
  categoryId: string;
  stage: string;
  matchNumber: number;
  teamAId: string;
  teamBId: string;
  courtId: string | null;
  scheduledDate: string;
  scheduledTime: string;
  status: MatchStatus;
  score: PadelScoreState;
  updatedAt: string;
}

export type WhatsAppEventType =
  | 'scheduled'
  | 'updated'
  | 'court_changed'
  | 'called_to_court'
  | 'test';

export interface WhatsAppLog {
  id: string;
  matchId: string | null;
  eventType: WhatsAppEventType;
  recipientName: string;
  recipientNumber: string;
  message: string;
  provider: WhatsAppProvider;
  deliveryStatus: 'sent' | 'queued_wa_me' | 'failed';
  errorDetail?: string;
  waMeUrl: string;
  createdAt: string;
}

export interface WhatsAppConfigPublic {
  provider: WhatsAppProvider;
  autoNotifyOnScheduleChange: boolean;
  webhookUrl: string;
  hasToken: boolean;
  phoneNumberId: string;
}

export interface LeaderboardRow {
  rank: number;
  team: Team;
  played: number;
  won: number;
  lost: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  points: number;
}

export interface TournamentState {
  tournament: TournamentInfo;
  categories: Category[];
  courts: Court[];
  teams: Team[];
  matches: Match[];
  whatsappLogs: WhatsAppLog[];
  whatsappConfig: WhatsAppConfigPublic;
}
