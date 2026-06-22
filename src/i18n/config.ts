export const locales = ['en', 'ar', 'fr', 'es'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'
export const localeCookieName = 'NEXT_LOCALE'

/** Native display name for each locale (used by the language switcher). */
export const localeNames: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
  es: 'Español',
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value != null && (locales as readonly string[]).includes(value)
}

export function detectLocaleFromAcceptLanguage(
  acceptLanguage: string | null | undefined,
): Locale {
  if (!acceptLanguage) return defaultLocale

  const preferred = acceptLanguage
    .split(',')
    .map((part) => part.trim().toLowerCase())

  // First matching supported language wins; fall back to the default.
  for (const part of preferred) {
    if (part.startsWith('ar')) return 'ar'
    if (part.startsWith('fr')) return 'fr'
    if (part.startsWith('es')) return 'es'
    if (part.startsWith('en')) return 'en'
  }
  return defaultLocale
}

export function getDirection(locale: Locale): 'ltr' | 'rtl' {
  // Arabic is the only RTL language; en/fr/es are LTR.
  return locale === 'ar' ? 'rtl' : 'ltr'
}

export function localeToBcp47(locale: Locale): string {
  switch (locale) {
    case 'ar':
      return 'ar-EG-u-nu-latn'
    case 'fr':
      return 'fr-FR'
    case 'es':
      return 'es-ES'
    default:
      return 'en-US'
  }
}

export function resolveLocaleFromRaw(
  locale: string | null | undefined,
): Locale {
  if (isLocale(locale)) return locale
  return defaultLocale
}
