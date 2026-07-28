import { NextResponse } from 'next/server'
import { getStayGuideForViewer, addStayGuideItem, isStayGuideInputError } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

// Host-authored stay guide for ONE reservation (no Supabase).
//   GET  /api/local/bookings/:id/stay-guide  (auth: that booking's host or guest)
//        → { items, canEdit }
//   POST /api/local/bookings/:id/stay-guide  (auth: the LISTING'S HOST only, and
//        only on a confirmed booking) { kind, title?, body?, url? } → item
// Authorization is resolved server-side from the session against
// listings.host_id — a client-supplied host id is never trusted.
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

/** Map a thrown authorization/validation error onto its HTTP status. Anything
 *  that isn't one of those is a server fault and stays a 500 with a generic
 *  message (the detail is logged, never echoed). */
function errorStatus(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err)
  if (/Forbidden/i.test(msg)) return 403
  if (/not found/i.test(msg)) return 404
  if (isStayGuideInputError(err)) return 400
  return 500
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const { id } = await params
    const guide = await getStayGuideForViewer(user.id, id)
    if (!guide) return NextResponse.json({ error: 'Reservation not found' }, { status: 404, headers: CORS })
    return NextResponse.json(guide, { headers: CORS })
  } catch (err) {
    console.error('GET /api/local/bookings/[id]/stay-guide failed:', err)
    return NextResponse.json({ error: 'Failed to load the stay guide' }, { status: 500, headers: CORS })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const item = await addStayGuideItem(user.id, id, body)
    return NextResponse.json(item, { status: 201, headers: CORS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/local/bookings/[id]/stay-guide failed:', err)
    const status = errorStatus(err)
    return NextResponse.json(
      { error: status === 500 ? 'Failed to add that item' : msg },
      { status, headers: CORS }
    )
  }
}
