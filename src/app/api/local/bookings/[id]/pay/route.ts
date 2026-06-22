import { NextResponse } from 'next/server'
import { payBooking } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

// Mock payment (no real gateway). Only allowed once the host has APPROVED the
// request (status 'confirmed'); records payment (paid_at) without changing status,
// so the booking becomes "confirmed & paid".
//   POST /api/local/bookings/:id/pay { method?, promo_code? } (auth) → { ok, booking, receipt }
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { booking, receipt } = await payBooking({
      userId: user.id,
      bookingId: id,
      method: body.method,
      promoCode: body.promo_code || body.promoCode || null,
    })
    return NextResponse.json({ ok: true, booking, receipt }, { headers: CORS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const status = /not found/i.test(msg) ? 404 : /no longer|awaiting|cannot be paid|Invalid/i.test(msg) ? 400 : 500
    return NextResponse.json({ error: msg }, { status, headers: CORS })
  }
}
