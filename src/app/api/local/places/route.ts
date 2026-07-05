import { NextResponse } from 'next/server'
import { getPlaceSuggestions } from '@/lib/local/db'

// Place autocomplete for the Explore search bar.
//   GET /api/local/places?q=<query> → { places: string[] }
// Merges distinct listing locations with a curated list of Egyptian
// destinations. No auth required.
export const dynamic = 'force-dynamic'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get('q') ?? ''
    const places = await getPlaceSuggestions(q)
    return NextResponse.json({ places }, { headers: CORS })
  } catch (err) {
    console.error('GET /api/local/places failed:', err)
    return NextResponse.json({ places: [] }, { status: 500, headers: CORS })
  }
}
