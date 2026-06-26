import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a price amount with its currency.
 * USD (or missing currency) renders as a leading "$"; any other currency
 * renders as "<amount> <CODE>" (e.g. "1,200 EGP"). The amount always carries
 * thousands separators. An invalid/empty currency falls back to a bare number
 * rather than echoing a bogus code.
 */
export function formatPrice(amount: number, currency?: string | null): string {
  const value = Number.isFinite(amount) ? amount : 0
  const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)

  const code = typeof currency === 'string' ? currency.trim() : ''
  if (!code || code === 'USD') return `$${num}`
  // Guard against junk currency codes (e.g. empty/whitespace/non-letters):
  // a valid ISO-style code is 2–6 letters. Otherwise show a bare number.
  if (!/^[A-Za-z]{2,6}$/.test(code)) return num
  return `${num} ${code.toUpperCase()}`
}

/**
 * Returns the base URL for the application.
 * Priority: 
 * 1. NEXT_PUBLIC_SITE_URL environment variable
 * 2. NEXT_PUBLIC_APP_URL environment variable
 * 3. window.location.origin (if in browser)
 * 4. Default live URL (https://www.quickin-eg.com)
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin
  }
  return 'https://www.quickin-eg.com'
}

/**
 * Parses a PostGIS EWKB Hex string (Point only) to [lat, lng]
 * @param hex - Hex string from PostGIS
 * @returns {lat: number, lng: number} | null
 */
export function parsePostGISHex(hex: string): { lat: number, lng: number } | null {
  try {
    if (!hex || typeof hex !== 'string') return null
    // Remove 0x prefix if present
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
    
    // Basic validation: 01 (1 byte) + Type (4) + SRID (4) + X (8) + Y (8) = 25 bytes = 50 chars
    // Or without SRID: 1 + 4 + 8 + 8 = 21 bytes = 42 chars
    if (cleanHex.length < 42) return null

    // Parse bytes
    const buffer = new Uint8Array(cleanHex.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16)))
    const view = new DataView(buffer.buffer)
    
    // Byte 0: Endianness (01 = Little)
    const isLittleEndian = view.getUint8(0) === 1
    
    // Byte 1-4: Type
    const type = view.getUint32(1, isLittleEndian)
    
    // Check for SRID flag (0x20000000)
    let offset = 5
    if ((type & 0x20000000) !== 0) {
      offset += 4 // Skip SRID
    }
    
    // Read X (Longitude) and Y (Latitude)
    const lng = view.getFloat64(offset, isLittleEndian)
    const lat = view.getFloat64(offset + 8, isLittleEndian)
    
    if (isNaN(lat) || isNaN(lng)) return null
    
    return { lat, lng }
  } catch (e) {
    console.error('Error parsing PostGIS hex:', e)
    return null
  }
}
