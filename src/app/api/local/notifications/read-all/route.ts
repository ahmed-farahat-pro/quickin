import { NextResponse } from 'next/server'
import { markAllNotificationsRead } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

//   POST /api/local/notifications/read-all (auth) → marks all read
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    await markAllNotificationsRead(user.id)
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err) {
    console.error('POST /api/local/notifications/read-all failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500, headers: CORS })
  }
}
