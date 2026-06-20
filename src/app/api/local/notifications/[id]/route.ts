import { NextResponse } from 'next/server'
import { markNotificationRead } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

// Mark a single notification read.
//   PATCH /api/local/notifications/:id (auth) → { ok }
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

async function mark(req: Request, id: string) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
  await markNotificationRead(user.id, id)
  return NextResponse.json({ ok: true }, { headers: CORS })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await mark(req, (await params).id)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500, headers: CORS })
  }
}

// Tolerate POST too, in case a client uses it.
export const POST = PATCH
