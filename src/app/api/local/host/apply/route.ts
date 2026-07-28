import { NextResponse } from 'next/server'
import { getUserFromRequest, getUserRowByEmail, getHostState } from '@/lib/local/auth'
import { submitHostApplication, getHostApplication, HostApplicationError } from '@/lib/local/db'

// POST /api/local/host/apply { full_name, national_id, phone, address, host_type, company?, notes? } (auth)
//   → submits (or re-submits) a host application for admin review. Never grants host —
//     only an admin approval in /ops does. 400 { error, fields } on validation failure;
//     409 when the user is already a host or already has an application under review.
// GET  /api/local/host/apply  (auth) → { host_status, application } for the current user.
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
    if (err instanceof HostApplicationError) {
      const payload = err.fields ? { error: err.message, fields: err.fields } : { error: err.message }
      return NextResponse.json(payload, { status: err.status, headers: CORS })
    }
    console.error('host apply failed:', err)
    return NextResponse.json({ error: 'Could not submit application' }, { status: 500, headers: CORS })
  }
}

export async function GET(req: Request) {
  try {
    const me = await getUserFromRequest(req)
    if (!me) return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: CORS })
    const row = await getUserRowByEmail(me.email)
    const [application, host] = await Promise.all([
      getHostApplication(me.id),
      getHostState(me.id, !!row?.is_host),
    ])
    return NextResponse.json({ host_status: host.host_status, application }, { headers: CORS })
  } catch {
    return NextResponse.json({ host_status: 'none', application: null }, { headers: CORS })
  }
}

export function OPTIONS() {
  return new NextResponse(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } })
}
