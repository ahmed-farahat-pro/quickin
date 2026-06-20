import { NextResponse } from 'next/server'
import { registerPushToken } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

// Register this device's push token (best-effort; no real push delivery yet).
//   PATCH /api/local/notifications/register { fcm_token | token, platform } (auth) → { ok }
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function PATCH(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ ok: false }, { status: 401, headers: CORS })
    const body = await req.json().catch(() => ({}))
    const fcm = String(body.fcm_token || body.token || '')
    if (fcm) await registerPushToken(user.id, fcm, String(body.platform || ''))
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err) {
    console.error('PATCH /api/local/notifications/register failed:', err)
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS }) // never surface to UI
  }
}
