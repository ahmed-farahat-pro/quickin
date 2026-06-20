import { pool } from './pool'

// Data access via node-postgres (parameterized queries). Works locally and on
// Vercel/Neon. No Supabase, no psql CLI.

const isUuid = (s: string) => /^[0-9a-fA-F-]{36}$/.test(s)
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

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
  if (filters.guests && Number.isFinite(filters.guests) && filters.guests > 0) {
    params.push(Math.floor(filters.guests))
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
  const { rows } = await pool.query(`SELECT ${LISTING_COLS} FROM listings l WHERE l.id = $1`, [id])
  return (rows[0] as Listing) ?? null
}

// ---- Bookings ---------------------------------------------------------------

const BOOKING_COLS = `
  b.id, b.listing_id,
  to_char(b.check_in, 'YYYY-MM-DD') AS check_in,
  to_char(b.check_out, 'YYYY-MM-DD') AS check_out,
  b.guests, b.total_price::float8 AS total_price, b.status,
  to_char(b.cancelled_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS cancelled_at,
  b.refund_percent,
  to_char(b.created_at, 'YYYY-MM-DD') AS created_at,
  l.title, l.location,
  (SELECT url FROM listing_images li WHERE li.listing_id = l.id ORDER BY li."order" LIMIT 1) AS image
`

export interface CreateBookingInput {
  listingId: string
  userId: string
  checkIn: string
  checkOut: string
  guests: number
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const { listingId, userId, checkIn, checkOut, guests } = input
  if (!isUuid(listingId) || !isUuid(userId)) throw new Error('Invalid id')
  if (!isDate(checkIn) || !isDate(checkOut)) throw new Error('Invalid dates (use YYYY-MM-DD)')
  // No bookings that start in the past. ISO dates compare correctly as strings.
  const today = new Date().toISOString().slice(0, 10)
  if (checkIn < today) throw new Error('Check-in cannot be in the past')
  if (checkOut <= checkIn) throw new Error('Check-out must be after check-in')
  const g = Math.max(1, Math.floor(Number(guests) || 1))

  const clash = await pool.query(
    `SELECT 1 FROM bookings
     WHERE listing_id = $1 AND status <> 'cancelled'
       AND check_in < $2 AND check_out > $3 LIMIT 1`,
    [listingId, checkOut, checkIn]
  )
  if (clash.rowCount && clash.rowCount > 0) throw new Error('Those dates are not available')

  const { rows } = await pool.query(
    `WITH ins AS (
       INSERT INTO bookings (listing_id, user_id, check_in, check_out, guests, total_price, status)
       SELECT $1, $2, $3, $4, $5, ($4::date - $3::date) * l.price_per_night, 'confirmed'
       FROM listings l WHERE l.id = $1
       RETURNING *
     )
     SELECT ${BOOKING_COLS} FROM ins b JOIN listings l ON l.id = b.listing_id`,
    [listingId, userId, checkIn, checkOut, g]
  )
  if (!rows[0]) throw new Error('Could not create booking (listing not found)')
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
  await pool.query(
    `INSERT INTO reviews (booking_id, listing_id, reviewer_id, rating, comment, photos)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (booking_id, reviewer_id)
     DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment,
                   photos = EXCLUDED.photos, created_at = now()`,
    [bookingId, rows[0].listing_id, userId, r, comment, JSON.stringify((photos || []).slice(0, 6))]
  )
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
    `SELECT user_id FROM bookings WHERE id = $1 AND status = 'confirmed' AND check_out < CURRENT_DATE`,
    [bookingId]
  )
  if (!rows[0]) throw new Error('This guest is not eligible for a review yet')
  await pool.query(
    `INSERT INTO guest_reviews (booking_id, guest_id, host_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (booking_id)
     DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment,
                   host_id = EXCLUDED.host_id, created_at = now()`,
    [bookingId, rows[0].user_id, hostId, r, comment]
  )
}
