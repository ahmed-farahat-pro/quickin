import { NextResponse } from 'next/server'
import { getUserById } from '@/lib/local/db'

export const dynamic = 'force-dynamic'

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

    return NextResponse.json(
      {
        profile: {
          id: user.id,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          created_at: user.created_at,
          bio: null,
          verification_status: 'unverified',
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
