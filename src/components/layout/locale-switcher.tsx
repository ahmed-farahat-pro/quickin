'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useSearchParams } from 'next/navigation'
import { replaceLocaleInPath } from '@/lib/i18n/pathname'
import { localeCookieName, type Locale } from '@/i18n/config'
import { cn } from '@/lib/utils'

export function LocaleSwitcher({
  className,
}: {
  className?: string
})
{
  const locale = useLocale() as Locale
  const t = useTranslations('common')
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const nextLocale: Locale = locale === 'en' ? 'ar' : 'en'

  const handleSwitch = () =>
  {
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 7}`

    const nextPath = replaceLocaleInPath(pathname, nextLocale)
    const query = searchParams.toString()
    const nextUrl = query ? `${nextPath}?${query}` : nextPath
    window.location.assign(nextUrl)
  }

  return (
    <button
      type="button"
      className={cn(
        "group flex items-center transition-all duration-300",
        locale === 'en' ? "font-sans" : "font-noto-sans-arabic",
        className,
        "gap-1 group-hover:gap-2"
      )}
      onClick={handleSwitch}
    >
      {locale === 'en' ? (
        <img src="https://kapowaz.github.io/circle-flags/flags/eg.svg" width="16" style={{ filter: 'grayscale(0.7)', opacity: 0.8 }} className="shrink-0" />
      ) : (
        <img src="https://kapowaz.github.io/circle-flags/flags/gb.svg" width="16" style={{ filter: 'grayscale(0.7)', opacity: 0.8 }} className="shrink-0" />
      )}
      <span className={cn(
        "overflow-hidden whitespace-nowrap max-w-0 opacity-0 transition-all duration-300 group-hover:max-w-[100px] group-hover:opacity-100",
        locale === 'en' ? "font-noto-sans-arabic" : "font-sans"
      )}>
        {t('languageToggle')}
      </span>
    </button>
  )
}

function UKFlag({ className }: { className?: string })
{
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" className={className}>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  )
}

function ArabLeagueFlag({ className }: { className?: string })
{
  // Egypt Flag representation as requested fallback/preference
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2" className={className}>
      <rect width="3" height="2" fill="#000" />
      <rect width="3" height="1.33" fill="#fff" />
      <rect width="3" height="0.67" fill="#c8102e" />
      <path d="M1.5,1.1l0.1-0.15l0.1,0.15l-0.1-0.05l-0.1,0.05z" fill="#c09300" />
    </svg>
  )
}
