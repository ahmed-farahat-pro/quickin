import { Pool } from 'pg'

// Single shared node-postgres pool. Works locally (TCP to local Postgres) AND on
// Vercel serverless (TCP to Vercel/Neon Postgres via DATABASE_URL). Replaces the
// old psql-CLI approach, which cannot run on serverless.
// Prefer an explicit DATABASE_URL, then the Neon/Vercel-Postgres integration vars
// (the marketplace store injects a `quickin_`-prefixed set), then local Postgres.
// A value that isn't a real postgres URL (e.g. a stale Vercel-encrypted blob) is ignored.
const isPgUrl = (v?: string): v is string => !!v && /^postgres(ql)?:\/\//.test(v)
const connectionString =
  [
    process.env.DATABASE_URL,
    process.env.quickin_DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.quickin_POSTGRES_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.quickin_DATABASE_URL_UNPOOLED,
  ].find(isPgUrl) || 'postgresql://ahmedfarahat@127.0.0.1:5432/quickin_local'

const isLocal =
  connectionString.includes('127.0.0.1') || connectionString.includes('localhost')

// Reuse the pool across hot-reloads / lambda invocations.
const g = globalThis as unknown as { _qkPool?: Pool }

export const pool: Pool =
  g._qkPool ??
  new Pool({
    connectionString,
    max: 5,
    // Managed Postgres (Neon/Vercel/RDS) needs TLS; local does not.
    ssl: isLocal ? false : { rejectUnauthorized: false },
  })

if (!g._qkPool) g._qkPool = pool

export async function query<T = unknown>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params)
  return res.rows as T[]
}
