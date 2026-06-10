import { NextResponse } from 'next/server'
import { getListings } from '@/lib/db'

// GET /api/listings  → JSON array of published listings (consumed by web + iOS + Android)
export async function GET() {
  try {
    const listings = await getListings()
    return NextResponse.json(listings, {
      headers: {
        // Allow the native apps / any local client to read this freely
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('GET /api/listings failed:', err)
    return NextResponse.json(
      { error: 'Failed to load listings', detail: String(err) },
      { status: 500 }
    )
  }
}
