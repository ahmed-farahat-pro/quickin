import { NextResponse } from 'next/server'
import { getListings, createListing } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

// Local-only API (no Supabase). GET /api/local/listings → JSON array.
// Supports search: ?location=&guests=&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD
// Consumed by the /explore web page and the iOS + Android apps.
//   POST /api/local/listings { ...listing fields, images? } → { listing } (auth; host_id = caller)
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

/** True only for well-formed http(s) URLs — keeps garbage/non-image entries out. */
function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try {
    const u = new URL(value.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const listings = await getListings({
      location: url.searchParams.get('location') || undefined,
      guests: url.searchParams.get('guests') ? Number(url.searchParams.get('guests')) : undefined,
      checkIn: url.searchParams.get('checkIn') || undefined,
      checkOut: url.searchParams.get('checkOut') || undefined,
    })
    return NextResponse.json(listings, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('GET /api/local/listings failed:', err)
    return NextResponse.json(
      { error: 'Failed to load listings' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Please sign in to create a listing' }, { status: 401, headers: CORS })
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers: CORS })
    const num = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Number(v))
    const listing = await createListing(user.id, {
      title: String(body.title ?? ''),
      description: body.description ?? undefined,
      location: body.location ?? undefined,
      country: body.country ?? undefined,
      price_per_night: Number(body.price_per_night),
      currency: body.currency ?? undefined,
      bedrooms: num(body.bedrooms),
      beds: num(body.beds),
      bathrooms: num(body.bathrooms),
      max_guests: num(body.max_guests),
      property_type: body.property_type ?? undefined,
      images: Array.isArray(body.images)
        ? body.images.filter(isHttpUrl).map((u: string) => u.trim())
        : undefined,
    })
    return NextResponse.json({ listing }, { status: 201, headers: CORS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/local/listings failed:', err)
    if (/Invalid|required/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400, headers: CORS })
    }
    return NextResponse.json({ error: 'Failed to create listing' }, { status: 500, headers: CORS })
  }
}
