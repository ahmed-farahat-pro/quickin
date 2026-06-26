'use client'

// Client-side browse experience: live type-to-filter search + a List/Map toggle.
// The server component (page.tsx) renders the header/footer and passes the
// first page of listings as `initialListings` so the first paint is instant.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import type { Listing } from '@/lib/local/db'
import { formatPrice } from '@/lib/utils'
import WishlistButton from './wishlist-button'

// Leaflet must never run on the server (it reads `window` at import time), so
// the map is a client-only dynamic import with SSR disabled.
function MapLoading() {
  const t = useTranslations('explorePage')
  return (
    <div
      style={{
        height: '70vh',
        width: '100%',
        borderRadius: 22,
        border: '1px solid rgba(42,34,32,0.08)',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6B6055',
        fontSize: 14,
      }}
    >
      {t('map.loading')}
    </div>
  )
}

const ListingsMap = dynamic(() => import('./listings-map'), {
  ssr: false,
  loading: () => <MapLoading />,
})

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&q=80'

const COLORS = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: COLORS.muted,
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 14px',
  fontSize: 14,
  fontFamily: FONT,
  color: COLORS.ink,
  background: '#fff',
  border: '1px solid rgba(42,34,32,0.14)',
  borderRadius: 14,
  outline: 'none',
}

type View = 'list' | 'map'

interface Filters {
  location: string
  checkIn: string
  checkOut: string
  guests: string
}

interface Props {
  initialListings: Listing[]
  initialFilters: Filters
  // Listing ids the signed-in user has already saved (seeds the heart state).
  savedIds?: string[]
}

function buildQuery(f: Filters): string {
  const params = new URLSearchParams()
  if (f.location.trim()) params.set('location', f.location.trim())
  if (f.checkIn) params.set('checkIn', f.checkIn)
  if (f.checkOut) params.set('checkOut', f.checkOut)
  if (f.guests.trim()) params.set('guests', f.guests.trim())
  return params.toString()
}

const EMPTY: Filters = { location: '', checkIn: '', checkOut: '', guests: '' }

export default function ExploreClient({ initialListings, initialFilters, savedIds }: Props) {
  const t = useTranslations('explorePage')
  const savedSet = useMemo(() => new Set(savedIds ?? []), [savedIds])
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [listings, setListings] = useState<Listing[]>(initialListings)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [view, setView] = useState<View>('list')

  // Airbnb-style: on desktop, collapse the hero copy + shrink the search bar into
  // a compact sticky bar once the user scrolls past the hero. (Mobile keeps the
  // full inline search — the CSS for this is gated to >=821px, see <style> below.)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 56)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Tracks the query string that produced `listings`, so we can skip the very
  // first fetch (the server already rendered that exact result set).
  const lastQueryRef = useRef<string>(buildQuery(initialFilters))
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (f: Filters) => {
    const query = buildQuery(f)
    // Skip redundant fetches (e.g. whitespace-only edits that don't change params).
    if (query === lastQueryRef.current) return
    lastQueryRef.current = query

    // Abort any in-flight request so only the latest keystroke wins.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSearching(true)
    setSearchError(false)
    try {
      const res = await fetch(`/api/local/listings${query ? `?${query}` : ''}`, {
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const data: Listing[] = await res.json()
      // Ignore stale responses that lost the race.
      if (!controller.signal.aborted) setListings(data)
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        // Keep the previous results on transient failure; just clear the spinner
        // and surface a subtle, non-blocking notice.
        console.error('Live search failed:', err)
        setSearchError(true)
      }
    } finally {
      if (abortRef.current === controller) {
        setSearching(false)
        abortRef.current = null
      }
    }
  }, [])

  // Debounce location typing (~300ms); fire dates/guests immediately.
  const updateFilter = useCallback(
    (patch: Partial<Filters>, opts?: { debounce?: boolean }) => {
      setFilters((prev) => {
        const next = { ...prev, ...patch }
        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (opts?.debounce) {
          debounceRef.current = setTimeout(() => runSearch(next), 300)
        } else {
          runSearch(next)
        }
        return next
      })
    },
    [runSearch]
  )

  const clearAll = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setFilters(EMPTY)
    runSearch(EMPTY)
  }, [runSearch])

  // Cleanup timers/requests on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  const hasFilters = useMemo(
    () => Boolean(buildQuery(filters)),
    [filters]
  )

  const count = listings.length
  const countLabel = t('results.countFound', { count })

  return (
    <>
      {/* Responsive rules for the inline-styled search bar + results grid.
          Inline styles can't hold media queries, so the layout-shifting bits
          carry class names and collapse to a single column on small screens. */}
      <style>{`
        @media (max-width: 720px) {
          .qk-search-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .qk-search-grid .qk-search-location,
          .qk-search-grid .qk-search-clear {
            grid-column: 1 / -1 !important;
          }
        }
        @media (max-width: 440px) {
          .qk-search-grid {
            grid-template-columns: 1fr !important;
          }
          .qk-results-grid {
            grid-template-columns: 1fr !important;
          }
        }

        /* Airbnb-style scroll-minimise of the hero search. The collapsing
           transitions are always defined; the sticky + collapsed state only
           applies on desktop (>=821px) so the mobile layout is untouched. */
        .qk-hero { transition: padding 0.3s ease, box-shadow 0.3s ease; }
        .qk-hero-headline {
          overflow: hidden;
          max-height: 260px;
          opacity: 1;
          transition: max-height 0.4s ease, opacity 0.25s ease, margin 0.35s ease;
        }
        .qk-search-grid { transition: padding 0.3s ease, border-radius 0.3s ease, box-shadow 0.3s ease; }
        @media (min-width: 821px) {
          .qk-hero { position: sticky; top: 0; z-index: 40; }
          .qk-hero[data-scrolled="true"] {
            padding-top: 12px !important;
            padding-bottom: 12px !important;
            box-shadow: 0 6px 20px rgba(42, 34, 32, 0.10);
            border-bottom: 1px solid rgba(42, 34, 32, 0.06);
          }
          .qk-hero[data-scrolled="true"] .qk-hero-headline {
            max-height: 0;
            opacity: 0;
            margin: 0 !important;
          }
          .qk-hero[data-scrolled="true"] .qk-search-grid {
            padding: 10px !important;
            border-radius: 16px !important;
            box-shadow: 0 4px 14px rgba(42, 34, 32, 0.12) !important;
          }
        }
      `}</style>

      {/* Hero + Search bar */}
      <section
        className="qk-hero"
        data-scrolled={scrolled ? 'true' : 'false'}
        style={{ background: COLORS.cream, padding: '36px 24px 8px' }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="qk-hero-headline">
            <h1
              style={{
                margin: 0,
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: 'clamp(26px, 4vw, 38px)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: COLORS.burgundy,
              }}
            >
              {t('hero.title')}
            </h1>
            <p style={{ margin: '10px 0 24px', fontSize: 15, color: COLORS.muted, maxWidth: 560 }}>
              {t('hero.subtitle')}
            </p>
          </div>

          {/* Live search (no submit needed — filters as you type) */}
          <div
            role="search"
            className="qk-search-grid"
            style={{
              background: '#fff',
              borderRadius: 22,
              border: '1px solid rgba(42,34,32,0.08)',
              boxShadow: '0 8px 28px rgba(42,34,32,0.08)',
              padding: 18,
              display: 'grid',
              gridTemplateColumns:
                'minmax(160px, 2fr) minmax(140px, 1fr) minmax(140px, 1fr) minmax(96px, 0.8fr) auto',
              gap: 14,
              alignItems: 'end',
            }}
          >
            <div className="qk-search-location">
              <label htmlFor="location" style={labelStyle}>
                {t('search.locationLabel')}
              </label>
              <input
                id="location"
                type="text"
                name="location"
                placeholder={t('search.locationPlaceholder')}
                autoComplete="off"
                value={filters.location}
                onChange={(e) => updateFilter({ location: e.target.value }, { debounce: true })}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="checkIn" style={labelStyle}>
                {t('search.checkInLabel')}
              </label>
              <input
                id="checkIn"
                type="date"
                name="checkIn"
                value={filters.checkIn}
                onChange={(e) => updateFilter({ checkIn: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="checkOut" style={labelStyle}>
                {t('search.checkOutLabel')}
              </label>
              <input
                id="checkOut"
                type="date"
                name="checkOut"
                value={filters.checkOut}
                onChange={(e) => updateFilter({ checkOut: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="guests" style={labelStyle}>
                {t('search.guestsLabel')}
              </label>
              <input
                id="guests"
                type="number"
                name="guests"
                min={1}
                placeholder="1"
                value={filters.guests}
                onChange={(e) => updateFilter({ guests: e.target.value })}
                style={inputStyle}
              />
            </div>
            <button
              type="button"
              onClick={clearAll}
              disabled={!hasFilters}
              className="qk-search-clear"
              style={{
                padding: '12px 26px',
                fontSize: 15,
                fontWeight: 700,
                fontFamily: FONT,
                color: hasFilters ? '#fff' : COLORS.muted,
                background: hasFilters ? COLORS.burgundy : COLORS.tan,
                border: 'none',
                borderRadius: 14,
                cursor: hasFilters ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
                transition: 'background 0.15s ease',
              }}
            >
              {t('search.clear')}
            </button>
          </div>

          {/* Status row: result count + searching indicator + List/Map toggle */}
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{ fontSize: 14, color: COLORS.muted }}
              aria-live="polite"
              aria-busy={searching}
            >
              {searching ? (
                <span style={{ color: COLORS.burgundy, fontWeight: 600 }}>{t('results.searching')}</span>
              ) : (
                <span>{countLabel}</span>
              )}
            </div>

            {/* List / Map toggle */}
            <div
              role="tablist"
              aria-label={t('view.toggleLabel')}
              style={{
                display: 'inline-flex',
                background: COLORS.tan,
                borderRadius: 999,
                padding: 4,
                gap: 4,
              }}
            >
              <ToggleButton
                label={t('view.list')}
                active={view === 'list'}
                onClick={() => setView('list')}
              />
              <ToggleButton
                label={t('view.map')}
                active={view === 'map'}
                onClick={() => setView('map')}
              />
            </div>
          </div>

          {/* Non-blocking notice if a live search request fails. Previous
              results stay on screen; this just explains the stale state. */}
          {searchError && (
            <div
              role="status"
              style={{
                marginTop: 14,
                background: 'rgba(91,15,22,0.06)',
                border: '1px solid rgba(91,15,22,0.18)',
                color: COLORS.burgundy,
                fontSize: 14,
                borderRadius: 14,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span>
                {t('error.refresh')}
              </span>
              <button
                type="button"
                onClick={() => setSearchError(false)}
                aria-label={t('error.dismiss')}
                style={{
                  appearance: 'none',
                  border: 'none',
                  background: 'transparent',
                  color: COLORS.burgundy,
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: 'pointer',
                  padding: 0,
                  flex: '0 0 auto',
                }}
              >
                ×
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Results: list grid or map */}
      <section
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          padding: '28px 24px 72px',
          flex: 1,
        }}
      >
        {view === 'map' ? (
          <ListingsMap listings={listings} />
        ) : listings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', color: COLORS.muted }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: COLORS.ink }}>
              {t('empty.title')}
            </p>
            <p style={{ margin: '8px 0 18px', fontSize: 15 }}>
              {t('empty.subtitle')}
            </p>
            <button
              type="button"
              onClick={clearAll}
              style={{
                display: 'inline-block',
                color: '#fff',
                background: COLORS.burgundy,
                border: 'none',
                fontFamily: FONT,
                fontSize: 15,
                fontWeight: 600,
                padding: '10px 22px',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              {t('empty.clearFilters')}
            </button>
          </div>
        ) : (
          <div
            className="qk-results-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 28,
            }}
          >
            {listings.map((listing) => {
              const cover = listing.listing_images[0]?.url || FALLBACK_IMG
              return (
                <a
                  key={listing.id}
                  href={`/explore/${listing.id}`}
                  style={{
                    display: 'block',
                    background: '#fff',
                    borderRadius: 22,
                    overflow: 'hidden',
                    textDecoration: 'none',
                    color: 'inherit',
                    boxShadow: '0 6px 24px rgba(42,34,32,0.08)',
                    border: '1px solid rgba(42,34,32,0.05)',
                    cursor: 'pointer',
                  }}
                >
                  {/* Cover */}
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '4 / 3',
                      overflow: 'hidden',
                      background: COLORS.tan,
                    }}
                  >
                    <img
                      src={cover}
                      alt={listing.title}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                    {listing.is_guest_favorite && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 14,
                          left: 14,
                          background: 'rgba(255,255,255,0.94)',
                          color: COLORS.burgundy,
                          fontSize: 12,
                          fontWeight: 600,
                          letterSpacing: '0.01em',
                          padding: '6px 12px',
                          borderRadius: 999,
                          boxShadow: '0 2px 8px rgba(42,34,32,0.14)',
                        }}
                      >
                        {t('card.guestFavorite')}
                      </span>
                    )}
                    {/* Heart toggle — self-managing; seeded with the saved state
                        when the server passed the user's saved ids. */}
                    <span style={{ position: 'absolute', top: 12, right: 12 }}>
                      <WishlistButton listingId={listing.id} initialSaved={savedSet.has(listing.id)} />
                    </span>
                  </div>

                  {/* Body */}
                  <div style={{ padding: '18px 20px 22px' }}>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 18,
                        fontWeight: 600,
                        lineHeight: 1.3,
                        color: COLORS.ink,
                      }}
                    >
                      {listing.title}
                    </h2>
                    {listing.location && (
                      <p style={{ margin: '6px 0 0', fontSize: 14, color: COLORS.muted }}>
                        {listing.location}
                      </p>
                    )}
                    <p style={{ margin: '14px 0 0', fontSize: 15, color: COLORS.ink }}>
                      <span style={{ fontWeight: 700, color: COLORS.burgundy }}>
                        {formatPrice(listing.price_per_night, listing.currency)}
                      </span>{' '}
                      <span style={{ color: COLORS.muted }}>{t('card.perNight')}</span>
                    </p>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}

function ToggleButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
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
        padding: '8px 20px',
        borderRadius: 999,
        color: active ? '#fff' : COLORS.ink,
        background: active ? COLORS.burgundy : 'transparent',
        transition: 'background 0.15s ease, color 0.15s ease',
      }}
    >
      {label}
    </button>
  )
}
