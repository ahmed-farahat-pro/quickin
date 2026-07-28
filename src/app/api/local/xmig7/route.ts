// TEMPORARY migration: the two listing columns the full host editor writes.
// Idempotent. Key-gated. REMOVE after running (see CLAUDE.md → Deploying & migrations).
//   1. listings.region    — curated browse area ('North Coast' | 'Ain Sokhna' | …).
//   2. listings.amenities — text[] of amenity names.
// Both already exist on the SHARED Neon database (quickin-backend has queried
// them for a while), so this is a no-op there; it exists for local databases
// built from local-backend/init.sql, which does not declare them yet.
import { NextResponse } from 'next/server'
import { pool } from '@/lib/local/pool'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const KEY = 'qk-mig7-5c04'

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('key') !== KEY) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const steps: string[] = []
  const run = async (label: string, sql: string) => {
    try {
      await pool.query(sql)
      steps.push('ok: ' + label)
    } catch (e) {
      steps.push('ERR ' + label + ': ' + (e as Error).message)
    }
  }
  await run('add listings.region', `ALTER TABLE listings ADD COLUMN IF NOT EXISTS region text`)
  await run('add listings.amenities', `ALTER TABLE listings ADD COLUMN IF NOT EXISTS amenities text[]`)
  // Region chips filter on this; harmless (and tiny) when the column is empty.
  await run(
    'index listings.region',
    `CREATE INDEX IF NOT EXISTS idx_listings_region ON listings(region) WHERE region IS NOT NULL`
  )

  let columns: string[] = []
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'listings' AND column_name IN ('region', 'amenities')
        ORDER BY column_name`
    )
    columns = rows.map((r: { column_name: string }) => r.column_name)
  } catch (e) {
    steps.push('ERR verify: ' + (e as Error).message)
  }

  return NextResponse.json({ ok: columns.length === 2, columns, steps })
}
