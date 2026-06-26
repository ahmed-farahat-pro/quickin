// TEMPORARY one-shot migration: users.email_verified (email OTP gate). Idempotent. Key-protected. REMOVE after running.
import { NextResponse } from 'next/server'
import { pool } from '@/lib/local/pool'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const KEY = 'qk-mig4-2f7a'

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('key') !== KEY) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const steps: string[] = []
  const run = async (label: string, sql: string) => {
    try { await pool.query(sql); steps.push('ok: ' + label) }
    catch (e) { steps.push('ERR ' + label + ': ' + (e as Error).message) }
  }
  await run('add users.email_verified', `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false`)
  // Grandfather any social accounts (provider != 'email') as verified — they never do OTP.
  await run('verify social accounts', `UPDATE users SET email_verified = true WHERE provider <> 'email' AND email_verified = false`)
  let cols: string[] = []
  try {
    const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='email_verified'`)
    cols = r.rows.map((x: { column_name: string }) => x.column_name)
  } catch { /* ignore */ }
  return NextResponse.json({ ok: true, steps, email_verified_present: cols.length > 0 })
}
