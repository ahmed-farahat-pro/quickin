import { NextResponse } from 'next/server'
import { isAdminKey } from '@/lib/local/auth'
import { adminListListings, adminSetListingPublished, adminDeleteListing } from '@/lib/local/db'

// Admin (key-gated): GET ?key=  → newest-first listings.
//                    POST ?key= { id, action: 'publish'|'unpublish'|'delete' } → mutate.
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
    if (!id || (action !== 'publish' && action !== 'unpublish' && action !== 'delete')) {
      return NextResponse.json({ error: 'id and action required' }, { status: 400, headers: CORS })
    }
    if (action === 'publish') await adminSetListingPublished(id, true)
    else if (action === 'unpublish') await adminSetListingPublished(id, false)
    else await adminDeleteListing(id)
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err) {
    console.error('admin listings POST:', err)
    return NextResponse.json({ error: 'Could not update' }, { status: 500, headers: CORS })
  }
}
