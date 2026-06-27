import { NextResponse } from 'next/server'
import { getVerification, submitVerification } from '@/lib/local/db'
import { getUserFromRequest } from '@/lib/local/auth'

// ID verification API (no Supabase). Auth via Bearer token (mobile) or qk_token cookie (web).
// No OCR anywhere — the user simply picks/captures a FRONT and a BACK photo of their ID.
//   GET  /api/local/verification                                          → the signed-in user's status
//   POST /api/local/verification { front, back, id_number?, full_name? }   → submit ID photos for review
//
// `front`/`back` are base64 JPEGs (with or without a `data:image/...;base64,` prefix); each is
// normalized to a data URL. Back-compat: { doc } or { image } is treated as FRONT only. Images are
// stored inline (base64) so the admin panel can render them with no blob storage.
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
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS })

    // FRONT: prefer { front }; fall back to legacy { doc } / { image } (front-only). BACK: { back } (optional).
    const frontRaw: string = body.front || body.doc || body.image || ''
    const backRaw: string = body.back || ''
    if (!frontRaw || frontRaw.length < 100) {
      return NextResponse.json({ error: 'front (ID image) is required' }, { status: 400, headers: CORS })
    }
    // Normalize each to a data URL so the admin can render it directly in an <img>.
    const front = frontRaw.startsWith('data:') ? frontRaw : `data:image/jpeg;base64,${frontRaw}`
    const back = backRaw ? (backRaw.startsWith('data:') ? backRaw : `data:image/jpeg;base64,${backRaw}`) : null
    // Guard against runaway payloads (base64 of a ~5 MB image ≈ 6.7 MB).
    if (front.length > 9_000_000 || (back && back.length > 9_000_000)) {
      return NextResponse.json({ error: 'Image too large; please use a smaller photo' }, { status: 413, headers: CORS })
    }
    const v = await submitVerification({
      userId: user.id,
      imageData: front,
      backImageData: back,
      idNumber: body.id_number || body.idNumber || null,
      fullName: body.full_name || body.fullName || null,
      source: 'manual',
    })
    return NextResponse.json({ status: v.status, verified_at: v.reviewed_at }, { status: 201, headers: CORS })
  } catch (err) {
    console.error('POST /api/local/verification failed:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: CORS })
  }
}
