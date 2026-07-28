// TEMPORARY migration: stay pass + host-authored stay guide. Idempotent. Key-gated. REMOVE after run.
//   1. bookings.reservation_code — the real column the QR / wallet pass / /stay/<code>
//      page resolve against (quickin-backend already writes it; the web used to
//      synthesize a fake one at SELECT time, which could never resolve).
//   2. stay_guide_items — the host-authored guide shown on the public stay page.
//   3. Backfill: issue a code to already-CONFIRMED bookings that have none.
//      Pending bookings are left NULL on purpose — no code, no QR, no pass.
import { NextResponse } from 'next/server'
import { pool } from '@/lib/local/pool'
import { genReservationCode } from '@/lib/local/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const KEY = 'qk-mig6-2b91'

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('key') !== KEY) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const steps: string[] = []
  const run = async (label: string, sql: string) => {
    try { await pool.query(sql); steps.push('ok: ' + label) } catch (e) { steps.push('ERR ' + label + ': ' + (e as Error).message) }
  }
  await run('add bookings.reservation_code', `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reservation_code text`)
  // Same name + predicate as local-backend/init.sql, so this is a true no-op on
  // a database that already has the schema.
  await run('unique reservation_code', `CREATE UNIQUE INDEX IF NOT EXISTS ux_bookings_reservation_code ON bookings (upper(reservation_code)) WHERE reservation_code IS NOT NULL`)
  await run('create stay_guide_items', `
    CREATE TABLE IF NOT EXISTS stay_guide_items (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      kind        text NOT NULL,
      title       text,
      body        text,
      url         text,
      "order"     int DEFAULT 0,
      created_at  timestamptz DEFAULT now()
    )`)
  await run('index stay_guide_items', `CREATE INDEX IF NOT EXISTS idx_stay_guide_booking ON stay_guide_items(booking_id, "order")`)

  // Backfill confirmed bookings only, one code per row (the generator lives in
  // db.ts so web + backend mint identical formats).
  let backfilled = 0
  try {
    const { rows } = await pool.query(
      `SELECT id FROM bookings WHERE status = 'confirmed' AND (reservation_code IS NULL OR reservation_code = '')`
    )
    for (const row of rows as Array<{ id: string }>) {
      // COALESCE keeps any code that appeared meanwhile — codes are never reissued.
      await pool.query(
        `UPDATE bookings SET reservation_code = COALESCE(NULLIF(reservation_code, ''), $2) WHERE id = $1`,
        [row.id, genReservationCode()]
      )
      backfilled++
    }
    steps.push(`ok: backfilled ${backfilled} confirmed booking(s)`)
  } catch (e) {
    steps.push('ERR backfill: ' + (e as Error).message)
  }

  let pendingWithCode = 0
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n FROM bookings WHERE status = 'pending' AND reservation_code IS NOT NULL AND reservation_code <> ''`
    )
    pendingWithCode = r.rows[0]?.n ?? 0
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true, steps, backfilled, pendingWithCode })
}
