import { NextResponse } from 'next/server'
import {
  createUser, getUserRowByEmail, hashPassword, generateOtp,
  isValidEmail, isDisposableEmail, rateLimit, clientIp,
} from '@/lib/local/auth'
import { createOtpCode } from '@/lib/local/db'
import { sendOtpEmail } from '@/lib/local/email'

export const dynamic = 'force-dynamic'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function POST(req: Request) {
  try {
    // Throttle signups: max 5 per minute per IP.
    const wait = rateLimit(`signup:${clientIp(req)}`, 5, 60_000)
    if (wait) {
      return NextResponse.json(
        { error: `Too many sign-up attempts. Please try again in ${wait}s.` },
        { status: 429, headers: { ...CORS, 'Retry-After': String(wait) } }
      )
    }
    const { email, password, full_name } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400, headers: CORS })
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400, headers: CORS })
    }
    if (isDisposableEmail(email)) {
      return NextResponse.json(
        { error: 'Temporary or disposable email addresses are not allowed. Please use a permanent personal or work email.' },
        { status: 400, headers: CORS }
      )
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400, headers: CORS })
    }
    const existing = await getUserRowByEmail(email)
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409, headers: CORS })
    }
    const user = await createUser({
      email: String(email).trim(),
      passwordHash: hashPassword(String(password)),
      fullName: String(full_name || '').trim() || String(email).split('@')[0],
    })
    // Email verification: send a 6-digit code; the session is issued by /verify-otp.
    const code = generateOtp()
    await createOtpCode(user.email, code)
    await sendOtpEmail(user.email, code)
    return NextResponse.json({ pending: true, email: user.email }, { headers: CORS })
  } catch (err) {
    console.error('signup failed:', err)
    return NextResponse.json({ error: 'Signup failed', detail: String(err) }, { status: 500, headers: CORS })
  }
}
