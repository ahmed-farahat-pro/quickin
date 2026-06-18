import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const ID_OCR_URL = process.env.ID_OCR_URL ?? 'http://localhost:8000'

export async function POST(req: NextRequest) {
  try {
    // Accept both multipart (file) and JSON (base64)
    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

      const bytes = await file.arrayBuffer()
      const b64 = Buffer.from(bytes).toString('base64')

      const resp = await fetch(`${ID_OCR_URL}/scan-base64`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: b64 }),
        signal: AbortSignal.timeout(30000),
      })
      const data = await resp.json()
      return NextResponse.json(data)
    } else {
      // JSON body with base64 image
      const body = await req.json()
      const resp = await fetch(`${ID_OCR_URL}/scan-base64`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: body.image }),
        signal: AbortSignal.timeout(30000),
      })
      const data = await resp.json()
      return NextResponse.json(data)
    }
  } catch (e: unknown) {
    return NextResponse.json(
      { error: 'OCR service unavailable. Make sure the ID OCR service is running on port 8000.' },
      { status: 503 }
    )
  }
}
