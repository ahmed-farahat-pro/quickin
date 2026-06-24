import { NextResponse } from 'next/server'
import { createBooking, getUserBookings } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

// Bookings API (no Supabase). Auth via Bearer token (mobile) or qk_token cookie (web).
//   GET  /api/local/bookings           → the signed-in user's reservations
//   POST /api/local/bookings {listing_id, check_in, check_out, guests} → reserve
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const bookings = await getUserBookings(user.id)
    return NextResponse.json(bookings, { headers: CORS })
  } catch (err) {
    console.error('GET /api/local/bookings failed:', err)
    return NextResponse.json({ error: 'Failed to load reservations', detail: String(err) }, { status: 500, headers: CORS })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Please sign in to reserve' }, { status: 401, headers: CORS })
    }
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS })
    const listingId = body.listing_id || body.listingId
    const checkIn = body.check_in || body.checkIn
    const checkOut = body.check_out || body.checkOut
    const guests = Number(body.guests || 1)
    if (!listingId || !checkIn || !checkOut) {
      return NextResponse.json({ error: 'listing_id, check_in and check_out are required' }, { status: 400, headers: CORS })
    }
    const booking = await createBooking({
      listingId, userId: user.id, checkIn, checkOut, guests,
      adults: body.adults, children: body.children, infants: body.infants, pets: body.pets,
    })
    return NextResponse.json(booking, { status: 201, headers: CORS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/local/bookings failed:', msg)
    // Availability / validation problems are client errors.
    const status = /available|after check-in|Invalid|required|maximum guests/i.test(msg) ? 400 : 500
    return NextResponse.json({ error: msg }, { status, headers: CORS })
  }
}
