import { headers } from 'next/headers'
import { getBaseUrl } from '@/lib/utils'

/**
 * The origin the visitor is actually on, resolved per request.
 *
 * Server components only (it reads request headers). Used for the stay-pass QR:
 * a code must encode the deployment the guest already has open — the same app
 * answers on the vercel preview domain, the custom domain and localhost, and a
 * QR built from a build-time constant would send them somewhere else.
 * Falls back to getBaseUrl() when the host header is missing.
 */
export async function getRequestOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  if (!host) return getBaseUrl()
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
  return `${proto}://${host}`
}
