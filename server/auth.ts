import crypto from 'node:crypto';
import type express from 'express';
import type { ServerSecrets } from './store.ts';

const EPHEMERAL_SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_AUTH_ATTEMPTS = 15;
const AUTH_WINDOW_MS = 5 * 60 * 1000;

const revokedTokenIds = new Set<string>();
const failedAttemptsByIp = new Map<string, { count: number; resetAt: number }>();

export interface AdminTokenPayload {
  sub: string;
  role: 'admin';
  jti: string;
  iat: number;
  exp: number;
}

export interface AuthConfigState {
  mode: 'env' | 'claimed' | 'unconfigured';
  needsSetup: boolean;
  envConfigured: boolean;
  username: string;
  passwordHash?: string;
}

export interface AuthenticatedRequest extends express.Request {
  admin?: {
    username: string;
    jti: string;
  };
}

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  return envSecret && envSecret.length >= 16 ? envSecret : EPHEMERAL_SESSION_SECRET;
}

export function safeEqualStrings(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function getAuthConfigState(secrets?: ServerSecrets): AuthConfigState {
  const envPassword = process.env.ADMIN_PASSWORD?.trim() || '';
  const envUsername = process.env.ADMIN_USERNAME?.trim() || 'admin';

  if (envPassword.length > 0) {
    return {
      mode: 'env',
      needsSetup: false,
      envConfigured: true,
      username: envUsername,
    };
  }

  if (secrets?.adminPasswordHash) {
    return {
      mode: 'claimed',
      needsSetup: false,
      envConfigured: false,
      username: secrets.adminUsername || envUsername,
      passwordHash: secrets.adminPasswordHash,
    };
  }

  return {
    mode: 'unconfigured',
    needsSetup: true,
    envConfigured: false,
    username: envUsername,
  };
}

export function verifyAdminCredentials(
  usernameInput: string,
  passwordInput: string,
  secrets?: ServerSecrets
): { ok: boolean; username: string; reason?: 'needs_setup' | 'invalid_credentials' } {
  const cfg = getAuthConfigState(secrets);
  if (cfg.mode === 'unconfigured') {
    return { ok: false, username: cfg.username, reason: 'needs_setup' };
  }

  const normalizedInputUser = usernameInput.trim().toLowerCase();
  const expectedUser = cfg.username.trim().toLowerCase();
  if (!normalizedInputUser || !safeEqualStrings(normalizedInputUser, expectedUser)) {
    return { ok: false, username: cfg.username, reason: 'invalid_credentials' };
  }

  if (cfg.mode === 'env') {
    const envPassword = process.env.ADMIN_PASSWORD?.trim() || '';
    const match = safeEqualStrings(passwordInput, envPassword);
    return match
      ? { ok: true, username: cfg.username }
      : { ok: false, username: cfg.username, reason: 'invalid_credentials' };
  }

  const match = cfg.passwordHash ? verifyPassword(passwordInput, cfg.passwordHash) : false;
  return match
    ? { ok: true, username: cfg.username }
    : { ok: false, username: cfg.username, reason: 'invalid_credentials' };
}

export function createAdminToken(username: string, ttlMs = TOKEN_TTL_MS): string {
  const now = Date.now();
  const payload: AdminTokenPayload = {
    sub: username,
    role: 'admin',
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + ttlMs,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');

  if (!safeEqualStrings(signature, expectedSig)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as AdminTokenPayload;
    if (
      !parsed ||
      parsed.role !== 'admin' ||
      typeof parsed.sub !== 'string' ||
      typeof parsed.jti !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (parsed.exp <= Date.now()) return null;
    if (revokedTokenIds.has(parsed.jti)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function revokeAdminToken(token: string): void {
  const payload = verifyAdminToken(token);
  if (payload) {
    revokedTokenIds.add(payload.jti);
  }
}

export function extractBearerToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match?.[1]?.trim() || null;
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
): void {
  const token = extractBearerToken(req);
  const payload = token ? verifyAdminToken(token) : null;
  if (!payload) {
    res.status(401).json({
      error: 'Akses ditolak. Silakan login sebagai Admin terlebih dahulu.',
    });
    return;
  }
  req.admin = { username: payload.sub, jti: payload.jti };
  next();
}

export function isRateLimited(ipKey: string): boolean {
  const now = Date.now();
  const entry = failedAttemptsByIp.get(ipKey);
  if (!entry) return false;
  if (entry.resetAt <= now) {
    failedAttemptsByIp.delete(ipKey);
    return false;
  }
  return entry.count >= MAX_AUTH_ATTEMPTS;
}

export function recordFailedAuthAttempt(ipKey: string): void {
  const now = Date.now();
  const entry = failedAttemptsByIp.get(ipKey);
  if (!entry || entry.resetAt <= now) {
    failedAttemptsByIp.set(ipKey, { count: 1, resetAt: now + AUTH_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearFailedAuthAttempts(ipKey: string): void {
  failedAttemptsByIp.delete(ipKey);
}
