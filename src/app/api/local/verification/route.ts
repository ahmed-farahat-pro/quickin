import { NextResponse } from 'next/server'
import { getVerification, submitVerification } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

// ID verification API (no Supabase). Auth via Bearer token (mobile) or qk_token cookie (web).
//   GET  /api/local/verification                                  → the signed-in user's status
//   POST /api/local/verification { doc, id_number?, full_name?, source? } → submit ID photo for review
//
// `doc` is a base64 JPEG (with or without a `data:image/...;base64,` prefix). The image is
// stored inline (base64) so the admin panel can render it with no blob storage. Used by the
// manual fallback on iOS/Android/Web when the StructOCR auto-scan fails or runs out of credits.
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const v = await getVerification(user.id)
    return NextResponse.json(
      {
        status: v.status,
        verified_at: v.reviewed_at,
        notes: v.notes,
        id_number: v.id_number,
        submitted_at: v.submitted_at,
      },
      { headers: CORS }
    )
  } catch (err) {
    console.error('GET /api/local/verification failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500, headers: CORS })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Please sign in to verify your identity' }, { status: 401, headers: CORS })
    }
    const body = await req.json()
    const doc: string = body.doc || body.image || ''
    if (!doc || doc.length < 100) {
      return NextResponse.json({ error: 'doc (ID image) is required' }, { status: 400, headers: CORS })
    }
    // Normalize to a data URL so the admin can render it directly in an <img>.
    const imageData = doc.startsWith('data:') ? doc : `data:image/jpeg;base64,${doc}`
    // Guard against runaway payloads (base64 of a ~5 MB image ≈ 6.7 MB).
    if (imageData.length > 9_000_000) {
      return NextResponse.json({ error: 'Image too large; please use a smaller photo' }, { status: 413, headers: CORS })
    }
    const v = await submitVerification({
      userId: user.id,
      imageData,
      idNumber: body.id_number || body.idNumber || null,
      fullName: body.full_name || body.fullName || null,
      source: body.source === 'structocr' ? 'structocr' : 'manual',
    })
    return NextResponse.json({ status: v.status, verified_at: v.reviewed_at }, { status: 201, headers: CORS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/local/verification failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500, headers: CORS })
  }
}
