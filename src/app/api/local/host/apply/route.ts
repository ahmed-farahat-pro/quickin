import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/local/auth'
import { submitHostApplication, getHostApplication } from '@/lib/local/db'

// POST /api/local/host/apply { national_id, phone, address, full_name?, company?, notes? } (auth)
//   → submits a host application for admin review (does NOT grant host).
// GET  /api/local/host/apply  (auth) → the current user's application status (or null).
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function POST(req: Request) {
  try {
    const me = await getUserFromRequest(req)
    if (!me) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400, headers: CORS })
    const out = await submitHostApplication(me.id, {
      full_name: body.full_name, national_id: body.national_id, phone: body.phone,
      address: body.address, company: body.company, notes: body.notes, host_type: body.host_type,
    })
    return NextResponse.json({ ok: true, ...out }, { headers: CORS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const status = /required|Invalid/i.test(msg) ? 400 : 500
    if (status === 500) console.error('host apply failed:', err)
    return NextResponse.json({ error: status === 400 ? msg : 'Could not submit application' }, { status, headers: CORS })
  }
}

export async function GET(req: Request) {
  try {
    const me = await getUserFromRequest(req)
    if (!me) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const app = await getHostApplication(me.id)
    return NextResponse.json({ application: app }, { headers: CORS })
  } catch {
    return NextResponse.json({ application: null }, { headers: CORS })
  }
}
