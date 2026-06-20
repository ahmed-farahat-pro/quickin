import { NextResponse } from 'next/server'
import { getCancellationQuote, cancelBooking } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

// Guest cancellation (no Supabase). Default "moderate" refund policy.
//   GET  /api/local/bookings/:id/cancel  (auth) → CancellationQuote (read-only, no mutation)
//   POST /api/local/bookings/:id/cancel  (auth) → { booking, refund }  (status → 'cancelled')
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const { id } = await params
    return NextResponse.json(await getCancellationQuote(user.id, id), { headers: CORS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const status = /not found/i.test(msg) ? 404 : /Invalid/i.test(msg) ? 400 : 500
    return NextResponse.json({ error: msg }, { status, headers: CORS })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const { id } = await params
    return NextResponse.json(await cancelBooking(user.id, id), { status: 200, headers: CORS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const status = /not found/i.test(msg) ? 404 : /already cancelled|Invalid/i.test(msg) ? 400 : 500
    return NextResponse.json({ error: msg }, { status, headers: CORS })
  }
}
