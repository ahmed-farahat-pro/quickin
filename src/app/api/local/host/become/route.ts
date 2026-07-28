import { NextResponse } from 'next/server'
import { getUserFromRequest, getUserRowByEmail, getHostState } from '@/lib/local/auth'

// POST /api/local/host/become — RETIRED. Becoming a host is an admin-reviewed
// application now, so this no longer flips users.is_host; only an approval in /ops
// does. The route stays mounted and answers 410 so an old client gets a clear,
// non-crashing error plus the real host_status instead of a silent fake success.
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function POST(req: Request) {
  try {
    const me = await getUserFromRequest(req)
    if (!me) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const row = await getUserRowByEmail(me.email)
    const { host_status } = await getHostState(me.id, !!row?.is_host)
    return NextResponse.json({ error: 'Use /api/local/host/apply', host_status }, { status: 410, headers: CORS })
  } catch (err) {
    console.error('become-host status lookup failed:', err)
    return NextResponse.json({ error: 'Use /api/local/host/apply', host_status: 'none' }, { status: 410, headers: CORS })
  }
}

export function OPTIONS() {
  return new NextResponse(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } })
}
