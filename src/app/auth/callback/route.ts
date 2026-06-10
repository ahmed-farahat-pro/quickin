// =============================================================================
// OAUTH CALLBACK ROUTE
// =============================================================================
// Description: Handles OAuth callback from authentication providers
// Purpose: Exchanges the authorization code for a session token
// Called by: OAuth providers (Google, GitHub) after user authorizes
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { defaultLocale } from '@/i18n/config'
import { localizePathname, stripLocaleFromPath } from '@/lib/i18n/pathname'

/**
 * GET /auth/callback
 * Exchanges OAuth authorization code for a user session
 * 
 * @param request - Incoming request with code parameter
 * @returns Redirect to intended destination or error page
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  const nextPath = (() => {
    if (!next.startsWith('/')) return '/'

    const { locale, pathname } = stripLocaleFromPath(next)
    const resolvedLocale = locale ?? defaultLocale
    const safePath = pathname.startsWith('/auth/callback') ? '/' : pathname

    if (safePath.startsWith('/dashboard') || safePath.startsWith('/admin')) {
      return safePath
    }

    return localizePathname(safePath, resolvedLocale)
  })()

  const supabase = await createClient()
  if (!supabase) {
    console.error('Auth callback failed: Supabase not configured')
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    })

    if (!error) {
      // Redirect to next path with success flag
      const separator = nextPath.includes('?') ? '&' : '?'
      return NextResponse.redirect(`${origin}${nextPath}${separator}auth_success=verified`)
    }

    console.error('Verification failed:', error.message)
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  if (code) {
    // Exchange code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Success - redirect to intended destination
      return NextResponse.redirect(`${origin}${nextPath}`)
    }

    console.error('OAuth code exchange failed:', error.message)
  }

  // Redirect to error page if no valid parameters or exchange failed
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
