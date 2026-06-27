// TEMPORARY migration: id_verifications.back_image_data (front+back ID images). Idempotent. Key-gated. REMOVE after run.
import { NextResponse } from 'next/server'
import { pool } from '@/lib/local/pool'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const KEY = 'qk-mig5-7a3c'

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('key') !== KEY) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const steps: string[] = []
  const run = async (label: string, sql: string) => {
    try { await pool.query(sql); steps.push('ok: ' + label) } catch (e) { steps.push('ERR ' + label + ': ' + (e as Error).message) }
  }
  await run('add id_verifications.back_image_data', `ALTER TABLE id_verifications ADD COLUMN IF NOT EXISTS back_image_data text`)
  let present = false
  try {
    const r = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name='id_verifications' AND column_name='back_image_data'`)
    present = r.rows.length > 0
  } catch { /* ignore */ }
  return NextResponse.json({ ok: true, steps, back_image_data_present: present })
}
