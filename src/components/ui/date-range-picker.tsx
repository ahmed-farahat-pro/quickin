'use client'

import * as React from 'react'
import { useLocale } from 'next-intl'
import type { DateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// A boutique check-in / check-out range picker. Replaces the native <input type="date">
// across the listing booking card + explore search. Values are YYYY-MM-DD strings so it's a
// drop-in for the existing checkIn/checkOut state. Calendar is the burgundy-themed shadcn one;
// it shows 2 months on >=sm screens and 1 on mobile.
const BURGUNDY = '#5B0F16'
const INK = '#2A2220'
const MUTED = '#6B6055'
const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'

function toYmd(d?: Date): string {
  if (!d) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fromYmd(s?: string): Date | undefined {
  if (!s) return undefined
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

export interface DateRangePickerProps {
  checkIn: string
  checkOut: string
  onChange: (checkIn: string, checkOut: string) => void
  checkInLabel?: string
  checkOutLabel?: string
  placeholder?: string
  /** Earliest selectable day (defaults to today). */
  minDate?: Date
  /** Right-side hint shown in the popover footer, e.g. "3 nights". */
  nightsLabel?: (nights: number) => string
  clearLabel?: string
  doneLabel?: string
}

export function DateRangePicker({
  checkIn, checkOut, onChange,
  checkInLabel = 'Check-in', checkOutLabel = 'Check-out', placeholder = 'Add date',
  minDate, nightsLabel, clearLabel = 'Clear', doneLabel = 'Done',
}: DateRangePickerProps) {
  const locale = useLocale()
  const [open, setOpen] = React.useState(false)
  const [months, setMonths] = React.useState(1)

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const apply = () => setMonths(mq.matches ? 2 : 1)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const today = React.useMemo(() => {
    const d = minDate ? new Date(minDate) : new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [minDate])

  const from = fromYmd(checkIn)
  const to = fromYmd(checkOut)
  const range: DateRange | undefined = from ? { from, to } : undefined
  const nights = from && to ? Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000)) : 0
  const fmt = (d?: Date) => (d ? d.toLocaleDateString(locale, { month: 'short', day: 'numeric' }) : '')

  function cell(label: string, value: string) {
    return (
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'start', minWidth: 0 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: MUTED }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: value ? 600 : 400, color: value ? INK : '#a99e93', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value || placeholder}
        </span>
      </span>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${checkInLabel} – ${checkOutLabel}`}
          style={{
            width: '100%', boxSizing: 'border-box', display: 'grid', gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center', gap: 10, padding: '8px 14px', minHeight: 52, background: '#fff',
            border: `1px solid ${open ? BURGUNDY : 'rgba(42,34,32,0.16)'}`, borderRadius: 14,
            cursor: 'pointer', fontFamily: FONT, textAlign: 'start',
            boxShadow: open ? `0 0 0 3px rgba(91,15,22,0.10)` : 'none', transition: 'border-color .15s, box-shadow .15s',
          }}
        >
          {cell(checkInLabel, fmt(from))}
          <span aria-hidden style={{ width: 1, height: 26, background: 'rgba(42,34,32,0.14)' }} />
          {cell(checkOutLabel, fmt(to))}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-auto p-0 overflow-hidden rounded-2xl border-[rgba(42,34,32,0.12)] shadow-xl">
        <Calendar
          mode="range"
          numberOfMonths={months}
          defaultMonth={from || today}
          selected={range}
          disabled={{ before: today }}
          onSelect={(r: DateRange | undefined) => onChange(toYmd(r?.from), toYmd(r?.to))}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderTop: '1px solid rgba(42,34,32,0.10)', fontFamily: FONT }}>
          <span style={{ fontSize: 13, color: MUTED }}>
            {nights > 0 ? (nightsLabel ? nightsLabel(nights) : `${nights} night${nights === 1 ? '' : 's'}`) : ''}
          </span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => onChange('', '')} style={{ background: 'none', border: 'none', color: MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: '6px 8px' }}>{clearLabel}</button>
            <button type="button" onClick={() => setOpen(false)} style={{ background: BURGUNDY, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: '8px 16px', fontFamily: FONT }}>{doneLabel}</button>
          </span>
        </div>
      </PopoverContent>
    </Popover>
  )
}
