export const locales = ['en', 'ar'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'
export const localeCookieName = 'NEXT_LOCALE'

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'ar'
}

export function detectLocaleFromAcceptLanguage(
  acceptLanguage: string | null | undefined,
): Locale {
  if (!acceptLanguage) return defaultLocale

  const preferred = acceptLanguage
    .split(',')
    .map((part) => part.trim().toLowerCase())

  const hasArabic = preferred.some((part) => part.startsWith('ar'))
  return hasArabic ? 'ar' : defaultLocale
}

export function getDirection(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}

export function localeToBcp47(locale: Locale): string {
  return locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US'
}

export function resolveLocaleFromRaw(
  locale: string | null | undefined,
): Locale {
  if (isLocale(locale)) return locale
  return defaultLocale
}
