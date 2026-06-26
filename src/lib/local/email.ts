// OTP email delivery. The SMTP credentials live on the backend project
// (quickin-backend), so the frontend delegates the actual send to that backend's
// internal mail relay instead of speaking SMTP itself.
//   MAIL_BACKEND_URL   e.g. https://quickin-backend.vercel.app
//   MAIL_RELAY_SECRET  shared secret matching the backend's MAIL_RELAY_SECRET
// When unset (local dev), the code is logged so the OTP flow still works offline.

const BACKEND = (process.env.MAIL_BACKEND_URL || '').replace(/\/+$/, '')
const SECRET = process.env.MAIL_RELAY_SECRET || ''

/**
 * Send the 6-digit verification code via the backend mail relay.
 * Never throws — a delivery failure must not break signup; it's logged instead so
 * the cause is diagnosable (and the code is logged when the relay isn't configured).
 */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  if (!BACKEND || !SECRET) {
    console.log(`[OTP][dev] mail relay not configured — verification code for ${to}: ${code}`)
    return
  }
  try {
    const res = await fetch(`${BACKEND}/api/mail/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-relay-secret': SECRET },
      body: JSON.stringify({ to, code }),
      cache: 'no-store',
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`[OTP] relay rejected send for ${to}: ${res.status} ${detail}`)
      return
    }
    console.log(`[OTP] verification code sent to ${to} via backend relay`)
  } catch (e) {
    console.error(`[OTP] relay request failed for ${to}: ${e}`)
  }
}
