import { NextResponse } from 'next/server'
import { updateStayGuideItem, deleteStayGuideItem, isStayGuideInputError } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

// One stay-guide item. Both verbs are HOST-ONLY (the host of the listing the
// booking belongs to) and only on a confirmed booking — enforced in db.ts.
//   PATCH  /api/local/bookings/:id/stay-guide/:itemId { kind?, title?, body?, url?, order? }
//   DELETE /api/local/bookings/:id/stay-guide/:itemId
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

/** Same mapping as the collection route: authorization → 403/404, the host's own
 *  input → 400 with the reason, anything else → an opaque 500. */
function errorStatus(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err)
  if (/Forbidden/i.test(msg)) return 403
  if (/not found/i.test(msg)) return 404
  if (isStayGuideInputError(err)) return 400
  return 500
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const { id, itemId } = await params
    const body = await req.json().catch(() => ({}))
    const item = await updateStayGuideItem(user.id, id, itemId, body)
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404, headers: CORS })
    return NextResponse.json(item, { headers: CORS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('PATCH /api/local/bookings/[id]/stay-guide/[itemId] failed:', err)
    const status = errorStatus(err)
    return NextResponse.json(
      { error: status === 500 ? 'Failed to update that item' : msg },
      { status, headers: CORS }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const { id, itemId } = await params
    const removed = await deleteStayGuideItem(user.id, id, itemId)
    if (!removed) return NextResponse.json({ error: 'Item not found' }, { status: 404, headers: CORS })
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('DELETE /api/local/bookings/[id]/stay-guide/[itemId] failed:', err)
    const status = errorStatus(err)
    return NextResponse.json(
      { error: status === 500 ? 'Failed to remove that item' : msg },
      { status, headers: CORS }
    )
  }
}
