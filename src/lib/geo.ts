// Location + pricing helpers shared by the listing form, detail page and maps.
// Isomorphic (no DOM / node APIs) so it's safe on the server and the client.

/**
 * Coarsen a coordinate for privacy — "nearby, not exact". Rounds to ~2 decimals
 * (~1.1km grid) so the point we show sits in the neighbourhood rather than on
 * the exact address. Deterministic (same input → same output) so the marker
 * doesn't jump around between renders. Pair with an APPROX_RADIUS_M circle.
 */
export function approxLatLng(lat: number, lng: number): { lat: number; lng: number } {
  const r = (n: number) => Math.round(n * 100) / 100
  return { lat: r(lat), lng: r(lng) }
}

/** Radius (metres) of the "approximate area" circle drawn around approxLatLng. */
export const APPROX_RADIUS_M = 600

/** Days-of-week that count as "weekend" by default (Egypt: Fri=5, Sat=6). */
export const DEFAULT_WEEKEND_DAYS = [5, 6]

/**
 * Total price for a stay, applying an optional per-listing weekend price on the
 * configured weekend days. Mirrors the SQL in createBooking so the client
 * preview matches the server-computed total. getDay()/Postgres DOW agree:
 * 0=Sun … 6=Sat. Nights are [checkIn, checkOut).
 */
export function stayQuote(
  checkIn: string,
  checkOut: string,
  pricePerNight: number,
  weekendPrice?: number | null,
  weekendDays?: number[] | null
): { nights: number; total: number } {
  if (!checkIn || !checkOut) return { nights: 0, total: 0 }
  const start = new Date(checkIn + 'T00:00:00')
  const end = new Date(checkOut + 'T00:00:00')
  const ms = end.getTime() - start.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return { nights: 0, total: 0 }
  const nights = Math.round(ms / 86_400_000)
  const wend = Array.isArray(weekendDays) ? weekendDays : null
  const hasWeekend = typeof weekendPrice === 'number' && weekendPrice > 0 && !!wend && wend.length > 0
  let total = 0
  const d = new Date(start)
  for (let i = 0; i < nights; i++) {
    total += hasWeekend && wend!.includes(d.getDay()) ? (weekendPrice as number) : pricePerNight
    d.setDate(d.getDate() + 1)
  }
  return { nights, total }
}
