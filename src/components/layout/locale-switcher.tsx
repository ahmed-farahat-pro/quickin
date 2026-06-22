'use client'

import { useLocale } from 'next-intl'
import { usePathname, useSearchParams } from 'next/navigation'
import { Check } from 'lucide-react'
import { replaceLocaleInPath } from '@/lib/i18n/pathname'
import { localeCookieName, locales, localeNames, type Locale } from '@/i18n/config'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Circle-flag slugs for each language (kapowaz/circle-flags).
const FLAG: Record<Locale, string> = {
  en: 'gb',
  ar: 'eg',
  fr: 'fr',
  es: 'es',
}

function Flag({ locale, size = 18 }: { locale: Locale; size?: number }) {
  return (
    <img
      src={`https://kapowaz.github.io/circle-flags/flags/${FLAG[locale]}.svg`}
      width={size}
      height={size}
      alt=""
      aria-hidden
      className="shrink-0 rounded-full"
      style={{ filter: 'grayscale(0.4)' }}
    />
  )
}

export function LocaleSwitcher({
  className,
}: {
  className?: string
})
{
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const switchTo = (next: Locale) =>
  {
    if (next === locale) return
    document.cookie = `${localeCookieName}=${next}; path=/; max-age=${60 * 60 * 24 * 365}`

    const nextPath = replaceLocaleInPath(pathname, next)
    const query = searchParams.toString()
    window.location.assign(query ? `${nextPath}?${query}` : nextPath)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Change language"
          className={cn(
            'group flex items-center gap-2 transition-all duration-300',
            locale === 'ar' ? 'font-noto-sans-arabic' : 'font-sans',
            className,
          )}
        >
          <Flag locale={locale} />
          <span className="whitespace-nowrap">{localeNames[locale]}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[170px] rounded-2xl p-1.5">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => switchTo(l)}
            className={cn(
              'flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer',
              l === 'ar' ? 'font-noto-sans-arabic' : 'font-sans',
              l === locale && 'bg-accent/50 font-semibold',
            )}
          >
            <Flag locale={l} />
            <span className="flex-1">{localeNames[l]}</span>
            {l === locale && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
