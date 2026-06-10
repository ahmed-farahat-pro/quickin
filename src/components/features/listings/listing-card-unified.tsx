'use client'

import { useState, useTransition, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Heart, Star, Users, Bed, Bath, MapPin, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores'
import { createClient } from '@/lib/supabase/client'
import { WishlistModal } from '@/components/features/wishlists/wishlist-modal'
import
{
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import type { Locale } from '@/i18n/config'
import { localizePathname } from '@/lib/i18n/pathname'
import { formatNumber } from '@/lib/i18n/format'
import { MIN_REVIEWS_THRESHOLD } from '@/lib/constants'

export interface ListingCardUnifiedProps
{
  id: string
  title: string
  location: string

  bestOfferPrice?: number | null
  city?: string | null
  country?: string | null
  price: number
  displayPrice?: number       // Today's price or avg nightly over selected dates
  totalPrice?: number | null  // Total stay cost when dates are selected
  numNights?: number | null   // Number of nights when dates are selected
  currency?: string
  rating?: number
  reviewCount?: number
  images: string[]
  isGuestFavorite?: boolean
  isFavorite?: boolean
  // Carousel
  enableCarousel?: boolean
  // Expanded mode props (for map view)
  isMapActive?: boolean
  expanded?: boolean
  maxGuests?: number
  bedrooms?: number
  bathrooms?: number
  // Interaction
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  isHighlighted?: boolean
}

export function ListingCardUnified({
  id,
  title,
  location,

  bestOfferPrice,
  city,
  country,
  price,
  displayPrice,
  totalPrice,
  numNights,
  currency = 'EGP',
  rating,
  reviewCount = 0,
  images = [],
  isGuestFavorite,
  isFavorite: initialFavorite = false,
  enableCarousel = false,
  isMapActive = false,
  expanded = false,
  maxGuests,
  bedrooms,
  bathrooms,
  onClick,
  onMouseEnter,
  onMouseLeave,
  isHighlighted = false,
}: ListingCardUnifiedProps)
{
  const locale = useLocale() as Locale
  const t = useTranslations('listingCard')
  const tDetail = useTranslations('listingDetail')
  const [isFavorite, setIsFavorite] = useState(initialFavorite)
  const [isWishlistModalOpen, setIsWishlistModalOpen] = useState(false)
  const { openAuthModal } = useUIStore()
  const supabase = createClient()
  const router = useRouter()

  // Sync state with prop if it changes via router.refresh()
  useEffect(() =>
  {
    setIsFavorite(initialFavorite)
  }, [initialFavorite])

  const handleFavoriteClick = async (e: React.MouseEvent) =>
  {
    e.preventDefault()
    e.stopPropagation()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast.error(t('pleaseLoginToSave'), {
        action: { label: t('logIn'), onClick: () => openAuthModal('login') }
      })
      return
    }

    setIsWishlistModalOpen(true)
  }

  const handleCardClick = (e: React.MouseEvent) =>
  {
    if (isMapActive && onClick) {
      e.preventDefault()
      onClick()
    }
  }

  // Card content (shared between Link and div wrappers)
  const cardContent = (
    <>
      {/* Image Container */}
      <div className={cn(
        'relative overflow-hidden',
        isMapActive ? (expanded ? 'w-full sm:w-[280px] shrink-0 aspect-[4/3]' : 'aspect-[16/9] w-full') : 'aspect-[16/10] w-full'
      )}>
        {/* Image / Carousel */}
        {enableCarousel && images.length > 0 ? (
          <Carousel className="w-full h-full [&>div]:h-full" opts={{ watchDrag: true }}>
            <CarouselContent className="h-full ms-0">
              {images.map((image, index) => (
                <CarouselItem key={index} className="relative h-full ps-0">
                  <Image
                    src={image}
                    alt={`${title} - Image ${index + 1}`}
                    fill
                    className={cn(
                      'object-cover',
                      !isMapActive && 'transition-transform duration-500 group-hover:scale-105'
                    )}
                    sizes={expanded ? '280px' : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw'}
                    priority={index === 0}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            {/* Show controls on hover only — stop propagation to prevent Link navigation */}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <CarouselPrevious className="start-2 bg-white/80 hover:bg-white h-7 w-7" />
              <CarouselNext className="end-2 bg-white/80 hover:bg-white h-7 w-7" />
            </div>
          </Carousel>
        ) : (
          <Image
            src={images[0] || '/placeholder.svg'}
            alt={title}
            fill
            className={cn(
              'object-cover rounded-card shadow-lg',
              !isMapActive && 'transition-transform duration-500 group-hover:scale-105'
            )}
            sizes={expanded ? '280px' : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw'}
          />
        )}

        {/* Favorite Button */}
        <Button
          size='icon'
          variant='ghost'
          className='absolute top-3 end-3 z-10 h-9 w-9 rounded-full bg-white/90 hover:bg-white shadow-sm'
          onClick={handleFavoriteClick}
        >
          <Heart
            className={`h-5 w-5 transition-all ${isFavorite
              ? 'fill-primary text-primary'
              : 'text-foreground/70 hover:text-primary'
              }`}
          />
        </Button>

        {/* Best Offer Badge — shown when an approved offer price exists */}
        {bestOfferPrice ? (
          <Badge className='absolute top-3 start-3 z-[5] bg-emerald-600 text-white shadow-md font-medium rounded-full px-3 py-1 border-0 flex items-center gap-1'>
            <Tag className='h-3 w-3' />
            {t('bestOffer')}
          </Badge>
        ) : isGuestFavorite ? (
          <Badge className='absolute top-3 start-3 bg-white text-foreground shadow-md font-medium rounded-full px-1'>
            {t('guestFavorite')}
          </Badge>
        ) : null}
      </div>

      {/* Content Section */}
      <div className={cn(
        'flex flex-col',
        expanded ? 'flex-1 p-4 justify-between' : 'px-3 pt-3 pb-4 space-y-2'
      )}>
        {/* Top: Title, Location, Rating */}
        <div>
          <div className='flex items-start justify-between gap-2'>
            <div className='flex-1 min-w-0'>
              <h3 className={cn(
                'font-semibold text-foreground line-clamp-1',
                expanded ? 'text-lg' : 'text-[15px]'
              )}>
                {title}
              </h3>
              <div className={cn('flex items-center gap-1 mt-0.5 text-muted-foreground', isMapActive ? 'text-xs' : 'text-sm')}>
                <MapPin className='h-3.5 w-3.5 shrink-0' />
                <span className='truncate'>{tDetail('locationFormat', { city: city || location || '', country: country || '' })}</span>
              </div>
            </div>
            {rating !== undefined && reviewCount > MIN_REVIEWS_THRESHOLD && (
              <div className='flex items-center gap-1 shrink-0'>
                <Star className='h-3.5 w-3.5 fill-primary text-primary' />
                <span className={cn('font-medium', isMapActive ? 'text-xs' : 'text-sm')}>{rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Extended Info (Unified) */}
          {(maxGuests || bedrooms || bathrooms) && (
            <div className='flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground'>
              {maxGuests && (
                <span className='flex items-center gap-1'>
                  {t('guestCount', { count: maxGuests })}
                </span>
              )}
              {bedrooms && (
                <span className='flex items-center gap-1'>
                  <Bed className='h-3.5 w-3.5' />
                  {t('bedCount', { count: bedrooms })}
                </span>
              )}
              {bathrooms && (
                <span className='flex items-center gap-1'>
                  <Bath className='h-3.5 w-3.5' />
                  {t('bathCount', { count: bathrooms })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Price */}
        {(() =>
        {
          const shownPrice = displayPrice || price
          const isLower = shownPrice < price
          const priceColor = isLower ? 'text-emerald-600' : 'text-foreground'
          return (
            <div className={cn(
              expanded ? 'mt-4' : 'mt-auto pt-1'
            )}>
              <div className={cn('flex', isMapActive ? 'text-sm' : '')}>
                {shownPrice !== price ? (
                  <div className='flex gap-[2px]'>
                    <span className='text-muted-foreground line-through'>{formatNumber(price, locale)} {currency}</span>
                    <span className={`font-semibold mx-[2px] ${priceColor}`}>{formatNumber(shownPrice, locale)} {currency}</span>
                  </div>
                ) : (
                  <span className='font-semibold text-foreground'>{formatNumber(shownPrice, locale)} {currency}</span>
                )}
                <span className='text-muted-foreground mx-[2px]'>/{t('night')}</span>
              </div>
              {totalPrice != null && numNights != null && numNights > 0 && (
                <p className='text-muted-foreground text-sm'>
                  {formatNumber(totalPrice, locale)} {currency} {t('total')} · {t('nightCount', { count: numNights })}
                </p>
              )}
            </div>
          )
        })()}

        {/* View Details button — only in map mode */}
        {isMapActive && (
          <Button
            variant='outline'
            className='w-1/2 mx-auto text-center text-sm font-semibold text-primary hover:text-primary/80 transition-colors rounded-full backdrop-blur-md bg-accent/20'
            onClick={(e) =>
            {
              e.preventDefault()
              e.stopPropagation()
              router.push(localizePathname(`/listings/${id}`, locale))
            }}
          >
            {t('viewDetails')}
          </Button>
        )}

      </div>
    </>
  )

  // Wrapper styling
  const wrapperClasses = cn(
    'group block bg-[#FDFBF7]/40 backdrop-blur-md rounded-3xl shadow-md overflow-hidden transition-all duration-200',
    'hover:shadow-lg hover:scale-[1.02]',
    expanded ? 'flex flex-col sm:flex-row' : '',
    isHighlighted && ''
  )

  // Conditional wrapper: Link for list-only view, div for map view
  if (isMapActive) {
    return (
      <>
        <div
          className={cn(wrapperClasses, "cursor-pointer")}
          onClick={handleCardClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {cardContent}
        </div>

        <WishlistModal
          isOpen={isWishlistModalOpen}
          onOpenChange={setIsWishlistModalOpen}
          listingId={id}
          listingTitle={title}
          onStatusChange={setIsFavorite}
        />
      </>
    )
  }

  return (
    <>
      <Link
        href={localizePathname(`/listings/${id}`, locale)}
        className={wrapperClasses}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {cardContent}
      </Link>

      <WishlistModal
        isOpen={isWishlistModalOpen}
        onOpenChange={setIsWishlistModalOpen}
        listingId={id}
        listingTitle={title}
        onStatusChange={setIsFavorite}
      />
    </>
  )
}
