import { NextResponse } from 'next/server'
import { generateOtp, isValidEmail, rateLimit } from '@/lib/local/auth'
import { createOtpCode } from '@/lib/local/db'
import { sendOtpEmail } from '@/lib/local/email'

// Resend the verification code. Enforces a 30s cooldown (the mobile/web timer
// mirrors this) plus a 5-per-hour cap, per email.
//   POST /api/auth/resend-otp { email } → { pending: true, cooldown: 30 } | 429
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
const COOLDOWN = 30

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400, headers: CORS })
    }
    const key = String(email).toLowerCase().trim()
    const cd = rateLimit(`resendotp-cd:${key}`, 1, COOLDOWN * 1000)
    if (cd) {
      return NextResponse.json(
        { error: `Please wait ${cd}s before requesting another code.`, cooldown: cd },
        { status: 429, headers: { ...CORS, 'Retry-After': String(cd) } }
      )
    }
    const hourly = rateLimit(`resendotp-hr:${key}`, 5, 60 * 60_000)
    if (hourly) {
      return NextResponse.json(
        { error: 'Too many code requests. Please try again later.' },
        { status: 429, headers: { ...CORS, 'Retry-After': String(hourly) } }
      )
    }
    const code = generateOtp()
    await createOtpCode(key, code)
    await sendOtpEmail(key, code)
    return NextResponse.json({ pending: true, cooldown: COOLDOWN }, { headers: CORS })
  } catch (err) {
    console.error('resend-otp failed:', err)
    return NextResponse.json({ error: 'Could not resend the code', detail: String(err) }, { status: 500, headers: CORS })
  }
}
