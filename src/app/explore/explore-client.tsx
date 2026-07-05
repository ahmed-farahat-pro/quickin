'use client'

// Client-side browse experience: a polished search bar, an Airbnb-style
// property-type category filter (icons), a List/Map toggle and a lively results
// grid. The server component (page.tsx) renders header/footer and passes the
// first page of listings as `initialListings` so the first paint is instant.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { MapPin, Users, Search as SearchIcon, Sparkles, Star } from 'lucide-react'
import type { Listing } from '@/lib/local/db'
import { formatPrice } from '@/lib/utils'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { PROPERTY_TYPES, iconForPropertyType } from '@/lib/property-types'
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

// Listing <img> that swaps to a boutique fallback when the source 404s/errors.
// Exported so the (server-rendered) detail page can reuse it as a client island.
export function FallbackImg({
  fallback = FALLBACK_IMG,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { fallback?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      {...props}
      onError={(e) => {
        e.currentTarget.onerror = null
        e.currentTarget.src = fallback
      }}
    />
  )
}

const COLORS = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
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
  type: string
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
  if (f.type.trim()) params.set('type', f.type.trim())
  return params.toString()
}

const EMPTY: Filters = { location: '', checkIn: '', checkOut: '', guests: '', type: '' }

export default function ExploreClient({ initialListings, initialFilters, savedIds }: Props) {
  const t = useTranslations('explorePage')
  const tp = useTranslations('hostPage.create.propertyTypes')
  const savedSet = useMemo(() => new Set(savedIds ?? []), [savedIds])
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [listings, setListings] = useState<Listing[]>(initialListings)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [view, setView] = useState<View>('list')

  // ── Location autocomplete ("search by place") ────────────────────────────
  const [placeOpen, setPlaceOpen] = useState(false)
  const [placeSuggestions, setPlaceSuggestions] = useState<string[]>([])
  const [placeHighlight, setPlaceHighlight] = useState(-1)
  const placeBoxRef = useRef<HTMLDivElement | null>(null)
  const placeAbortRef = useRef<AbortController | null>(null)
  const placeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const placeBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Airbnb-style: on desktop, collapse the hero copy once the user scrolls past
  // the hero, keeping the search + category bar sticky at the top.
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

  const runSearch = useCallback(async (f: Filters) => {
    const query = buildQuery(f)
    if (query === lastQueryRef.current) return
    lastQueryRef.current = query

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
      if (!controller.signal.aborted) setListings(data)
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
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

  // Edit text/date/guest filters locally; the fetch happens on "Search"/Enter.
  const updateFilter = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
  }, [])

  const submitSearch = useCallback(() => {
    runSearch(filters)
  }, [runSearch, filters])

  // ── Location autocomplete behaviour ──────────────────────────────────────
  // The current query is empty ⇒ we're showing the "popular destinations" list.
  const placeQueryEmpty = !filters.location.trim()

  const fetchPlaces = useCallback((value: string) => {
    placeAbortRef.current?.abort()
    const controller = new AbortController()
    placeAbortRef.current = controller
    fetch(`/api/local/places?q=${encodeURIComponent(value.trim())}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { places: [] }))
      .then((data: { places?: string[] }) => {
        if (controller.signal.aborted) return
        setPlaceSuggestions(Array.isArray(data.places) ? data.places : [])
      })
      .catch((err) => {
        if ((err as Error)?.name !== 'AbortError') console.error('Place autocomplete failed:', err)
      })
  }, [])

  // Debounced fetch whenever the (open) location field changes.
  const onLocationChange = useCallback((value: string) => {
    updateFilter({ location: value })
    setPlaceOpen(true)
    setPlaceHighlight(-1)
    if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current)
    placeDebounceRef.current = setTimeout(() => fetchPlaces(value), 200)
  }, [updateFilter, fetchPlaces])

  const openPlaces = useCallback(() => {
    if (placeBlurRef.current) clearTimeout(placeBlurRef.current)
    setPlaceOpen(true)
    setPlaceHighlight(-1)
    fetchPlaces(filters.location)
  }, [fetchPlaces, filters.location])

  const closePlaces = useCallback(() => {
    setPlaceOpen(false)
    setPlaceHighlight(-1)
  }, [])

  const choosePlace = useCallback((place: string) => {
    setFilters((prev) => {
      const next = { ...prev, location: place }
      runSearch(next)
      return next
    })
    closePlaces()
  }, [runSearch, closePlaces])

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!placeOpen) return
    const onDown = (e: MouseEvent) => {
      if (placeBoxRef.current && !placeBoxRef.current.contains(e.target as Node)) closePlaces()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [placeOpen, closePlaces])

  // Cleanup debounce + in-flight request on unmount.
  useEffect(() => {
    return () => {
      if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current)
      if (placeBlurRef.current) clearTimeout(placeBlurRef.current)
      placeAbortRef.current?.abort()
    }
  }, [])

  const onLocationKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (!placeOpen) { openPlaces(); return }
      e.preventDefault()
      setPlaceHighlight((h) => (placeSuggestions.length ? (h + 1) % placeSuggestions.length : -1))
    } else if (e.key === 'ArrowUp') {
      if (!placeOpen) return
      e.preventDefault()
      setPlaceHighlight((h) => (placeSuggestions.length ? (h <= 0 ? placeSuggestions.length - 1 : h - 1) : -1))
    } else if (e.key === 'Enter') {
      if (placeOpen && placeHighlight >= 0 && placeSuggestions[placeHighlight]) {
        e.preventDefault()
        choosePlace(placeSuggestions[placeHighlight])
      } else {
        closePlaces()
        submitSearch()
      }
    } else if (e.key === 'Escape') {
      if (placeOpen) { e.preventDefault(); closePlaces() }
    }
  }, [placeOpen, placeSuggestions, placeHighlight, openPlaces, choosePlace, closePlaces, submitSearch])

  // Category chips filter instantly (like Airbnb's category bar).
  const selectType = useCallback((type: string) => {
    setFilters((prev) => {
      const next = { ...prev, type }
      runSearch(next)
      return next
    })
  }, [runSearch])

  const clearAll = useCallback(() => {
    setFilters(EMPTY)
    runSearch(EMPTY)
  }, [runSearch])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const count = listings.length
  const countLabel = t('results.countFound', { count })

  return (
    <>
      <style>{`
        @keyframes qkFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

        @media (max-width: 760px) {
          .qk-search-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .qk-search-grid .qk-search-location,
          .qk-search-grid .qk-search-dates,
          .qk-search-grid .qk-search-submit {
            grid-column: 1 / -1 !important;
          }
        }
        @media (max-width: 440px) {
          .qk-search-grid { grid-template-columns: 1fr !important; }
          .qk-results-grid { grid-template-columns: 1fr !important; }
        }

        /* Category bar — horizontal scroll, hidden scrollbar. */
        .qk-cats { scrollbar-width: none; -ms-overflow-style: none; }
        .qk-cats::-webkit-scrollbar { display: none; }
        .qk-cat { transition: color .16s ease, border-color .16s ease, opacity .16s ease; opacity: .7; }
        .qk-cat:hover { opacity: 1; }
        .qk-cat[data-on="true"] { opacity: 1; }

        /* Card hover life. */
        .qk-card { transition: transform .22s ease, box-shadow .22s ease; will-change: transform; }
        .qk-card:hover { transform: translateY(-6px); box-shadow: 0 18px 40px rgba(42,34,32,0.16); }
        .qk-card:hover .qk-card-img { transform: scale(1.07); }
        .qk-card-img { transition: transform .5s cubic-bezier(.2,.7,.2,1); }
        .qk-card-cta { transition: background .16s ease; }

        /* Scroll-minimise of the hero copy on desktop. */
        .qk-hero { transition: padding 0.3s ease, box-shadow 0.3s ease; }
        .qk-hero-headline { overflow: hidden; max-height: 280px; opacity: 1; transition: max-height 0.4s ease, opacity 0.25s ease, margin 0.35s ease; }
        .qk-search-grid { transition: padding 0.3s ease, border-radius 0.3s ease, box-shadow 0.3s ease; }
        @media (min-width: 821px) {
          .qk-hero { position: sticky; top: 0; z-index: 40; }
          .qk-hero[data-scrolled="true"] {
            padding-top: 10px !important; padding-bottom: 8px !important;
            box-shadow: 0 6px 20px rgba(42, 34, 32, 0.10);
            border-bottom: 1px solid rgba(42, 34, 32, 0.06);
          }
          .qk-hero[data-scrolled="true"] .qk-hero-headline { max-height: 0; opacity: 0; margin: 0 !important; }
          .qk-hero[data-scrolled="true"] .qk-search-grid { padding: 10px !important; border-radius: 16px !important; box-shadow: 0 4px 14px rgba(42, 34, 32, 0.12) !important; }
        }
      `}</style>

      {/* Hero + Search bar */}
      <section
        className="qk-hero"
        data-scrolled={scrolled ? 'true' : 'false'}
        style={{
          background: `radial-gradient(1200px 300px at 50% -80px, ${COLORS.tan} 0%, ${COLORS.cream} 62%)`,
          padding: '34px 24px 12px',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="qk-hero-headline">
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: 'rgba(91,15,22,0.07)', color: COLORS.burgundy,
                fontSize: 12.5, fontWeight: 700, letterSpacing: '0.02em',
                padding: '6px 13px', borderRadius: 999, marginBottom: 14,
              }}
            >
              <Sparkles size={14} /> {t('hero.badge')}
            </div>
            <h1
              style={{
                margin: 0,
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: 'clamp(28px, 4.6vw, 44px)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: COLORS.burgundy,
                lineHeight: 1.08,
              }}
            >
              {t('hero.title')}
            </h1>
            <p style={{ margin: '12px 0 22px', fontSize: 15.5, color: COLORS.muted, maxWidth: 580, lineHeight: 1.6 }}>
              {t('hero.subtitle')}
            </p>
          </div>

          {/* Search bar */}
          <div
            role="search"
            className="qk-search-grid"
            style={{
              background: '#fff',
              borderRadius: 22,
              border: '1px solid rgba(42,34,32,0.08)',
              boxShadow: '0 10px 34px rgba(42,34,32,0.10)',
              padding: 18,
              display: 'grid',
              gridTemplateColumns: 'minmax(160px, 2fr) minmax(220px, 1.8fr) minmax(96px, 0.8fr) auto',
              gap: 14,
              alignItems: 'end',
            }}
          >
            <div className="qk-search-location" ref={placeBoxRef} style={{ position: 'relative' }}>
              <label htmlFor="location" style={labelStyle}>
                <MapPin size={13} /> {t('search.locationLabel')}
              </label>
              <input
                id="location"
                type="text"
                name="location"
                placeholder={t('search.locationPlaceholder')}
                autoComplete="off"
                role="combobox"
                aria-expanded={placeOpen}
                aria-autocomplete="list"
                aria-controls="qk-place-listbox"
                value={filters.location}
                onChange={(e) => onLocationChange(e.target.value)}
                onFocus={openPlaces}
                onBlur={() => {
                  // Delay so a click on a suggestion registers before we close.
                  if (placeBlurRef.current) clearTimeout(placeBlurRef.current)
                  placeBlurRef.current = setTimeout(() => closePlaces(), 150)
                }}
                onKeyDown={onLocationKeyDown}
                style={inputStyle}
              />
              {placeOpen && placeSuggestions.length > 0 && (
                <ul
                  id="qk-place-listbox"
                  role="listbox"
                  style={{
                    listStyle: 'none',
                    margin: '6px 0 0',
                    padding: 6,
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 60,
                    background: '#fff',
                    border: '1px solid rgba(42,34,32,0.10)',
                    borderRadius: 14,
                    boxShadow: '0 14px 36px rgba(42,34,32,0.16)',
                    maxHeight: 320,
                    overflowY: 'auto',
                  }}
                >
                  {placeQueryEmpty && (
                    <li
                      aria-hidden="true"
                      style={{
                        padding: '8px 10px 6px',
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: COLORS.muted,
                      }}
                    >
                      {t('search.popular')}
                    </li>
                  )}
                  {placeSuggestions.map((place, i) => (
                    <li
                      key={place}
                      role="option"
                      aria-selected={i === placeHighlight}
                      onMouseEnter={() => setPlaceHighlight(i)}
                      onMouseDown={(e) => {
                        // Prevent the input's blur from firing before the click.
                        e.preventDefault()
                        choosePlace(place)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        padding: '10px 12px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontSize: 14,
                        fontFamily: FONT,
                        color: COLORS.ink,
                        background: i === placeHighlight ? COLORS.cream : 'transparent',
                      }}
                    >
                      <MapPin size={15} color={COLORS.burgundy} />
                      <span>{place}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="qk-search-dates" style={{ alignSelf: 'end' }}>
              <DateRangePicker
                checkIn={filters.checkIn}
                checkOut={filters.checkOut}
                checkInLabel={t('search.checkInLabel')}
                checkOutLabel={t('search.checkOutLabel')}
                onChange={(checkIn, checkOut) => updateFilter({ checkIn, checkOut })}
              />
            </div>
            <div>
              <label htmlFor="guests" style={labelStyle}>
                <Users size={13} /> {t('search.guestsLabel')}
              </label>
              <input
                id="guests"
                type="number"
                name="guests"
                min={1}
                placeholder="1"
                value={filters.guests}
                onChange={(e) => updateFilter({ guests: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') submitSearch() }}
                style={inputStyle}
              />
            </div>
            <button
              type="button"
              onClick={submitSearch}
              className="qk-search-submit qk-card-cta"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 26px',
                fontSize: 15,
                fontWeight: 700,
                fontFamily: FONT,
                color: '#fff',
                background: COLORS.burgundy,
                border: 'none',
                borderRadius: 14,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <SearchIcon size={17} /> {t('search.search')}
            </button>
          </div>

          {/* Property-type category bar */}
          <div
            className="qk-cats"
            style={{
              display: 'flex',
              gap: 26,
              overflowX: 'auto',
              padding: '16px 2px 6px',
              marginTop: 6,
            }}
          >
            <CategoryChip
              label={t('categories.all')}
              Icon={Sparkles}
              active={!filters.type}
              onClick={() => selectType('')}
            />
            {PROPERTY_TYPES.map((p) => (
              <CategoryChip
                key={p.value}
                label={tp(p.key)}
                Icon={p.Icon}
                active={filters.type.toLowerCase() === p.value.toLowerCase()}
                onClick={() => selectType(p.value)}
              />
            ))}
          </div>

          {/* Status row: result count + searching + List/Map toggle */}
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: 14, color: COLORS.muted }} aria-live="polite" aria-busy={searching}>
              {searching ? (
                <span style={{ color: COLORS.burgundy, fontWeight: 600 }}>{t('results.searching')}</span>
              ) : (
                <span>{countLabel}</span>
              )}
            </div>

            <div
              role="tablist"
              aria-label={t('view.toggleLabel')}
              style={{ display: 'inline-flex', background: COLORS.tan, borderRadius: 999, padding: 4, gap: 4 }}
            >
              <ToggleButton label={t('view.list')} active={view === 'list'} onClick={() => setView('list')} />
              <ToggleButton label={t('view.map')} active={view === 'map'} onClick={() => setView('map')} />
            </div>
          </div>

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
              <span>{t('error.refresh')}</span>
              <button
                type="button"
                onClick={() => setSearchError(false)}
                aria-label={t('error.dismiss')}
                style={{ appearance: 'none', border: 'none', background: 'transparent', color: COLORS.burgundy, fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: 0, flex: '0 0 auto' }}
              >
                ×
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      <section
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          padding: '26px 24px 72px',
          flex: 1,
        }}
      >
        {listings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', color: COLORS.muted }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: COLORS.ink }}>{t('empty.title')}</p>
            <p style={{ margin: '8px 0 18px', fontSize: 15 }}>{t('empty.subtitle')}</p>
            <button
              type="button"
              onClick={clearAll}
              style={{ display: 'inline-block', color: '#fff', background: COLORS.burgundy, border: 'none', fontFamily: FONT, fontSize: 15, fontWeight: 600, padding: '10px 22px', borderRadius: 999, cursor: 'pointer' }}
            >
              {t('empty.clearFilters')}
            </button>
          </div>
        ) : view === 'map' ? (
          <ListingsMap listings={listings} />
        ) : (
          <div
            className="qk-results-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 28 }}
          >
            {listings.map((listing, i) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                saved={savedSet.has(listing.id)}
                index={i}
                t={t}
              />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function CategoryChip({
  label, Icon, active, onClick,
}: {
  label: string
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-on={active ? 'true' : 'false'}
      className="qk-cat"
      style={{
        appearance: 'none',
        background: 'transparent',
        border: 'none',
        borderBottom: `2px solid ${active ? COLORS.burgundy : 'transparent'}`,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 7,
        padding: '4px 2px 10px',
        minWidth: 62,
        flex: '0 0 auto',
        fontFamily: FONT,
        fontSize: 12,
        fontWeight: active ? 700 : 600,
        color: active ? COLORS.burgundy : COLORS.ink,
      }}
    >
      <Icon size={23} strokeWidth={1.7} color={active ? COLORS.burgundy : COLORS.muted} />
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

function ListingCard({
  listing, saved, index, t,
}: {
  listing: Listing
  saved: boolean
  index: number
  t: ReturnType<typeof useTranslations>
}) {
  const cover = listing.listing_images[0]?.url || FALLBACK_IMG
  const TypeIcon = iconForPropertyType(listing.property_type)
  return (
    <a
      href={`/explore/${listing.id}`}
      className="qk-card"
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
        animation: `qkFadeUp .5s ease both`,
        animationDelay: `${Math.min(index, 8) * 45}ms`,
      }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', overflow: 'hidden', background: COLORS.tan }}>
        <img
          src={cover}
          alt={listing.title}
          loading="lazy"
          className="qk-card-img"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMG }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {listing.is_guest_favorite && (
          <span
            style={{
              position: 'absolute', top: 14, left: 14,
              background: 'rgba(255,255,255,0.94)', color: COLORS.burgundy,
              fontSize: 12, fontWeight: 600, letterSpacing: '0.01em',
              padding: '6px 12px', borderRadius: 999,
              boxShadow: '0 2px 8px rgba(42,34,32,0.14)',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            <Star size={12} fill={COLORS.burgundy} /> {t('card.guestFavorite')}
          </span>
        )}
        <span style={{ position: 'absolute', top: 12, right: 12 }}>
          <WishlistButton listingId={listing.id} initialSaved={saved} />
        </span>
      </div>

      <div style={{ padding: '16px 18px 20px' }}>
        <h2 style={{ margin: 0, fontSize: 17.5, fontWeight: 600, lineHeight: 1.3, color: COLORS.ink }}>
          {listing.title}
        </h2>
        {listing.location && (
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: COLORS.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
            <MapPin size={13} /> {listing.location}
          </p>
        )}
        {listing.property_type && (
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: 10,
              background: COLORS.cream, color: COLORS.ink,
              fontSize: 12, fontWeight: 600,
              padding: '4px 10px', borderRadius: 999,
            }}
          >
            <TypeIcon size={13} strokeWidth={1.8} color={COLORS.burgundy} /> {listing.property_type}
          </span>
        )}
        <p style={{ margin: '12px 0 0', fontSize: 15, color: COLORS.ink }}>
          <span style={{ fontWeight: 700, color: COLORS.burgundy, fontSize: 17 }}>
            {formatPrice(listing.price_per_night, listing.currency)}
          </span>{' '}
          <span style={{ color: COLORS.muted }}>{t('card.perNight')}</span>
        </p>
      </div>
    </a>
  )
}

function ToggleButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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
