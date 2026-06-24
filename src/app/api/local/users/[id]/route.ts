import { NextResponse } from 'next/server'
import { getUserById, updateUserProfile, getVerification } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getUserById(id)

    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const verification = await getVerification(id)

    return NextResponse.json(
      {
        profile: {
          id: user.id,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          created_at: user.created_at,
          bio: null,
          verification_status: verification.status,
        },
        listings: [],
        reviews: [],
      },
      { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('GET /api/local/users/[id] failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PATCH /api/local/users/:id { full_name?, avatar_url? } → { ok: true }
// Auth required; a user may only edit their own profile.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getUserFromRequest(req)
    if (!caller) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const { id } = await params
    if (caller.id !== id) {
      return NextResponse.json({ error: 'You can only edit your own profile' }, { status: 403, headers: CORS })
    }
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers: CORS })
    const fields: { full_name?: string; avatar_url?: string } = {}
    if (body.full_name !== undefined) fields.full_name = String(body.full_name)
    if (body.avatar_url !== undefined) fields.avatar_url = String(body.avatar_url)
    await updateUserProfile(id, fields)
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err) {
    console.error('PATCH /api/local/users/[id] failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500, headers: CORS })
  }
}
