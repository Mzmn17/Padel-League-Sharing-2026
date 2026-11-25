import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { OperationType, auth, db, googleProvider, handleFirestoreError } from '../firebase.ts';
import type {
  AdminAuthStatus,
  Category,
  CategoryBracket,
  Court,
  Match,
  MatchStatus,
  PadelScoreState,
  Participant,
  Team,
  TeamStatus,
  TournamentInfo,
  TournamentState,
} from '../types/tournament.ts';
import {
  FIRESTORE_LIMITS,
  sanitizeCourtInput,
  sanitizeParticipantInput,
  sanitizeText,
} from '../utils/firestoreValidation.ts';
import {
  cloneInitialBrackets,
  mergeWithDefaultBrackets,
  syncAllBracketsWithTeamsAndMatches,
  syncBracketWithTeamsAndMatches,
} from '../utils/tournamentBracket.ts';
import {
  buildDefaultPairName,
  createInitialScore,
  detectScheduleConflict,
  formatPairRegion,
  generateKnockoutPairings,
  generateRoundRobinPairings,
} from '../utils/tournamentLogic.ts';
import { INITIAL_TOURNAMENT_SEED } from '../utils/tournamentSeed.ts';

const TOURNAMENT_ID = FIRESTORE_LIMITS.TOURNAMENT_ID;
const BOOTSTRAPPED_ADMIN_EMAIL = 'muhazman441@gmail.com';
const CATEGORY_ORDER = [
  'cat-mens-beginner',
  'cat-mens-intermediate',
  'cat-womens-doubles',
];

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  'cat-bronze': 'cat-mens-beginner',
  'cat-mixed': 'cat-mens-beginner',
  'cat-mens-open': 'cat-mens-intermediate',
  'cat-double-man': 'cat-mens-intermediate',
  'cat-womens-open': 'cat-womens-doubles',
};

const CANONICAL_CATEGORIES = INITIAL_TOURNAMENT_SEED.categories;
const CANONICAL_CATEGORY_IDS = new Set(CANONICAL_CATEGORIES.map((c) => c.id));
const CANONICAL_COURTS = INITIAL_TOURNAMENT_SEED.courts;
const LEGACY_COURT_IDS = new Set(['court-1', 'court-2', 'court-3', 'court-4', 'court-5']);

function isLegacyCourtList(courts: Court[]): boolean {
  if (courts.length === 0) return false;
  return courts.some(
    (c) =>
      c.id === 'court-3' ||
      c.name.includes('(Indoor)') ||
      c.name.includes('Center Panoramic') ||
      c.name.includes('North Glass') ||
      c.name.includes('South Arena') ||
      c.name.includes('Club Court') ||
      c.surface.includes('Mondo')
  );
}

function isLegacyCategoryList(categories: Category[]): boolean {
  if (categories.length === 0) return false;
  return (
    categories.length !== CANONICAL_CATEGORIES.length ||
    categories.some((c) => !CANONICAL_CATEGORY_IDS.has(c.id))
  );
}

function resolveMigratedCategoryId(categoryId: string): string {
  if (CANONICAL_CATEGORY_IDS.has(categoryId)) return categoryId;
  return LEGACY_CATEGORY_MAP[categoryId] || 'cat-mens-beginner';
}

function resolveMigratedCourtId(
  courtId: string | null,
  hadCourt3: boolean,
  hadCourt5: boolean
): string | null {
  if (!courtId) return null;
  if (courtId === 'court-3') return 'court-4';
  if (hadCourt3 && !hadCourt5 && courtId === 'court-4') return 'court-5';
  return courtId;
}

function createUuidPrefix(prefix: string): string {
  const raw =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}-${raw}`;
}

function sortCategories(list: Category[]): Category[] {
  return [...list].sort((a, b) => {
    const idxA = CATEGORY_ORDER.indexOf(a.id);
    const idxB = CATEGORY_ORDER.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
}

function stripCourtSuffixes(courts: Court[]): Court[] {
  return courts.map((c) => ({
    ...c,
    name: c.name.replace(/\s*\(Indoor\)/gi, '').trim() || c.name,
  }));
}

function getStaffToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

function toCleanTournamentDoc(t: TournamentInfo) {
  const cleanName =
    !t.name || t.name === 'Padel League & Share' ? 'Padel League & Share 2026' : t.name;
  const rawCaption = t.caption || 'Sulawesi Edition';
  const cleanCaption =
    rawCaption.toLowerCase().includes('retail sales') ||
    rawCaption.toLowerCase().includes('awarding') ||
    rawCaption.toLowerCase().includes('padel turnamen')
      ? 'Sulawesi Edition'
      : rawCaption;

  return {
    id: TOURNAMENT_ID,
    name: sanitizeText(cleanName, 120, 'Padel League & Share 2026'),
    caption: sanitizeText(cleanCaption, 200, 'Sulawesi Edition'),
    slug: sanitizeText(t.slug, 100, 'padel-league-and-share'),
    venue: sanitizeText(t.venue, 120, 'Beach Padel Makassar'),
    city: sanitizeText(t.city, 80, 'Makassar'),
    startDate: sanitizeText(t.startDate, 20, '2026-11-27'),
    endDate: sanitizeText(t.endDate, 20, '2026-11-27'),
    scoringFormat: t.scoringFormat === 'pro_set_9' ? 'pro_set_9' : 'best_of_3',
    goldenPointDefault: Boolean(t.goldenPointDefault),
    seeded: true,
    updatedAt: serverTimestamp(),
  };
}

function toCleanParticipantDoc(p: Participant, createdByUid?: string) {
  return {
    id: p.id,
    tournamentId: TOURNAMENT_ID,
    name: sanitizeText(p.name, FIRESTORE_LIMITS.NAME_MAX, 'Peserta'),
    region: sanitizeText(p.region, FIRESTORE_LIMITS.REGION_MAX, 'Makassar'),
    representation: sanitizeText(
      p.representation,
      FIRESTORE_LIMITS.REPRESENTATION_MAX,
      'Retail Sales'
    ),
    categoryId: p.categoryId,
    level: sanitizeText(p.level, FIRESTORE_LIMITS.LEVEL_MAX, 'Open'),
    status: p.status,
    ...(createdByUid ? { createdByUid } : {}),
    createdAt: p.createdAt,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  };
}

function toCleanTeamDoc(t: Team) {
  const p1Region = sanitizeText(
    t.player1.region || t.region || t.club,
    FIRESTORE_LIMITS.REGION_MAX,
    'Makassar'
  );
  const p2Region = sanitizeText(
    t.player2.region || t.region || t.club,
    FIRESTORE_LIMITS.REGION_MAX,
    p1Region
  );
  const resolvedRegion = sanitizeText(
    t.region || t.club || formatPairRegion(p1Region, p2Region),
    FIRESTORE_LIMITS.TEAM_REGION_MAX,
    'Makassar'
  );
  return {
    id: t.id,
    tournamentId: TOURNAMENT_ID,
    categoryId: t.categoryId,
    teamName: sanitizeText(t.teamName, FIRESTORE_LIMITS.TEAM_NAME_MAX, 'Pasangan'),
    region: resolvedRegion,
    club: resolvedRegion,
    seed: typeof t.seed === 'number' && t.seed >= 1 && t.seed <= 128 ? t.seed : null,
    status: t.status,
    player1Id: t.player1Id || `${t.id}-p1`,
    player2Id: t.player2Id || `${t.id}-p2`,
    player1: {
      name: sanitizeText(t.player1.name, FIRESTORE_LIMITS.NAME_MAX, 'Pemain 1'),
      region: p1Region,
      representation: sanitizeText(
        t.player1.representation,
        FIRESTORE_LIMITS.REPRESENTATION_MAX,
        'Retail Sales'
      ),
      level: sanitizeText(t.player1.level, FIRESTORE_LIMITS.LEVEL_MAX, 'Open'),
    },
    player2: {
      name: sanitizeText(t.player2.name, FIRESTORE_LIMITS.NAME_MAX, 'Pemain 2'),
      region: p2Region,
      representation: sanitizeText(
        t.player2.representation,
        FIRESTORE_LIMITS.REPRESENTATION_MAX,
        'Retail Sales'
      ),
      level: sanitizeText(t.player2.level, FIRESTORE_LIMITS.LEVEL_MAX, 'Open'),
    },
    createdAt: t.createdAt,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  };
}

function toCleanMatchDoc(m: Match) {
  const sets =
    Array.isArray(m.score?.sets) && m.score.sets.length > 0
      ? m.score.sets.slice(0, FIRESTORE_LIMITS.MAX_SETS).map((s) => ({
          teamA: Math.max(0, Math.min(20, Math.trunc(Number(s.teamA) || 0))),
          teamB: Math.max(0, Math.min(20, Math.trunc(Number(s.teamB) || 0))),
        }))
      : [{ teamA: 0, teamB: 0 }];

  return {
    id: m.id,
    tournamentId: TOURNAMENT_ID,
    categoryId: m.categoryId,
    stage: sanitizeText(m.stage, FIRESTORE_LIMITS.STAGE_MAX, 'Fase Grup'),
    matchNumber: Math.max(1, Math.min(9999, Math.trunc(Number(m.matchNumber) || 1))),
    teamAId: m.teamAId,
    teamBId: m.teamBId,
    courtId: m.courtId || null,
    scheduledDate: sanitizeText(m.scheduledDate, FIRESTORE_LIMITS.DATE_MAX, '2026-11-27'),
    scheduledTime: sanitizeText(m.scheduledTime, FIRESTORE_LIMITS.TIME_MAX, '07:30'),
    status: m.status,
    score: {
      sets,
      currentPointA: sanitizeText(m.score?.currentPointA, 8, '0'),
      currentPointB: sanitizeText(m.score?.currentPointB, 8, '0'),
      servingTeam: m.score?.servingTeam === 'B' ? 'B' : 'A',
      goldenPoint: Boolean(m.score?.goldenPoint ?? true),
      isTiebreak: Boolean(m.score?.isTiebreak ?? false),
      winnerSide:
        m.score?.winnerSide === 'A' || m.score?.winnerSide === 'B'
          ? m.score.winnerSide
          : null,
    },
    updatedAt: m.updatedAt || new Date().toISOString(),
    serverUpdatedAt: serverTimestamp(),
  };
}

function toCleanBracketDoc(b: CategoryBracket) {
  return {
    id: b.id,
    tournamentId: TOURNAMENT_ID,
    categoryId: b.categoryId,
    title: sanitizeText(b.title, FIRESTORE_LIMITS.BRACKET_TITLE_MAX, 'BAGAN TURNAMEN'),
    subtitle: sanitizeText(b.subtitle, FIRESTORE_LIMITS.BRACKET_SUBTITLE_MAX, 'SISTEM GUGUR'),
    rounds: b.rounds.slice(0, 8),
    slots: b.slots.slice(0, FIRESTORE_LIMITS.BRACKET_SLOTS_MAX).map((s) => ({
      ...s,
      teamAName: String(s.teamAName ?? '').slice(0, FIRESTORE_LIMITS.BRACKET_TEAM_NAME_MAX),
      teamBName: String(s.teamBName ?? '').slice(0, FIRESTORE_LIMITS.BRACKET_TEAM_NAME_MAX),
      teamAId: typeof s.teamAId === 'string' && s.teamAId.trim() ? s.teamAId.trim().slice(0, 64) : null,
      teamBId: typeof s.teamBId === 'string' && s.teamBId.trim() ? s.teamBId.trim().slice(0, 64) : null,
      linkedMatchId:
        typeof s.linkedMatchId === 'string' && s.linkedMatchId.trim()
          ? s.linkedMatchId.trim().slice(0, 64)
          : null,
      scoreA: String(s.scoreA ?? '').slice(0, FIRESTORE_LIMITS.BRACKET_SCORE_MAX),
      scoreB: String(s.scoreB ?? '').slice(0, FIRESTORE_LIMITS.BRACKET_SCORE_MAX),
      winnerSide: s.winnerSide === 'A' || s.winnerSide === 'B' ? s.winnerSide : null,
    })),
    championTitle: sanitizeText(b.championTitle, 40, 'JUARA'),
    championName: String(b.championName ?? '').slice(0, FIRESTORE_LIMITS.BRACKET_TEAM_NAME_MAX),
    ...(b.thirdPlaceTitle !== undefined
      ? {
          thirdPlaceTitle: sanitizeText(b.thirdPlaceTitle, 40, 'JUARA 3'),
          thirdPlaceName: String(b.thirdPlaceName ?? '').slice(
            0,
            FIRESTORE_LIMITS.BRACKET_TEAM_NAME_MAX
          ),
        }
      : {}),
    ...(b.footerNote !== undefined ? { footerNote: String(b.footerNote).slice(0, 300) } : {}),
    updatedAt: b.updatedAt || new Date().toISOString(),
    serverUpdatedAt: serverTimestamp(),
  };
}

async function writeSeedStateToFirestore(seed: TournamentState, adminUid?: string): Promise<void> {
  const batch1 = writeBatch(db);
  batch1.set(doc(db, 'tournaments', TOURNAMENT_ID), toCleanTournamentDoc(seed.tournament));

  for (const cat of seed.categories) {
    batch1.set(doc(db, 'categories', cat.id), {
      id: cat.id,
      tournamentId: TOURNAMENT_ID,
      name: sanitizeText(cat.name, 80),
      level: sanitizeText(cat.level, 60),
      maxTeams: Math.max(1, Math.min(128, Math.trunc(cat.maxTeams))),
      entryFee: Math.max(0, Math.min(50000000, Math.trunc(cat.entryFee))),
    });
  }

  for (const court of seed.courts) {
    batch1.set(doc(db, 'courts', court.id), {
      id: court.id,
      tournamentId: TOURNAMENT_ID,
      name: sanitizeText(court.name, FIRESTORE_LIMITS.COURT_NAME_MAX),
      surface: sanitizeText(court.surface, FIRESTORE_LIMITS.COURT_SURFACE_MAX),
      isIndoor: Boolean(court.isIndoor),
    });
  }
  await batch1.commit();

  const batch2 = writeBatch(db);
  for (const p of seed.participants) {
    batch2.set(doc(db, 'participants', p.id), toCleanParticipantDoc(p, adminUid));
  }
  for (const t of seed.teams) {
    batch2.set(doc(db, 'teams', t.id), toCleanTeamDoc(t));
  }
  for (const m of seed.matches) {
    batch2.set(doc(db, 'matches', m.id), toCleanMatchDoc(m));
  }
  const bracketsToSeed = mergeWithDefaultBrackets(seed.brackets);
  for (const br of bracketsToSeed) {
    batch2.set(doc(db, 'brackets', br.id), toCleanBracketDoc(br));
  }
  await batch2.commit();
}

export function useTournamentStream() {
  const [cloudSeeded, setCloudSeeded] = useState<boolean | null>(null);
  const [cloudUpdatedAtMs, setCloudUpdatedAtMs] = useState<number>(0);
  const [cloudTournament, setCloudTournament] = useState<TournamentInfo | null>(null);
  const [cloudCategories, setCloudCategories] = useState<Category[]>([]);
  const [cloudCourts, setCloudCourts] = useState<Court[]>([]);
  const [cloudParticipants, setCloudParticipants] = useState<Participant[]>([]);
  const [cloudTeams, setCloudTeams] = useState<Team[]>([]);
  const [cloudMatches, setCloudMatches] = useState<Match[]>([]);
  const [cloudBrackets, setCloudBrackets] = useState<CategoryBracket[]>([]);

  const [staffState, setStaffState] = useState<TournamentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(true);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AdminAuthStatus>({
    authenticated: false,
    username: null,
    needsSetup: false,
    envConfigured: true,
    signedIn: false,
    email: null,
    authReady: false,
  });

  const seedingRef = useRef(false);
  const migratingCloudRef = useRef(false);

  const resolveAdminStatus = useCallback(async (user: User | null) => {
    if (!user || !user.emailVerified) {
      setAuthStatus({
        authenticated: false,
        username: null,
        needsSetup: false,
        envConfigured: true,
        signedIn: Boolean(user),
        email: user?.email ?? null,
        authReady: true,
      });
      return false;
    }

    const emailLower = (user.email || '').toLowerCase();
    let isAdminUser = emailLower === BOOTSTRAPPED_ADMIN_EMAIL;

    if (!isAdminUser) {
      try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        isAdminUser = adminDoc.exists();
      } catch {
        isAdminUser = false;
      }
    }

    if (isAdminUser && user.email) {
      try {
        const resp = await fetch('/api/auth/google-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email }),
        });
        if (resp.ok) {
          const json = await resp.json();
          if (json.token) {
            localStorage.setItem('admin_token', json.token);
          }
        }
      } catch (err) {
        console.warn('Google super admin token exchange notice:', err);
      }
    }

    setAuthStatus({
      authenticated: isAdminUser,
      username: isAdminUser ? user.displayName || user.email || 'Admin' : null,
      needsSetup: false,
      envConfigured: true,
      signedIn: true,
      email: user.email,
      authReady: true,
    });
    return isAdminUser;
  }, []);

  // Authenticate staff token & Firebase Auth
  useEffect(() => {
    const token = getStaffToken();
    if (token) {
      fetch('/api/auth/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.authenticated) {
            setAuthStatus({
              authenticated: true,
              username: data.username || 'panitia',
              needsSetup: data.needsSetup,
              envConfigured: data.envConfigured,
              signedIn: true,
              email: `${data.username || 'panitia'}@admin.local`,
              authReady: true,
            });
            return;
          }
          localStorage.removeItem('admin_token');
          void resolveAdminStatus(auth.currentUser);
        })
        .catch(() => {});
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!getStaffToken()) {
        void resolveAdminStatus(user);
      }
    });
    return () => unsubscribe();
  }, [resolveAdminStatus]);

  // Immediate server state fetch + SSE stream for instant Panitia & cross-tab sync
  useEffect(() => {
    let active = true;
    fetch('/api/state')
      .then((r) => (r.ok ? r.json() : null))
      .then((json: TournamentState | null) => {
        if (!active || !json?.tournament?.id) return;
        setStaffState(json);
        setLoading(false);
      })
      .catch(() => {});

    if (typeof EventSource === 'undefined') return () => { active = false; };

    const es = new EventSource('/api/events');
    es.addEventListener('state', (ev) => {
      try {
        const parsed = JSON.parse((ev as MessageEvent).data) as TournamentState;
        if (active && parsed?.tournament?.id) {
          setStaffState(parsed);
          setSseConnected(true);
          setLoading(false);
        }
      } catch {}
    });
    es.onerror = () => {
      // Fall back quietly; Firestore or fetch handles updates
    };

    return () => {
      active = false;
      es.close();
    };
  }, []);

  const attachListeners = useCallback(() => {
    let loadedFlags = {
      tournament: false,
      categories: false,
      courts: false,
      participants: false,
      teams: false,
      matches: false,
    };

    const markLoaded = (key: keyof typeof loadedFlags) => {
      loadedFlags = { ...loadedFlags, [key]: true };
      if (Object.values(loadedFlags).every(Boolean)) {
        setLoading(false);
        setSseConnected(true);
        setError(null);
      }
    };

    const unsubTournament = onSnapshot(
      doc(db, 'tournaments', TOURNAMENT_ID),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as TournamentInfo & { updatedAt?: { toMillis?: () => number } };
          const rawName = data.name || 'Padel League & Share 2026';
          const normalizedName =
            rawName === 'Padel League & Share' ? 'Padel League & Share 2026' : rawName;
          const rawCaption = data.caption || 'Sulawesi Edition';
          const normalizedCaption =
            rawCaption.toLowerCase().includes('retail sales') ||
            rawCaption.toLowerCase().includes('awarding') ||
            rawCaption.toLowerCase().includes('padel turnamen')
              ? 'Sulawesi Edition'
              : rawCaption;

          if (
            auth.currentUser &&
            (data.name === 'Padel League & Share' ||
              (data.caption &&
                (data.caption.includes('Retail Sales') ||
                  data.caption.includes('Awarding') ||
                  data.caption.includes('Padel Turnamen'))))
          ) {
            void updateDoc(doc(db, 'tournaments', TOURNAMENT_ID), {
              name: 'Padel League & Share 2026',
              caption: 'Sulawesi Edition',
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }

          setCloudUpdatedAtMs(
            typeof data.updatedAt?.toMillis === 'function' ? data.updatedAt.toMillis() : 0
          );
          setCloudTournament({
            id: data.id,
            name: normalizedName,
            caption: normalizedCaption,
            slug: data.slug,
            venue: data.venue,
            city: data.city,
            startDate: data.startDate,
            endDate: data.endDate,
            scoringFormat: data.scoringFormat,
            goldenPointDefault: data.goldenPointDefault,
          });
          setCloudSeeded(true);
        } else {
          setCloudSeeded(false);
        }
        markLoaded('tournament');
      },
      (err) => {
        setSseConnected(false);
        setError(err.message);
        setLoading(false);
        handleFirestoreError(err, OperationType.GET, `tournaments/${TOURNAMENT_ID}`);
      }
    );

    const unsubCategories = onSnapshot(
      query(collection(db, 'categories'), where('tournamentId', '==', TOURNAMENT_ID)),
      (snap) => {
        const rows = snap.docs.map((d) => {
          const v = d.data();
          return {
            id: v.id || d.id,
            name: v.name,
            level: v.level,
            maxTeams: v.maxTeams,
            entryFee: v.entryFee,
          } as Category;
        });
        setCloudCategories(sortCategories(rows));
        markLoaded('categories');
      },
      (err) => {
        setSseConnected(false);
        setError(err.message);
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'categories');
      }
    );

    const unsubCourts = onSnapshot(
      query(collection(db, 'courts'), where('tournamentId', '==', TOURNAMENT_ID)),
      (snap) => {
        const rows = snap.docs
          .map((d) => {
            const v = d.data();
            return {
              id: v.id || d.id,
              name: v.name,
              surface: v.surface,
              isIndoor: Boolean(v.isIndoor),
            } as Court;
          })
          .sort((a, b) => a.id.localeCompare(b.id));
        setCloudCourts(rows);
        markLoaded('courts');
      },
      (err) => {
        setSseConnected(false);
        setError(err.message);
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'courts');
      }
    );

    const unsubParticipants = onSnapshot(
      query(collection(db, 'participants'), where('tournamentId', '==', TOURNAMENT_ID)),
      (snap) => {
        const rows = snap.docs
          .map((d) => {
            const v = d.data();
            return {
              id: v.id || d.id,
              name: v.name,
              region: v.region,
              representation: v.representation || 'Retail Sales',
              categoryId: v.categoryId,
              level: v.level,
              status: v.status,
              createdAt: v.createdAt,
            } as Participant;
          })
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        setCloudParticipants(rows);
        markLoaded('participants');
      },
      (err) => {
        setSseConnected(false);
        setError(err.message);
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'participants');
      }
    );

    const unsubTeams = onSnapshot(
      query(collection(db, 'teams'), where('tournamentId', '==', TOURNAMENT_ID)),
      (snap) => {
        const rows = snap.docs
          .map((d) => {
            const v = d.data();
            return {
              id: v.id || d.id,
              categoryId: v.categoryId,
              teamName: v.teamName,
              region: v.region,
              club: v.club,
              seed: v.seed ?? null,
              status: v.status,
              player1Id: v.player1Id,
              player2Id: v.player2Id,
              player1: v.player1,
              player2: v.player2,
              createdAt: v.createdAt,
            } as Team;
          })
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        setCloudTeams(rows);
        markLoaded('teams');
      },
      (err) => {
        setSseConnected(false);
        setError(err.message);
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'teams');
      }
    );

    const unsubMatches = onSnapshot(
      query(collection(db, 'matches'), where('tournamentId', '==', TOURNAMENT_ID)),
      (snap) => {
        const rows = snap.docs
          .map((d) => {
            const v = d.data();
            return {
              id: v.id || d.id,
              categoryId: v.categoryId,
              stage: v.stage,
              matchNumber: v.matchNumber,
              teamAId: v.teamAId,
              teamBId: v.teamBId,
              courtId: v.courtId ?? null,
              scheduledDate: v.scheduledDate,
              scheduledTime: v.scheduledTime,
              status: v.status,
              score: v.score,
              updatedAt: v.updatedAt,
            } as Match;
          })
          .sort((a, b) => a.matchNumber - b.matchNumber);
        setCloudMatches(rows);
        markLoaded('matches');
      },
      (err) => {
        setSseConnected(false);
        setError(err.message);
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'matches');
      }
    );

    const unsubBrackets = onSnapshot(
      query(collection(db, 'brackets'), where('tournamentId', '==', TOURNAMENT_ID)),
      (snap) => {
        const rows = snap.docs.map((d) => {
          const v = d.data();
          return {
            id: v.id || d.id,
            categoryId: v.categoryId,
            title: v.title,
            subtitle: v.subtitle,
            rounds: Array.isArray(v.rounds) ? v.rounds : [],
            slots: Array.isArray(v.slots) ? v.slots : [],
            championTitle: v.championTitle || 'JUARA',
            championName: v.championName || '',
            ...(v.thirdPlaceTitle !== undefined ? { thirdPlaceTitle: v.thirdPlaceTitle } : {}),
            ...(v.thirdPlaceName !== undefined ? { thirdPlaceName: v.thirdPlaceName } : {}),
            ...(v.footerNote !== undefined ? { footerNote: v.footerNote } : {}),
            updatedAt: v.updatedAt || new Date().toISOString(),
          } as CategoryBracket;
        });
        setCloudBrackets(rows);
      },
      () => {
        // Non-blocking fallback to default brackets
      }
    );

    return () => {
      unsubTournament();
      unsubCategories();
      unsubCourts();
      unsubParticipants();
      unsubTeams();
      unsubMatches();
      unsubBrackets();
    };
  }, []);

  useEffect(() => {
    const cleanup = attachListeners();
    return cleanup;
  }, [attachListeners]);

  useEffect(() => {
    if (!loading || cloudSeeded !== null) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) {
        setStaffState((prev) => prev || INITIAL_TOURNAMENT_SEED);
        setLoading(false);
        setSseConnected(false);
      }
    }, 3500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loading, cloudSeeded]);

  // One-time auto-seed ONLY when Firestore has never been initialized yet (tournaments/pls-2026 absent)
  // and Google Admin is signed in.
  useEffect(() => {
    if (
      cloudSeeded !== false ||
      !authStatus.authReady ||
      !authStatus.authenticated ||
      !auth.currentUser ||
      seedingRef.current
    ) {
      return;
    }

    seedingRef.current = true;
    (async () => {
      try {
        const serverCheck = await getDocFromServer(doc(db, 'tournaments', TOURNAMENT_ID));
        if (serverCheck.exists()) {
          setCloudSeeded(true);
          return;
        }
        await writeSeedStateToFirestore(staffState || INITIAL_TOURNAMENT_SEED, firebaseUser?.uid);
      } catch (err) {
        console.error('Initial Firestore seed failed:', err);
      } finally {
        seedingRef.current = false;
      }
    })();
  }, [cloudSeeded, authStatus.authReady, authStatus.authenticated, firebaseUser?.uid, staffState]);

  const hasLegacyCategories = useMemo(
    () => isLegacyCategoryList(cloudCategories),
    [cloudCategories]
  );
  const hasLegacyCourts = useMemo(() => isLegacyCourtList(cloudCourts), [cloudCourts]);
  const missingCloudBrackets = useMemo(
    () => cloudSeeded === true && cloudBrackets.length < 3,
    [cloudSeeded, cloudBrackets.length]
  );

  // Idempotent Firestore migration for legacy categories, legacy court labels, and missing brackets
  useEffect(() => {
    if (
      cloudSeeded !== true ||
      !auth.currentUser ||
      !authStatus.authenticated ||
      migratingCloudRef.current ||
      (!hasLegacyCategories && !hasLegacyCourts && !missingCloudBrackets)
    ) {
      return;
    }

    migratingCloudRef.current = true;
    (async () => {
      try {
        const hadCourt3 = cloudCourts.some((c) => c.id === 'court-3');
        const hadCourt5 = cloudCourts.some((c) => c.id === 'court-5');

        const batch1 = writeBatch(db);
        let hasBatch1Ops = false;
        if (hasLegacyCategories) {
          for (const cat of CANONICAL_CATEGORIES) {
            batch1.set(doc(db, 'categories', cat.id), {
              id: cat.id,
              tournamentId: TOURNAMENT_ID,
              name: sanitizeText(cat.name, 80),
              level: sanitizeText(cat.level, 60),
              maxTeams: Math.max(1, Math.min(128, Math.trunc(cat.maxTeams))),
              entryFee: Math.max(0, Math.min(50000000, Math.trunc(cat.entryFee))),
            });
          }
          for (const existingCat of cloudCategories) {
            if (!CANONICAL_CATEGORY_IDS.has(existingCat.id)) {
              batch1.delete(doc(db, 'categories', existingCat.id));
            }
          }
          hasBatch1Ops = true;
        }
        if (hasLegacyCourts) {
          for (const court of CANONICAL_COURTS) {
            batch1.set(doc(db, 'courts', court.id), {
              id: court.id,
              tournamentId: TOURNAMENT_ID,
              name: sanitizeText(court.name, FIRESTORE_LIMITS.COURT_NAME_MAX),
              surface: sanitizeText(court.surface, FIRESTORE_LIMITS.COURT_SURFACE_MAX),
              isIndoor: Boolean(court.isIndoor),
            });
          }
          for (const custom of cloudCourts) {
            if (!LEGACY_COURT_IDS.has(custom.id) && custom.name.includes('(Indoor)')) {
              batch1.update(doc(db, 'courts', custom.id), {
                name: custom.name.replace(/\s*\(Indoor\)/gi, '').trim(),
              });
            }
          }
          if (hadCourt3) {
            batch1.delete(doc(db, 'courts', 'court-3'));
          }
          hasBatch1Ops = true;
        }
        if (missingCloudBrackets) {
          const existingIds = new Set(cloudBrackets.map((b) => b.categoryId || b.id));
          for (const def of cloneInitialBrackets()) {
            if (!existingIds.has(def.categoryId)) {
              batch1.set(doc(db, 'brackets', def.id), toCleanBracketDoc(def));
              hasBatch1Ops = true;
            }
          }
        }
        if (hasBatch1Ops) {
          await batch1.commit();
        }

        const batch2a = writeBatch(db);
        let hasBatch2aOps = false;
        const matchesToRecreate: Match[] = [];

        if (hasLegacyCategories) {
          for (const p of cloudParticipants) {
            const nextCategoryId = resolveMigratedCategoryId(p.categoryId);
            if (nextCategoryId !== p.categoryId) {
              batch2a.update(doc(db, 'participants', p.id), {
                categoryId: nextCategoryId,
                serverUpdatedAt: serverTimestamp(),
              });
              hasBatch2aOps = true;
            }
          }
          for (const t of cloudTeams) {
            const nextCategoryId = resolveMigratedCategoryId(t.categoryId);
            if (nextCategoryId !== t.categoryId) {
              batch2a.update(doc(db, 'teams', t.id), {
                categoryId: nextCategoryId,
                serverUpdatedAt: serverTimestamp(),
              });
              hasBatch2aOps = true;
            }
          }
        }

        for (const m of cloudMatches) {
          const nextCategoryId = hasLegacyCategories
            ? resolveMigratedCategoryId(m.categoryId)
            : m.categoryId;
          const nextCourtId = hasLegacyCourts
            ? resolveMigratedCourtId(m.courtId, hadCourt3, hadCourt5)
            : m.courtId;
          if (nextCategoryId !== m.categoryId) {
            batch2a.delete(doc(db, 'matches', m.id));
            matchesToRecreate.push({ ...m, categoryId: nextCategoryId, courtId: nextCourtId });
            hasBatch2aOps = true;
          } else if (nextCourtId !== m.courtId) {
            batch2a.update(doc(db, 'matches', m.id), {
              courtId: nextCourtId,
              updatedAt: new Date().toISOString(),
              serverUpdatedAt: serverTimestamp(),
            });
            hasBatch2aOps = true;
          }
        }

        if (hasBatch2aOps) {
          await batch2a.commit();
        }

        if (matchesToRecreate.length > 0) {
          const batch2b = writeBatch(db);
          for (const m of matchesToRecreate) {
            batch2b.set(doc(db, 'matches', m.id), toCleanMatchDoc(m));
          }
          await batch2b.commit();
        }
      } catch (err) {
        console.error('Firestore category/court migration failed:', err);
      } finally {
        migratingCloudRef.current = false;
      }
    })();
  }, [
    cloudSeeded,
    authStatus.authenticated,
    hasLegacyCategories,
    hasLegacyCourts,
    missingCloudBrackets,
    cloudCategories,
    cloudCourts,
    cloudParticipants,
    cloudTeams,
    cloudMatches,
    cloudBrackets,
  ]);

  const state: TournamentState | null = useMemo(() => {
    // Use server state whenever Panitia/server has a newer edit or Firestore isn't seeded/connected
    const serverHasNewerEdits =
      Boolean(staffState) &&
      (staffState?.revision ?? 0) > 0 &&
      (cloudSeeded !== true || (staffState?.updatedAtMs ?? 0) >= cloudUpdatedAtMs);

    if (serverHasNewerEdits && staffState) {
      return {
        ...staffState,
        courts: stripCourtSuffixes(staffState.courts),
        brackets: syncAllBracketsWithTeamsAndMatches(
          mergeWithDefaultBrackets(staffState.brackets),
          staffState.teams || [],
          staffState.matches || []
        ),
      };
    }

    if (cloudSeeded === null) {
      return staffState
        ? {
            ...staffState,
            courts: stripCourtSuffixes(staffState.courts),
            brackets: syncAllBracketsWithTeamsAndMatches(
              mergeWithDefaultBrackets(staffState.brackets),
              staffState.teams || [],
              staffState.matches || []
            ),
          }
        : null;
    }
    if (cloudSeeded === false) {
      const base = staffState || INITIAL_TOURNAMENT_SEED;
      return {
        ...base,
        courts: stripCourtSuffixes(base.courts),
        brackets: syncAllBracketsWithTeamsAndMatches(
          mergeWithDefaultBrackets(base.brackets),
          base.teams || [],
          base.matches || []
        ),
      };
    }
    if (!cloudTournament) {
      return staffState;
    }

    const hadCourt3 = cloudCourts.some((c) => c.id === 'court-3');
    const hadCourt5 = cloudCourts.some((c) => c.id === 'court-5');

    const normalizedCategories = hasLegacyCategories ? CANONICAL_CATEGORIES : cloudCategories;

    const normalizedCourts = hasLegacyCourts
      ? [
          ...CANONICAL_COURTS,
          ...stripCourtSuffixes(
            cloudCourts.filter((c) => !LEGACY_COURT_IDS.has(c.id))
          ),
        ]
      : stripCourtSuffixes(cloudCourts);

    const normalizedParticipants = hasLegacyCategories
      ? cloudParticipants.map((p) => ({
          ...p,
          categoryId: resolveMigratedCategoryId(p.categoryId),
        }))
      : cloudParticipants;

    const normalizedTeams = hasLegacyCategories
      ? cloudTeams.map((t) => ({
          ...t,
          categoryId: resolveMigratedCategoryId(t.categoryId),
        }))
      : cloudTeams;

    const normalizedMatches =
      hasLegacyCategories || hasLegacyCourts
        ? cloudMatches.map((m) => ({
            ...m,
            categoryId: hasLegacyCategories
              ? resolveMigratedCategoryId(m.categoryId)
              : m.categoryId,
            courtId: hasLegacyCourts
              ? resolveMigratedCourtId(m.courtId, hadCourt3, hadCourt5)
              : m.courtId,
          }))
        : cloudMatches;

    return {
      tournament: cloudTournament,
      categories: normalizedCategories,
      courts: normalizedCourts,
      participants: normalizedParticipants,
      teams: normalizedTeams,
      matches: normalizedMatches,
      brackets: syncAllBracketsWithTeamsAndMatches(
        mergeWithDefaultBrackets(cloudBrackets),
        normalizedTeams,
        normalizedMatches
      ),
      whatsappLogs: staffState?.whatsappLogs || [],
      whatsappConfig: staffState?.whatsappConfig || INITIAL_TOURNAMENT_SEED.whatsappConfig,
    };
  }, [
    cloudSeeded,
    cloudUpdatedAtMs,
    cloudTournament,
    cloudCategories,
    cloudCourts,
    cloudParticipants,
    cloudTeams,
    cloudMatches,
    cloudBrackets,
    hasLegacyCategories,
    hasLegacyCourts,
    staffState,
  ]);

  const staffRequest = useCallback(
    async <T extends { state?: TournamentState }>(
      url: string,
      options: RequestInit = {}
    ): Promise<T> => {
      const token = getStaffToken();
      const headers = new Headers(options.headers);
      if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
      }
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const resp = await fetch(url, { ...options, headers });
      const json = (await resp.json().catch(() => ({}))) as T & {
        error?: string;
        status?: number;
        conflict?: unknown;
        linkedMatchCount?: number;
      };
      if (!resp.ok) {
        const err = new Error(json.error || `Gagal memproses permintaan (${resp.status}).`) as Error & {
          status?: number;
          conflict?: unknown;
          linkedMatchCount?: number;
        };
        err.status = resp.status;
        if (json.conflict !== undefined) err.conflict = json.conflict;
        if (json.linkedMatchCount !== undefined) err.linkedMatchCount = json.linkedMatchCount;
        throw err;
      }
      if (json.state) {
        setStaffState(json.state);
      }
      return json;
    },
    []
  );

  const signInWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const isAdminUser = await resolveAdminStatus(cred.user);
    return { user: cred.user, isAdmin: isAdminUser };
  }, [resolveAdminStatus]);

  const setupAdmin = useCallback(async () => {
    await signInWithGoogle();
  }, [signInWithGoogle]);

  const loginAdmin = useCallback(async () => {
    await signInWithGoogle();
  }, [signInWithGoogle]);

  const loginStaffAdmin = useCallback(async (usernameInput: string, passwordInput: string) => {
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameInput, password: passwordInput }),
    });
    const json = await resp.json();
    if (!resp.ok) {
      throw new Error(json.error || 'Gagal login admin panitia.');
    }
    if (json.token) {
      localStorage.setItem('admin_token', json.token);
    }
    setAuthStatus({
      authenticated: true,
      username: json.username || 'panitia',
      needsSetup: false,
      envConfigured: json.envConfigured ?? true,
      signedIn: true,
      email: `${json.username || 'panitia'}@admin.local`,
      authReady: true,
    });
    return { isAdmin: true };
  }, []);

  const logoutAdmin = useCallback(async () => {
    const token = getStaffToken();
    if (token) {
      localStorage.removeItem('admin_token');
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    if (auth.currentUser) {
      await signOut(auth);
    }
    await resolveAdminStatus(null);
  }, [resolveAdminStatus]);

  const refresh = useCallback(async () => {
    try {
      const resp = await fetch('/api/state');
      if (resp.ok) {
        const json = (await resp.json()) as TournamentState;
        if (json?.tournament?.id) {
          setStaffState(json);
        }
      }
      if (auth.currentUser) {
        await getDocFromServer(doc(db, 'tournaments', TOURNAMENT_ID));
      }
      setSseConnected(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyegarkan data turnamen');
    }
  }, []);

  const refreshAuthStatus = useCallback(async () => {
    const token = getStaffToken();
    if (token) return;
    await resolveAdminStatus(auth.currentUser);
  }, [resolveAdminStatus]);

  const hasCloudAdminWriteAccess = () =>
    Boolean(auth.currentUser && auth.currentUser.emailVerified);

  const ensureCloudInitializedForWrite = useCallback(async () => {
    if (!auth.currentUser) {
      throw new Error('Silakan masuk sebagai Admin terlebih dahulu.');
    }
    try {
      const check = await getDocFromServer(doc(db, 'tournaments', TOURNAMENT_ID));
      if (!check.exists()) {
        if (authStatus.authenticated) {
          await writeSeedStateToFirestore(state || INITIAL_TOURNAMENT_SEED, auth.currentUser.uid);
        }
      }
    } catch (err) {
      console.warn('ensureCloudInitializedForWrite notice (quota or network):', err);
    }
  }, [authStatus.authenticated, state]);

  const touchCloudTournamentTimestamp = useCallback(async () => {
    if (!auth.currentUser) return;
    await updateDoc(doc(db, 'tournaments', TOURNAMENT_ID), {
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  }, []);

  const registerParticipant = useCallback(
    async (payload: {
      name: string;
      region: string;
      representation?: string;
      categoryId: string;
      level: string;
    }) => {
      const clean = sanitizeParticipantInput(payload);
      const activeState = state || INITIAL_TOURNAMENT_SEED;
      if (!activeState.categories.some((c) => c.id === clean.categoryId)) {
        throw new Error('Kategori turnamen tidak valid.');
      }

      if (!hasCloudAdminWriteAccess()) {
        const res = await staffRequest<{ participant: Participant; state: TournamentState }>(
          '/api/participants',
          {
            method: 'POST',
            body: JSON.stringify(clean),
          }
        );
        return res.participant;
      }

      await ensureCloudInitializedForWrite();
      const newParticipant: Participant = {
        id: createUuidPrefix('part'),
        name: clean.name,
        region: clean.region,
        representation: clean.representation,
        categoryId: clean.categoryId,
        level: clean.level,
        status: 'registered',
        createdAt: new Date().toISOString(),
      };

      const path = `participants/${newParticipant.id}`;
      try {
        await setDoc(
          doc(db, 'participants', newParticipant.id),
          toCleanParticipantDoc(newParticipant, auth.currentUser!.uid)
        );
        await touchCloudTournamentTimestamp();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
      return newParticipant;
    },
    [ensureCloudInitializedForWrite, staffRequest, state, touchCloudTournamentTimestamp]
  );

  const updateParticipant = useCallback(
    async (
      participantId: string,
      payload: Partial<{
        name: string;
        region: string;
        representation: string;
        categoryId: string;
        level: string;
        status: TeamStatus;
      }>
    ) => {
      if (!authStatus.authenticated) {
        throw new Error('Login Admin diperlukan untuk mengubah data peserta.');
      }

      if (!hasCloudAdminWriteAccess()) {
        const res = await staffRequest<{ participant: Participant; state: TournamentState }>(
          `/api/participants/${encodeURIComponent(participantId)}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        return res.participant;
      }

      await ensureCloudInitializedForWrite();

      const activeState = state || INITIAL_TOURNAMENT_SEED;
      const existing = activeState.participants.find((p) => p.id === participantId);
      if (!existing) {
        throw new Error('Peserta tidak ditemukan.');
      }

      const nextName =
        payload.name !== undefined
          ? sanitizeText(payload.name, FIRESTORE_LIMITS.NAME_MAX, existing.name)
          : existing.name;
      const nextRegion =
        payload.region !== undefined
          ? sanitizeText(payload.region, FIRESTORE_LIMITS.REGION_MAX, existing.region)
          : existing.region;
      const nextRep =
        payload.representation !== undefined
          ? sanitizeText(
              payload.representation,
              FIRESTORE_LIMITS.REPRESENTATION_MAX,
              existing.representation || 'Retail Sales'
            )
          : existing.representation || 'Retail Sales';
      const nextCategoryId =
        payload.categoryId && activeState.categories.some((c) => c.id === payload.categoryId)
          ? payload.categoryId
          : existing.categoryId;
      const nextLevel =
        payload.level !== undefined
          ? sanitizeText(payload.level, FIRESTORE_LIMITS.LEVEL_MAX, existing.level)
          : existing.level;
      const nextStatus: TeamStatus =
        payload.status && ['registered', 'checked_in', 'withdrawn'].includes(payload.status)
          ? payload.status
          : existing.status;

      const updated: Participant = {
        ...existing,
        name: nextName,
        region: nextRegion,
        representation: nextRep,
        categoryId: nextCategoryId,
        level: nextLevel,
        status: nextStatus,
      };

      const batch = writeBatch(db);
      batch.update(doc(db, 'participants', participantId), {
        name: nextName,
        region: nextRegion,
        representation: nextRep,
        categoryId: nextCategoryId,
        level: nextLevel,
        status: nextStatus,
        serverUpdatedAt: serverTimestamp(),
      });

      for (const team of activeState.teams) {
        if (team.player1Id === participantId || team.player2Id === participantId) {
          const oldAutoName = buildDefaultPairName(team.player1.name, team.player2.name);
          const nextP1 =
            team.player1Id === participantId
              ? { name: nextName, region: nextRegion, representation: nextRep, level: nextLevel }
              : {
                  name: team.player1.name,
                  region: team.player1.region || team.region || 'Makassar',
                  representation: team.player1.representation || 'Retail Sales',
                  level: team.player1.level,
                };
          const nextP2 =
            team.player2Id === participantId
              ? { name: nextName, region: nextRegion, representation: nextRep, level: nextLevel }
              : {
                  name: team.player2.name,
                  region: team.player2.region || team.region || 'Makassar',
                  representation: team.player2.representation || 'Retail Sales',
                  level: team.player2.level,
                };
          const nextTeamName =
            team.teamName === oldAutoName
              ? buildDefaultPairName(nextP1.name, nextP2.name)
              : team.teamName;
          const nextPairRegion = sanitizeText(
            formatPairRegion(nextP1.region, nextP2.region),
            FIRESTORE_LIMITS.TEAM_REGION_MAX,
            'Makassar'
          );

          batch.update(doc(db, 'teams', team.id), {
            teamName: sanitizeText(nextTeamName, FIRESTORE_LIMITS.TEAM_NAME_MAX, 'Pasangan'),
            region: nextPairRegion,
            club: nextPairRegion,
            player1: nextP1,
            player2: nextP2,
            serverUpdatedAt: serverTimestamp(),
          });
        }
      }

      try {
        await batch.commit();
        await touchCloudTournamentTimestamp();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `participants/${participantId}`);
      }

      return updated;
    },
    [authStatus.authenticated, ensureCloudInitializedForWrite, staffRequest, state, touchCloudTournamentTimestamp]
  );

  const deleteParticipant = useCallback(
    async (participantId: string, cascade = false) => {
      if (!authStatus.authenticated) {
        throw new Error('Login Admin diperlukan untuk menghapus peserta.');
      }

      if (!hasCloudAdminWriteAccess()) {
        await staffRequest<{ state: TournamentState }>(
          `/api/participants/${encodeURIComponent(participantId)}${cascade ? '?cascade=true' : ''}`,
          { method: 'DELETE' }
        );
        return;
      }

      await ensureCloudInitializedForWrite();

      const activeState = state || INITIAL_TOURNAMENT_SEED;
      const linkedTeams = activeState.teams.filter(
        (t) => t.player1Id === participantId || t.player2Id === participantId
      );

      if (linkedTeams.length > 0 && !cascade) {
        const err = new Error(
          `Peserta ini tergabung dalam pasangan "${linkedTeams[0].teamName}". Hapus pasangan & jadwal terkait?`
        ) as Error & { status?: number };
        err.status = 409;
        throw err;
      }

      const linkedTeamIds = new Set(linkedTeams.map((t) => t.id));
      const linkedMatches = activeState.matches.filter(
        (m) => linkedTeamIds.has(m.teamAId) || linkedTeamIds.has(m.teamBId)
      );

      const batch = writeBatch(db);
      for (const m of linkedMatches) {
        batch.delete(doc(db, 'matches', m.id));
      }
      for (const t of linkedTeams) {
        batch.delete(doc(db, 'teams', t.id));
      }
      batch.delete(doc(db, 'participants', participantId));

      try {
        await batch.commit();
        await touchCloudTournamentTimestamp();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `participants/${participantId}`);
      }
    },
    [authStatus.authenticated, ensureCloudInitializedForWrite, staffRequest, state, touchCloudTournamentTimestamp]
  );

  const pairParticipants = useCallback(
    async (payload: {
      participant1Id: string;
      participant2Id: string;
      categoryId: string;
      teamName?: string;
      region?: string;
      seed?: number | null;
    }) => {
      if (!authStatus.authenticated) {
        throw new Error('Login Admin diperlukan untuk memasangkan peserta.');
      }

      if (!hasCloudAdminWriteAccess()) {
        const res = await staffRequest<{ team: Team; state: TournamentState }>('/api/teams/pair', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        return res.team;
      }

      await ensureCloudInitializedForWrite();

      const activeState = state || INITIAL_TOURNAMENT_SEED;
      const { participant1Id, participant2Id, categoryId, teamName, region, seed } = payload;

      if (!participant1Id || !participant2Id || participant1Id === participant2Id) {
        throw new Error('Pilih dua peserta yang berbeda untuk dipasangkan.');
      }
      const p1 = activeState.participants.find((p) => p.id === participant1Id);
      const p2 = activeState.participants.find((p) => p.id === participant2Id);
      if (!p1 || !p2) {
        throw new Error('Salah satu peserta tidak ditemukan.');
      }
      const category = activeState.categories.find((c) => c.id === categoryId);
      if (!category) {
        throw new Error('Kategori turnamen tidak valid.');
      }

      const existingPair = activeState.teams.find(
        (t) =>
          t.status !== 'withdrawn' &&
          (t.player1Id === participant1Id ||
            t.player2Id === participant1Id ||
            t.player1Id === participant2Id ||
            t.player2Id === participant2Id)
      );
      if (existingPair) {
        throw new Error(`Peserta sudah tergabung di pasangan "${existingPair.teamName}".`);
      }

      const activeInCat = activeState.teams.filter(
        (t) => t.categoryId === categoryId && t.status !== 'withdrawn'
      );
      if (activeInCat.length >= category.maxTeams) {
        throw new Error(`Kuota kategori ${category.name} sudah penuh.`);
      }

      const pairRegion = sanitizeText(
        region || formatPairRegion(p1.region, p2.region),
        FIRESTORE_LIMITS.TEAM_REGION_MAX,
        'Makassar'
      );
      const computedName = sanitizeText(
        teamName || buildDefaultPairName(p1.name, p2.name),
        FIRESTORE_LIMITS.TEAM_NAME_MAX,
        'Pasangan'
      );

      const newTeam: Team = {
        id: createUuidPrefix('team'),
        categoryId,
        teamName: computedName,
        region: pairRegion,
        club: pairRegion,
        seed: typeof seed === 'number' && seed > 0 ? seed : null,
        status: p1.status === 'checked_in' && p2.status === 'checked_in' ? 'checked_in' : 'registered',
        player1Id: p1.id,
        player2Id: p2.id,
        player1: {
          name: p1.name,
          region: p1.region,
          representation: p1.representation || 'Retail Sales',
          level: p1.level,
        },
        player2: {
          name: p2.name,
          region: p2.region,
          representation: p2.representation || 'Retail Sales',
          level: p2.level,
        },
        createdAt: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, 'teams', newTeam.id), toCleanTeamDoc(newTeam));
        await touchCloudTournamentTimestamp();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `teams/${newTeam.id}`);
      }
      return newTeam;
    },
    [authStatus.authenticated, ensureCloudInitializedForWrite, staffRequest, state, touchCloudTournamentTimestamp]
  );

  const registerTeam = useCallback(
    async (payload: {
      categoryId: string;
      teamName: string;
      region?: string;
      club?: string;
      seed?: number | null;
      player1: { name: string; region?: string; representation?: string; level: string };
      player2: { name: string; region?: string; representation?: string; level: string };
    }) => {
      if (!authStatus.authenticated) {
        throw new Error('Login Admin diperlukan.');
      }

      if (!hasCloudAdminWriteAccess()) {
        const res = await staffRequest<{ team: Team; state: TournamentState }>('/api/teams', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        return res.team;
      }

      await ensureCloudInitializedForWrite();

      const now = new Date().toISOString();
      const p1Id = createUuidPrefix('part');
      const p2Id = createUuidPrefix('part');
      const p1Region = sanitizeText(
        payload.player1.region || payload.region || payload.club,
        FIRESTORE_LIMITS.REGION_MAX,
        'Makassar'
      );
      const p2Region = sanitizeText(
        payload.player2.region || p1Region,
        FIRESTORE_LIMITS.REGION_MAX,
        p1Region
      );
      const pairRegion = sanitizeText(
        payload.region || payload.club || formatPairRegion(p1Region, p2Region),
        FIRESTORE_LIMITS.TEAM_REGION_MAX,
        'Makassar'
      );

      const p1: Participant = {
        id: p1Id,
        name: sanitizeText(payload.player1.name, FIRESTORE_LIMITS.NAME_MAX),
        region: p1Region,
        representation: sanitizeText(
          payload.player1.representation,
          FIRESTORE_LIMITS.REPRESENTATION_MAX,
          'Retail Sales'
        ),
        categoryId: payload.categoryId,
        level: sanitizeText(payload.player1.level, FIRESTORE_LIMITS.LEVEL_MAX, 'Open'),
        status: 'registered',
        createdAt: now,
      };
      const p2: Participant = {
        id: p2Id,
        name: sanitizeText(payload.player2.name, FIRESTORE_LIMITS.NAME_MAX),
        region: p2Region,
        representation: sanitizeText(
          payload.player2.representation,
          FIRESTORE_LIMITS.REPRESENTATION_MAX,
          'Retail Sales'
        ),
        categoryId: payload.categoryId,
        level: sanitizeText(payload.player2.level, FIRESTORE_LIMITS.LEVEL_MAX, 'Open'),
        status: 'registered',
        createdAt: now,
      };
      const team: Team = {
        id: createUuidPrefix('team'),
        categoryId: payload.categoryId,
        teamName: sanitizeText(
          payload.teamName || buildDefaultPairName(p1.name, p2.name),
          FIRESTORE_LIMITS.TEAM_NAME_MAX
        ),
        region: pairRegion,
        club: pairRegion,
        seed: typeof payload.seed === 'number' && payload.seed > 0 ? payload.seed : null,
        status: 'registered',
        player1Id: p1Id,
        player2Id: p2Id,
        player1: { name: p1.name, region: p1.region, representation: p1.representation, level: p1.level },
        player2: { name: p2.name, region: p2.region, representation: p2.representation, level: p2.level },
        createdAt: now,
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'participants', p1Id), toCleanParticipantDoc(p1, firebaseUser?.uid));
      batch.set(doc(db, 'participants', p2Id), toCleanParticipantDoc(p2, firebaseUser?.uid));
      batch.set(doc(db, 'teams', team.id), toCleanTeamDoc(team));
      try {
        await batch.commit();
        await touchCloudTournamentTimestamp();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `teams/${team.id}`);
      }
      return team;
    },
    [authStatus.authenticated, ensureCloudInitializedForWrite, firebaseUser?.uid, staffRequest, touchCloudTournamentTimestamp]
  );

  const updateTeam = useCallback(
    async (
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
    ) => {
      if (!authStatus.authenticated) {
        throw new Error('Login Admin diperlukan untuk mengubah data pasangan.');
      }

      if (!hasCloudAdminWriteAccess()) {
        const res = await staffRequest<{ team: Team; state: TournamentState }>(
          `/api/teams/${encodeURIComponent(teamId)}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        return res.team;
      }

      await ensureCloudInitializedForWrite();

      const activeState = state || INITIAL_TOURNAMENT_SEED;
      const existing = activeState.teams.find((t) => t.id === teamId);
      if (!existing) {
        throw new Error('Pasangan tidak ditemukan.');
      }

      const nextCategoryId =
        payload.categoryId && activeState.categories.some((c) => c.id === payload.categoryId)
          ? payload.categoryId
          : existing.categoryId;
      const nextTeamName = sanitizeText(
        payload.teamName ?? existing.teamName,
        FIRESTORE_LIMITS.TEAM_NAME_MAX,
        existing.teamName
      );
      const nextP1 = payload.player1
        ? {
            name: sanitizeText(payload.player1.name, FIRESTORE_LIMITS.NAME_MAX, existing.player1.name),
            region: sanitizeText(
              payload.player1.region || existing.player1.region || existing.region,
              FIRESTORE_LIMITS.REGION_MAX,
              'Makassar'
            ),
            representation: sanitizeText(
              payload.player1.representation || existing.player1.representation,
              FIRESTORE_LIMITS.REPRESENTATION_MAX,
              'Retail Sales'
            ),
            level: sanitizeText(
              payload.player1.level,
              FIRESTORE_LIMITS.LEVEL_MAX,
              existing.player1.level
            ),
          }
        : {
            name: existing.player1.name,
            region: existing.player1.region || existing.region || 'Makassar',
            representation: existing.player1.representation || 'Retail Sales',
            level: existing.player1.level,
          };
      const nextP2 = payload.player2
        ? {
            name: sanitizeText(payload.player2.name, FIRESTORE_LIMITS.NAME_MAX, existing.player2.name),
            region: sanitizeText(
              payload.player2.region || existing.player2.region || existing.region,
              FIRESTORE_LIMITS.REGION_MAX,
              'Makassar'
            ),
            representation: sanitizeText(
              payload.player2.representation || existing.player2.representation,
              FIRESTORE_LIMITS.REPRESENTATION_MAX,
              'Retail Sales'
            ),
            level: sanitizeText(
              payload.player2.level,
              FIRESTORE_LIMITS.LEVEL_MAX,
              existing.player2.level
            ),
          }
        : {
            name: existing.player2.name,
            region: existing.player2.region || existing.region || 'Makassar',
            representation: existing.player2.representation || 'Retail Sales',
            level: existing.player2.level,
          };

      const nextRegion = sanitizeText(
        payload.region ?? payload.club ?? formatPairRegion(nextP1.region, nextP2.region),
        FIRESTORE_LIMITS.TEAM_REGION_MAX,
        'Makassar'
      );
      const nextSeed =
        payload.seed !== undefined
          ? typeof payload.seed === 'number' && payload.seed >= 1 && payload.seed <= 128
            ? payload.seed
            : null
          : existing.seed;
      const nextStatus: TeamStatus =
        payload.status && ['registered', 'checked_in', 'withdrawn'].includes(payload.status)
          ? payload.status
          : existing.status;

      const batch = writeBatch(db);
      batch.update(doc(db, 'teams', teamId), {
        categoryId: nextCategoryId,
        teamName: nextTeamName,
        region: nextRegion,
        club: nextRegion,
        seed: nextSeed,
        status: nextStatus,
        player1: nextP1,
        player2: nextP2,
        serverUpdatedAt: serverTimestamp(),
      });

      if (existing.player1Id && activeState.participants.some((p) => p.id === existing.player1Id)) {
        batch.update(doc(db, 'participants', existing.player1Id), {
          name: nextP1.name,
          region: nextP1.region,
          representation: nextP1.representation,
          categoryId: nextCategoryId,
          level: nextP1.level,
          status: nextStatus,
          serverUpdatedAt: serverTimestamp(),
        });
      }
      if (existing.player2Id && activeState.participants.some((p) => p.id === existing.player2Id)) {
        batch.update(doc(db, 'participants', existing.player2Id), {
          name: nextP2.name,
          region: nextP2.region,
          representation: nextP2.representation,
          categoryId: nextCategoryId,
          level: nextP2.level,
          status: nextStatus,
          serverUpdatedAt: serverTimestamp(),
        });
      }

      const updatedTeam: Team = {
        ...existing,
        categoryId: nextCategoryId,
        teamName: nextTeamName,
        region: nextRegion,
        club: nextRegion,
        seed: nextSeed,
        status: nextStatus,
        player1: nextP1,
        player2: nextP2,
      };
      const nextTeams = activeState.teams.map((t) => (t.id === teamId ? updatedTeam : t));
      const baseBrackets = mergeWithDefaultBrackets(activeState.brackets);
      const syncedBrackets = syncAllBracketsWithTeamsAndMatches(
        baseBrackets,
        nextTeams,
        activeState.matches
      );
      syncedBrackets.forEach((br, idx) => {
        if (br !== baseBrackets[idx]) {
          batch.set(doc(db, 'brackets', br.id), toCleanBracketDoc(br));
        }
      });

      try {
        await batch.commit();
        await touchCloudTournamentTimestamp();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `teams/${teamId}`);
      }

      return updatedTeam;
    },
    [authStatus.authenticated, ensureCloudInitializedForWrite, staffRequest, state, touchCloudTournamentTimestamp]
  );

  const deleteTeam = useCallback(
    async (teamId: string, cascade = false) => {
      if (!authStatus.authenticated) {
        throw new Error('Login Admin diperlukan untuk melepas pasangan.');
      }

      if (!hasCloudAdminWriteAccess()) {
        await staffRequest<{ state: TournamentState }>(
          `/api/teams/${encodeURIComponent(teamId)}${cascade ? '?cascade=true' : ''}`,
          { method: 'DELETE' }
        );
        return;
      }

      await ensureCloudInitializedForWrite();

      const activeState = state || INITIAL_TOURNAMENT_SEED;
      const linkedMatches = activeState.matches.filter(
        (m) => m.teamAId === teamId || m.teamBId === teamId
      );

      if (linkedMatches.length > 0 && !cascade) {
        const err = new Error(
          `Pasangan terhubung ke ${linkedMatches.length} pertandingan.`
        ) as Error & { status?: number; linkedMatchCount?: number };
        err.status = 409;
        err.linkedMatchCount = linkedMatches.length;
        throw err;
      }

      const batch = writeBatch(db);
      for (const m of linkedMatches) {
        batch.delete(doc(db, 'matches', m.id));
      }
      batch.delete(doc(db, 'teams', teamId));

      const linkedMatchIds = new Set(linkedMatches.map((m) => m.id));
      const nextTeamsAfterDelete = activeState.teams.filter((t) => t.id !== teamId);
      const nextMatchesAfterDelete = activeState.matches.filter((m) => !linkedMatchIds.has(m.id));
      const baseBracketsAfterDelete = mergeWithDefaultBrackets(activeState.brackets);
      const syncedBracketsAfterDelete = syncAllBracketsWithTeamsAndMatches(
        baseBracketsAfterDelete,
        nextTeamsAfterDelete,
        nextMatchesAfterDelete
      );
      syncedBracketsAfterDelete.forEach((br, idx) => {
        if (br !== baseBracketsAfterDelete[idx]) {
          batch.set(doc(db, 'brackets', br.id), toCleanBracketDoc(br));
        }
      });

      try {
        await batch.commit();
        await touchCloudTournamentTimestamp();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `teams/${teamId}`);
      }
    },
    [authStatus.authenticated, ensureCloudInitializedForWrite, staffRequest, state, touchCloudTournamentTimestamp]
  );

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
      if (!authStatus.authenticated) {
        throw new Error('Login Admin diperlukan untuk menjadwalkan pertandingan.');
      }

      if (!hasCloudAdminWriteAccess()) {
        const res = await staffRequest<{ match: Match; state: TournamentState }>('/api/matches', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        return res.match;
      }

      await ensureCloudInitializedForWrite();

      const activeState = state || INITIAL_TOURNAMENT_SEED;
      if (!payload.teamAId || !payload.teamBId || payload.teamAId === payload.teamBId) {
        throw new Error('Pilih dua pasangan yang berbeda.');
      }

      const conflict = detectScheduleConflict(activeState.matches, {
        courtId: payload.courtId,
        scheduledDate: payload.scheduledDate,
        scheduledTime: payload.scheduledTime,
        teamAId: payload.teamAId,
        teamBId: payload.teamBId,
      });
      if (conflict && !payload.ignoreConflict) {
        const err = new Error(conflict.message || 'Bentrok jadwal terdeteksi.') as Error & {
          status?: number;
          conflict?: unknown;
        };
        err.status = 409;
        err.conflict = conflict;
        throw err;
      }

      const nextNumber =
        activeState.matches.reduce((max, m) => Math.max(max, m.matchNumber), 0) + 1;
      const newMatch: Match = {
        id: createUuidPrefix('match'),
        categoryId: payload.categoryId,
        stage: sanitizeText(payload.stage, FIRESTORE_LIMITS.STAGE_MAX, 'Fase Grup'),
        matchNumber: nextNumber,
        teamAId: payload.teamAId,
        teamBId: payload.teamBId,
        courtId: payload.courtId || null,
        scheduledDate: sanitizeText(payload.scheduledDate, FIRESTORE_LIMITS.DATE_MAX, '2026-11-27'),
        scheduledTime: sanitizeText(payload.scheduledTime, FIRESTORE_LIMITS.TIME_MAX, '07:30'),
        status: 'scheduled',
        score: createInitialScore(activeState.tournament.goldenPointDefault),
        updatedAt: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, 'matches', newMatch.id), toCleanMatchDoc(newMatch));
        await touchCloudTournamentTimestamp();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `matches/${newMatch.id}`);
      }
      return newMatch;
    },
    [authStatus.authenticated, ensureCloudInitializedForWrite, staffRequest, state, touchCloudTournamentTimestamp]
  );

  const autoPairCategory = useCallback(
    async (payload: {
      categoryId: string;
      mode: 'round_robin' | 'knockout';
      stage: string;
      scheduledDate: string;
      startTime: string;
    }) => {
      if (!authStatus.authenticated) {
        throw new Error('Login Admin diperlukan untuk generate jadwal.');
      }

      if (!hasCloudAdminWriteAccess()) {
        const res = await staffRequest<{ createdCount: number; state: TournamentState }>(
          '/api/matches/auto-pair',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        );
        return res.createdCount;
      }

      await ensureCloudInitializedForWrite();

      const activeState = state || INITIAL_TOURNAMENT_SEED;
      const pairings =
        payload.mode === 'knockout'
          ? generateKnockoutPairings(activeState.teams, payload.categoryId, payload.stage)
          : generateRoundRobinPairings(
              activeState.teams,
              payload.categoryId,
              activeState.matches,
              payload.stage
            );

      if (pairings.length === 0) {
        throw new Error('Tidak ada pasangan baru yang bisa dibuat pada kategori ini.');
      }

      let nextNum = activeState.matches.reduce((max, m) => Math.max(max, m.matchNumber), 0) + 1;
      const [hh, mm] = (payload.startTime || '07:30').split(':').map((n) => Number(n) || 0);
      const baseMinutes = hh * 60 + mm;
      const courtCount = Math.max(1, activeState.courts.length);

      const batch = writeBatch(db);
      pairings.forEach((pair, idx) => {
        const slotIndex = Math.floor(idx / courtCount);
        const totalMin = baseMinutes + slotIndex * 60;
        const slotTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
        const assignedCourt = activeState.courts[idx % courtCount]?.id || null;
        const match: Match = {
          id: createUuidPrefix('match'),
          categoryId: payload.categoryId,
          stage: sanitizeText(pair.stage || payload.stage, FIRESTORE_LIMITS.STAGE_MAX, 'Fase Grup'),
          matchNumber: nextNum++,
          teamAId: pair.teamAId,
          teamBId: pair.teamBId,
          courtId: assignedCourt,
          scheduledDate: payload.scheduledDate || activeState.tournament.startDate,
          scheduledTime: slotTime,
          status: 'scheduled',
          score: createInitialScore(activeState.tournament.goldenPointDefault),
          updatedAt: new Date().toISOString(),
        };
        batch.set(doc(db, 'matches', match.id), toCleanMatchDoc(match));
      });

      try {
        await batch.commit();
        await touchCloudTournamentTimestamp();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'matches');
      }
      return pairings.length;
    },
    [authStatus.authenticated, ensureCloudInitializedForWrite, staffRequest, state, touchCloudTournamentTimestamp]
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
      if (!authStatus.authenticated) {
        throw new Error('Login Admin diperlukan untuk mengubah jadwal.');
      }

      if (!hasCloudAdminWriteAccess()) {
        const res = await staffRequest<{ match: Match; generatedLogs: number; state: TournamentState }>(
          `/api/matches/${encodeURIComponent(matchId)}/schedule`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        return { match: res.match, generatedLogs: res.generatedLogs || 0 };
      }

      await ensureCloudInitializedForWrite();

      const activeState = state || INITIAL_TOURNAMENT_SEED;
      const existing = activeState.matches.find((m) => m.id === matchId);
      if (!existing) {
        throw new Error('Pertandingan tidak ditemukan.');
      }

      const nextCourtId = payload.courtId !== undefined ? payload.courtId : existing.courtId;
      const nextDate = payload.scheduledDate ?? existing.scheduledDate;
      const nextTime = payload.scheduledTime ?? existing.scheduledTime;
      const nextStatus = payload.status ?? existing.status;
      const nextStage = sanitizeText(
        payload.stage ?? existing.stage,
        FIRESTORE_LIMITS.STAGE_MAX,
        existing.stage
      );

      const conflict = detectScheduleConflict(activeState.matches, {
        id: matchId,
        courtId: nextCourtId,
        scheduledDate: nextDate,
        scheduledTime: nextTime,
        teamAId: existing.teamAId,
        teamBId: existing.teamBId,
      });
      if (conflict && !payload.ignoreConflict) {
        const err = new Error(conflict.message || 'Bentrok jadwal terdeteksi.') as Error & {
          status?: number;
          conflict?: unknown;
        };
        err.status = 409;
        err.conflict = conflict;
        throw err;
      }

      const nowIso = new Date().toISOString();
      let cloudSuccess = false;
      if (hasCloudAdminWriteAccess()) {
        try {
          await ensureCloudInitializedForWrite();
          await updateDoc(doc(db, 'matches', matchId), {
            courtId: nextCourtId || null,
            scheduledDate: sanitizeText(nextDate, FIRESTORE_LIMITS.DATE_MAX),
            scheduledTime: sanitizeText(nextTime, FIRESTORE_LIMITS.TIME_MAX),
            status: nextStatus,
            stage: nextStage,
            updatedAt: nowIso,
            serverUpdatedAt: serverTimestamp(),
          });
          await touchCloudTournamentTimestamp();
          cloudSuccess = true;
        } catch (err) {
          console.warn('Cloud update match notice:', err);
          handleFirestoreError(err, OperationType.UPDATE, `matches/${matchId}`);
        }
      }

      let generatedLogs = 0;
      try {
        const res = await staffRequest<{ match: Match; generatedLogs: number; state: TournamentState }>(
          `/api/matches/${encodeURIComponent(matchId)}/schedule`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        generatedLogs = res.generatedLogs || 0;
      } catch (serverErr) {
        if (!cloudSuccess) {
          throw serverErr;
        }
      }

      const updatedMatch: Match = {
        ...existing,
        courtId: nextCourtId,
        scheduledDate: nextDate,
        scheduledTime: nextTime,
        status: nextStatus,
        stage: nextStage,
        updatedAt: nowIso,
      };

      setStaffState((prev) =>
        prev
          ? {
              ...prev,
              matches: prev.matches.map((m) => (m.id === matchId ? updatedMatch : m)),
            }
          : prev
      );

      return {
        match: updatedMatch,
        generatedLogs,
      };
    },
    [authStatus.authenticated, ensureCloudInitializedForWrite, staffRequest, state, touchCloudTournamentTimestamp]
  );

  const updateMatchScore = useCallback(
    async (matchId: string, payload: { score: PadelScoreState; status?: MatchStatus }) => {
      if (!authStatus.authenticated) {
        throw new Error('Login Admin diperlukan untuk mengubah skor.');
      }

      if (!hasCloudAdminWriteAccess()) {
        const res = await staffRequest<{ match: Match; state: TournamentState }>(
          `/api/matches/${encodeURIComponent(matchId)}/score`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        return res.match;
      }

      await ensureCloudInitializedForWrite();

      const activeState = state || INITIAL_TOURNAMENT_SEED;
      const existing = activeState.matches.find((m) => m.id === matchId);
      if (!existing) {
        throw new Error('Pertandingan tidak ditemukan.');
      }

      const nextStatus: MatchStatus =
        payload.status ??
        (payload.score.winnerSide
          ? 'completed'
          : existing.status === 'scheduled'
            ? 'live'
            : existing.status);

      const cleanSets = payload.score.sets.slice(0, FIRESTORE_LIMITS.MAX_SETS).map((s) => ({
        teamA: Math.max(0, Math.min(20, Math.trunc(Number(s.teamA) || 0))),
        teamB: Math.max(0, Math.min(20, Math.trunc(Number(s.teamB) || 0))),
      }));

      const cleanScore: PadelScoreState = {
        sets: cleanSets.length > 0 ? cleanSets : [{ teamA: 0, teamB: 0 }],
        currentPointA: sanitizeText(payload.score.currentPointA, 8, '0'),
        currentPointB: sanitizeText(payload.score.currentPointB, 8, '0'),
        servingTeam: payload.score.servingTeam === 'B' ? 'B' : 'A',
        goldenPoint: Boolean(payload.score.goldenPoint),
        isTiebreak: Boolean(payload.score.isTiebreak),
        winnerSide:
          payload.score.winnerSide === 'A' || payload.score.winnerSide === 'B'
            ? payload.score.winnerSide
            : null,
      };

      const nowIso = new Date().toISOString();
      const updatedMatch: Match = {
        ...existing,
        score: cleanScore,
        status: nextStatus,
        updatedAt: nowIso,
      };
      const nextMatches = activeState.matches.map((m) => (m.id === matchId ? updatedMatch : m));
      const baseBracketsForScore = mergeWithDefaultBrackets(activeState.brackets);
      const syncedBracketsForScore = syncAllBracketsWithTeamsAndMatches(
        baseBracketsForScore,
        activeState.teams,
        nextMatches
      );

      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'matches', matchId), {
          score: cleanScore,
          status: nextStatus,
          updatedAt: nowIso,
          serverUpdatedAt: serverTimestamp(),
        });
        syncedBracketsForScore.forEach((br, idx) => {
          if (br !== baseBracketsForScore[idx]) {
            batch.set(doc(db, 'brackets', br.id), toCleanBracketDoc(br));
          }
        });
        await batch.commit();
        await touchCloudTournamentTimestamp();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `matches/${matchId}`);
      }

      return updatedMatch;
    },
    [authStatus.authenticated, ensureCloudInitializedForWrite, staffRequest, state, touchCloudTournamentTimestamp]
  );

  const deleteMatch = useCallback(
    async (matchId: string) => {
      if (!authStatus.authenticated) {
        throw new Error('Login Admin diperlukan untuk menghapus jadwal.');
      }

      let cloudSuccess = false;
      if (hasCloudAdminWriteAccess()) {
        try {
          await ensureCloudInitializedForWrite();
          await deleteDoc(doc(db, 'matches', matchId));
          await touchCloudTournamentTimestamp();
          cloudSuccess = true;
        } catch (err) {
          console.warn('Cloud delete match notice:', err);
          handleFirestoreError(err, OperationType.DELETE, `matches/${matchId}`);
        }
      }

      try {
        await staffRequest<{ state: TournamentState }>(
          `/api/matches/${encodeURIComponent(matchId)}`,
          { method: 'DELETE' }
        );
      } catch (serverErr) {
        if (!cloudSuccess) {
          throw serverErr;
        }
      }

      setStaffState((prev) =>
        prev
          ? {
              ...prev,
              matches: prev.matches.filter((m) => m.id !== matchId),
            }
          : prev
      );
    },
    [authStatus.authenticated, ensureCloudInitializedForWrite, staffRequest, touchCloudTournamentTimestamp]
  );

  const addCourt = useCallback(
    async (payload: { name: string; surface: string; isIndoor: boolean }) => {
      if (!authStatus.authenticated) {
        throw new Error('Login Admin diperlukan untuk menambah court.');
      }

      const cleanedName = payload.name.replace(/\s*\(Indoor\)/gi, '').trim() || payload.name;
      const clean = sanitizeCourtInput({
        ...payload,
        name: cleanedName,
        surface: payload.surface || 'Indoor',
      });

      if (!hasCloudAdminWriteAccess()) {
        await staffRequest<{ court: Court; state: TournamentState }>('/api/courts', {
          method: 'POST',
          body: JSON.stringify(clean),
        });
        return;
      }

      await ensureCloudInitializedForWrite();

      const id = createUuidPrefix('court');
      try {
        await setDoc(doc(db, 'courts', id), {
          id,
          tournamentId: TOURNAMENT_ID,
          name: clean.name,
          surface: clean.surface,
          isIndoor: clean.isIndoor,
        });
        await touchCloudTournamentTimestamp();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `courts/${id}`);
      }
    },
    [authStatus.authenticated, ensureCloudInitializedForWrite, staffRequest, touchCloudTournamentTimestamp]
  );

  const updateBracket = useCallback(
    async (categoryId: string, nextBracket: CategoryBracket) => {
      if (!authStatus.authenticated) {
        throw new Error('Login Admin diperlukan untuk mengubah bagan pertandingan.');
      }

      if (!hasCloudAdminWriteAccess()) {
        const res = await staffRequest<{ bracket: CategoryBracket; state: TournamentState }>(
          `/api/brackets/${encodeURIComponent(categoryId)}`,
          {
            method: 'PUT',
            body: JSON.stringify(nextBracket),
          }
        );
        return res.bracket;
      }

      await ensureCloudInitializedForWrite();
      const activeState = state || INITIAL_TOURNAMENT_SEED;
      const synced = syncBracketWithTeamsAndMatches(
        {
          ...nextBracket,
          updatedAt: new Date().toISOString(),
        },
        activeState.teams,
        activeState.matches
      );
      const docPayload = toCleanBracketDoc(synced);
      try {
        await setDoc(doc(db, 'brackets', docPayload.id), docPayload);
        await touchCloudTournamentTimestamp();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `brackets/${docPayload.id}`);
      }
      return synced;
    },
    [authStatus.authenticated, ensureCloudInitializedForWrite, staffRequest, state, touchCloudTournamentTimestamp]
  );

  const resetBracket = useCallback(
    async (categoryId: string) => {
      if (!authStatus.authenticated) {
        throw new Error('Login Admin diperlukan untuk mereset bagan pertandingan.');
      }

      const def = cloneInitialBrackets().find(
        (b) => b.categoryId === categoryId || b.id === categoryId
      );
      if (!def) {
        throw new Error('Bagan kategori tidak ditemukan.');
      }

      if (!hasCloudAdminWriteAccess()) {
        const res = await staffRequest<{ bracket: CategoryBracket; state: TournamentState }>(
          `/api/brackets/${encodeURIComponent(categoryId)}/reset`,
          { method: 'POST' }
        );
        return res.bracket;
      }

      await ensureCloudInitializedForWrite();
      const docPayload = toCleanBracketDoc(def);
      try {
        await setDoc(doc(db, 'brackets', docPayload.id), docPayload);
        await touchCloudTournamentTimestamp();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `brackets/${docPayload.id}`);
      }
      return def;
    },
    [authStatus.authenticated, ensureCloudInitializedForWrite, staffRequest, touchCloudTournamentTimestamp]
  );

  const resetDemo = useCallback(async () => {
    if (!authStatus.authenticated) {
      throw new Error('Login Admin diperlukan untuk mereset data.');
    }

    if (!hasCloudAdminWriteAccess()) {
      await staffRequest<{ state: TournamentState }>('/api/reset-demo', {
        method: 'POST',
      });
      return;
    }

    const colNames = [
      'brackets',
      'matches',
      'teams',
      'participants',
      'courts',
      'categories',
    ] as const;
    try {
      for (const colName of colNames) {
        const snap = await getDocs(
          query(collection(db, colName), where('tournamentId', '==', TOURNAMENT_ID))
        );
        if (!snap.empty) {
          const delBatch = writeBatch(db);
          snap.docs.forEach((d) => delBatch.delete(d.ref));
          await delBatch.commit();
        }
      }
      await writeSeedStateToFirestore(INITIAL_TOURNAMENT_SEED, auth.currentUser?.uid);
      if (getStaffToken()) {
        await staffRequest('/api/reset-demo', { method: 'POST' }).catch(() => {});
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tournaments/${TOURNAMENT_ID}`);
    }
  }, [authStatus.authenticated, staffRequest]);

  return {
    state,
    loading,
    error,
    sseConnected,
    cloudSeeded,
    authStatus,
    refresh,
    refreshAuthStatus,
    signInWithGoogle,
    setupAdmin,
    loginAdmin,
    loginStaffAdmin,
    logoutAdmin,
    registerParticipant,
    updateParticipant,
    deleteParticipant,
    pairParticipants,
    registerTeam,
    updateTeam,
    deleteTeam,
    createMatch,
    autoPairCategory,
    updateMatchSchedule,
    updateMatchScore,
    deleteMatch,
    addCourt,
    updateBracket,
    resetBracket,
    resetDemo,
  };
}