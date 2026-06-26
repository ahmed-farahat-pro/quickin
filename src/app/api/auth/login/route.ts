import { NextResponse } from 'next/server'
import { getUserRowByEmail, verifyPassword, signToken, rateLimit, clientIp, publicUser, generateOtp } from '@/lib/local/auth'
import { createOtpCode } from '@/lib/local/db'
import { sendOtpEmail } from '@/lib/local/email'

export const dynamic = 'force-dynamic'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400, headers: CORS })
    }
    // Throttle brute-force: max 10 attempts per 5 min per IP+email.
    const wait = rateLimit(`login:${clientIp(req)}:${String(email).toLowerCase().trim()}`, 10, 5 * 60_000)
    if (wait) {
      return NextResponse.json(
        { error: `Too many login attempts. Please try again in ${wait}s.` },
        { status: 429, headers: { ...CORS, 'Retry-After': String(wait) } }
      )
    }
    const row = await getUserRowByEmail(String(email).trim())
    if (!row || !verifyPassword(String(password), row.password_hash)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401, headers: CORS })
    }
    // Correct password, but the email was never OTP-verified → force verification.
    // Re-issue a fresh code; clients (web/iOS/Android) route to the OTP screen on this.
    if (!row.email_verified) {
      const code = generateOtp()
      await createOtpCode(row.email, code)
      await sendOtpEmail(row.email, code)
      return NextResponse.json(
        { needsVerification: true, email: row.email, error: 'Please verify your email to continue — we sent you a new code.' },
        { status: 403, headers: CORS }
      )
    }
    const user = publicUser(row)
    const token = signToken({ sub: user.id, email: user.email })
    const res = NextResponse.json({ token, user }, { headers: CORS })
    res.cookies.set('qk_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 30 * 24 * 3600 })
    return res
  } catch (err) {
    console.error('login failed:', err)
    return NextResponse.json({ error: 'Login failed', detail: String(err) }, { status: 500, headers: CORS })
  }
}
