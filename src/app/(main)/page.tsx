// =============================================================================
// HOMEPAGE
// =============================================================================
// Description: Main landing page with hero section, listings grid and filtering
// Supports: category, location, dates, guests, price, attributes via URL params
// =============================================================================

import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Tag } from 'lucide-react'
import { getListings, getAttributes, getDestinations } from '@/lib/supabase/queries'
import { getUserSavedListingIds } from '@/lib/supabase/wishlists'
import ReactMarkdown from 'react-markdown'
import { ListingsGrid } from '@/components/features/listings/listings-grid'
import { StickySearchSectionV2 } from '@/components/features/search/sticky-search-v2'
import { ViewToggle } from '@/components/features/search/view-toggle'
import { ListingsExplorer } from '@/components/features/listings/listings-explorer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getRequestLocale } from '@/i18n/request-locale'
import { localizePathname } from '@/lib/i18n/pathname'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { SiteSettings } from '@/types/site-settings'
import { SortDropdown } from '@/components/features/search/sort-dropdown'
import { ClearFiltersButton } from '@/components/features/search/clear-filters-button'

// Revalidate on every request since search params change listings
// Using searchParams already opts into dynamic rendering in Next.js 15+
// No force-dynamic needed — Next.js will stream the response

const ITEMS_PER_PAGE = 12

interface HomePageProps
{
  searchParams: Promise<{
    category?: string // Retained for backward compat, though largely replaced by location logic
    location?: string
    checkIn?: string
    checkOut?: string
    guests?: string
    priceMin?: string
    priceMax?: string
    attributes?: string
    propertyType?: string
    page?: string
    view?: string // 'list' | 'map'
    bestOffer?: string
    sort?: string
  }>
}

export default async function HomePage({ searchParams }: HomePageProps)
{
  const locale = await getRequestLocale()
  const t = await getTranslations('home')
  const params = await searchParams
  const category = params.category
  const location = params.location
  const checkIn = params.checkIn
  const checkOut = params.checkOut
  const guests = params.guests ? parseInt(params.guests) : undefined
  const priceMin = params.priceMin ? parseInt(params.priceMin) : undefined
  const priceMax = params.priceMax ? parseInt(params.priceMax) : undefined
  const attributes = params.attributes ? params.attributes.split(',') : undefined
  const page = parseInt(params.page || '1', 10)
  const view = params.view || 'list'
  const sort = params.sort
  const offset = (page - 1) * ITEMS_PER_PAGE

  // Fetch active destinations for the search bar
  const destinations = await getDestinations(locale)

  // Get current user for personalized recommendations
  const supabase = await createClient()
  const user = supabase ? (await supabase.auth.getUser()).data.user : null

  // Check if 'location' matches a known destination label (prefer original english label)
  const selectedDest = (destinations as import('@/types/database').SearchDestination[]).find(d =>
    (d.en_label || d.label) === location || d.label === location
  )

  let geoSearch: { lat: number; lng: number; radiusKm: number } | undefined
  let specificIds: string[] | undefined
  let includeSurrounding: boolean | undefined
  let countryFilter: string | undefined

  if (selectedDest) {
    if (selectedDest.type === 'curated' && selectedDest.listing_ids?.length > 0) {
      specificIds = selectedDest.listing_ids
    } else {
      // lat/lng are now resolved server-side via ST_X/ST_Y in get_active_destinations_with_coords()
      if (selectedDest.lat != null && selectedDest.lng != null) {
        geoSearch = {
          lat: selectedDest.lat,
          lng: selectedDest.lng,
          radiusKm: selectedDest.radius_km
        }
      }

      includeSurrounding = selectedDest.include_surrounding
      countryFilter = selectedDest.country
    }
  }

  // Fetch listings with all filters, including new destination logic
  const limit = view === 'map' ? 50 : ITEMS_PER_PAGE

  const [listings, allAttributes, savedListingIds] = await Promise.all([
    getListings({
      category,
      location,
      checkIn,
      checkOut,
      guests,
      priceMin,
      priceMax,
      attributes,
      propertyType: params.propertyType ? params.propertyType.split(',') : undefined,
      limit,
      offset: view === 'map' ? 0 : offset,
      geoSearch,
      specificIds,
      includeSurrounding,
      country: countryFilter,
      bestOffer: params.bestOffer === 'true',
      locale,
      sortBy: sort,
      userId: user?.id,
    }),
    getAttributes(),
    getUserSavedListingIds()
  ])

  // Extract total count from the RPC result (embedded in each row)
  const totalCount = listings[0]?._total_count ?? listings.length
  const hasMore = offset + listings.length < totalCount

  // Build URL for "Show more" preserving all params
  const showMoreParams = new URLSearchParams()
  if (category) showMoreParams.set('category', category)
  if (location) showMoreParams.set('location', location)
  if (checkIn) showMoreParams.set('checkIn', checkIn)
  if (checkOut) showMoreParams.set('checkOut', checkOut)
  if (guests) showMoreParams.set('guests', String(guests))
  if (priceMin) showMoreParams.set('priceMin', String(priceMin))
  if (priceMax) showMoreParams.set('priceMax', String(priceMax))
  if (attributes) showMoreParams.set('attributes', attributes.join(','))
  if (params.propertyType) showMoreParams.set('propertyType', params.propertyType)
  if (params.bestOffer) showMoreParams.set('bestOffer', params.bestOffer)
  if (view) showMoreParams.set('view', view)
  if (sort) showMoreParams.set('sort', sort)
  showMoreParams.set('page', String(page + 1))

  // Check if any filters are active
  const hasFilters = location || checkIn || checkOut || guests || priceMin || priceMax || (attributes && attributes.length > 0) || (params.propertyType) || params.bestOffer === 'true'

  // Show hero only on first page with no filters
  const showHero = page === 1 && !category && !hasFilters

  // Map Center Logic
  const mapCenter = geoSearch
    ? { lat: geoSearch.lat, lng: geoSearch.lng }
    : { lat: 26.8206, lng: 30.8025 }
  const mapZoom = selectedDest ? 10 : 6

  // Fetch Site Settings for Hero
  const { data: siteSettings } = await supabase?.from('site_settings').select('*').eq('id', 1).single() || { data: null }
  const heroConfig = siteSettings?.hero_config as SiteSettings['hero_config'] | undefined

  return (
    <>
      {/* Hero Section */}
      {showHero && (
        <>
          <section className='relative h-[70vh] min-h-[500px] max-h-[700px] overflow-visible'>
            {/* Background */}
            <div className='absolute inset-0'>
              {heroConfig?.background_type === 'video' && heroConfig.media_url ? (
                <video
                  src={heroConfig.media_url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="object-cover w-full h-full"
                />
              ) : heroConfig?.background_type === 'color' ? (
                 <div className="w-full h-full bg-primary" />
              ) : (
                <Image
                  src={heroConfig?.media_url || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2070'}
                  alt='Hero Background'
                  fill
                  className='object-cover'
                  priority
                />
              )}
              <div className='absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/50' />
            </div>

            {/* Hero Content */}
            <div className='relative h-full container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center'>
              <div className='max-w-xl'>
                <h1
                  className='text-hero text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 [&_p]:inline'
                  style={{ textShadow: '0 2px 8px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3)' }}
                >
                  {heroConfig?.title?.[locale as 'en' | 'ar'] ? (
                    <ReactMarkdown>{heroConfig.title[locale as 'en' | 'ar']}</ReactMarkdown>
                  ) : (
                    t.rich('hero.title', { br: () => <br /> })
                  )}
                </h1>
                <div
                  className='text-lg md:text-xl text-white/95 mb-8 [&_p]:inline [&_p]:mr-1 prose prose-invert prose-p:my-0'
                  style={{ textShadow: '0 2px 6px rgba(0, 0, 0, 0.5), 0 3px 12px rgba(0, 0, 0, 0.3)' }}
                >
                  {heroConfig?.subtitle?.[locale as 'en' | 'ar'] ? (
                    <ReactMarkdown>{heroConfig.subtitle[locale as 'en' | 'ar']}</ReactMarkdown>
                  ) : (
                    <p>{t('hero.description')}</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Sticky Search + Dynamic Destinations */}
      <StickySearchSectionV2
        showHero={showHero}
        attributes={allAttributes}
        destinations={destinations}
      />

      <div id='listings' className='container mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-[2%] min-h-[500px]'>

        <ListingsExplorer
          listings={listings}
          totalCount={totalCount}
          savedListingIds={savedListingIds}
          center={mapCenter}
          zoom={mapZoom}
          defaultView={view === 'map' ? 'map' : 'list'}
          geoSearch={geoSearch}
          country={countryFilter}
          includeSurrounding={includeSurrounding}
        />

      </div>
    </>
  )
}
