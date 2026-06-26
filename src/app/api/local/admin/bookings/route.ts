import { NextResponse } from 'next/server'
import { isAdminKey } from '@/lib/local/auth'
import { adminListBookings } from '@/lib/local/db'

// Admin (key-gated): GET ?key=  → newest-first bookings with guest + listing info.
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
const keyOf = (req: Request) => new URL(req.url).searchParams.get('key') || req.headers.get('x-admin-key')

export async function GET(req: Request) {
  if (!isAdminKey(keyOf(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: CORS })
  try {
    return NextResponse.json({ bookings: await adminListBookings() }, { headers: CORS })
  } catch (err) {
    console.error('admin bookings GET:', err)
    return NextResponse.json({ error: 'Failed to load' }, { status: 500, headers: CORS })
  }
}
