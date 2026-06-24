import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import {
  defaultLocale,
  detectLocaleFromAcceptLanguage,
  isLocale,
  localeCookieName,
  type Locale,
} from '@/i18n/config'
import {
  isLocalizablePath,
  localizePathname,
  stripLocaleFromPath,
} from '@/lib/i18n/pathname'

function resolvePreferredLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(localeCookieName)?.value
  if (isLocale(cookieLocale)) return cookieLocale

  const headerLocale = request.headers.get('x-locale')
  if (isLocale(headerLocale)) return headerLocale

  return detectLocaleFromAcceptLanguage(request.headers.get('accept-language'))
}

function buildRequestHeaders(
  request: NextRequest,
  locale: Locale,
  pathname: string,
) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-locale', locale)
  requestHeaders.set('x-pathname', pathname)
  return requestHeaders
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const search = request.nextUrl.search
  const preferredLocale = resolvePreferredLocale(request)
  const { locale: localeFromPath, pathname: strippedPath } =
    stripLocaleFromPath(pathname)

  // Homepage (/, /en, /ar) → the local Supabase-free browse page (/explore).
  if (strippedPath === '/' || strippedPath === '') {
    const locale = localeFromPath || preferredLocale
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = `/${locale}/explore`
    return NextResponse.redirect(redirectUrl)
  }

  // Legacy /listings alias (with or without a locale prefix) → /<locale>/explore.
  // The local-stack browse page lives at /explore; keep old links working.
  if (strippedPath === '/listings' || strippedPath.startsWith('/listings/')) {
    const locale = localeFromPath || preferredLocale
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = `/${locale}/explore`
    redirectUrl.search = search
    return NextResponse.redirect(redirectUrl, 308)
  }

  if (localeFromPath) {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = strippedPath

    const headers = buildRequestHeaders(request, localeFromPath, pathname)
    const response = NextResponse.rewrite(rewriteUrl, {
      request: { headers },
    })
    response.cookies.set(localeCookieName, localeFromPath, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    })
    return response
  }

  const isSystemPath =
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/auth/invite')

  if (!isSystemPath && isLocalizablePath(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = localizePathname(pathname, preferredLocale)
    redirectUrl.search = search
    return NextResponse.redirect(redirectUrl)
  }

  const localeForUnprefixedPaths = preferredLocale

  const requestHeaders = buildRequestHeaders(
    request,
    localeForUnprefixedPaths,
    pathname,
  )

  return await updateSession(request, requestHeaders)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
