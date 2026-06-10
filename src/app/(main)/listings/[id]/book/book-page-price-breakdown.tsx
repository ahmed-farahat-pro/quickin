'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/config'
import { formatDate, formatNumber } from '@/lib/i18n/format'

interface PriceBreakdownProps {
  pricePerNight: { date: string; price: number; adjustmentName?: string }[]
  nights: number
  currency: string
  subtotal: number
  basePrice: number
}

export function BookPagePriceBreakdown({ 
  pricePerNight, 
  nights, 
  currency, 
  subtotal,
  basePrice 
}: PriceBreakdownProps) {
  const locale = useLocale() as Locale
  const commonT = useTranslations('common')
  const t = useTranslations('bookingPage')
  const [showAll, setShowAll] = useState(false)
  const COLLAPSE_THRESHOLD = 15
  const baseRateLabel = t('baseRate')

  // If no per-night data, show simple calc
  if (!pricePerNight || pricePerNight.length === 0) {
    return (
      <div className="flex justify-between text-sm">
        <span>
          {formatNumber(basePrice, locale)} {currency} × {nights} {nights !== 1 ? commonT('nights') : commonT('night')}
        </span>
        <span>{formatNumber(subtotal, locale)} {currency}</span>
      </div>
    )
  }

  // Group prices by rate type for summary
  const groupedPrices = pricePerNight.reduce((acc, night) => {
    const key = night.adjustmentName || baseRateLabel
    if (!acc[key]) {
      acc[key] = { count: 0, total: 0, pricePerNight: night.price }
    }
    acc[key].count++
    acc[key].total += night.price
    return acc
  }, {} as Record<string, { count: number; total: number; pricePerNight: number }>)

  // If <= threshold, show full breakdown
  if (nights <= COLLAPSE_THRESHOLD) {
    return (
      <div className="space-y-1">
        {pricePerNight.map((night) => (
          <div key={night.date} className="flex justify-between text-sm">
            <span className={night.adjustmentName ? 'text-violet-600 dark:text-violet-400' : ''}>
              {formatDate(night.date, locale, { weekday: 'short', month: 'short', day: 'numeric' })}
              {night.adjustmentName && (
                <span className="text-xs ml-1">({night.adjustmentName})</span>
              )}
            </span>
            <span className={night.adjustmentName ? 'text-violet-600 dark:text-violet-400' : ''}>
              {formatNumber(night.price, locale)} {currency}
            </span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-medium pt-1 border-t">
          <span>{t('subtotal')} ({nights} {commonT('nights')})</span>
          <span>{formatNumber(subtotal, locale)} {currency}</span>
        </div>
      </div>
    )
  }

  // For > threshold nights, show grouped summary with expandable detail
  return (
    <div className="space-y-2">
      {/* Grouped summary */}
      {Object.entries(groupedPrices).map(([rateType, data]) => (
        <div key={rateType} className="flex justify-between text-sm">
          <span className={rateType !== baseRateLabel ? 'text-violet-600 dark:text-violet-400' : ''}>
            {formatNumber(data.pricePerNight, locale)} {currency} × {data.count} {data.count > 1 ? commonT('nights') : commonT('night')}
            {rateType !== baseRateLabel && (
              <span className="text-xs ml-1">({rateType})</span>
            )}
          </span>
          <span className={rateType !== baseRateLabel ? 'text-violet-600 dark:text-violet-400' : ''}>
            {formatNumber(data.total, locale)} {currency}
          </span>
        </div>
      ))}
      
      <div className="flex justify-between text-sm font-medium pt-1 border-t">
        <span>{t('subtotal')} ({nights} {commonT('nights')})</span>
        <span>{formatNumber(subtotal, locale)} {currency}</span>
      </div>

      {/* Expandable full breakdown */}
      <button
        onClick={() => setShowAll(!showAll)}
        className="text-xs text-primary hover:underline w-full text-left"
      >
        {showAll ? `▼ ${t('hideNightlyBreakdown')}` : `▶ ${t('viewAllNights')}`}
      </button>
      
      {showAll && (
        <div className="space-y-1 pl-2 border-l-2 border-muted max-h-48 overflow-y-auto">
          {pricePerNight.map((night) => (
            <div key={night.date} className="flex justify-between text-xs text-muted-foreground">
              <span className={night.adjustmentName ? 'text-violet-500' : ''}>
                {formatDate(night.date, locale, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span>{formatNumber(night.price, locale)} {currency}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
