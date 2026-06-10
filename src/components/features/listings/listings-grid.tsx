'use client'

import { ListingCard } from './listing-card'
import type { ListingWithHost } from '@/types'

interface ListingsGridProps {
  listings: ListingWithHost[]
}

export function ListingsGrid({ listings }: ListingsGridProps) {
  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          id={listing.id}
          title={listing.title}
          location={listing.location}
          price={listing.price_per_night}
          displayPrice={listing.display_price}
          totalPrice={listing.total_price}
          numNights={listing.num_nights}
          bestOfferPrice={listing.best_offer_price}
          currency={listing.currency}
          rating={listing.rating}
          images={listing.images}
          isGuestFavorite={listing.is_guest_favorite}
        />
      ))}
    </div>
  )
}
