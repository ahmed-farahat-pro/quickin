// The approval-status chip a host sees on their own listings: "Published",
// "Under review", "Rejected". Shared by the dashboard cards (host/page.tsx, where
// it sits over the photo) and the listing editor, so a listing that just went
// back for review looks the same on both screens.
//
// Presentational only — the label arrives already translated (the dashboard's
// hostPage.dashboard.badge.* / filters.* strings), so this works from a server
// component and a client component alike.
import type { CSSProperties } from 'react'
import type { HostListingStatus } from './host-tabs'

const BACKGROUNDS: Record<HostListingStatus, string> = {
  approved: 'rgba(23,114,69,0.95)',
  pending: 'rgba(138,109,27,0.95)',
  rejected: 'rgba(138,43,35,0.95)',
}

export function ListingStatusChip({
  status,
  label,
  style,
}: {
  status: HostListingStatus
  /** Already-translated text, e.g. t('dashboard.badge.pending'). */
  label: string
  /** Positioning from the caller (the card overlays it on the photo). */
  style?: CSSProperties
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 700,
        color: '#fff',
        background: BACKGROUNDS[status],
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {label}
    </span>
  )
}
