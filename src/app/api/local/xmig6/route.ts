// TEMPORARY migration: weekend pricing, host_type/company, ID selfie, chat tables.
// Idempotent. Key-gated. REMOVE after run.
import { NextResponse } from 'next/server'
import { pool } from '@/lib/local/pool'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const KEY = 'qk-mig6-4f8b'

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('key') !== KEY) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const steps: string[] = []
  const run = async (label: string, sql: string) => {
    try { await pool.query(sql); steps.push('ok: ' + label) } catch (e) { steps.push('ERR ' + label + ': ' + (e as Error).message) }
  }

  // Weekend pricing (configurable per listing). weekend_days: 0=Sun … 6=Sat.
  await run('listings.weekend_price', `ALTER TABLE listings ADD COLUMN IF NOT EXISTS weekend_price numeric`)
  await run('listings.weekend_days', `ALTER TABLE listings ADD COLUMN IF NOT EXISTS weekend_days smallint[]`)

  // Host type (individual | company | brokerage) + display company name on the user row.
  await run('users.host_type', `ALTER TABLE users ADD COLUMN IF NOT EXISTS host_type text`)
  await run('users.company', `ALTER TABLE users ADD COLUMN IF NOT EXISTS company text`)

  // ID verification: personal/selfie photo.
  await run('id_verifications.selfie_image_data', `ALTER TABLE id_verifications ADD COLUMN IF NOT EXISTS selfie_image_data text`)

  // Pre-booking chat: one thread per (listing, guest); messages belong to a thread.
  await run('conversations table', `
    CREATE TABLE IF NOT EXISTS conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
      guest_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      host_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(),
      last_message_at timestamptz DEFAULT now(),
      UNIQUE (listing_id, guest_id)
    )`)
  // chat_messages (not "messages") — the shared Neon DB already has a backend
  // booking-scoped `messages` table, so we use a distinct name.
  await run('chat_messages table', `
    CREATE TABLE IF NOT EXISTS chat_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body text NOT NULL,
      created_at timestamptz DEFAULT now()
    )`)
  await run('chat_messages index', `CREATE INDEX IF NOT EXISTS chat_messages_conversation_idx ON chat_messages (conversation_id, created_at)`)
  await run('conversations guest index', `CREATE INDEX IF NOT EXISTS conversations_guest_idx ON conversations (guest_id, last_message_at DESC)`)
  await run('conversations host index', `CREATE INDEX IF NOT EXISTS conversations_host_idx ON conversations (host_id, last_message_at DESC)`)

  const cols = await pool.query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE (table_name='listings' AND column_name IN ('weekend_price','weekend_days'))
        OR (table_name='users' AND column_name IN ('host_type','company'))
        OR (table_name='id_verifications' AND column_name='selfie_image_data')`
  ).then((r) => r.rows).catch(() => [])
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name IN ('conversations','chat_messages')`
  ).then((r) => r.rows.map((x) => x.table_name)).catch(() => [])

  return NextResponse.json({ ok: true, steps, cols, tables })
}
