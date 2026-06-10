'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Heart, Star, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useUIStore } from '@/stores'
import { createClient } from '@/lib/supabase/client'
import { WishlistModal } from '@/components/features/wishlists/wishlist-modal'
import type { Locale } from '@/i18n/config'
import { localizePathname } from '@/lib/i18n/pathname'
import { formatNumber } from '@/lib/i18n/format'

export interface ListingCardProps
{
  id: string
  title: string
  location: string
  distance?: string
  dates?: string
  price: number
  displayPrice?: number       // Today's price or avg nightly over selected dates
  totalPrice?: number | null  // Total stay cost when dates are selected
  numNights?: number | null   // Number of nights when dates are selected
  bestOfferPrice?: number | null
  currency?: string
  rating?: number
  images: string[]
  isSuperhost?: boolean
  isGuestFavorite?: boolean
  isFavorite?: boolean
}

export function ListingCard({
  id,
  title,
  location,
  distance,
  dates,
  price,
  displayPrice,
  totalPrice,
  numNights,
  bestOfferPrice,
  currency,
  rating,
  images,
  isGuestFavorite,
  isFavorite: initialFavorite = false,
}: ListingCardProps)
{
  const locale = useLocale() as Locale
  const t = useTranslations('listingCard')
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
        action: { label: "Log In", onClick: () => openAuthModal('login') }
      })
      return
    }

    setIsWishlistModalOpen(true)
  }

  return (
    <>
      <Link href={localizePathname(`/listings/${id}`, locale)} className='group block'>
        {/* Image Container - 28px rounded corners per design spec */}
        <div className='relative aspect-square overflow-hidden rounded-card card-shadow'>
          <Image
            src={images[0] || '/placeholder.svg'}
            alt={title}
            fill
            className='object-cover transition-transform duration-500 group-hover:scale-105'
            sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw'
          />

          {/* Favorite Button */}
          <Button
            size='icon'
            variant='ghost'
            className='absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-white/80 hover:bg-white shadow-sm'
            onClick={handleFavoriteClick}
          >
            <Heart
              className={`h-5 w-5 transition-all ${isFavorite
                ? 'fill-primary text-primary'
                : 'text-foreground/70 hover:text-primary'
                }`}
            />
          </Button>

          {/* Best Offer Badge */}
          {bestOfferPrice ? (
            <Badge className='absolute top-3 left-3 bg-emerald-600 text-white shadow-md font-medium rounded-full px-3 py-1 flex items-center gap-1'>
              <Tag className='h-3 w-3' />
              Best Offer
            </Badge>
          ) : isGuestFavorite ? (
            <Badge className='absolute top-3 left-3 bg-white text-foreground shadow-md font-medium rounded-full px-3 py-1'>
              {t('guestFavorite')}
            </Badge>
          ) : null}
        </div>

        {/* Card Content */}
        <div className='mt-4 space-y-1'>
          {/* Location & Rating */}
          <div className='flex items-start justify-between gap-2'>
            <h3 className='font-semibold text-foreground line-clamp-1'>{location}</h3>
            {rating && (
              <div className='flex items-center gap-1 shrink-0'>
                <Star className='h-3.5 w-3.5 fill-primary text-primary' />
                <span className='text-sm font-medium'>{rating.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Title/Distance */}
          <p className='text-muted-foreground text-sm line-clamp-1'>
            {distance || title}
          </p>

          {/* Dates */}
          {dates && (
            <p className='text-muted-foreground text-sm'>{dates}</p>
          )}

          {/* Price */}
          {(() =>
          {
            const shownPrice = displayPrice || price
            const isLower = shownPrice < price
            const priceColor = isLower ? 'text-emerald-600' : 'text-foreground'
            return (
              <p className='pt-1'>
                {shownPrice !== price ? (
                  <>
                    <span className='text-sm text-muted-foreground line-through mr-1'>{currency || 'EGP'}{formatNumber(price, locale)}</span>
                    <span className={`font-semibold ${priceColor}`}>{currency || 'EGP'}{formatNumber(shownPrice, locale)}</span>
                  </>
                ) : (
                  <span className='font-semibold text-foreground'>{currency || 'EGP'}{formatNumber(shownPrice, locale)}</span>
                )}
                <span className='text-muted-foreground'> {t('night')}</span>
                {totalPrice != null && numNights != null && numNights > 0 && (
                  <span className='text-muted-foreground text-sm block'>
                    {currency || 'EGP'}{formatNumber(totalPrice, locale)} {t('total')} · {numNights} {numNights !== 1 ? t('nights') : t('night')}
                  </span>
                )}
              </p>
            )
          })()}
        </div>
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
