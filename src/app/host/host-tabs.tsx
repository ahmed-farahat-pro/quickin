'use client'

// Client interactivity for the host dashboard.
//  - HostTabs: "My Listings" vs "Incoming Reservations". Both sections are
//    rendered server-side and passed in as slots; this only toggles which one
//    is visible (reuses the boutique pill toggle used on /explore).
//  - HostListingsFilter: All / Published / Under review / Rejected filter above
//    the listings grid. The cards themselves are still server-rendered and
//    handed over as slots, so the filter never duplicates card markup.
import { Fragment, useState, type ReactNode } from 'react'

const COLORS = {
  burgundy: '#5B0F16',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}
const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'

export function HostTabs({
  listingsLabel,
  reservationsLabel,
  listings,
  reservations,
}: {
  listingsLabel: string
  reservationsLabel: string
  listings: ReactNode
  reservations: ReactNode
}) {
  const [tab, setTab] = useState<'listings' | 'reservations'>('listings')

  return (
    <>
      <div
        role="tablist"
        aria-label={`${listingsLabel} / ${reservationsLabel}`}
        style={{
          display: 'inline-flex',
          background: COLORS.tan,
          borderRadius: 999,
          padding: 4,
          gap: 4,
          marginBottom: 26,
          maxWidth: '100%',
          flexWrap: 'wrap',
        }}
      >
        <TabButton label={listingsLabel} active={tab === 'listings'} onClick={() => setTab('listings')} />
        <TabButton label={reservationsLabel} active={tab === 'reservations'} onClick={() => setTab('reservations')} />
      </div>
      <div>{tab === 'listings' ? listings : reservations}</div>
    </>
  )
}

/** Approval state a host listing can be filtered by ('approved' = published). */
export type HostListingStatus = 'approved' | 'pending' | 'rejected'
/** The filter pills, in display order. */
export type HostListingFilter = 'all' | HostListingStatus

const FILTER_ORDER: HostListingFilter[] = ['all', 'approved', 'pending', 'rejected']

export type HostListingItem = {
  id: string
  status: HostListingStatus
  /** The server-rendered <ListingCard /> for this listing. */
  card: ReactNode
}

/**
 * Listings grid + its status filter. Cards arrive pre-rendered from the server
 * component (page.tsx), so this only decides which of them to mount.
 */
export function HostListingsFilter({
  items,
  labels,
  emptyLabel,
}: {
  items: HostListingItem[]
  labels: Record<HostListingFilter, string>
  emptyLabel: string
}) {
  const [filter, setFilter] = useState<HostListingFilter>('all')
  const visible = filter === 'all' ? items : items.filter((item) => item.status === filter)

  return (
    <>
      <div
        role="group"
        aria-label={FILTER_ORDER.map((key) => labels[key]).join(' / ')}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 18,
        }}
      >
        {FILTER_ORDER.map((key) => (
          <FilterPill
            key={key}
            label={labels[key]}
            active={filter === key}
            onClick={() => setFilter(key)}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <p
          role="status"
          style={{
            margin: 0,
            background: '#fff',
            borderRadius: 22,
            border: '1px solid rgba(42,34,32,0.06)',
            boxShadow: '0 6px 24px rgba(42,34,32,0.06)',
            padding: '36px 24px',
            textAlign: 'center',
            fontSize: 15,
            color: COLORS.muted,
          }}
        >
          {emptyLabel}
        </p>
      ) : (
        <div
          className="qk-host-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 18,
          }}
        >
          {visible.map((item) => (
            <Fragment key={item.id}>{item.card}</Fragment>
          ))}
        </div>
      )}
    </>
  )
}

/** Filter chip: burgundy fill when active, white + hairline border otherwise. */
function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        appearance: 'none',
        cursor: 'pointer',
        fontFamily: FONT,
        fontSize: 13.5,
        fontWeight: 600,
        padding: '8px 16px',
        borderRadius: 999,
        border: `1px solid ${active ? COLORS.burgundy : 'rgba(42,34,32,0.16)'}`,
        color: active ? '#fff' : COLORS.ink,
        background: active ? COLORS.burgundy : '#fff',
        transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        appearance: 'none',
        border: 'none',
        cursor: 'pointer',
        fontFamily: FONT,
        fontSize: 14,
        fontWeight: 600,
        padding: '9px 20px',
        borderRadius: 999,
        color: active ? '#fff' : COLORS.ink,
        background: active ? COLORS.burgundy : 'transparent',
        transition: 'background 0.15s ease, color 0.15s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}
