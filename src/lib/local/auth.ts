import { scryptSync, randomBytes, timingSafeEqual, createHmac, randomInt } from 'node:crypto'
import { pool } from './pool'

/** A cryptographically-random 6-digit OTP, as a zero-padded string. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

// Local auth — no Supabase. Postgres via node-postgres (Vercel/Neon-ready),
// password hashing via node:crypto (scrypt), stateless HMAC-signed tokens.

const SECRET = process.env.AUTH_SECRET || 'quickin-local-dev-secret-change-me'

// ---- Email validation + disposable-domain blocklist -------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Common disposable / temp-mail domains we refuse at signup, login and email change. */
const DISPOSABLE_DOMAINS = new Set([
  // Mailinator + family
  'mailinator.com', 'mailinator.net', 'mailinator2.com', 'reallymymail.com',
  // Guerrilla Mail + aliases
  'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.info',
  'guerrillamail.biz', 'guerrillamail.de', 'guerrillamailblock.com', 'sharklasers.com',
  'grr.la', 'spam4.me', 'pokemail.net',
  // 10 minute mail
  '10minutemail.com', '10minutemail.net', '10minutemail.org', '10minemail.com',
  // Temp-mail / tempmail family
  'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'temp-mail.com', 'tempmail.dev',
  'tempmail.net', 'tempmailo.com', 'tempmail.plus', 'tmpmail.org', 'tmpmail.net',
  'tmail.ws', 'tempinbox.com', 'tempr.email', 'temp-inbox.com', 'tempmailaddress.com',
  // Yopmail
  'yopmail.com', 'yopmail.net', 'yopmail.fr',
  // Throwaway
  'throwawaymail.com', 'throwaway.email', 'throwawayemailaddresses.com',
  // Nada / GetNada
  'getnada.com', 'nada.email',
  // Dispostable / Dispomail
  'dispostable.com', 'dispomail.eu',
  // Trashmail
  'trashmail.com', 'trashmail.de', 'trashmail.net', 'trashmail.org', 'trash-mail.com',
  // Maildrop / Mailnesia / Mailcatch / Maildim
  'maildrop.cc', 'mailnesia.com', 'mailcatch.com', 'mailpoof.com', 'mailnull.com',
  // Misc throwaways
  'fakeinbox.com', 'fakemail.net', 'mintemail.com', 'mohmal.com', 'emailondeck.com',
  'discard.email', 'moakt.com', 'inboxbear.com', 'harakirimail.com', 'byom.de',
  'anonbox.net', 'burnermail.io', 'einrot.com', 'mvrht.com', 'luxusmail.org',
  // 1secmail family
  '1secmail.com', '1secmail.net', '1secmail.org',
  // Other commonly-abused providers
  'getairmail.com', 'maileater.com', 'spambox.us', 'spamgourmet.com', 'mytemp.email',
  'tempemail.co', 'tempemails.io', 'mailtemp.net', 'inboxkitten.com', 'emailfake.com',
  'mailsac.com', 'mail.tm', 'mail7.io', 'wegwerfmail.de', 'wegwerfemail.de',
])

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(String(email).trim())
}

export function isDisposableEmail(email: string): boolean {
  const domain = String(email).trim().toLowerCase().split('@')[1]
  if (!domain) return false
  // Reject if the domain itself OR any parent domain is blocklisted, so a
  // subdomain (e.g. sub.mailinator.com) can't slip past the exact-match check.
  const labels = domain.split('.')
  for (let i = 0; i < labels.length - 1; i++) {
    if (DISPOSABLE_DOMAINS.has(labels.slice(i).join('.'))) return true
  }
  return false
}

// ---- In-memory rate limiter (per-process; good enough for this stack) --------

type Hit = { count: number; resetAt: number }
const _buckets = new Map<string, Hit>()

/**
 * Returns null when the action is allowed, or the seconds the caller must wait
 * once [key] exceeds [max] hits within [windowMs]. Best-effort, per-process.
 */
export function rateLimit(key: string, max: number, windowMs: number): number | null {
  const now = Date.now()
  const hit = _buckets.get(key)
  if (!hit || now >= hit.resetAt) {
    _buckets.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }
  if (hit.count >= max) return Math.ceil((hit.resetAt - now) / 1000)
  hit.count++
  return null
}

/** Best-effort client IP from proxy headers (Vercel/Next). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'local'
}

export interface User {
  id: string
  email: string
  full_name: string | null
  provider: string
  avatar_url: string | null
  is_host: boolean
  email_verified: boolean
}

// ---- Password hashing (scrypt) ----------------------------------------------
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(password, salt, 64)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// ---- Stateless HMAC token ----------------------------------------------------
const TOKEN_TTL_MS = 30 * 24 * 3600 * 1000 // 30 days

export function signToken(payload: { sub: string; email: string }): string {
  const now = Date.now()
  const body = Buffer.from(
    JSON.stringify({ ...payload, iat: now, exp: now + TOKEN_TTL_MS })
  ).toString('base64url')
  const sig = createHmac('sha256', SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyToken(token: string): { sub: string; email: string } | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  const expected = createHmac('sha256', SECRET).update(body).digest('base64url')
  if (sig !== expected) return null
  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (typeof claims.exp === 'number' && Date.now() > claims.exp) return null
    return claims
  } catch {
    return null
  }
}

/** Resolve the signed-in user from a request — Bearer header (mobile) or qk_token cookie (web). */
export async function getUserFromRequest(
  req: Request
): Promise<{ id: string; email: string } | null> {
  const auth = req.headers.get('authorization') || ''
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null
  const cookie = req.headers.get('cookie') || ''
  const m = cookie.match(/(?:^|;\s*)qk_token=([^;]+)/)
  const cookieToken = m ? decodeURIComponent(m[1]) : null
  const token = bearer || cookieToken
  if (!token) return null
  const claims = verifyToken(token)
  if (!claims) return null
  const row = await getUserRowByEmail(claims.email)
  return row ? { id: row.id, email: row.email } : null
}

// ---- User operations (parameterized pg) -------------------------------------
// NB: deliberately excludes is_host so INSERT…RETURNING keeps working even before
// the is_host migration has run. getUserRowByEmail resolves is_host separately
// (tolerantly), and the create/upsert helpers default new accounts to is_host:false.
const USER_COLS = `id, email, full_name, provider, avatar_url`

export async function getUserRowByEmail(
  email: string
): Promise<{ id: string; email: string; password_hash: string | null; full_name: string | null; provider: string; avatar_url: string | null; is_host: boolean; email_verified: boolean } | null> {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, password_hash, full_name, provider, avatar_url,
              COALESCE(is_host, false) AS is_host, COALESCE(email_verified, false) AS email_verified
       FROM users WHERE lower(email) = lower($1)`,
      [email]
    )
    return rows[0] ?? null
  } catch {
    // is_host / email_verified may not exist yet (pre-migration window) — degrade
    // gracefully so auth keeps working. Treat as a verified guest until migrated
    // (defaulting email_verified to true here avoids locking anyone out mid-deploy).
    const { rows } = await pool.query(
      `SELECT id, email, password_hash, full_name, provider, avatar_url, false AS is_host, true AS email_verified
       FROM users WHERE lower(email) = lower($1)`,
      [email]
    )
    return rows[0] ?? null
  }
}

/** Client-facing user shape (web + mobile). One unified account: `is_host` is a
 *  capability flag, and `role` is derived from it for backward-compatible clients. */
export function publicUser(row: {
  id: string; email: string; full_name: string | null; provider: string; avatar_url: string | null; is_host?: boolean | null; email_verified?: boolean | null
}): User & { role: 'host' | 'guest' } {
  const is_host = !!row.is_host
  return {
    id: row.id, email: row.email, full_name: row.full_name,
    provider: row.provider, avatar_url: row.avatar_url, is_host,
    email_verified: !!row.email_verified,
    role: is_host ? 'host' : 'guest',
  }
}

// ---- Host state (authoritative, server-derived) ------------------------------

/** The four states every client renders. `approved` is driven by users.is_host. */
export type HostStatus = 'none' | 'pending' | 'rejected' | 'approved'

export interface HostState {
  host_type: string | null
  host_status: HostStatus
  host_review_note: string | null
}

/**
 * Resolve a user's host state from the database — the single source of truth the
 * clients read on every launch (never a cached local flag).
 *
 * `approved` follows `users.is_host`, NOT the application row, so pre-existing
 * hosts (is_host=true with no application) keep working. One tolerant query: on a
 * pre-migration DB (no host_type / host_applications) it degrades to is_host alone
 * rather than failing the session.
 */
export async function getHostState(userId: string, isHost: boolean): Promise<HostState> {
  const fallback: HostState = { host_type: null, host_status: isHost ? 'approved' : 'none', host_review_note: null }
  try {
    const { rows } = await pool.query(
      `SELECT u.host_type, a.status AS app_status, a.review_note
         FROM users u LEFT JOIN host_applications a ON a.user_id = u.id
        WHERE u.id = $1`,
      [userId]
    )
    const row = rows[0] as { host_type: string | null; app_status: string | null; review_note: string | null } | undefined
    if (!row) return fallback
    const host_type = row.host_type ?? null
    // Legacy rule first: is_host = true ⇒ approved, whatever the application says.
    if (isHost) return { host_type, host_status: 'approved', host_review_note: null }
    if (row.app_status === 'pending') return { host_type, host_status: 'pending', host_review_note: null }
    if (row.app_status === 'rejected') return { host_type, host_status: 'rejected', host_review_note: row.review_note ?? null }
    // An 'approved' row without is_host means the flip never landed — show the
    // apply CTA so the applicant can recover instead of a fake host state.
    return { host_type, host_status: 'none', host_review_note: null }
  } catch {
    return fallback
  }
}

/** publicUser + the host fields every client reads on launch / session restore. */
export async function publicUserWithHost(row: {
  id: string; email: string; full_name: string | null; provider: string; avatar_url: string | null; is_host?: boolean | null; email_verified?: boolean | null
}): Promise<User & { role: 'host' | 'guest' } & HostState> {
  const user = publicUser(row)
  return { ...user, ...(await getHostState(user.id, user.is_host)) }
}

// NB: there is deliberately no "promote me to host" helper here. Host is granted
// only by an admin decision — `reviewHostApplication` / `adminSetHost` in db.ts.

/** Shared-secret check for the local-stack admin (host-application + ID review).
 *  Configure ADMIN_OPS_KEY in the environment; falls back to a dev default. */
export function isAdminKey(key: string | null | undefined): boolean {
  const expected = process.env.ADMIN_OPS_KEY || 'QuickInAdmin2026'
  return typeof key === 'string' && key.length > 0 && key === expected
}

export async function createUser(args: {
  email: string
  passwordHash: string
  fullName: string
}): Promise<User> {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, provider)
     VALUES ($1, $2, $3, 'email')
     RETURNING ${USER_COLS}`,
    [args.email, args.passwordHash, args.fullName]
  )
  if (!rows[0]) throw new Error('Failed to create user')
  // New email accounts start unverified — they must confirm the OTP.
  return { ...rows[0], is_host: false, email_verified: false } as User
}

/** Upsert a social (google/apple) user. */
export async function upsertSocialUser(args: {
  email: string
  fullName: string
  provider: 'google' | 'apple'
  avatarUrl?: string
}): Promise<User> {
  // Manual upsert by case-insensitive email — robust whether or not a unique
  // index on lower(email) exists (avoids ON CONFLICT constraint-matching errors).
  const existing = await pool.query(
    `SELECT ${USER_COLS} FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [args.email]
  )
  if (existing.rows[0]) {
    const cur = existing.rows[0]
    await pool.query(
      `UPDATE users
         SET full_name = COALESCE(full_name, $2),
             avatar_url = COALESCE($3, avatar_url),
             email_verified = true
       WHERE id = $1`,
      [cur.id, args.fullName, args.avatarUrl || null]
    )
    // Re-resolve through the tolerant lookup so a returning social host keeps is_host.
    const fresh = await getUserRowByEmail(args.email)
    return (fresh
      ? { id: fresh.id, email: fresh.email, full_name: fresh.full_name, provider: fresh.provider, avatar_url: fresh.avatar_url, is_host: fresh.is_host, email_verified: true }
      : { ...cur, is_host: false, email_verified: true }) as User
  }
  const { rows } = await pool.query(
    `INSERT INTO users (email, full_name, provider, avatar_url, email_verified)
     VALUES ($1, $2, $3, $4, true)
     RETURNING ${USER_COLS}`,
    [args.email, args.fullName, args.provider, args.avatarUrl || null]
  )
  if (!rows[0]) throw new Error('Failed to upsert social user')
  return { ...rows[0], is_host: false, email_verified: true } as User
}

/** Replace a user's password with a fresh scrypt hash. */
export async function updatePassword(userId: string, newPassword: string): Promise<void> {
  const hash = hashPassword(newPassword)
  await pool.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [userId, hash])
}
