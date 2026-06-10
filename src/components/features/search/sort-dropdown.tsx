'use client'

import { useTransition, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUIStore } from '@/stores/ui-store'

interface SortDropdownProps {
  hasLocation?: boolean
}

export function SortDropdown({ hasLocation }: SortDropdownProps) {
  const t = useTranslations('home.filters')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const { startLoading, stopLoading } = useUIStore()
  
  const currentSort = searchParams.get('sort') || 'recommended'

  // Effect to clear loading state when navigation completes
  useEffect(() => {
    stopLoading('sort-navigation')
  }, [searchParams, stopLoading])

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'recommended') {
      params.delete('sort')
    } else {
      params.set('sort', value)
    }
    // Reset to page 1 when sorting changes
    params.delete('page')
    
    startTransition(() => {
      startLoading('sort-navigation')
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground whitespace-nowrap">{t('sortBy')}:</span>
      <Select value={currentSort} onValueChange={handleSortChange}>
        <SelectTrigger className="w-[180px] h-8 text-sm bg-white">
          <SelectValue placeholder={t('sortRecommended')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recommended">{t('sortRecommended')}</SelectItem>
          <SelectItem value="price_asc">{t('sortPriceAsc')}</SelectItem>
          <SelectItem value="price_desc">{t('sortPriceDesc')}</SelectItem>
          <SelectItem value="rating">{t('sortRating')}</SelectItem>
          <SelectItem value="newest">{t('sortNewest')}</SelectItem>
          {hasLocation && (
            <SelectItem value="distance">{t('sortDistance')}</SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
