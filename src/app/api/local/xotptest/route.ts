// TEMPORARY OTP/relay diagnostic. Key-protected. REMOVE after use.
//   GET ?key=KEY&relay=1        -> reports MAIL_* env presence + does a live relay send from this runtime
//   GET ?key=KEY&peek=<email>   -> returns the current otp_codes.code for an email (to complete verify-otp in tests)
import { NextResponse } from 'next/server'
import { pool } from '@/lib/local/pool'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const KEY = 'qk-otptest-5b3d'

export async function GET(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('key') !== KEY) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const backendUrl = process.env.MAIL_BACKEND_URL || ''
  const secret = process.env.MAIL_RELAY_SECRET || ''
  const out: Record<string, unknown> = {
    backendUrlSet: !!backendUrl,
    secretSet: !!secret,
    backendUrl: backendUrl || null,
  }

  const peek = url.searchParams.get('peek')
  if (peek) {
    try {
      const { rows } = await pool.query(`SELECT code FROM otp_codes WHERE email = lower($1)`, [peek])
      out.code = rows[0]?.code ?? null
    } catch (e) { out.peekError = (e as Error).message }
  }

  if (url.searchParams.get('relay') === '1' && backendUrl && secret) {
    try {
      const r = await fetch(`${backendUrl.replace(/\/+$/, '')}/api/mail/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-relay-secret': secret },
        body: JSON.stringify({ to: 'tech@problem-x.com', code: '999111' }),
        cache: 'no-store',
      })
      out.relayStatus = r.status
      out.relayBody = await r.json().catch(() => null)
    } catch (e) { out.relayError = (e as Error).message }
  }

  return NextResponse.json(out)
}
