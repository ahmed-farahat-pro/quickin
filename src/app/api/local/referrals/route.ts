import { NextResponse } from 'next/server'
import { getReferralSummary } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

//   GET /api/local/referrals (auth) → { code, count, rewardTotal, referred }
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    return NextResponse.json(await getReferralSummary(user.id), { headers: CORS })
  } catch (err) {
    console.error('GET /api/local/referrals failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500, headers: CORS })
  }
}
