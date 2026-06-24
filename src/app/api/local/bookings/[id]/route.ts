import { NextResponse } from 'next/server'
import { getBookingById, patchBooking } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

// Single reservation + host actions (no Supabase).
//   GET   /api/local/bookings/:id                        (auth) → Booking (with reservation_code)
//   PATCH /api/local/bookings/:id { host_notes?, status? } (auth) → updated Booking
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const { id } = await params
    const booking = await getBookingById(user.id, id)
    if (!booking) return NextResponse.json({ error: 'Reservation not found' }, { status: 404, headers: CORS })
    return NextResponse.json(booking, { headers: CORS })
  } catch (err) {
    console.error('GET /api/local/bookings/[id] failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500, headers: CORS })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const hostNotes = 'host_notes' in body ? String(body.host_notes ?? '') : undefined
    const status = body.status ? String(body.status) : undefined
    // Pass through undefined for omitted fields so patchBooking only updates what
    // was actually supplied (e.g. a status decision must not wipe host_notes).
    const booking = await patchBooking(user.id, id, hostNotes, status)
    if (!booking) return NextResponse.json({ error: 'Reservation not found' }, { status: 404, headers: CORS })
    return NextResponse.json(booking, { headers: CORS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const status = /Forbidden/i.test(msg) ? 403 : /Invalid/i.test(msg) ? 400 : 500
    return NextResponse.json({ error: msg }, { status, headers: CORS })
  }
}
