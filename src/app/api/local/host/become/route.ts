import { NextResponse } from 'next/server'
import { getUserFromRequest, getUserRowByEmail, becomeHost, publicUser } from '@/lib/local/auth'

// POST /api/local/host/become — promote the CURRENT signed-in account to a host.
// One unified account: this just flips users.is_host = true (idempotent); it never
// creates a new account or requires re-registration.
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function POST(req: Request) {
  try {
    const me = await getUserFromRequest(req)
    if (!me) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    await becomeHost(me.id)
    const row = await getUserRowByEmail(me.email)
    return NextResponse.json({ ok: true, user: row ? publicUser(row) : null }, { headers: CORS })
  } catch (err) {
    console.error('become-host failed:', err)
    return NextResponse.json({ error: 'Could not enable hosting' }, { status: 500, headers: CORS })
  }
}

export function OPTIONS() {
  return new NextResponse(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } })
}
