import 'server-only'
import { cookies, headers } from 'next/headers'
import {
  detectLocaleFromAcceptLanguage,
  isLocale,
  localeCookieName,
  type Locale,
} from '@/i18n/config'

export async function getRequestLocale(): Promise<Locale> {
  const requestHeaders = await headers()

  const headerLocale = requestHeaders.get('x-locale')
  if (isLocale(headerLocale)) return headerLocale

  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(localeCookieName)?.value
  if (isLocale(cookieLocale)) return cookieLocale

  const acceptLanguage = requestHeaders.get('accept-language')
  return detectLocaleFromAcceptLanguage(acceptLanguage)
}

export async function getRequestPathname(): Promise<string | null> {
  const requestHeaders = await headers()
  return requestHeaders.get('x-pathname')
}
