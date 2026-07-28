// Reservation-code helpers shared by the server (lib/local/db.ts) and the
// browser (the guest pass card, the host stay-guide editor). No `pg` and no node
// built-ins live here, so a client component can import it.
//
// Background: a reservation only gets a code when it is CONFIRMED, so "no code"
// is a normal state, not an error — and a client that turns a missing code into
// a link produces `/stay/null`, which is exactly the bug guests reported.

/**
 * Normalise a reservation code coming from a URL, a QR scan or an API payload.
 * Returns null for anything that is not a plausible code, including the empty
 * string and the literal "null"/"undefined" strings (Android's
 * `JSONObject.optString` hands back "null" for a JSON null). Treat null as
 * "there is no code": don't look it up, don't build a link from it.
 */
export function normalizeReservationCode(raw: unknown): string | null {
  const code = String(raw ?? '').trim().toUpperCase()
  if (!code || code === 'NULL' || code === 'UNDEFINED') return null
  if (!/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(code)) return null
  return code
}

/**
 * THE one definition of "this pass is still live". `confirmed` and `completed`
 * only: the code is issued at the confirmation transition and is never cleared,
 * so a cancelled/rejected booking keeps a code that must stop working, while a
 * finished stay keeps its pass (the guest's receipt of what happened).
 * Deliberately identical to quickin-backend's getStayByCode gate and to
 * `isApproved` on iOS/Android, so one reservation looks the same on every
 * surface. Lives here (no `pg`, no node built-ins) so client components can
 * import it; `lib/local/db.ts` re-exports it for the server.
 */
export function isLiveStayStatus(status: string | null | undefined): boolean {
  return status === 'confirmed' || status === 'completed'
}

/**
 * The ONE place the web builds a link to a stay pass. Returns null when there is
 * no usable code, so every caller renders nothing rather than a broken link.
 * `locale` is optional — the app's proxy redirects an unprefixed /stay/<code> to
 * the viewer's locale anyway.
 */
export function stayPassPath(code: unknown, locale?: string): string | null {
  const c = normalizeReservationCode(code)
  if (!c) return null
  const prefix = locale ? `/${locale}` : ''
  return `${prefix}/stay/${encodeURIComponent(c)}`
}
