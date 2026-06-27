import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/local/auth'
import { adminDeleteUser } from '@/lib/local/db'

// Self-service account deletion (App Store 5.1.1(v) / Google Play account-deletion policy).
//   DELETE /api/local/account (auth) — permanently deletes the signed-in user + their data.
//   POST   /api/local/account (auth) — same (clients that can't send a DELETE).
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

async function deleteSelf(req: Request) {
  const me = await getUserFromRequest(req)
  if (!me) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
  try {
    await adminDeleteUser(me.id) // transactional: removes their listings + the account (rest cascades)
  } catch (err) {
    console.error('account self-delete failed:', err)
    return NextResponse.json({ error: 'Could not delete account' }, { status: 500, headers: CORS })
  }
  const res = NextResponse.json({ ok: true, deleted: true }, { headers: CORS })
  res.cookies.set('qk_token', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return res
}

export async function DELETE(req: Request) {
  return deleteSelf(req)
}

export async function POST(req: Request) {
  return deleteSelf(req)
}
