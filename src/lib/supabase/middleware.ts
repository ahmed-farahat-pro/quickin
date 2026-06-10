import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  detectLocaleFromAcceptLanguage,
  isLocale,
  localeCookieName,
  type Locale,
} from '@/i18n/config'

function resolveLocaleFromRequest(
  request: NextRequest,
  requestHeaders?: Headers,
): Locale {
  const pathLocale = request.nextUrl.pathname.split('/')[1]
  if (isLocale(pathLocale)) return pathLocale

  const headerLocale =
    requestHeaders?.get('x-locale') ?? request.headers.get('x-locale')
  if (isLocale(headerLocale)) return headerLocale

  const cookieLocale = request.cookies.get(localeCookieName)?.value
  if (isLocale(cookieLocale)) return cookieLocale

  return detectLocaleFromAcceptLanguage(request.headers.get('accept-language'))
}

export async function updateSession(
  request: NextRequest,
  requestHeaders?: Headers,
) {
  const forwardedHeaders = requestHeaders ?? request.headers

  // Skip Supabase auth if credentials are not configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({
      request: {
        headers: forwardedHeaders,
      },
    })
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: forwardedHeaders,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request: {
              headers: forwardedHeaders,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes check
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    request.nextUrl.pathname.startsWith('/dashboard')
  ) {
    // Redirect to login for protected routes
    const locale = resolveLocaleFromRequest(request, forwardedHeaders)
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/login`
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
