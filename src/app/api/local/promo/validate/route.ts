import { NextResponse } from 'next/server'
import { quotePromo } from '@/lib/local/db'

// Validate a promo code against a subtotal (no auth needed — it's just a quote).
//   POST /api/local/promo/validate { code, subtotal } → { valid, code, kind, value, discount, message }
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const subtotal = Number(body.subtotal ?? body.amount ?? 0)
    return NextResponse.json(quotePromo(body.code ?? '', subtotal), { headers: CORS })
  } catch (err) {
    console.error('POST /api/local/promo/validate failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500, headers: CORS })
  }
}
