import { NextResponse } from 'next/server'
import { isAdminKey } from '@/lib/local/auth'
import { adminListListings, adminSetListingPublished, adminDeleteListing, adminSetListingApproval } from '@/lib/local/db'

// Admin (key-gated): GET ?key=  → newest-first listings.
//                    POST ?key= { id, action: 'publish'|'unpublish'|'delete'|'approve'|'reject', note? } → mutate.
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
const keyOf = (req: Request) => new URL(req.url).searchParams.get('key') || req.headers.get('x-admin-key')

export async function GET(req: Request) {
  if (!isAdminKey(keyOf(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: CORS })
  try {
    return NextResponse.json({ listings: await adminListListings() }, { headers: CORS })
  } catch (err) {
    console.error('admin listings GET:', err)
    return NextResponse.json({ error: 'Failed to load' }, { status: 500, headers: CORS })
  }
}

export async function POST(req: Request) {
  if (!isAdminKey(keyOf(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: CORS })
  try {
    const body = await req.json().catch(() => null)
    const id = body?.id
    const action = body?.action
    const ALLOWED = ['publish', 'unpublish', 'delete', 'approve', 'reject']
    if (!id || !ALLOWED.includes(action)) {
      return NextResponse.json({ error: 'id and action required' }, { status: 400, headers: CORS })
    }
    if (action === 'publish') await adminSetListingPublished(id, true)
    else if (action === 'unpublish') await adminSetListingPublished(id, false)
    else if (action === 'approve') await adminSetListingApproval(id, 'approve', body?.note ?? null)
    else if (action === 'reject') await adminSetListingApproval(id, 'reject', body?.note ?? null)
    else await adminDeleteListing(id)
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err) {
    console.error('admin listings POST:', err)
    return NextResponse.json({ error: 'Could not update' }, { status: 500, headers: CORS })
  }
}
