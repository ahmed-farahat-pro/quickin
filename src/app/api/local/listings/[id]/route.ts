import { NextResponse } from 'next/server'
import { getListingById, updateListing, setListingOwnershipDoc, isListingInputError } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

// GET   /api/local/listings/:id → a single listing (no Supabase).
// PATCH /api/local/listings/:id → the OWNER host edits ANY aspect of the listing
//        (auth): title, description, location, country, region, lat/lng,
//        property type, capacity, amenities, pricing AND the photo set
//        (`images` — add / delete / reorder / cover, first entry = cover).
//        Only the keys present are written. Every edit re-queues the listing for
//        review (approval_status='pending', is_published=false) — see
//        REVIEW_TRIGGERING_FIELDS in lib/local/db.ts — and the response carries
//        the fresh approval_status so the client can show "Under review" without
//        a refetch.
//        ... { ownership_doc } → host (re)submits the ownership doc → re-queues
//        the listing for review (same contract as quickin-backend's PATCH).
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
    // The ownership doc is not a plain column edit — it re-queues the listing for
    // review — so it is split out of the field update and applied last, letting
    // the edit form save details and a new document in one PATCH.
    const { ownership_doc, ownershipDoc, ...fields } = body
    const doc = ownership_doc ?? ownershipDoc
    const updated = await updateListing(id, me.id, fields)
    if (!updated) {
      // Either the listing doesn't exist or it isn't this host's.
      return NextResponse.json({ error: 'Listing not found or not yours' }, { status: 404, headers: CORS })
    }
    if (typeof doc === 'string' && doc.trim()) {
      const requeued = await setListingOwnershipDoc(id, me.id, doc)
      if (!requeued) {
        return NextResponse.json({ error: 'Listing not found or not yours' }, { status: 404, headers: CORS })
      }
      return NextResponse.json(requeued, { headers: CORS })
    }
    return NextResponse.json(updated, { headers: CORS })
  } catch (err) {
    // Anything the host can fix in the form is a 400 carrying the reason; a real
    // failure stays opaque. isListingInputError covers the edit validators, the
    // regex the ownership-doc / legacy messages.
    const msg = err instanceof Error ? err.message : 'Failed to update listing'
    const status =
      isListingInputError(err) || /required|greater than|Invalid|attach a photo|too large/i.test(msg) ? 400 : 500
    if (status === 500) console.error('PATCH /api/local/listings/[id] failed:', err)
    return NextResponse.json({ error: status === 400 ? msg : 'Failed to update listing' }, { status, headers: CORS })
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
  })
}
