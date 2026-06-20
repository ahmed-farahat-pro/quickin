import { NextResponse } from 'next/server'
import { getUserRowByEmail, signToken, rateLimit, clientIp } from '@/lib/local/auth'
import { verifyOtpCode } from '@/lib/local/db'

// Verify the emailed 6-digit code and issue the session.
//   POST /api/auth/verify-otp { email, code } → { token, user } | 400
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json()
    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400, headers: CORS })
    }
    // Cap verification attempts: 10 per 10 min per IP+email.
    const wait = rateLimit(`verifyotp:${clientIp(req)}:${String(email).toLowerCase().trim()}`, 10, 10 * 60_000)
    if (wait) {
      return NextResponse.json(
        { error: `Too many attempts. Please try again in ${wait}s.` },
        { status: 429, headers: { ...CORS, 'Retry-After': String(wait) } }
      )
    }
    const ok = await verifyOtpCode(String(email), String(code))
    if (!ok) {
      return NextResponse.json({ error: 'That code is invalid or has expired.' }, { status: 400, headers: CORS })
    }
    const row = await getUserRowByEmail(String(email).trim())
    if (!row) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404, headers: CORS })
    }
    const user = {
      id: row.id, email: row.email, full_name: row.full_name,
      provider: row.provider, avatar_url: row.avatar_url,
    }
    const token = signToken({ sub: user.id, email: user.email })
    const res = NextResponse.json({ token, user }, { headers: CORS })
    res.cookies.set('qk_token', token, { httpOnly: true, sameSite: 'lax', path: '/' })
    return res
  } catch (err) {
    console.error('verify-otp failed:', err)
    return NextResponse.json({ error: 'Verification failed', detail: String(err) }, { status: 500, headers: CORS })
  }
}
