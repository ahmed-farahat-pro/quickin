import { pool } from './pool'

// Data access via node-postgres (parameterized queries). Works locally and on
// Vercel/Neon. No Supabase, no psql CLI.

const isUuid = (s: string) => /^[0-9a-fA-F-]{36}$/.test(s)
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

/** Accept http(s) image URLs or inline base64 image data URLs (device uploads). */
const isImageSrc = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  const v = value.trim()
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(v)) return true
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export interface ListingImage {
  url: string
  order: number
}

export interface Listing {
  id: string
  title: string
  description: string | null
  location: string | null
  country: string | null
  price_per_night: number
  weekend_price: number | null
  weekend_days: number[] | null
  currency: string
  bedrooms: number | null
  beds: number | null
  bathrooms: number | null
  max_guests: number | null
  property_type: string | null
  is_guest_favorite: boolean
  listing_code: string | null
  lat: number | null
  lng: number | null
  listing_images: ListingImage[]
  host_id?: string | null
  host_name?: string | null
  host_avatar?: string | null
  host_type?: string | null
  host_company?: string | null
  image_url?: string | null
}

export interface SearchFilters {
  location?: string
  guests?: number
  checkIn?: string
  checkOut?: string
  type?: string
}

export interface Booking {
  id: string
  listing_id: string
  check_in: string
  check_out: string
  guests: number
  total_price: number
  status: string
  payment_status: 'paid' | 'unpaid'
  paid_at: string | null
  created_at: string
  title: string
  location: string | null
  currency: string
  image: string | null
}

const LISTING_COLS = `
  l.id, l.title, l.description, l.location, l.country,
  l.price_per_night::float8 AS price_per_night,
  l.weekend_price::float8 AS weekend_price, l.weekend_days,
  l.currency,
  l.bedrooms, l.beds, l.bathrooms, l.max_guests, l.property_type,
  l.is_guest_favorite, l.listing_code, l.lat::float8 AS lat, l.lng::float8 AS lng,
  COALESCE(
    (SELECT json_agg(json_build_object('url', li.url, 'order', li."order") ORDER BY li."order")
     FROM listing_images li WHERE li.listing_id = l.id), '[]'
  ) AS listing_images
`

export async function getListings(filters: SearchFilters = {}): Promise<Listing[]> {
  const where: string[] = ['l.is_published = true']
  const params: unknown[] = []

  if (filters.location && filters.location.trim()) {
    params.push('%' + filters.location.trim() + '%')
    where.push(`l.location ILIKE $${params.length}`)
  }
  if (filters.type && filters.type.trim()) {
    params.push(filters.type.trim())
    where.push(`lower(l.property_type) = lower($${params.length})`)
  }
  // Clamp guests to a sane range so a non-finite / absurd value (e.g. an
  // integer-overflow string) can't reach Postgres and blow up the int comparison.
  if (filters.guests != null && Number.isFinite(filters.guests) && filters.guests > 0) {
    const guests = Math.min(100, Math.max(1, Math.floor(filters.guests)))
    params.push(guests)
    where.push(`COALESCE(l.max_guests, 0) >= $${params.length}`)
  }
  if (filters.checkIn && filters.checkOut && isDate(filters.checkIn) && isDate(filters.checkOut)) {
    params.push(filters.checkOut)
    const a = params.length
    params.push(filters.checkIn)
    const b = params.length
    where.push(`NOT EXISTS (
      SELECT 1 FROM bookings bk
      WHERE bk.listing_id = l.id AND bk.status <> 'cancelled'
        AND bk.check_in < $${a} AND bk.check_out > $${b}
    )`)
  }

  const { rows } = await pool.query(
    `SELECT ${LISTING_COLS} FROM listings l
     WHERE ${where.join(' AND ')}
     ORDER BY l.is_guest_favorite DESC, l.created_at DESC`,
    params
  )
  return rows as Listing[]
}

export async function getListingById(id: string): Promise<Listing | null> {
  if (!isUuid(id)) return null
  const { rows } = await pool.query(
    `SELECT ${LISTING_COLS}, l.host_id, u.full_name AS host_name, u.avatar_url AS host_avatar,
            u.host_type AS host_type, u.company AS host_company
       FROM listings l LEFT JOIN users u ON u.id = l.host_id WHERE l.id = $1`,
    [id]
  )
  return (rows[0] as Listing) ?? null
}

// ---- Bookings ---------------------------------------------------------------

const BOOKING_COLS = `
  b.id, b.listing_id,
  to_char(b.check_in, 'YYYY-MM-DD') AS check_in,
  to_char(b.check_out, 'YYYY-MM-DD') AS check_out,
  b.guests, b.adults, b.children, b.infants, b.pets,
  b.total_price::float8 AS total_price, b.status,
  CASE WHEN b.paid_at IS NULL THEN 'unpaid' ELSE 'paid' END AS payment_status,
  to_char(b.paid_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS paid_at,
  to_char(b.cancelled_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS cancelled_at,
  b.refund_percent, b.host_notes,
  'QK-' || upper(substr(b.id::text, 1, 8)) AS reservation_code,
  to_char(b.created_at, 'YYYY-MM-DD') AS created_at,
  l.title, l.location, COALESCE(l.currency, 'USD') AS currency,
  (SELECT url FROM listing_images li WHERE li.listing_id = l.id ORDER BY li."order" LIMIT 1) AS image
`

export interface CreateBookingInput {
  listingId: string
  userId: string
  checkIn: string
  checkOut: string
  guests: number
  adults?: number
  children?: number
  infants?: number
  pets?: number
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const { listingId, userId, checkIn, checkOut, guests } = input
  if (!isUuid(listingId) || !isUuid(userId)) throw new Error('Invalid id')
  if (!isDate(checkIn) || !isDate(checkOut)) throw new Error('Invalid dates (use YYYY-MM-DD)')
  // No bookings that start in the past. ISO dates compare correctly as strings.
  const today = new Date().toISOString().slice(0, 10)
  if (checkIn < today) throw new Error('Check-in cannot be in the past')
  if (checkOut <= checkIn) throw new Error('Check-out must be after check-in')
  const nn = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0))
  // Adults + children = the headcount. Infants and pets don't count toward it.
  const adults = Math.max(1, nn(input.adults ?? guests))
  const children = nn(input.children)
  const infants = nn(input.infants)
  const pets = nn(input.pets)
  const g = Math.max(1, adults + children)

  // Load the listing (for max_guests / title / host_id) and enforce capacity.
  const { rows: lrows } = await pool.query(
    `SELECT title, max_guests, host_id FROM listings WHERE id = $1`,
    [listingId]
  )
  const listing = lrows[0] as { title: string; max_guests: number | null; host_id: string | null } | undefined
  if (!listing) throw new Error('Could not create booking (listing not found)')
  if (listing.max_guests != null && g > listing.max_guests) {
    throw new Error('Exceeds the maximum guests for this listing')
  }

  const clash = await pool.query(
    `SELECT 1 FROM bookings
     WHERE listing_id = $1 AND status NOT IN ('cancelled', 'rejected')
       AND check_in < $2 AND check_out > $3 LIMIT 1`,
    [listingId, checkOut, checkIn]
  )
  if (clash.rowCount && clash.rowCount > 0) throw new Error('Those dates are not available')

  // Total = sum over each night in [check_in, check_out). A night whose weekday
  // (Postgres DOW: 0=Sun … 6=Sat) is in the listing's weekend_days is charged
  // weekend_price; otherwise price_per_night. Falls back to nights × nightly
  // when no weekend price is configured.
  const { rows } = await pool.query(
    `WITH ins AS (
       INSERT INTO bookings (listing_id, user_id, check_in, check_out, guests, adults, children, infants, pets, total_price, status)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9,
              (SELECT COALESCE(SUM(
                 CASE WHEN l.weekend_price IS NOT NULL AND l.weekend_days IS NOT NULL
                           AND EXTRACT(DOW FROM gs)::int = ANY(l.weekend_days)
                      THEN l.weekend_price ELSE l.price_per_night END
               ), 0)
               FROM generate_series($3::date, $4::date - interval '1 day', interval '1 day') AS gs),
              'pending'
       FROM listings l WHERE l.id = $1
       RETURNING *
     )
     SELECT ${BOOKING_COLS} FROM ins b JOIN listings l ON l.id = b.listing_id`,
    [listingId, userId, checkIn, checkOut, g, adults, children, infants, pets]
  )
  if (!rows[0]) throw new Error('Could not create booking (listing not found)')
  // Notify the listing host of a new reservation request (if the listing has an owner).
  if (listing.host_id && isUuid(listing.host_id)) {
    await createNotification(
      listing.host_id, 'booking', 'New reservation request',
      `New request for ${listing.title} (${checkIn} -> ${checkOut})`, '/host'
    )
  }
  return rows[0] as Booking
}

// ---- Cancellation (guest) — default "moderate" policy -----------------------

export interface CancellationQuote {
  policy: string
  daysUntilCheckIn: number
  refundPercent: number
  refundAmount: number
  total: number
  currency: string
}

/** Moderate policy: full refund ≥7 days out, half 1–6 days out, none within a day / past. */
function moderateRefundPercent(daysUntilCheckIn: number): number {
  if (daysUntilCheckIn >= 7) return 100
  if (daysUntilCheckIn >= 1) return 50
  return 0
}

async function loadCancelable(userId: string, bookingId: string) {
  const { rows } = await pool.query(
    `SELECT b.status, b.total_price::float8 AS total, COALESCE(l.currency,'EGP') AS currency,
            (b.check_in - CURRENT_DATE)::int AS days_until
       FROM bookings b JOIN listings l ON l.id = b.listing_id
      WHERE b.id = $1 AND b.user_id = $2`,
    [bookingId, userId]
  )
  return rows[0] as { status: string; total: number; currency: string; days_until: number } | undefined
}

export async function getCancellationQuote(userId: string, bookingId: string): Promise<CancellationQuote> {
  if (!isUuid(bookingId)) throw new Error('Invalid booking')
  const b = await loadCancelable(userId, bookingId)
  if (!b) throw new Error('Booking not found')
  const percent = b.status === 'cancelled' ? 0 : moderateRefundPercent(b.days_until)
  return {
    policy: 'moderate',
    daysUntilCheckIn: b.days_until,
    refundPercent: percent,
    refundAmount: Math.round(b.total * percent) / 100,
    total: b.total,
    currency: b.currency,
  }
}

export async function cancelBooking(
  userId: string,
  bookingId: string
): Promise<{ booking: Booking; refund: { refundPercent: number; refundAmount: number; currency: string } }> {
  if (!isUuid(bookingId)) throw new Error('Invalid booking')
  const b = await loadCancelable(userId, bookingId)
  if (!b) throw new Error('Booking not found')
  if (b.status === 'cancelled') throw new Error('This booking is already cancelled')
  const percent = moderateRefundPercent(b.days_until)
  const { rows } = await pool.query(
    `WITH upd AS (
       UPDATE bookings SET status = 'cancelled', cancelled_at = now(), refund_percent = $3
        WHERE id = $1 AND user_id = $2 RETURNING *
     )
     SELECT ${BOOKING_COLS} FROM upd b JOIN listings l ON l.id = b.listing_id`,
    [bookingId, userId, percent]
  )
  if (!rows[0]) throw new Error('Could not cancel booking')
  return {
    booking: rows[0] as Booking,
    refund: { refundPercent: percent, refundAmount: Math.round(b.total * percent) / 100, currency: b.currency },
  }
}

// ---- Mock payment (keeps the booking 'pending' awaiting host approval) ------

export interface PaymentReceipt {
  currency: string; nights: number; nightly: number; subtotal: number
  serviceFee: number; methodFee: number; total: number; reference: string
  paidAt: string; method: string; promoCode: string | null; promoDiscount: number
}

/** Records a mock payment. Only allowed once the host has APPROVED the request
 *  (status 'confirmed'); a pending reservation can't be paid yet. Payment doesn't
 *  change the status — it sets paid_at, so an approved booking becomes "confirmed & paid". */
export async function payBooking(args: {
  userId: string; bookingId: string; method?: string; promoCode?: string | null
}): Promise<{ booking: Booking; receipt: PaymentReceipt }> {
  const { userId, bookingId } = args
  const method = args.method === 'bank_transfer' ? 'bank_transfer' : 'card'
  if (!isUuid(bookingId)) throw new Error('Invalid booking')
  const { rows: br } = await pool.query(
    `SELECT b.status, b.total_price::float8 AS total, (b.check_out - b.check_in)::int AS nights,
            l.price_per_night::float8 AS nightly, COALESCE(l.currency,'EGP') AS currency
       FROM bookings b JOIN listings l ON l.id = b.listing_id
      WHERE b.id = $1 AND b.user_id = $2`,
    [bookingId, userId]
  )
  const b = br[0]
  if (!b) throw new Error('Booking not found')
  if (b.status === 'cancelled' || b.status === 'rejected') throw new Error('This booking can no longer be paid')
  if (b.status === 'pending') throw new Error('This reservation is awaiting host approval — you can pay once it is approved')
  if (b.status !== 'confirmed') throw new Error('This reservation cannot be paid')
  const { rows } = await pool.query(
    `WITH upd AS (
       UPDATE bookings SET paid_at = COALESCE(paid_at, now()) WHERE id = $1 AND user_id = $2 RETURNING *
     )
     SELECT ${BOOKING_COLS} FROM upd b JOIN listings l ON l.id = b.listing_id`,
    [bookingId, userId]
  )
  const subtotal = Math.round(b.total)
  const methodFee = method === 'card' ? Math.round(subtotal * 0.05) : -Math.round(subtotal * 0.05)
  const receipt: PaymentReceipt = {
    currency: b.currency, nights: b.nights, nightly: Math.round(b.nightly),
    subtotal, serviceFee: 0, methodFee, total: subtotal + methodFee,
    reference: 'QK-' + bookingId.slice(0, 8).toUpperCase(),
    paidAt: (rows[0] as { paid_at?: string }).paid_at || new Date().toISOString(),
    method, promoCode: null, promoDiscount: 0,
  }
  return { booking: rows[0] as Booking, receipt }
}

// ---- Notifications ----------------------------------------------------------

export async function createNotification(
  userId: string, type: string, title: string, body?: string | null, link?: string | null
): Promise<void> {
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, title, body ?? null, link ?? null]
  )
}

export async function getNotifications(userId: string): Promise<{ notifications: unknown[]; unreadCount: number }> {
  if (!isUuid(userId)) return { notifications: [], unreadCount: 0 }
  const { rows } = await pool.query(
    `SELECT id, type, title, body, link, read,
            to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [userId]
  )
  return { notifications: rows, unreadCount: rows.filter((r) => !r.read).length }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!isUuid(userId)) return
  await pool.query(`UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`, [userId])
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  if (!isUuid(userId) || !isUuid(id)) return
  await pool.query(`UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2`, [id, userId])
}

export async function registerPushToken(userId: string, fcmToken: string, platform: string): Promise<void> {
  if (!isUuid(userId) || !fcmToken) return
  await pool.query(`UPDATE users SET fcm_token = $2, push_platform = $3 WHERE id = $1`, [userId, fcmToken, platform || null])
}

// ---- Single booking + host notes / status patch -----------------------------

export async function getBookingById(userId: string, bookingId: string): Promise<Booking | null> {
  if (!isUuid(bookingId) || !isUuid(userId)) return null
  const { rows } = await pool.query(
    `SELECT ${BOOKING_COLS} FROM bookings b JOIN listings l ON l.id = b.listing_id
      WHERE b.id = $1 AND b.user_id = $2`,
    [bookingId, userId]
  )
  return (rows[0] as Booking) ?? null
}

/** Host actions on a single reservation: set host_notes and/or decide status.
 *  Authorization: this endpoint is HOST-ONLY — the caller must own the booking's
 *  listing (listings.host_id === callerId). Guests manage their own reservations
 *  via cancelBooking()/payBooking(), which scope by user_id.
 *  Status is a strict allowlist: 'confirm'→'confirmed', 'reject'→'rejected', and
 *  only from a 'pending' reservation. Any other value is rejected (no raw writes).
 *  Returns the updated booking, or null if the booking does not exist. */
const BOOKING_STATUS_ACTIONS: Record<string, 'confirmed' | 'rejected'> = {
  confirm: 'confirmed',
  reject: 'rejected',
}

export async function patchBooking(
  callerId: string,
  bookingId: string,
  hostNotes: string | null | undefined,
  status: string | null | undefined
): Promise<Booking | null> {
  if (!isUuid(callerId)) throw new Error('Invalid caller')
  if (!isUuid(bookingId)) throw new Error('Invalid booking')

  // Always load the booking + its listing's owner and enforce authorization for
  // EVERY call (reads included), so this endpoint can never read or mutate
  // another user's reservation. This closes the IDOR.
  const { rows: orows } = await pool.query(
    `SELECT b.status AS current_status, l.host_id
       FROM bookings b JOIN listings l ON l.id = b.listing_id WHERE b.id = $1`,
    [bookingId]
  )
  const owner = orows[0] as { current_status: string; host_id: string | null } | undefined
  if (!owner) return null
  if (!owner.host_id || owner.host_id !== callerId) {
    throw new Error('Forbidden: only the listing host can update this reservation')
  }

  const sets: string[] = []
  const params: unknown[] = [bookingId]
  // host_notes is only touched when explicitly supplied (undefined = leave as-is),
  // so a status-only decision never clobbers existing notes.
  if (hostNotes !== undefined) { params.push(hostNotes); sets.push(`host_notes = $${params.length}`) }
  let newStatus: 'confirmed' | 'rejected' | null = null
  if (status !== undefined && status !== null && status !== '') {
    const mapped = BOOKING_STATUS_ACTIONS[status]
    if (!mapped) throw new Error('Invalid status (allowed actions: confirm, reject)')
    if (owner.current_status !== 'pending') {
      throw new Error('Invalid status transition: only a pending reservation can be confirmed or rejected')
    }
    newStatus = mapped
    params.push(newStatus); sets.push(`status = $${params.length}`)
  }
  const select = `SELECT ${BOOKING_COLS} FROM bookings b JOIN listings l ON l.id = b.listing_id WHERE b.id = $1`
  if (!sets.length) {
    const { rows } = await pool.query(select, [bookingId])
    return (rows[0] as Booking) ?? null
  }
  const { rows } = await pool.query(
    `WITH upd AS (UPDATE bookings SET ${sets.join(', ')} WHERE id = $1 RETURNING *)
     SELECT ${BOOKING_COLS}, b.user_id AS _uid FROM upd b JOIN listings l ON l.id = b.listing_id`,
    params
  )
  const row = rows[0] as (Booking & { _uid?: string; title?: string }) | undefined
  // Notify the guest when the host approves (prompt them to pay) or declines.
  if (row && row._uid && (newStatus === 'confirmed' || newStatus === 'rejected') && isUuid(row._uid)) {
    const title = row.title ?? 'your stay'
    if (newStatus === 'confirmed') {
      await createNotification(row._uid!, 'booking', 'Reservation approved',
        `Your reservation at ${title} was approved. Complete your payment to confirm your stay.`, '/reservations')
    } else {
      await createNotification(row._uid!, 'booking', 'Reservation declined',
        `Your reservation at ${title} was declined by the host.`, '/reservations')
    }
  }
  if (row) delete row._uid
  return (row as Booking) ?? null
}

// ---- Promo codes (mock) -----------------------------------------------------

const PROMO_CODES: Record<string, { kind: 'percent' | 'fixed'; value: number; message: string }> = {
  WELCOME10: { kind: 'percent', value: 10, message: '10% off your stay' },
  QUICKIN15: { kind: 'percent', value: 15, message: '15% off applied' },
  SAVE50:    { kind: 'fixed',   value: 50, message: 'EGP 50 off applied' },
}

export function quotePromo(codeRaw: string, subtotal: number): {
  valid: boolean; code: string; kind: string | null; value: number; discount: number; message: string
} {
  const code = String(codeRaw || '').trim().toUpperCase()
  const sub = Math.max(0, Math.round(Number(subtotal) || 0))
  const p = PROMO_CODES[code]
  if (!p) return { valid: false, code, kind: null, value: 0, discount: 0, message: 'Invalid or expired promo code' }
  const discount = p.kind === 'percent' ? Math.round((sub * p.value) / 100) : Math.min(p.value, sub)
  return { valid: true, code, kind: p.kind, value: p.value, discount, message: p.message }
}

// ---- Referrals --------------------------------------------------------------

/** A stable share code derived from the user id (no referral-tracking table yet). */
export async function getReferralSummary(
  userId: string
): Promise<{ code: string; count: number; rewardTotal: number; referred: unknown[] }> {
  if (!isUuid(userId)) return { code: '', count: 0, rewardTotal: 0, referred: [] }
  const code = 'QK-' + userId.replace(/-/g, '').slice(0, 6).toUpperCase()
  return { code, count: 0, rewardTotal: 0, referred: [] }
}

export async function getUserBookings(userId: string): Promise<Booking[]> {
  if (!isUuid(userId)) return []
  const { rows } = await pool.query(
    `SELECT ${BOOKING_COLS} FROM bookings b JOIN listings l ON l.id = b.listing_id
     WHERE b.user_id = $1 ORDER BY b.check_in DESC`,
    [userId]
  )
  return rows as Booking[]
}

export interface PublicUser {
  id: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

// ---- Email OTP codes --------------------------------------------------------

/** Store (or replace) the active 6-digit code for an email. */
export async function createOtpCode(email: string, code: string, ttlMinutes = 10): Promise<void> {
  await pool.query(
    `INSERT INTO otp_codes (email, code, expires_at, attempts)
     VALUES (lower($1), $2, now() + make_interval(mins => $3), 0)
     ON CONFLICT (email)
     DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at,
                   attempts = 0, created_at = now()`,
    [email, code, ttlMinutes]
  )
}

/** Flip an account to verified after a successful OTP check (the email gate). */
export async function markEmailVerified(email: string): Promise<void> {
  await pool.query(`UPDATE users SET email_verified = true WHERE lower(email) = lower($1)`, [email])
}

/** True if [code] matches the unexpired stored code (≤5 tries). Consumes it on success. */
export async function verifyOtpCode(email: string, code: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT code, expires_at, attempts FROM otp_codes WHERE email = lower($1)`,
    [email]
  )
  const row = rows[0]
  if (!row) return false
  if (new Date(row.expires_at).getTime() < Date.now()) return false
  if (row.attempts >= 5) return false
  if (String(row.code) !== String(code).trim()) {
    await pool.query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE email = lower($1)`, [email])
    return false
  }
  await pool.query(`DELETE FROM otp_codes WHERE email = lower($1)`, [email])
  return true
}

export async function getUserById(userId: string): Promise<PublicUser | null> {
  if (!isUuid(userId)) return null
  const { rows } = await pool.query(
    `SELECT id, full_name, avatar_url, created_at FROM users WHERE id = $1`,
    [userId]
  )
  return rows[0] ?? null
}

// ---- ID verification --------------------------------------------------------

export interface VerificationRow {
  status: string                 // unverified | pending | verified | rejected
  id_number: string | null
  full_name: string | null
  notes: string | null
  submitted_at: string | null
  reviewed_at: string | null
}

const UNVERIFIED: VerificationRow = {
  status: 'unverified', id_number: null, full_name: null,
  notes: null, submitted_at: null, reviewed_at: null,
}

/** Latest verification submission for a user, or 'unverified' if none. */
export async function getVerification(userId: string): Promise<VerificationRow> {
  if (!isUuid(userId)) return UNVERIFIED
  const { rows } = await pool.query(
    `SELECT status, id_number, full_name, notes, submitted_at, reviewed_at
       FROM id_verifications WHERE user_id = $1
      ORDER BY submitted_at DESC LIMIT 1`,
    [userId]
  )
  return (rows[0] as VerificationRow) ?? UNVERIFIED
}

/** Submit ID photos (front + optional back + selfie) for review — reuses the user's pending row if one exists. */
export async function submitVerification(args: {
  userId: string
  imageData: string
  backImageData?: string | null
  selfieImageData?: string | null
  idNumber?: string | null
  fullName?: string | null
  source?: string
}): Promise<VerificationRow> {
  const { userId, imageData, backImageData = null, selfieImageData = null, idNumber = null, fullName = null, source = 'manual' } = args
  const existing = await pool.query(
    `SELECT id FROM id_verifications WHERE user_id = $1 AND status = 'pending' LIMIT 1`,
    [userId]
  )
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE id_verifications
          SET image_data = $2, back_image_data = $3, selfie_image_data = $4,
              id_number = COALESCE($5, id_number),
              full_name = COALESCE($6, full_name), source = $7,
              submitted_at = now(), reviewed_at = NULL, reviewed_by = NULL, notes = NULL
        WHERE id = $1`,
      [existing.rows[0].id, imageData, backImageData, selfieImageData, idNumber, fullName, source]
    )
  } else {
    await pool.query(
      `INSERT INTO id_verifications (user_id, image_data, back_image_data, selfie_image_data, id_number, full_name, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, imageData, backImageData, selfieImageData, idNumber, fullName, source]
    )
  }
  return getVerification(userId)
}

// ---- Reviews (guest → listing, "rate the place") ----------------------------

export interface Review {
  rating: number
  comment: string | null
  reviewer_name: string | null
  created_at: string
  photos: string[]
}

/** Public, newest-first reviews for a listing. */
export async function getListingReviews(listingId: string): Promise<Review[]> {
  if (!isUuid(listingId)) return []
  const { rows } = await pool.query(
    `SELECT r.rating, r.comment, u.full_name AS reviewer_name,
            to_char(r.created_at, 'YYYY-MM-DD') AS created_at, r.photos
       FROM reviews r JOIN users u ON u.id = r.reviewer_id
      WHERE r.listing_id = $1
      ORDER BY r.created_at DESC`,
    [listingId]
  )
  return rows.map((r) => ({ ...r, photos: Array.isArray(r.photos) ? r.photos : [] })) as Review[]
}

export interface ReviewableStay {
  booking_id: string
  listing_id: string
  title: string
  location: string | null
  image: string | null
  check_in: string
  check_out: string
}

/** Stays the user may review: their confirmed bookings, past check-out, not yet reviewed. */
export async function getReviewableStays(userId: string): Promise<ReviewableStay[]> {
  if (!isUuid(userId)) return []
  const { rows } = await pool.query(
    `SELECT b.id AS booking_id, b.listing_id, l.title, l.location,
            (SELECT url FROM listing_images li WHERE li.listing_id = l.id ORDER BY "order" LIMIT 1) AS image,
            to_char(b.check_in,'YYYY-MM-DD')  AS check_in,
            to_char(b.check_out,'YYYY-MM-DD') AS check_out
       FROM bookings b JOIN listings l ON l.id = b.listing_id
      WHERE b.user_id = $1 AND b.status = 'confirmed' AND b.check_out < CURRENT_DATE
        AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id AND r.reviewer_id = $1)
      ORDER BY b.check_out DESC`,
    [userId]
  )
  return rows as ReviewableStay[]
}

/** Submit (or update) a guest's review of the place. Requires a past, confirmed, owned booking. */
export async function submitReview(args: {
  userId: string
  bookingId: string
  rating: number
  comment?: string | null
  photos?: string[]
}): Promise<void> {
  const { userId, bookingId, rating, comment = null, photos = [] } = args
  if (!isUuid(bookingId)) throw new Error('Invalid booking')
  const r = Math.max(1, Math.min(5, Math.round(rating)))
  const { rows } = await pool.query(
    `SELECT listing_id FROM bookings
      WHERE id = $1 AND user_id = $2 AND status = 'confirmed' AND check_out < CURRENT_DATE`,
    [bookingId, userId]
  )
  if (!rows[0]) throw new Error('This stay is not eligible for a review yet')
  const listingId = rows[0].listing_id
  // reviews.photos is a Postgres text[] (not jsonb) on the live DB — pass the JS
  // array directly so node-postgres maps it to a text[] (no ::jsonb cast).
  const photosArr = (photos || []).slice(0, 6)
  // Manual upsert (no ON CONFLICT) so a missing/late UNIQUE(booking_id,reviewer_id)
  // constraint on the live DB can't 500 the write — the eligibility guard above
  // already restricts this to one booking per reviewer.
  const upd = await pool.query(
    `UPDATE reviews SET rating = $3, comment = $4, photos = $5, created_at = now()
      WHERE booking_id = $1 AND reviewer_id = $2 RETURNING id`,
    [bookingId, userId, r, comment, photosArr]
  )
  if (!upd.rows[0]) {
    await pool.query(
      `INSERT INTO reviews (booking_id, listing_id, reviewer_id, rating, comment, photos)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [bookingId, listingId, userId, r, comment, photosArr]
    )
  }
}

// ---- Guest reviews (host → guest). Listings carry no owner, so "reviewable
// guests" can't be derived; the endpoints exist so clients don't 404. ---------

export interface GuestReview {
  id: string
  booking_id: string | null
  guest_id: string | null
  host_id: string | null
  rating: number
  comment: string | null
  created_at: string
  host_name: string | null
}

export async function getGuestReviews(guestId: string): Promise<GuestReview[]> {
  if (!isUuid(guestId)) return []
  const { rows } = await pool.query(
    `SELECT g.id, g.booking_id, g.guest_id, g.host_id, g.rating, g.comment,
            to_char(g.created_at,'YYYY-MM-DD') AS created_at, u.full_name AS host_name
       FROM guest_reviews g LEFT JOIN users u ON u.id = g.host_id
      WHERE g.guest_id = $1 ORDER BY g.created_at DESC`,
    [guestId]
  )
  return rows as GuestReview[]
}

/** No host-ownership model in this schema → a host has no derivable reviewable guests. */
export async function getReviewableGuests(_userId: string): Promise<unknown[]> {
  return []
}

export async function submitGuestReview(args: {
  hostId: string
  bookingId: string
  rating: number
  comment?: string | null
}): Promise<void> {
  const { hostId, bookingId, rating, comment = null } = args
  if (!isUuid(bookingId)) throw new Error('Invalid booking')
  const r = Math.max(1, Math.min(5, Math.round(rating)))
  const { rows } = await pool.query(
    `SELECT b.user_id AS guest_id, b.listing_id, l.host_id
       FROM bookings b JOIN listings l ON l.id = b.listing_id
      WHERE b.id = $1 AND b.status = 'confirmed' AND b.check_out < CURRENT_DATE`,
    [bookingId]
  )
  if (!rows[0]) throw new Error('This guest is not eligible for a review yet')
  const { guest_id, listing_id, host_id } = rows[0]
  // Only the listing's host may review the guest (when ownership is known).
  if (host_id && host_id !== hostId) {
    throw new Error('Forbidden: only the listing host can review this guest')
  }
  // guest_reviews.listing_id is NOT NULL; provide it. Manual upsert (no ON CONFLICT)
  // so a missing UNIQUE(booking_id) constraint on the live DB can't 500 the write.
  const upd = await pool.query(
    `UPDATE guest_reviews SET rating = $2, comment = $3, host_id = $4, created_at = now()
      WHERE booking_id = $1 RETURNING id`,
    [bookingId, r, comment, hostId]
  )
  if (upd.rows[0]) return
  await pool.query(
    `INSERT INTO guest_reviews (booking_id, listing_id, guest_id, host_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [bookingId, listing_id, guest_id, hostId, r, comment]
  )
}

// ---- Host applications (Become a host → admin review → approve) -------------

export interface HostApplication {
  id: string
  user_id: string
  full_name: string | null
  national_id: string | null
  phone: string | null
  address: string | null
  company: string | null
  notes: string | null
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  reviewed_at: string | null
  review_note: string | null
  email?: string
}

/** Submit (or re-submit) a host application. Does NOT grant host — sets it pending for admin review. */
export async function submitHostApplication(
  userId: string,
  f: { full_name?: string; national_id?: string; phone?: string; address?: string; company?: string; notes?: string; host_type?: string }
): Promise<{ status: string }> {
  if (!isUuid(userId)) throw new Error('Invalid user')
  if (!f.national_id || !f.phone || !f.address) {
    throw new Error('national_id, phone and address are required')
  }
  const vals = [userId, f.full_name || null, f.national_id, f.phone, f.address, f.company || null, f.notes || null]
  const upd = await pool.query(
    `UPDATE host_applications
        SET full_name=$2, national_id=$3, phone=$4, address=$5, company=$6, notes=$7,
            status='pending', submitted_at=now(), reviewed_at=NULL, review_note=NULL
      WHERE user_id=$1 RETURNING id`,
    vals
  )
  if (!upd.rows[0]) {
    await pool.query(
      `INSERT INTO host_applications (user_id, full_name, national_id, phone, address, company, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      vals
    )
  }
  // Persist the host type + company name on the user so listings can show a
  // "Company"/"Brokerage" badge (individual/company/brokerage; default individual).
  const hostType = ['individual', 'company', 'brokerage'].includes(String(f.host_type)) ? f.host_type : 'individual'
  const company = hostType === 'individual' ? null : (f.company || null)
  await pool.query(`UPDATE users SET host_type=$2, company=$3 WHERE id=$1`, [userId, hostType, company])
  return { status: 'pending' }
}

export async function getHostApplication(userId: string): Promise<HostApplication | null> {
  if (!isUuid(userId)) return null
  const { rows } = await pool.query(
    `SELECT id, user_id, full_name, national_id, phone, address, company, notes, status,
            to_char(submitted_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS submitted_at,
            to_char(reviewed_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS reviewed_at, review_note
       FROM host_applications WHERE user_id=$1`,
    [userId]
  )
  return (rows[0] as HostApplication) ?? null
}

export async function getPendingHostApplications(): Promise<HostApplication[]> {
  const { rows } = await pool.query(
    `SELECT a.id, a.user_id, a.full_name, a.national_id, a.phone, a.address, a.company, a.notes, a.status,
            to_char(a.submitted_at,'YYYY-MM-DD HH24:MI') AS submitted_at, u.email
       FROM host_applications a JOIN users u ON u.id = a.user_id
      WHERE a.status = 'pending' ORDER BY a.submitted_at ASC`
  )
  return rows as HostApplication[]
}

/** Admin decision on a host application. Approve → set users.is_host + notify; reject → notify. */
export async function reviewHostApplication(appId: string, action: 'approve' | 'reject', note: string | null): Promise<void> {
  if (!isUuid(appId)) throw new Error('Invalid application')
  const status = action === 'approve' ? 'approved' : 'rejected'
  const { rows } = await pool.query(
    `UPDATE host_applications SET status=$2, reviewed_at=now(), reviewed_by='admin', review_note=$3
      WHERE id=$1 RETURNING user_id`,
    [appId, status, note]
  )
  const uid = rows[0]?.user_id
  if (!uid) throw new Error('Application not found')
  if (action === 'approve') {
    await pool.query(`UPDATE users SET is_host = true WHERE id = $1`, [uid])
    // Keep the legacy `role` flag in sync so the mobile backend (which reads role)
    // also recognizes this host. The column is absent on a frontend-only dev DB, so
    // this is best-effort and must never fail the approval.
    try { await pool.query(`UPDATE users SET role = 'host' WHERE id = $1`, [uid]) } catch { /* role column not present */ }
    await createNotification(uid, 'host', 'You are now a host!', 'Your host application was approved — you can now list your space and accept guests.', '/host')
  } else {
    await createNotification(uid, 'host', 'Host application update', note ? `Your application needs attention: ${note}` : 'Your host application was not approved this time.', '/account')
  }
}

// ---- Admin: ID verification review -----------------------------------------

export async function getPendingVerifications(): Promise<Array<{ id: string; user_id: string; email: string; full_name: string | null; id_number: string | null; status: string; image_data: string; back_image_data: string | null; selfie_image_data: string | null; submitted_at: string }>> {
  const { rows } = await pool.query(
    `SELECT v.id, v.user_id, u.email, v.full_name, v.id_number, v.status, v.image_data, v.back_image_data, v.selfie_image_data,
            to_char(v.submitted_at,'YYYY-MM-DD HH24:MI') AS submitted_at
       FROM id_verifications v JOIN users u ON u.id = v.user_id
      WHERE v.status = 'pending' ORDER BY v.submitted_at ASC`
  )
  return rows
}

export async function reviewVerification(verifId: string, action: 'verify' | 'reject', note: string | null): Promise<void> {
  if (!isUuid(verifId)) throw new Error('Invalid verification')
  const status = action === 'verify' ? 'verified' : 'rejected'
  const { rows } = await pool.query(
    `UPDATE id_verifications SET status=$2, reviewed_at=now(), reviewed_by='admin', notes=$3
      WHERE id=$1 RETURNING user_id`,
    [verifId, status, note]
  )
  const uid = rows[0]?.user_id
  if (!uid) throw new Error('Verification not found')
  await createNotification(
    uid, 'verification',
    action === 'verify' ? 'Identity verified' : 'Identity check update',
    action === 'verify' ? 'Your ID was verified — your account is now verified.' : (note ? `We could not verify your ID: ${note}` : 'We could not verify your ID. Please re-submit a clear photo.'),
    '/account'
  )
}

// ---- Wishlists --------------------------------------------------------------

/** The user's saved listings (same row shape as getListings, incl. a primary image_url). */
export async function getWishlistListings(userId: string): Promise<Listing[]> {
  if (!isUuid(userId)) return []
  const { rows } = await pool.query(
    `SELECT ${LISTING_COLS},
            (SELECT url FROM listing_images li WHERE li.listing_id = l.id ORDER BY li."order" LIMIT 1) AS image_url
       FROM saved_listings w JOIN listings l ON l.id = w.listing_id
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC`,
    [userId]
  )
  return rows as Listing[]
}

/** Listing ids the user has saved. */
export async function getWishlistIds(userId: string): Promise<string[]> {
  if (!isUuid(userId)) return []
  const { rows } = await pool.query(
    `SELECT listing_id FROM saved_listings WHERE user_id = $1`,
    [userId]
  )
  return rows.map((r) => r.listing_id as string)
}

/** Toggle a listing in the user's wishlist. Insert → {saved:true}; existing → delete → {saved:false}. */
export async function toggleWishlist(userId: string, listingId: string): Promise<{ saved: boolean }> {
  if (!isUuid(userId) || !isUuid(listingId)) throw new Error('Invalid id')
  const del = await pool.query(
    `DELETE FROM saved_listings WHERE user_id = $1 AND listing_id = $2`,
    [userId, listingId]
  )
  if (del.rowCount && del.rowCount > 0) return { saved: false }
  await pool.query(
    `INSERT INTO saved_listings (user_id, listing_id) VALUES ($1, $2)
     ON CONFLICT (user_id, listing_id) DO NOTHING`,
    [userId, listingId]
  )
  return { saved: true }
}

// ---- User profile -----------------------------------------------------------

/** Update mutable profile fields (full_name / avatar_url). No-op if nothing provided. */
export async function updateUserProfile(
  userId: string,
  fields: { full_name?: string; avatar_url?: string }
): Promise<void> {
  if (!isUuid(userId)) throw new Error('Invalid id')
  const sets: string[] = []
  const params: unknown[] = [userId]
  if (fields.full_name !== undefined) { params.push(fields.full_name); sets.push(`full_name = $${params.length}`) }
  if (fields.avatar_url !== undefined) { params.push(fields.avatar_url); sets.push(`avatar_url = $${params.length}`) }
  if (!sets.length) return
  await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1`, params)
}

// ---- Host: listings & incoming reservations ---------------------------------

/** Listings owned by a host. */
export async function getHostListings(hostId: string): Promise<Listing[]> {
  if (!isUuid(hostId)) return []
  const { rows } = await pool.query(
    `SELECT ${LISTING_COLS},
            (SELECT url FROM listing_images li WHERE li.listing_id = l.id ORDER BY li."order" LIMIT 1) AS image_url
       FROM listings l
      WHERE l.host_id = $1
      ORDER BY l.created_at DESC`,
    [hostId]
  )
  return rows as Listing[]
}

/** Reservations on a host's listings, newest first, with the guest name + listing title. */
export async function getHostBookings(
  hostId: string
): Promise<Array<Booking & { guest_name: string | null; listing_title: string | null }>> {
  if (!isUuid(hostId)) return []
  const { rows } = await pool.query(
    `SELECT ${BOOKING_COLS}, gu.full_name AS guest_name, l.title AS listing_title
       FROM bookings b
       JOIN listings l ON l.id = b.listing_id
       LEFT JOIN users gu ON gu.id = b.user_id
      WHERE l.host_id = $1
      ORDER BY b.created_at DESC`,
    [hostId]
  )
  return rows as Array<Booking & { guest_name: string | null; listing_title: string | null }>
}

// ---- Host: public profile page (/hosts/[id]) --------------------------------

export interface HostListingCard {
  id: string
  title: string
  location: string | null
  price_per_night: number
  image_url: string | null
  rating: number | null          // average of this listing's review ratings
  rating_count: number
}

export interface HostReviewCard {
  id: string
  rating: number
  comment: string | null
  created_at: string
  listing_title: string | null
  reviewer_name: string | null
  reviewer_avatar: string | null
}

export interface HostProfile {
  profile: PublicUser & { bio: string | null; verification_status: string }
  listings: HostListingCard[]
  reviews: HostReviewCard[]
  avgRating: number | null
  totalReviews: number
}

/** Everything the public /hosts/[id] page needs, read straight from the local
 *  stack (no Supabase). Returns null when the user doesn't exist so the page
 *  can render notFound(). */
export async function getHostProfile(hostId: string): Promise<HostProfile | null> {
  if (!isUuid(hostId)) return null
  const user = await getUserById(hostId)
  if (!user) return null
  const verification = await getVerification(hostId)

  const [{ rows: lrows }, { rows: rvrows }] = await Promise.all([
    pool.query(
      `SELECT l.id, l.title, l.location, l.price_per_night::float8 AS price_per_night,
              (SELECT url FROM listing_images li WHERE li.listing_id = l.id
                ORDER BY li."order" LIMIT 1) AS image_url,
              agg.avg_rating::float8 AS rating,
              COALESCE(agg.cnt, 0)::int AS rating_count
         FROM listings l
         LEFT JOIN (
           SELECT listing_id, AVG(rating) AS avg_rating, COUNT(*) AS cnt
             FROM reviews GROUP BY listing_id
         ) agg ON agg.listing_id = l.id
        WHERE l.host_id = $1
        ORDER BY l.created_at DESC
        LIMIT 12`,
      [hostId]
    ),
    pool.query(
      `SELECT rv.id, rv.rating, rv.comment,
              to_char(rv.created_at, 'YYYY-MM-DD') AS created_at,
              l.title AS listing_title,
              u.full_name AS reviewer_name, u.avatar_url AS reviewer_avatar
         FROM reviews rv
         JOIN listings l ON l.id = rv.listing_id
         LEFT JOIN users u ON u.id = rv.reviewer_id
        WHERE l.host_id = $1
        ORDER BY rv.created_at DESC
        LIMIT 8`,
      [hostId]
    ),
  ])

  const listings = lrows as HostListingCard[]
  const rated = listings.filter((l) => l.rating != null && l.rating_count > 0)
  const avgRating = rated.length
    ? rated.reduce((s, l) => s + (l.rating ?? 0), 0) / rated.length
    : null
  const totalReviews = listings.reduce((s, l) => s + (l.rating_count ?? 0), 0)

  return {
    profile: { ...user, bio: null, verification_status: verification.status },
    listings,
    reviews: rvrows as HostReviewCard[],
    avgRating,
    totalReviews,
  }
}

// ---- Host: create a listing -------------------------------------------------

export interface CreateListingInput {
  title: string
  description?: string
  location?: string
  country?: string
  lat?: number
  lng?: number
  price_per_night: number
  weekend_price?: number
  weekend_days?: number[]
  currency?: string
  bedrooms?: number
  beds?: number
  bathrooms?: number
  max_guests?: number
  property_type?: string
  images?: string[]
}

/** Create a listing owned by [hostId], plus any provided images. */
export async function createListing(hostId: string, data: CreateListingInput): Promise<Listing> {
  if (!isUuid(hostId)) throw new Error('Invalid host')
  const title = String(data.title || '').trim()
  if (!title) throw new Error('Title is required')
  const price = Number(data.price_per_night)
  if (!Number.isFinite(price) || price <= 0) throw new Error('A valid price per night is required')
  const nn = (v: unknown, d: number) => {
    const n = Math.floor(Number(v))
    return Number.isFinite(n) && n >= 0 ? n : d
  }
  const fin = (v: unknown): number | null => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const weekendPrice = fin(data.weekend_price)
  const weekendDays = Array.isArray(data.weekend_days)
    ? data.weekend_days.map((d) => Math.floor(Number(d))).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    : []
  const { rows } = await pool.query(
    `INSERT INTO listings
       (host_id, title, description, location, country, lat, lng, price_per_night,
        weekend_price, weekend_days, currency,
        bedrooms, beds, bathrooms, max_guests, property_type, is_published)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true)
     RETURNING id`,
    [
      hostId, title, data.description ?? null, data.location ?? null, data.country ?? null,
      fin(data.lat), fin(data.lng), price,
      weekendPrice && weekendPrice > 0 ? weekendPrice : null,
      weekendPrice && weekendPrice > 0 && weekendDays.length ? weekendDays : null,
      data.currency || 'USD',
      nn(data.bedrooms, 1), nn(data.beds, 1), nn(data.bathrooms, 1), nn(data.max_guests, 2),
      data.property_type ?? null,
    ]
  )
  const newId = rows[0].id as string
  const images = Array.isArray(data.images) ? data.images.filter(isImageSrc) : []
  for (let i = 0; i < images.length; i++) {
    await pool.query(
      `INSERT INTO listing_images (listing_id, url, "order") VALUES ($1, $2, $3)`,
      [newId, images[i].trim(), i]
    )
  }
  const listing = await getListingById(newId)
  if (!listing) throw new Error('Could not create listing')
  return listing
}

// ---- Admin: full ops dashboard (key-gated) ----------------------------------

export interface AdminStats {
  users: number
  hosts: number
  verified: number
  listings: number
  published: number
  bookings: number
  pending_bookings: number
  confirmed_bookings: number
  paid_bookings: number
  pending_applications: number
  pending_verifications: number
  gross_paid: number
}

/** Top-line counts for the admin dashboard. gross_paid = SUM(total_price) of paid
 *  bookings; verified = users with at least one verified id_verification. */
export async function adminStats(): Promise<AdminStats> {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM users)::int AS users,
       (SELECT COUNT(*) FROM users WHERE is_host = true)::int AS hosts,
       (SELECT COUNT(DISTINCT user_id) FROM id_verifications WHERE status = 'verified')::int AS verified,
       (SELECT COUNT(*) FROM listings)::int AS listings,
       (SELECT COUNT(*) FROM listings WHERE is_published = true)::int AS published,
       (SELECT COUNT(*) FROM bookings)::int AS bookings,
       (SELECT COUNT(*) FROM bookings WHERE status = 'pending')::int AS pending_bookings,
       (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed')::int AS confirmed_bookings,
       (SELECT COUNT(*) FROM bookings WHERE paid_at IS NOT NULL)::int AS paid_bookings,
       (SELECT COUNT(*) FROM host_applications WHERE status = 'pending')::int AS pending_applications,
       (SELECT COUNT(*) FROM id_verifications WHERE status = 'pending')::int AS pending_verifications,
       COALESCE((SELECT SUM(total_price) FROM bookings WHERE paid_at IS NOT NULL), 0)::float8 AS gross_paid`
  )
  return rows[0] as AdminStats
}

export interface AdminUserRow {
  id: string
  email: string
  full_name: string | null
  is_host: boolean
  email_verified: boolean
  verification_status: string
  provider: string
  push_platform: string | null
  has_push: boolean
  device_platforms: string | null
  device_count: number
  created_at: string
  listing_count: number
  booking_count: number
}

/** Newest-first users (LIMIT 300) with their latest verification status, the count
 *  of listings they host and bookings they've made. */
export async function adminListUsers(): Promise<AdminUserRow[]> {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.full_name, COALESCE(u.is_host, false) AS is_host,
            COALESCE(u.email_verified, false) AS email_verified,
            COALESCE(
              (SELECT v.status FROM id_verifications v
                WHERE v.user_id = u.id ORDER BY v.submitted_at DESC LIMIT 1),
              'none'
            ) AS verification_status,
            u.provider,
            u.push_platform,
            (u.fcm_token IS NOT NULL OR EXISTS (SELECT 1 FROM device_tokens dt WHERE dt.user_id = u.id)) AS has_push,
            (SELECT string_agg(DISTINCT dt.platform, ', ') FROM device_tokens dt WHERE dt.user_id = u.id) AS device_platforms,
            (SELECT COUNT(*) FROM device_tokens dt WHERE dt.user_id = u.id)::int AS device_count,
            to_char(u.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
            (SELECT COUNT(*) FROM listings l WHERE l.host_id = u.id)::int AS listing_count,
            (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id)::int AS booking_count
       FROM users u
      ORDER BY u.created_at DESC
      LIMIT 300`
  )
  return rows as AdminUserRow[]
}

/** Admin: delete a booking and notify BOTH the guest and the host (in-app + push via the
 *  notifications fan-out). Used by the /ops Bookings tab. */
export async function adminDeleteBooking(id: string): Promise<void> {
  if (!isUuid(id)) throw new Error('Invalid booking')
  const { rows } = await pool.query(
    `SELECT b.user_id, l.host_id, COALESCE(l.title, 'your stay') AS title,
            'QK-' || upper(substr(b.id::text, 1, 8)) AS code
       FROM bookings b LEFT JOIN listings l ON l.id = b.listing_id WHERE b.id = $1`,
    [id]
  )
  const bk = rows[0] as { user_id: string; host_id: string | null; title: string; code: string } | undefined
  if (!bk) throw new Error('Booking not found')
  await pool.query(`DELETE FROM bookings WHERE id = $1`, [id])
  if (bk.user_id) {
    await createNotification(bk.user_id, 'booking', 'Reservation cancelled', `Your reservation ${bk.code} for ${bk.title} was cancelled by QuickIn support.`, '/reservations')
  }
  if (bk.host_id && bk.host_id !== bk.user_id) {
    await createNotification(bk.host_id, 'booking', 'Reservation removed', `Reservation ${bk.code} on ${bk.title} was removed by QuickIn support.`, '/host')
  }
}

export interface AdminListingRow {
  id: string
  title: string
  location: string | null
  currency: string
  price_per_night: number
  is_published: boolean
  host_id: string | null
  host_name: string | null
  created_at: string
  booking_count: number
  image: string | null
}

/** Newest-first listings (LIMIT 300) with host name, booking count and a primary image. */
export async function adminListListings(): Promise<AdminListingRow[]> {
  const { rows } = await pool.query(
    `SELECT l.id, l.title, l.location, COALESCE(l.currency, 'USD') AS currency,
            l.price_per_night::float8 AS price_per_night, l.is_published,
            l.host_id, u.full_name AS host_name,
            to_char(l.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
            (SELECT COUNT(*) FROM bookings b WHERE b.listing_id = l.id)::int AS booking_count,
            (SELECT li.url FROM listing_images li WHERE li.listing_id = l.id
              ORDER BY li."order" LIMIT 1) AS image
       FROM listings l
       LEFT JOIN users u ON u.id = l.host_id
      ORDER BY l.created_at DESC
      LIMIT 300`
  )
  return rows as AdminListingRow[]
}

/** Publish / unpublish a listing. */
export async function adminSetListingPublished(id: string, published: boolean): Promise<void> {
  if (!isUuid(id)) throw new Error('Invalid listing')
  await pool.query(`UPDATE listings SET is_published = $2 WHERE id = $1`, [id, published])
}

/** Delete a listing (FK cascades remove its images / bookings / reviews). */
export async function adminDeleteListing(id: string): Promise<void> {
  if (!isUuid(id)) throw new Error('Invalid listing')
  await pool.query(`DELETE FROM listings WHERE id = $1`, [id])
}

/** Admin: manually mark a user's email as verified (when OTP email can't reach them). */
export async function adminActivateUser(id: string): Promise<void> {
  if (!isUuid(id)) throw new Error('Invalid user')
  await pool.query(`UPDATE users SET email_verified = true WHERE id = $1`, [id])
  await createNotification(id, 'account', 'Account activated', 'Your email was verified by our team — you can use your account normally now.', '/account')
}

/** Admin: permanently delete a user and everything they own. Most child rows cascade,
 *  but listings.host_id has no ON DELETE CASCADE, so their listings are removed first
 *  (which cascades to those listings' images / bookings / reviews). Transactional. */
export async function adminDeleteUser(id: string): Promise<void> {
  if (!isUuid(id)) throw new Error('Invalid user')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM listings WHERE host_id = $1`, [id])
    await client.query(`DELETE FROM users WHERE id = $1`, [id])
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

export interface AdminBookingRow {
  id: string
  reservation_code: string
  status: string
  payment_status: string
  total_price: number
  currency: string
  check_in: string
  check_out: string
  guest_name: string | null
  guest_email: string | null
  listing_title: string | null
  created_at: string
}

/** Newest-first bookings (LIMIT 300) with guest + listing details. */
export async function adminListBookings(): Promise<AdminBookingRow[]> {
  const { rows } = await pool.query(
    `SELECT b.id,
            'QK-' || upper(substr(b.id::text, 1, 8)) AS reservation_code,
            b.status,
            CASE WHEN b.paid_at IS NULL THEN 'unpaid' ELSE 'paid' END AS payment_status,
            b.total_price::float8 AS total_price,
            COALESCE(l.currency, 'USD') AS currency,
            to_char(b.check_in, 'YYYY-MM-DD') AS check_in,
            to_char(b.check_out, 'YYYY-MM-DD') AS check_out,
            gu.full_name AS guest_name, gu.email AS guest_email,
            l.title AS listing_title,
            to_char(b.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM bookings b
       LEFT JOIN listings l ON l.id = b.listing_id
       LEFT JOIN users gu ON gu.id = b.user_id
      ORDER BY b.created_at DESC
      LIMIT 300`
  )
  return rows as AdminBookingRow[]
}

// ---- Chat (pre-booking inquiry: guest ⇄ host) -------------------------------

/**
 * Content guard: strip phone numbers, emails and links from a chat message so
 * guests + hosts keep the conversation (and payments) on-platform. Runs
 * server-side in postMessage — the client can't bypass it.
 */
export function redactContact(text: string): string {
  let s = String(text)
  s = s.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[hidden]')
  s = s.replace(/\bhttps?:\/\/\S+/gi, '[hidden]')
  // Phone-like digit runs: 7+ digits, allowing +, spaces, dashes, parens, dots.
  s = s.replace(/(\+?\d[\d\s().-]{5,}\d)/g, (m) => (m.replace(/\D/g, '').length >= 7 ? '[hidden]' : m))
  return s
}

export interface ConversationSummary {
  id: string
  listing_id: string | null
  listing_title: string | null
  listing_image: string | null
  other_name: string | null
  last_message: string | null
  last_message_at: string
  is_host: boolean
}

export interface ChatMessage {
  id: string
  sender_id: string
  body: string
  created_at: string
  mine?: boolean
}

/** Guest opens (or reuses) a thread with the listing's host. Returns the thread id. */
export async function getOrCreateConversation(
  guestId: string,
  listingId: string
): Promise<{ id: string; host_id: string; listing_title: string | null }> {
  if (!isUuid(guestId) || !isUuid(listingId)) throw new Error('Invalid id')
  const { rows: lr } = await pool.query(
    `SELECT host_id, title FROM listings WHERE id = $1`,
    [listingId]
  )
  const listing = lr[0] as { host_id: string | null; title: string | null } | undefined
  if (!listing) throw new Error('Listing not found')
  if (!listing.host_id || !isUuid(listing.host_id)) throw new Error('This listing has no host to message yet')
  if (listing.host_id === guestId) throw new Error("You can't message your own listing")
  const { rows } = await pool.query(
    `INSERT INTO conversations (listing_id, guest_id, host_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (listing_id, guest_id) DO UPDATE SET listing_id = EXCLUDED.listing_id
     RETURNING id`,
    [listingId, guestId, listing.host_id]
  )
  return { id: rows[0].id as string, host_id: listing.host_id, listing_title: listing.title }
}

/** All threads a user is part of (as guest or host), newest activity first. */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  if (!isUuid(userId)) return []
  const { rows } = await pool.query(
    `SELECT c.id, c.listing_id,
            l.title AS listing_title,
            (SELECT url FROM listing_images li WHERE li.listing_id = l.id ORDER BY li."order" LIMIT 1) AS listing_image,
            CASE WHEN c.guest_id = $1 THEN hu.full_name ELSE gu.full_name END AS other_name,
            (SELECT m.body FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
            to_char(c.last_message_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_message_at,
            (c.host_id = $1) AS is_host
       FROM conversations c
       LEFT JOIN listings l ON l.id = c.listing_id
       LEFT JOIN users gu ON gu.id = c.guest_id
       LEFT JOIN users hu ON hu.id = c.host_id
      WHERE c.guest_id = $1 OR c.host_id = $1
      ORDER BY c.last_message_at DESC
      LIMIT 200`,
    [userId]
  )
  return rows as ConversationSummary[]
}

/** Assert the user belongs to the conversation; returns the row or null. */
async function conversationForUser(userId: string, conversationId: string) {
  const { rows } = await pool.query(
    `SELECT id, listing_id, guest_id, host_id FROM conversations
      WHERE id = $1 AND (guest_id = $2 OR host_id = $2)`,
    [conversationId, userId]
  )
  return rows[0] as { id: string; listing_id: string | null; guest_id: string; host_id: string } | undefined
}

/** Messages in a thread, oldest first. Only members can read. */
export async function listMessages(userId: string, conversationId: string): Promise<ChatMessage[]> {
  if (!isUuid(userId) || !isUuid(conversationId)) throw new Error('Invalid id')
  const convo = await conversationForUser(userId, conversationId)
  if (!convo) throw new Error('Conversation not found')
  const { rows } = await pool.query(
    `SELECT id, sender_id, body,
            to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 500`,
    [conversationId]
  )
  return (rows as ChatMessage[]).map((m) => ({ ...m, mine: m.sender_id === userId }))
}

/** Post a message (contact info redacted). Notifies the other party. */
export async function postMessage(userId: string, conversationId: string, rawBody: string): Promise<ChatMessage> {
  if (!isUuid(userId) || !isUuid(conversationId)) throw new Error('Invalid id')
  const body = redactContact(String(rawBody || '').trim()).slice(0, 2000)
  if (!body) throw new Error('Message is empty')
  const convo = await conversationForUser(userId, conversationId)
  if (!convo) throw new Error('Conversation not found')
  const { rows } = await pool.query(
    `WITH ins AS (
       INSERT INTO chat_messages (conversation_id, sender_id, body) VALUES ($1, $2, $3) RETURNING *
     ), upd AS (
       UPDATE conversations SET last_message_at = now() WHERE id = $1
     )
     SELECT id, sender_id, body, to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at FROM ins`,
    [conversationId, userId, body]
  )
  const other = convo.guest_id === userId ? convo.host_id : convo.guest_id
  if (isUuid(other)) {
    await createNotification(other, 'message', 'New message', body.slice(0, 80), '/messages')
  }
  const msg = rows[0] as ChatMessage
  return { ...msg, mine: true }
}
