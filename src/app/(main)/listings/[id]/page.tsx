import { Metadata, ResolvingMetadata } from 'next'
import { getListingById, getReviews, getReviewEligibility, getListingAvailabilityAndAdjustments, getListingBookedDates, getExistingBookingStatus } from '@/lib/supabase/queries'
import { getListingWishlistStatus } from '@/lib/supabase/wishlists'
import { ListingDetail } from '@/components/features/listings/listing-detail'
import { CommentsSection } from '@/components/features/comments/comment-section'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { eachDayOfInterval, parseISO } from 'date-fns'
import { getLocale } from 'next-intl/server'
import type { ListingAttributeDisplay } from '@/components/features/listings/listing-amenities-client'
import { getCommissionRates } from '@/lib/actions/platform-settings'

export const dynamic = 'force-dynamic'

interface ListingPageProps
{
  params: Promise<{ id: string }>
}

export async function generateMetadata(
  { params }: ListingPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params
  const locale = await getLocale()
  const listing = await getListingById(id, locale)

  if (!listing) {
    return {
      title: 'Listing Not Found',
    }
  }

  const previousImages = (await parent).openGraph?.images || []
  let imageUrl = ''
  if (listing.images && listing.images.length > 0) {
    const firstImg = listing.images[0]
    imageUrl = typeof firstImg === 'string' ? firstImg : (firstImg as any).url || ''
  }
  const listingImage = imageUrl ? [imageUrl] : []
  
  const title = listing.title || 'QuickIn Listing'
  const description = listing.description?.substring(0, 160) || 'Check out this wonderful stay on QuickIn.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [...listingImage, ...previousImages],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: listingImage.length ? listingImage : previousImages,
    },
  }
}

async function fetchListingAmenities(listingId: string, locale: string = 'en'): Promise<{
  highlighted: ListingAttributeDisplay[]
  byCategory: Record<string, ListingAttributeDisplay[]>
  categoryLabels: Record<string, string>
}>
{
  const supabase = await createClient()
  if (!supabase) {
    return { highlighted: [], byCategory: {}, categoryLabels: {} }
  }

  const { data, error } = await supabase
    .from('listing_attributes')
    .select(`
      attribute_id,
      value_option_id,
      value_number,
      notes,
      attribute:attributes(
        code,
        label,
        translations,
        icon_class,
        is_highlighted,
        category_id,
        category:attribute_categories(label, translations)
      ),
      option:attribute_options(label, translations)
    `)
    .eq('listing_id', listingId)

  if (error || !data) {
    return { highlighted: [], byCategory: {}, categoryLabels: {} }
  }

  const highlighted: ListingAttributeDisplay[] = []
  const byCategory: Record<string, ListingAttributeDisplay[]> = {}
  const categoryLabels: Record<string, string> = {}

  for (const la of data) {
    const attr = Array.isArray(la.attribute) ? la.attribute[0] : la.attribute
    const opt = Array.isArray(la.option) ? la.option[0] : la.option
    const cat = (attr as any)?.category
    const catData = Array.isArray(cat) ? cat[0] : cat

    if (!attr) continue

    // Skip if no meaningful value
    if (la.value_option_id === null && (la.value_number === null || la.value_number <= 0)) {
      continue
    }

    const getLocalized = (obj: any, field: string = 'label'): string | null =>
    {
      if (!obj) return null
      if (locale !== 'en' && obj.translations) {
        const trans = obj.translations as Record<string, any>
        const localized = trans[locale]
        if (localized) {
          if (typeof localized === 'object' && localized !== null) {
            const val = (localized as any)[field]
            if (val) return val
          } else if (typeof localized === 'string') {
            if (field === 'label' || field === 'name' || field === 'title') {
              return localized
            }
          }
        }
      }
      return obj[field] || obj.label || obj.name || null
    }

    const display: ListingAttributeDisplay = {
      attribute_id: la.attribute_id,
      attribute_code: attr.code,
      attribute_label: getLocalized(attr) || attr.label,
      category_id: attr.category_id,
      category_label: getLocalized(catData) || catData?.label || 'Other',
      icon_class: attr.icon_class,
      value_option_label: getLocalized(opt) || opt?.label || null,
      value_number: la.value_number,
      notes: la.notes,
      is_highlighted: attr.is_highlighted
    }

    if (attr.is_highlighted) {
      highlighted.push(display)
    }

    const catId = attr.category_id
    categoryLabels[catId] = getLocalized(catData) || catData?.label || 'Other'
    if (!byCategory[catId]) {
      byCategory[catId] = []
    }
    byCategory[catId].push(display)
  }

  return { highlighted, byCategory, categoryLabels }
}

export default async function ListingPage({ params }: ListingPageProps)
{
  const { id } = await params
  const locale = await getLocale()

  // Fetch all data in parallel
  const [
    reviews,
    canReview,
    availabilityAndAdjustments,
    existingBookingStatus,
    amenitiesData,
    bookedDates,
    supabase,
    wishlistStatus,
    rates
  ] = await Promise.all([
    getReviews(id),
    getReviewEligibility(id),
    getListingAvailabilityAndAdjustments(id),
    getExistingBookingStatus(id),
    fetchListingAmenities(id, locale),
    getListingBookedDates(id),
    createClient(),
    getListingWishlistStatus(id),
    getCommissionRates()
  ])

  const { blockedDates, customPriceDates, priceAdjustments } = availabilityAndAdjustments

  // Get listing data with locale
  const listing = await getListingById(id, locale)

  if (!listing) {
    notFound()
  }

  // Fetch approved best offer date ranges and price for this listing
  let offerDays: Date[] = []
  let bestOfferPrice: number | null = null
  if (supabase) {
    const today = new Date().toISOString().split('T')[0]
    const { data: offers } = await supabase
      .from('listing_best_offers')
      .select('start_date, end_date, offer_price')
      .eq('listing_id', id)
      .eq('status', 'approved')
      .gte('end_date', today) // Not expired

    if (offers && offers.length > 0) {
      const daySet = new Set<string>()
      for (const offer of offers) {
        // Extract just the date part to avoid timezone issues
        const startStr = offer.start_date.split('T')[0].split(' ')[0]
        const endStr = offer.end_date.split('T')[0].split(' ')[0]
        const days = eachDayOfInterval({
          start: parseISO(startStr),
          end: parseISO(endStr)
        })
        // Use local date formatting to avoid timezone shift
        days.forEach(d =>
        {
          const year = d.getFullYear()
          const month = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          daySet.add(`${year}-${month}-${day}`)
        })
        // Get the lowest offer price if multiple offers exist
        if (offer.offer_price) {
          const price = Number(offer.offer_price)
          if (bestOfferPrice === null || price < bestOfferPrice) {
            bestOfferPrice = price
          }
        }
      }
      offerDays = Array.from(daySet).map(d => new Date(d + 'T00:00:00'))
    }
  }

  // Fetch today's calculated price (base + overrides + adjustments, without offer price)
  // This is what the calendar calls calculate_listing_price(id, today)
  let todayCalculatedPrice: number | null = null
  if (supabase) {
    const todayStr = new Date().toISOString().split('T')[0]
    const { data: calcPrice } = await supabase.rpc('calculate_listing_price', {
      p_listing_id: id,
      p_date: todayStr
    })
    if (calcPrice != null) {
      todayCalculatedPrice = Number(calcPrice)
    }
  }

  let currentUser = null
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser()
    currentUser = user
  }

  let commentsCount = 0
  if (supabase) {
    const { count } = await supabase.from('listing_comments').select('*', { count: 'exact', head: true }).eq('listing_id', id)
    commentsCount = count || 0
  }

  return (
    <ListingDetail
      listing={listing}
      reviews={reviews}
      currentUser={currentUser}
      canReview={canReview}
      blockedDates={blockedDates}
      bookedDates={bookedDates}
      priceAdjustments={priceAdjustments}
      customPriceDates={customPriceDates}
      existingBookingStatus={existingBookingStatus}
      amenitiesData={amenitiesData}
      offerDays={offerDays}
      bestOfferPrice={bestOfferPrice}
      displayPrice={todayCalculatedPrice}
      isFavorite={wishlistStatus?.isSaved || false}
      guestCommissionRate={rates.guestRate}
      commentsCount={commentsCount}
      commentsNode={<CommentsSection listingId={listing.id} hostId={listing.user_id} />}
    />
  )
}
