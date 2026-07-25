import { NextResponse } from 'next/server'
import { isAdminKey } from '@/lib/local/auth'
import { getAppLinks, setAppLinks } from '@/lib/local/db'

// Admin (key-gated): GET returns the current app store links; POST { ios, android }
// saves them. Backs the "App download links" card in the /ops console.
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
const keyOf = (req: Request) => new URL(req.url).searchParams.get('key') || req.headers.get('x-admin-key')

// Store only valid http(s) URLs; anything else (incl. empty) clears the link.
function cleanUrl(v: unknown): string | null {
  const s = String(v ?? '').trim()
  if (!s) return null
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:' ? s : null
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  if (!isAdminKey(keyOf(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: CORS })
  try {
    return NextResponse.json(await getAppLinks(), { headers: CORS })
  } catch (err) {
    console.error('admin app-links GET:', err)
    return NextResponse.json({ error: 'Failed to load' }, { status: 500, headers: CORS })
  }
}

export async function POST(req: Request) {
  if (!isAdminKey(keyOf(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: CORS })
  try {
    const body = await req.json().catch(() => ({}))
    await setAppLinks(cleanUrl(body.ios), cleanUrl(body.android))
    return NextResponse.json(await getAppLinks(), { headers: CORS })
  } catch (err) {
    console.error('admin app-links POST:', err)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500, headers: CORS })
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' },
  })
}
