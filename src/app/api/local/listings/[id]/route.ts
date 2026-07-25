import { NextResponse } from 'next/server'
import { getListingById, updateListing } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

// GET   /api/local/listings/:id → a single listing (no Supabase).
// PATCH /api/local/listings/:id → the OWNER host edits core fields (auth).
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const listing = await getListingById(id)
    if (!listing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(listing, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('GET /api/local/listings/[id] failed:', err)
    return NextResponse.json(
      { error: 'Failed to load listing' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getUserFromRequest(req)
    if (!me) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const { id } = await params
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400, headers: CORS })
    }
    const updated = await updateListing(id, me.id, body)
    if (!updated) {
      // Either the listing doesn't exist or it isn't this host's.
      return NextResponse.json({ error: 'Listing not found or not yours' }, { status: 404, headers: CORS })
    }
    return NextResponse.json(updated, { headers: CORS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update listing'
    const status = /required|greater than|Invalid/i.test(msg) ? 400 : 500
    if (status === 500) console.error('PATCH /api/local/listings/[id] failed:', err)
    return NextResponse.json({ error: status === 400 ? msg : 'Failed to update listing' }, { status, headers: CORS })
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
  })
}
