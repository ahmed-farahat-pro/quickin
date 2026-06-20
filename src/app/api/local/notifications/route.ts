import { NextResponse } from 'next/server'
import { getNotifications } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

// In-app notifications feed (e.g. "your booking was approved").
//   GET /api/local/notifications (auth) → { notifications: [...], unreadCount }
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    return NextResponse.json(await getNotifications(user.id), { headers: CORS })
  } catch (err) {
    console.error('GET /api/local/notifications failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500, headers: CORS })
  }
}
