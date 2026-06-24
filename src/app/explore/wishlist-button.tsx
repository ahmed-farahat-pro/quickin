'use client'

// Heart toggle that saves/unsaves a listing to the signed-in user's wishlist.
// Optimistic: the heart flips immediately, then POSTs /api/local/wishlists.
// If the server says 401 (not signed in) we send the user to /login. On any
// other failure we roll the optimistic state back.

import { useState } from 'react'

const BURGUNDY = '#5B0F16'

export default function WishlistButton({
  listingId,
  initialSaved = false,
}: {
  listingId: string
  initialSaved?: boolean
}) {
  const [saved, setSaved] = useState(initialSaved)
  const [busy, setBusy] = useState(false)

  async function toggle(e: React.MouseEvent) {
    // Cards wrap the button in a link — don't navigate when the heart is tapped.
    e.preventDefault()
    e.stopPropagation()
    if (busy) return

    const next = !saved
    setSaved(next) // optimistic
    setBusy(true)
    try {
      const res = await fetch('/api/local/wishlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const data: { saved?: boolean } = await res.json().catch(() => ({}))
      if (typeof data.saved === 'boolean') setSaved(data.saved)
    } catch {
      setSaved(!next) // roll back on failure
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save to wishlist'}
      style={{
        appearance: 'none',
        border: 'none',
        cursor: busy ? 'default' : 'pointer',
        padding: 0,
        width: 38,
        height: 38,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.94)',
        boxShadow: '0 2px 8px rgba(42,34,32,0.18)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        transition: 'transform 0.12s ease',
      }}
    >
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill={saved ? BURGUNDY : 'none'}
        stroke={BURGUNDY}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  )
}
