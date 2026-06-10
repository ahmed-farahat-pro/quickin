import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// Plain local PostgreSQL — accessed through the installed `psql` client so we
// need ZERO npm dependencies beyond Next/React. No Supabase, no ORM.
const PSQL = process.env.PSQL_BIN || '/opt/homebrew/opt/libpq/bin/psql'
const CONN =
  process.env.DATABASE_URL ||
  'postgresql://ahmedfarahat@127.0.0.1:5432/quickin_local'

export interface ListingImage {
  url: string
  order: number
}

export interface Listing {
  id: string
  title: string
  description: string | null
  location: string | null
  country: string | null
  price_per_night: number
  currency: string
  bedrooms: number | null
  beds: number | null
  bathrooms: number | null
  max_guests: number | null
  property_type: string | null
  is_guest_favorite: boolean
  listing_code: string | null
  lat: number | null
  lng: number | null
  listing_images: ListingImage[]
}

const ROW = `
  json_build_object(
    'id', l.id, 'title', l.title, 'description', l.description,
    'location', l.location, 'country', l.country,
    'price_per_night', l.price_per_night::float8, 'currency', l.currency,
    'bedrooms', l.bedrooms, 'beds', l.beds, 'bathrooms', l.bathrooms,
    'max_guests', l.max_guests, 'property_type', l.property_type,
    'is_guest_favorite', l.is_guest_favorite, 'listing_code', l.listing_code,
    'lat', l.lat, 'lng', l.lng,
    'listing_images', COALESCE(
      (SELECT json_agg(json_build_object('url', li.url, 'order', li."order") ORDER BY li."order")
       FROM listing_images li WHERE li.listing_id = l.id), '[]'::json)
  )
`

/** Run a query that returns a single JSON value and parse it. */
async function queryJson<T>(sql: string, vars: Record<string, string> = {}): Promise<T> {
  const args: string[] = ['-tAX', '--no-psqlrc']
  for (const [k, v] of Object.entries(vars)) args.push('-v', `${k}=${v}`)
  args.push('-c', sql, CONN)
  const { stdout } = await execFileAsync(PSQL, args, { maxBuffer: 16 * 1024 * 1024 })
  const text = stdout.trim()
  if (!text || text === '') return ([] as unknown) as T
  return JSON.parse(text) as T
}

export async function getListings(): Promise<Listing[]> {
  const sql = `
    SELECT COALESCE(json_agg(${ROW} ORDER BY l.is_guest_favorite DESC, l.created_at DESC), '[]'::json)
    FROM listings l
    WHERE l.is_published = true`
  return queryJson<Listing[]>(sql)
}

export async function getListingById(id: string): Promise<Listing | null> {
  // UUID-only guard, then bind safely via psql's quoted variable.
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) return null
  const sql = `SELECT ${ROW} FROM listings l WHERE l.id = :'id'`
  try {
    const row = await queryJson<Listing | null>(sql, { id })
    return row ?? null
  } catch {
    return null
  }
}
