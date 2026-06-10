'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Map, List } from 'lucide-react'
import type { Locale } from '@/i18n/config'
import { localizePathname } from '@/lib/i18n/pathname'

export function ViewToggle()
{
  const locale = useLocale() as Locale
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentView = searchParams.get('view') || 'list'

  const toggleView = () =>
  {
    const params = new URLSearchParams(searchParams.toString())
    if (currentView === 'list') {
      params.set('view', 'map')
    } else {
      params.set('view', 'list')
    }

    router.push(`${localizePathname('/', locale)}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
      <Button
        onClick={toggleView}
        className="rounded-full shadow-xl bg-[#222222] hover:bg-black text-white px-6 py-6 h-auto text-base font-medium transition-transform hover:scale-105 active:scale-95"
      >
        {currentView === 'list' ? (
          <>
            Show map <Map className="ml-2 h-5 w-5" />
          </>
        ) : (
          <>
            Show list <List className="ml-2 h-5 w-5" />
          </>
        )}
      </Button>
    </div>
  )
}
