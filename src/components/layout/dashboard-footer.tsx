'use client'

import Link from 'next/link'
import { DollarSign } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { localizeHrefWithQuery } from '@/lib/i18n/pathname'
import { LocaleSwitcher } from '@/components/layout/locale-switcher'
import type { Locale } from '@/i18n/config'

export function DashboardFooter() {
  const locale = useLocale() as Locale
  const t = useTranslations('footer')
  const localizedHref = (href: string) => localizeHrefWithQuery(href, locale)

  return (
    <footer className="border-t bg-background">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>© {new Date().getFullYear()} {t('legalCompanyName')}</span>
          <span className="hidden sm:inline">·</span>
          <Link href={localizedHref('/terms')} className="hover:underline">{t('terms')}</Link>
          <span>·</span>
          <Link href={localizedHref('/sitemap')} className="hover:underline">{t('sitemap')}</Link>
          <span>·</span>
          <Link href={localizedHref('/privacy')} className="hover:underline">{t('privacy')}</Link>
        </div>
        <div className="flex items-center gap-4">
          <LocaleSwitcher className="flex items-center gap-1.5 hover:underline" />
          <button className="flex items-center gap-1.5 hover:underline">
            <DollarSign className="h-4 w-4" />
            <span>{t('currency')}</span>
          </button>
        </div>
      </div>
    </footer>
  )
}
