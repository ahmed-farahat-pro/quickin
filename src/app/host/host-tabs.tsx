'use client'

// Client tab switcher for the host dashboard: "My Listings" vs "Incoming
// Reservations". Both sections are rendered server-side and passed in as slots;
// this component only toggles which one is visible (reuses the boutique pill
// toggle used on /explore).
import { useState, type ReactNode } from 'react'

const COLORS = {
  burgundy: '#5B0F16',
  tan: '#EFE6D8',
  ink: '#2A2220',
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
