import { NextResponse } from 'next/server'
import { isAdminKey } from '@/lib/local/auth'
import { getPendingHostApplications, reviewHostApplication } from '@/lib/local/db'

// Admin (key-gated): GET ?key=  → pending host applications.
//                    POST ?key= { id, action: 'approve'|'reject', note? } → decide.
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
const keyOf = (req: Request) => new URL(req.url).searchParams.get('key') || req.headers.get('x-admin-key')

export async function GET(req: Request) {
  if (!isAdminKey(keyOf(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: CORS })
  try {
    return NextResponse.json({ applications: await getPendingHostApplications() }, { headers: CORS })
  } catch (err) {
    console.error('admin host-applications GET:', err)
    return NextResponse.json({ error: 'Failed to load' }, { status: 500, headers: CORS })
  }
}

export async function POST(req: Request) {
  if (!isAdminKey(keyOf(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: CORS })
  try {
    const body = await req.json().catch(() => null)
    const id = body?.id
    const action = body?.action === 'approve' ? 'approve' : body?.action === 'reject' ? 'reject' : null
    if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400, headers: CORS })
    await reviewHostApplication(id, action, body?.note ?? null)
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err) {
    console.error('admin host-applications POST:', err)
    return NextResponse.json({ error: 'Could not update' }, { status: 500, headers: CORS })
  }
}
