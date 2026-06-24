import { NextResponse } from 'next/server'
import { getHostBookings } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

// Host inbox (no Supabase). Auth via Bearer token (mobile) or qk_token cookie (web).
//   GET /api/local/host/bookings → { bookings } reservations on the signed-in host's listings
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const bookings = await getHostBookings(user.id)
    return NextResponse.json({ bookings }, { headers: CORS })
  } catch (err) {
    console.error('GET /api/local/host/bookings failed:', err)
    return NextResponse.json({ error: 'Failed to load reservations', detail: String(err) }, { status: 500, headers: CORS })
  }
}
