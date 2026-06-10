import type { Locale } from '@/i18n/config'
import { localeToBcp47 } from '@/i18n/config'

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(localeToBcp47(locale)).format(value)
}

export function formatCurrency(
  value: number,
  locale: Locale,
  currency: string,
): string {
  return new Intl.NumberFormat(localeToBcp47(locale), {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(
  value: Date | string,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(localeToBcp47(locale), options).format(date)
}
