import { NextResponse } from 'next/server'
import { isAdminKey } from '@/lib/local/auth'
import { adminListUsers, adminActivateUser, adminDeleteUser } from '@/lib/local/db'

// Admin (key-gated): GET ?key=  → newest-first users with verification + counts.
//                    POST ?key= { id, action:'activate'|'delete' } → verify / delete user.
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
const keyOf = (req: Request) => new URL(req.url).searchParams.get('key') || req.headers.get('x-admin-key')

export async function GET(req: Request) {
  if (!isAdminKey(keyOf(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: CORS })
  try {
    return NextResponse.json({ users: await adminListUsers() }, { headers: CORS })
  } catch (err) {
    console.error('admin users GET:', err)
    return NextResponse.json({ error: 'Failed to load' }, { status: 500, headers: CORS })
  }
}

export async function POST(req: Request) {
  if (!isAdminKey(keyOf(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: CORS })
  try {
    const body = await req.json().catch(() => null)
    const id = body?.id
    const action = body?.action
    if (!id || (action !== 'activate' && action !== 'delete')) {
      return NextResponse.json({ error: "id and action:'activate'|'delete' required" }, { status: 400, headers: CORS })
    }
    if (action === 'delete') await adminDeleteUser(id)
    else await adminActivateUser(id)
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err) {
    console.error('admin users POST:', err)
    return NextResponse.json({ error: 'Could not update user' }, { status: 500, headers: CORS })
  }
}
