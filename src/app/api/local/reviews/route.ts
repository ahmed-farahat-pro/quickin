import { NextResponse } from 'next/server'
import { getListingReviews, getReviewableStays, submitReview } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

// Reviews API (no Supabase) — guest reviews of a listing ("rate the place").
//   GET  /api/local/reviews?listing_id=ID         (public) → Review[]
//   GET  /api/local/reviews                        (auth)   → ReviewableStay[]  (past, unrated stays)
//   POST /api/local/reviews { booking_id, rating, comment?, photos? } (auth) → 201
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function GET(req: Request) {
  try {
    const listingId = new URL(req.url).searchParams.get('listing_id')
    if (listingId) {
      return NextResponse.json(await getListingReviews(listingId), { headers: CORS })
    }
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    return NextResponse.json(await getReviewableStays(user.id), { headers: CORS })
  } catch (err) {
    console.error('GET /api/local/reviews failed:', err)
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
    const photos = Array.isArray(body.photos) ? body.photos.filter((p: unknown) => typeof p === 'string') : []
    await submitReview({ userId: user.id, bookingId, rating, comment: body.comment ?? null, photos })
    return NextResponse.json({ ok: true }, { status: 201, headers: CORS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/local/reviews failed:', err)
    if (/eligible|Invalid|required/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400, headers: CORS })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: CORS })
  }
}
