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
const USER_COLS = `id, email, full_name, provider, avatar_url`

export async function getUserRowByEmail(
  email: string
): Promise<{ id: string; email: string; password_hash: string | null; full_name: string | null; provider: string; avatar_url: string | null } | null> {
  const { rows } = await pool.query(
    `SELECT id, email, password_hash, full_name, provider, avatar_url
     FROM users WHERE lower(email) = lower($1)`,
    [email]
  )
  return rows[0] ?? null
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
  return rows[0] as User
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
    const cur = existing.rows[0] as User
    const { rows } = await pool.query(
      `UPDATE users
         SET full_name = COALESCE(full_name, $2),
             avatar_url = COALESCE($3, avatar_url)
       WHERE id = $1
       RETURNING ${USER_COLS}`,
      [cur.id, args.fullName, args.avatarUrl || null]
    )
    return (rows[0] || cur) as User
  }
  const { rows } = await pool.query(
    `INSERT INTO users (email, full_name, provider, avatar_url)
     VALUES ($1, $2, $3, $4)
     RETURNING ${USER_COLS}`,
    [args.email, args.fullName, args.provider, args.avatarUrl || null]
  )
  if (!rows[0]) throw new Error('Failed to upsert social user')
  return rows[0] as User
}

/** Replace a user's password with a fresh scrypt hash. */
export async function updatePassword(userId: string, newPassword: string): Promise<void> {
  const hash = hashPassword(newPassword)
  await pool.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [userId, hash])
}
