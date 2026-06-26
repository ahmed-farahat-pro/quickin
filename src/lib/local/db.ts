import { pool } from './pool'

// Data access via node-postgres (parameterized queries). Works locally and on
// Vercel/Neon. No Supabase, no psql CLI.

const isUuid = (s: string) => /^[0-9a-fA-F-]{36}$/.test(s)
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

/** Accept only well-formed http(s) URLs (keeps garbage/non-image entries out of the DB). */
const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  try {
    const u = new URL(value.trim())
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
  image_url?: string | null
}

export interface SearchFilters {
  location?: string
  guests?: number
  checkIn?: string
  checkOut?: string
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
  image: string | null
}

const LISTING_COLS = `
  l.id, l.title, l.description, l.location, l.country,
  l.price_per_night::float8 AS price_per_night, l.currency,
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
    `SELECT ${LISTING_COLS}, l.host_id, u.full_name AS host_name, u.avatar_url AS host_avatar
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

  const { rows } = await pool.query(
    `WITH ins AS (
       INSERT INTO bookings (listing_id, user_id, check_in, check_out, guests, adults, children, infants, pets, total_price, status)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, ($4::date - $3::date) * l.price_per_night, 'pending'
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

/** Submit an ID photo for review — reuses the user's pending row if one exists. */
export async function submitVerification(args: {
  userId: string
  imageData: string
  idNumber?: string | null
  fullName?: string | null
  source?: string
}): Promise<VerificationRow> {
  const { userId, imageData, idNumber = null, fullName = null, source = 'manual' } = args
  const existing = await pool.query(
    `SELECT id FROM id_verifications WHERE user_id = $1 AND status = 'pending' LIMIT 1`,
    [userId]
  )
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE id_verifications
          SET image_data = $2, id_number = COALESCE($3, id_number),
              full_name = COALESCE($4, full_name), source = $5,
              submitted_at = now(), reviewed_at = NULL, reviewed_by = NULL, notes = NULL
        WHERE id = $1`,
      [existing.rows[0].id, imageData, idNumber, fullName, source]
    )
  } else {
    await pool.query(
      `INSERT INTO id_verifications (user_id, image_data, id_number, full_name, source)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, imageData, idNumber, fullName, source]
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
  price_per_night: number
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
  const { rows } = await pool.query(
    `INSERT INTO listings
       (host_id, title, description, location, country, price_per_night, currency,
        bedrooms, beds, bathrooms, max_guests, property_type, is_published)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
     RETURNING id`,
    [
      hostId, title, data.description ?? null, data.location ?? null, data.country ?? null,
      price, data.currency || 'USD',
      nn(data.bedrooms, 1), nn(data.beds, 1), nn(data.bathrooms, 1), nn(data.max_guests, 2),
      data.property_type ?? null,
    ]
  )
  const newId = rows[0].id as string
  const images = Array.isArray(data.images) ? data.images.filter(isHttpUrl) : []
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
