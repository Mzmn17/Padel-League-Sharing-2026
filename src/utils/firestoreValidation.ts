// Synchronized verbatim with firebase-blueprint.json constraints
export const FIRESTORE_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  TOURNAMENT_ID: 'pls-2026',
  ID_MAX: 64,
  NAME_MAX: 100,
  REGION_MAX: 80,
  REPRESENTATION_MAX: 80,
  LEVEL_MAX: 40,
  TEAM_NAME_MAX: 120,
  TEAM_REGION_MAX: 100,
  COURT_NAME_MAX: 80,
  COURT_SURFACE_MAX: 80,
  STAGE_MAX: 80,
  DATE_MAX: 20,
  TIME_MAX: 10,
  MAX_SETS: 5,
  BRACKET_TITLE_MAX: 100,
  BRACKET_SUBTITLE_MAX: 160,
  BRACKET_TEAM_NAME_MAX: 160,
  BRACKET_SCORE_MAX: 40,
  BRACKET_SLOTS_MAX: 24,
} as const;

export function sanitizeText(value: string | undefined | null, maxLen: number, fallback = ''): string {
  const trimmed = (value ?? '').trim();
  const base = trimmed.length > 0 ? trimmed : fallback;
  return base.slice(0, maxLen);
}

export function assertValidId(id: string, label = 'ID'): string {
  const clean = id.trim();
  if (!clean || clean.length > FIRESTORE_LIMITS.ID_MAX || !FIRESTORE_LIMITS.ID_PATTERN.test(clean)) {
    throw new Error(`${label} tidak valid.`);
  }
  return clean;
}

export function sanitizeParticipantInput(input: {
  name: string;
  region: string;
  representation?: string;
  categoryId: string;
  level: string;
}) {
  const name = sanitizeText(input.name, FIRESTORE_LIMITS.NAME_MAX);
  const region = sanitizeText(input.region, FIRESTORE_LIMITS.REGION_MAX);
  const representation = sanitizeText(
    input.representation,
    FIRESTORE_LIMITS.REPRESENTATION_MAX,
    'Retail Sales'
  );
  const level = sanitizeText(input.level, FIRESTORE_LIMITS.LEVEL_MAX, 'Open');
  const categoryId = assertValidId(input.categoryId, 'Kategori');

  if (!name) throw new Error('Nama peserta wajib diisi.');
  if (!region) throw new Error('Region peserta wajib diisi.');

  return { name, region, representation, categoryId, level };
}

export function sanitizeCourtInput(input: {
  name: string;
  surface: string;
  isIndoor: boolean;
}) {
  const name = sanitizeText(input.name, FIRESTORE_LIMITS.COURT_NAME_MAX);
  const surface = sanitizeText(
    input.surface,
    FIRESTORE_LIMITS.COURT_SURFACE_MAX,
    'Mondo Supercourt'
  );
  if (!name) throw new Error('Nama court wajib diisi.');
  return { name, surface, isIndoor: Boolean(input.isIndoor) };
}
