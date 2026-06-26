import { NextResponse } from 'next/server'
import { isAdminKey } from '@/lib/local/auth'
import { adminStats } from '@/lib/local/db'

// Admin (key-gated): GET ?key=  → top-line dashboard counts.
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
const keyOf = (req: Request) => new URL(req.url).searchParams.get('key') || req.headers.get('x-admin-key')

export async function GET(req: Request) {
  if (!isAdminKey(keyOf(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: CORS })
  try {
    return NextResponse.json({ stats: await adminStats() }, { headers: CORS })
  } catch (err) {
    console.error('admin stats GET:', err)
    return NextResponse.json({ error: 'Failed to load' }, { status: 500, headers: CORS })
  }
}
