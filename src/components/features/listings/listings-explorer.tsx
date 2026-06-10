'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ListingCardUnified } from './listing-card-unified'
import { DestinationsMapWrapper } from '@/components/features/search/destinations-map-wrapper'
import type { ListingWithHost } from '@/types'
import { fetchMoreListings } from '@/lib/actions/listing-actions'
import { useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Map as MapIcon, List, Loader2, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { LISTINGS_PER_PAGE } from '@/lib/constants'
import { SortDropdown } from '@/components/features/search/sort-dropdown'
import { ClearFiltersButton } from '@/components/features/search/clear-filters-button'
import { localizePathname } from '@/lib/i18n/pathname'
import type { Locale } from '@/i18n/config'

interface ListingsExplorerProps
{
  listings: ListingWithHost[]
  totalCount: number
  savedListingIds?: string[]
  center: { lat: number; lng: number }
  zoom?: number
  defaultView?: 'list' | 'map'
  // Resolved geo coords from a destination pill — forwarded to fetchMoreListings
  geoSearch?: { lat: number; lng: number; radiusKm: number }
  country?: string
  includeSurrounding?: boolean
}

export function ListingsExplorer({
  listings,
  totalCount: initialTotalCount,
  savedListingIds = [],
  center,
  zoom = 10,
  defaultView = 'list',
  geoSearch,
  country,
  includeSurrounding,
}: ListingsExplorerProps)
{
  const locale = useLocale() as Locale
  const t = useTranslations('listingsExplorer')
  const homeT = useTranslations('home')
  const commonT = useTranslations('common')
  const [showMap, setShowMap] = useState(defaultView === 'map')
  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null)
  const [focusedListingId, setFocusedListingId] = useState<string | null>(null)
  const [openPopupForId, setOpenPopupForId] = useState<string | null>(null)
  const listContainerRef = useRef<HTMLDivElement>(null)
  // Tracks DOM refs for each card so we can scroll to them
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const searchParams = useSearchParams()

  const [currentListings, setCurrentListings] = useState<ListingWithHost[]>(listings)
  const [page, setPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(listings.length > 0 && (Number(listings[0]?._total_count) || initialTotalCount) > listings.length)

  // Derived filter state for badges
  const category = searchParams.get('category')
  const location = searchParams.get('location')
  const checkIn = searchParams.get('checkIn')
  const checkOut = searchParams.get('checkOut')
  const guests = searchParams.get('guests') ? parseInt(searchParams.get('guests')!) : undefined
  const priceMin = searchParams.get('priceMin') ? parseInt(searchParams.get('priceMin')!) : undefined
  const priceMax = searchParams.get('priceMax') ? parseInt(searchParams.get('priceMax')!) : undefined
  const attributes = searchParams.get('attributes') ? searchParams.get('attributes')!.split(',') : undefined
  const propertyType = searchParams.get('propertyType')
  const bestOffer = searchParams.get('bestOffer') === 'true'

  const hasFilters = location || checkIn || checkOut || guests || priceMin || priceMax || (attributes && attributes.length > 0) || (propertyType) || bestOffer

  // Calculate serialized dependencies for the overarching search query
  const searchKey = `${searchParams.toString()}-${geoSearch?.lat}-${country}-${includeSurrounding}-${searchParams.get('sort')}`
  const prevSearchKeyRef = useRef(searchKey)

  // Sync state if overarching search query changes
  useEffect(() =>
  {
    if (prevSearchKeyRef.current !== searchKey) {
      // New search -> restart from page 1
      prevSearchKeyRef.current = searchKey
      setCurrentListings(listings)
      setPage(1)
      const total = Number(listings[0]?._total_count) || initialTotalCount
      setHasMore(listings.length > 0 && listings.length < total)
    } else if (page === 1) {
      // Same search, we are on page 1 -> parent sent us updated bindings (e.g. from hydration or DB save updates)
      setCurrentListings(listings)
      const total = Number(listings[0]?._total_count) || initialTotalCount
      setHasMore(listings.length > 0 && listings.length < total)
    }
    // Deliberately ignoring changes to `listings` if we're on page > 1 with the same searchKey
    // to prevent wiping out appended pages!
  }, [listings, searchKey, page, initialTotalCount])

  const handleShowMore = async () =>
  {
    setIsLoadingMore(true)
    try {
      const nextPage = page + 1
      const newListings = await fetchMoreListings(nextPage, {
        category: searchParams.get('category') || undefined,
        location: searchParams.get('location') || undefined,
        checkIn: searchParams.get('checkIn') || undefined,
        checkOut: searchParams.get('checkOut') || undefined,
        guests: searchParams.get('guests') || undefined,
        priceMin: searchParams.get('priceMin') || undefined,
        priceMax: searchParams.get('priceMax') || undefined,
        attributes: searchParams.get('attributes') || undefined,
        propertyType: searchParams.get('propertyType') || undefined,
        bestOffer: searchParams.get('bestOffer') || undefined,
        sortBy: searchParams.get('sort') || undefined,
        view: showMap ? 'map' : 'list',
        // Forward resolved geo coords so pagination also uses radius search
        geoLat: geoSearch?.lat,
        geoLng: geoSearch?.lng,
        geoRadiusKm: geoSearch?.radiusKm,
        country,
        includeSurrounding,
        locale,
      })

      if (newListings.length > 0) {
        setCurrentListings(prev => [...prev, ...newListings])
        setPage(nextPage)

        // Ensure "Show More" correctly disappears when max reached
        const total = Number(newListings[0]?._total_count) || initialTotalCount
        const newTotalLength = currentListings.length + newListings.length

        if (newListings.length < LISTINGS_PER_PAGE || newTotalLength >= total) {
          setHasMore(false)
        }
      } else {
        setHasMore(false)
      }
    } catch (error) {
      console.error('Failed to load more listings:', error)
      toast.error(commonT('errors.generic'))
    } finally {
      setIsLoadingMore(false)
    }
  }

  // Final processed listings for rendering
  const mappedListings = currentListings.map((l) => ({
    ...l,
    latitude: l.lat || 0,
    longitude: l.lng || 0,
    isFavorite: savedListingIds.includes(l.id)
  }))

  // Handle card click to focus map on that listing (fly + open popup)
  const handleCardFocus = useCallback((listingId: string) =>
  {
    setFocusedListingId(listingId)
    setOpenPopupForId(listingId)
    // Reset popup trigger after animation so the same card can be clicked again
    setTimeout(() =>
    {
      setFocusedListingId(null)
      setOpenPopupForId(null)
    }, 2000)
  }, [])

  // Handle map marker click → highlight + scroll to card in list
  const handleMarkerClick = useCallback((listingId: string) =>
  {
    setFocusedListingId(listingId)
    setHoveredListingId(listingId)
    const cardEl = cardRefs.current.get(listingId)
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    setTimeout(() =>
    {
      setFocusedListingId(null)
      setHoveredListingId(null)
    }, 2000)
  }, [])



  if (!currentListings || currentListings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] w-full text-center p-8">
        <h2 className="text-2xl font-bold mb-2">{t('empty.title')}</h2>
        <p className="text-muted-foreground">{t('empty.description')}</p>
      </div>
    )
  }

  const totalDisplayed = currentListings.length
  const totalInDb = Number(currentListings[0]?._total_count) || initialTotalCount

  return (
    <div className="relative w-full">

      {/* Filter Info, Sort Dropdown & Clear Buttons */}
      <div className='mb-6 flex flex-col sm:flex-row sm:items-center justify-between flex-wrap gap-4'>
        <div className='flex items-center gap-2 flex-wrap'>
          <p className='text-muted-foreground font-medium'>
            {homeT('filters.showingResults', { count: totalDisplayed, total: totalInDb })}
          </p>
          {category && <Badge variant="secondary" className='rounded-full'>{category}</Badge>}
          {location && <Badge variant="outline" className='rounded-full'>{homeT('filters.location', { location })}</Badge>}
          {checkIn && checkOut && <Badge variant="outline" className='rounded-full'>{homeT('filters.dates', { checkIn, checkOut })}</Badge>}
          {guests && <Badge variant="outline" className='rounded-full'>{homeT('filters.guests', { count: guests })}</Badge>}
          {(priceMin || priceMax) && (
            <Badge variant="outline" className='rounded-full'>
              {homeT('filters.price', { min: priceMin || 0, max: priceMax || '∞' })}
            </Badge>
          )}
          {attributes && attributes.length > 0 && (
            <Badge variant="outline" className='rounded-full'>{homeT('filters.amenities', { count: attributes.length })}</Badge>
          )}
          {propertyType && (
            <Badge variant="outline" className='rounded-full'>{homeT('filters.propertyTypes', { count: propertyType.split(',').length })}</Badge>
          )}
          {bestOffer && (
            <Badge variant="outline" className='rounded-full bg-primary/10 border-primary/30 text-primary'>
              <Tag className='h-3 w-3 mr-1' /> {homeT('filters.bestOffers')}
            </Badge>
          )}
        </div>

        <div className='flex items-center gap-4 sm:ms-auto'>
          <SortDropdown hasLocation={!!geoSearch || !!location} />

          {(category || hasFilters) && (
            <ClearFiltersButton
              label={homeT('filters.clearAll')}
              href={localizePathname('/', locale)}
            />
          )}
        </div>
      </div>

      {/* TOGGLE BUTTON - Top Right */}
      <div className="flex justify-end px-4 sm:px-6 mb-4">
        <Button
          onClick={() => setShowMap(!showMap)}
          variant="outline"
          className="rounded-full border-black/10 hover:bg-accent gap-2 text-sm font-semibold h-10 px-4 transition-transform active:scale-95"
        >
          {showMap ? (
            <>
              <List className="h-4 w-4" />
              {t('actions.showList')}
            </>
          ) : (
            <>
              <MapIcon className="h-4 w-4" />
              {t('actions.showMap')}
            </>
          )}
        </Button>
      </div>

      {/* MAIN CONTAINER - Responsive flex layout */}
      <div className={cn(
        'flex transition-all duration-500 ease-in-out',
        showMap
          ? 'flex-col lg:flex-row min-h-[calc(100vh-200px)]'
          : 'flex-col'
      )}>

        {/* LIST SECTION */}
        <div
          ref={listContainerRef}
          className={cn(
            'transition-all duration-500 ease-in-out overflow-y-auto',
            showMap
              ? 'h-[35vh] lg:h-[calc(100vh-200px)] w-full lg:w-1/2 order-2 lg:order-1'
              : 'w-full'
          )}
        >
          <div className={cn(
            'p-4 sm:p-6 transition-all duration-500',
            showMap
              ? 'flex flex-col gap-4'
              : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
          )}>
            {currentListings.map((listing) => (
              <div
                key={listing.id}
                ref={(el) =>
                {
                  if (el) cardRefs.current.set(listing.id, el)
                  else cardRefs.current.delete(listing.id)
                }}
              >
                <ListingCardUnified
                  id={listing.id}
                  title={listing.title}
                  location={listing.location}
                  city={listing.city}
                  country={listing.country}
                  price={listing.price_per_night}
                  displayPrice={listing.display_price}
                  totalPrice={listing.total_price}
                  numNights={listing.num_nights}
                  currency={listing.currency}
                  rating={listing.rating}
                  reviewCount={listing.review_count}
                  images={listing.images}
                  isGuestFavorite={listing.is_guest_favorite}
                  enableCarousel={true}

                  bestOfferPrice={listing.best_offer_price}
                  isFavorite={savedListingIds.includes(listing.id)}
                  // Map mode props
                  isMapActive={showMap}
                  expanded={showMap}
                  maxGuests={listing.max_guests}
                  bedrooms={listing.bedrooms}
                  bathrooms={listing.bathrooms}
                  // Interactions
                  onClick={() => handleCardFocus(listing.id)}
                  onMouseEnter={() => setHoveredListingId(listing.id)}
                  onMouseLeave={() => setHoveredListingId(null)}
                  isHighlighted={hoveredListingId === listing.id}
                />
              </div>
            ))}
          </div>

          {/* SHOW MORE BUTTON */}
          {hasMore && currentListings.length > 0 && (
            <div className='flex justify-center p-8 pb-12'>
              <Button
                variant="outline"
                size="lg"
                onClick={handleShowMore}
                disabled={isLoadingMore}
                className="rounded-full min-w-[200px] border-black/80 hover:bg-black/5 hover:border-black font-semibold text-base h-12"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {commonT('loading')}
                  </>
                ) : (
                  t('actions.showMore')
                )}
              </Button>
            </div>
          )}
        </div>

        {/* MAP SECTION - Slides in when active */}
        <div
          className={cn(
            'transition-all duration-500 ease-in-out',
            showMap
              ? 'h-[65vh] lg:h-[calc(100vh-200px)] w-full lg:w-1/2 order-1 lg:order-2 opacity-100 p-4'
              : 'hidden overflow-hidden pointer-events-none'
          )}
        >
          <div className="w-full h-full relative">
            <DestinationsMapWrapper
              center={center}
              zoom={zoom}
              listings={mappedListings as any}
              focusListingId={focusedListingId}
              hoveredListingId={hoveredListingId}
              openPopupForId={openPopupForId}
              onMarkerClick={handleMarkerClick}
              className="h-full mt-0 border border-border rounded-xl shadow-sm w-full"
            />
          </div>
        </div>

      </div>
    </div>
  )
}
