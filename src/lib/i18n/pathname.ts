import { defaultLocale, isLocale, type Locale } from '@/i18n/config'

const UNLOCALIZED_PREFIXES = ['/api', '/_next']
const UNLOCALIZED_EXACT = ['/favicon.ico']

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

export function stripLocaleFromPath(pathname: string): {
  locale: Locale | null
  pathname: string
} {
  const segments = pathname.split('/').filter(Boolean)
  const firstSegment = segments[0]

  if (!isLocale(firstSegment)) {
    return { locale: null, pathname }
  }

  const rest = segments.slice(1).join('/')
  return { locale: firstSegment, pathname: rest ? `/${rest}` : '/' }
}

export function isLocalizablePath(pathname: string): boolean {
  if (!pathname.startsWith('/')) return false
  if (UNLOCALIZED_EXACT.includes(pathname)) return false
  if (pathname.startsWith('/auth/callback')) return false
  if (pathname.startsWith('/auth/invite')) return false

  return !UNLOCALIZED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function localizePathname(pathname: string, locale: Locale): string {
  if (!pathname.startsWith('/')) return pathname
  if (!isLocalizablePath(pathname)) return pathname

  const { pathname: strippedPath } = stripLocaleFromPath(pathname)
  if (strippedPath === '/') return `/${locale}`
  return `/${locale}${strippedPath}`
}

export function maybeUnlocalizePathname(pathname: string): string {
  const { pathname: strippedPath } = stripLocaleFromPath(pathname)
  return strippedPath
}

export function replaceLocaleInPath(pathname: string, locale: Locale): string {
  const { pathname: strippedPath } = stripLocaleFromPath(pathname)
  return localizePathname(strippedPath, locale)
}

export function getLocaleFromPathname(pathname: string): Locale {
  const { locale } = stripLocaleFromPath(pathname)
  return locale ?? defaultLocale
}

export function localizeHrefWithQuery(
  href: string,
  locale: Locale,
): string {
  if (!href || href.startsWith('#') || href.startsWith('mailto:')) return href
  if (isAbsoluteUrl(href)) return href

  const [pathname, query = ''] = href.split('?')
  const localizedPath = localizePathname(pathname, locale)
  return query ? `${localizedPath}?${query}` : localizedPath
}

