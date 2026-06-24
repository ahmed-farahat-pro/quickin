import { NextResponse } from 'next/server'
import { getGuestReviews, getReviewableGuests, submitGuestReview } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

// Guest reviews API (no Supabase) — host's review of a guest.
//   GET  /api/local/guest-reviews?guest_id=ID      (public) → GuestReview[]
//   GET  /api/local/guest-reviews                   (auth)   → ReviewableGuest[]  (empty: no host model)
//   POST /api/local/guest-reviews { booking_id, rating, comment? } (auth) → 201
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function GET(req: Request) {
  try {
    const guestId = new URL(req.url).searchParams.get('guest_id')
    if (guestId) {
      return NextResponse.json(await getGuestReviews(guestId), { headers: CORS })
    }
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    return NextResponse.json(await getReviewableGuests(user.id), { headers: CORS })
  } catch (err) {
    console.error('GET /api/local/guest-reviews failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500, headers: CORS })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Please sign in to leave a review' }, { status: 401, headers: CORS })
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS })
    const bookingId = body.booking_id || body.bookingId
    const rating = Number(body.rating)
    if (!bookingId || !Number.isFinite(rating)) {
      return NextResponse.json({ error: 'booking_id and rating are required' }, { status: 400, headers: CORS })
    }
    await submitGuestReview({ hostId: user.id, bookingId, rating, comment: body.comment ?? null })
    return NextResponse.json({ ok: true }, { status: 201, headers: CORS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/local/guest-reviews failed:', err)
    if (/eligible|Invalid|required/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400, headers: CORS })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: CORS })
  }
}
