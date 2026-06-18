import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Star, BadgeCheck, CalendarDays, Home } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { localizePathname } from '@/lib/i18n/pathname'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  if (!supabase) return { title: 'Host Profile' }
  const { data } = await supabase.from('profiles').select('full_name').eq('id', id).single()
  return { title: data?.full_name ? `${data.full_name} · QuickIn Host` : 'Host Profile' }
}

export default async function HostProfilePage({ params }: Props) {
  const { id } = await params
  const locale = await getLocale()
  const supabase = await createClient()

  type ProfileRow = {
    id: string; full_name: string | null; avatar_url: string | null
    bio: string | null; verification_status: string | null; created_at: string
  }
  type ListingRow = {
    id: string; title: string | null; location: string | null
    price_per_night: number | null; rating: number | null; rating_count: number | null
    listing_images: { url: string; display_order: number | null }[]
  }
  type ReviewRow = {
    id: string; rating: number; comment: string | null; created_at: string
    listing_id: string
    user: { full_name?: string; avatar_url?: string } | null
    listing: { title?: string } | null
  }

  let profile: ProfileRow | null = null
  let listings: ListingRow[] = []
  let reviews: ReviewRow[] = []

  if (supabase) {
    const [{ data: p }, { data: ls }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase
        .from('listings')
        .select('id, title, location, price_per_night, rating, rating_count, listing_images(url, display_order)')
        .eq('user_id', id)
        .eq('approval_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(12),
    ])
    profile = p as ProfileRow | null
    listings = (ls ?? []) as ListingRow[]

    if (profile) {
      const listingIds = listings.map(l => l.id)
      const { data: rv } = listingIds.length
        ? await supabase
            .from('reviews')
            .select('id, rating, comment, created_at, listing_id, user:profiles(full_name, avatar_url), listing:listings(title)')
            .in('listing_id', listingIds)
            .order('created_at', { ascending: false })
            .limit(8)
        : { data: [] }
      reviews = (rv ?? []) as ReviewRow[]
    }
  } else {
    // Local dev mode — call the local API route
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${base}/api/local/users/${id}`, { cache: 'no-store' })
    if (res.ok) {
      const json = await res.json()
      profile = json.profile ?? null
      listings = json.listings ?? []
      reviews = json.reviews ?? []
    }
  }

  if (!profile) notFound()

  const memberYear = profile.created_at
    ? new Date(profile.created_at).getFullYear()
    : null

  const ratedListings = (listings || []).filter(l => l.rating && l.rating_count)
  const avgRating =
    ratedListings.length > 0
      ? ratedListings.reduce((s, l) => s + (l.rating ?? 0), 0) / ratedListings.length
      : null
  const totalReviews = (listings || []).reduce((s, l) => s + (l.rating_count ?? 0), 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href={localizePathname('/', locale)}
        className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1"
      >
        ← Back to listings
      </Link>

      {/* Host header */}
      <div className="flex items-start gap-6 mb-8">
        <Avatar className="h-24 w-24 border-2 border-primary/20 flex-shrink-0">
          <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name ?? 'Host'} />
          <AvatarFallback className="text-2xl bg-primary/10 text-primary">
            {(profile.full_name ?? 'H')[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{profile.full_name ?? 'Host'}</h1>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {profile.verification_status === 'verified' && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <BadgeCheck className="h-3 w-3" /> Verified
              </Badge>
            )}
            {memberYear && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Member since {memberYear}
              </span>
            )}
          </div>

          {avgRating !== null && (
            <div className="flex items-center gap-1 mt-2">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold">{avgRating.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">
                · {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
              </span>
            </div>
          )}

          {profile.bio && (
            <p className="mt-3 text-muted-foreground leading-relaxed">{profile.bio}</p>
          )}
        </div>
      </div>

      <Separator className="mb-8" />

      {/* Their listings */}
      {listings && listings.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Home className="h-5 w-5" />
            {listings.length} {listings.length === 1 ? 'listing' : 'listings'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map(listing => {
              const sorted = [...(listing.listing_images ?? [])].sort(
                (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
              )
              const imgUrl = sorted[0]?.url
              return (
                <Link
                  key={listing.id}
                  href={localizePathname(`/listings/${listing.id}`, locale)}
                  className="group block rounded-2xl overflow-hidden border bg-card hover:shadow-md transition-shadow"
                >
                  <div className="aspect-[4/3] bg-muted relative">
                    {imgUrl ? (
                      <Image
                        src={imgUrl}
                        alt={listing.title ?? ''}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Home className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm line-clamp-1">{listing.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{listing.location}</p>
                    <p className="text-sm font-semibold mt-1">
                      EGP {listing.price_per_night?.toLocaleString()}/night
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Reviews received */}
      {reviews && reviews.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Guest reviews</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map(review => {
              const reviewer = review.user as { full_name?: string; avatar_url?: string } | null
              const listing = review.listing as { title?: string } | null
              return (
                <div key={review.id} className="p-4 rounded-2xl border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={reviewer?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {(reviewer?.full_name ?? 'G')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{reviewer?.full_name ?? 'Guest'}</p>
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{review.comment}</p>
                  )}
                  {listing?.title && (
                    <p className="text-xs text-muted-foreground/60 mt-2">For: {listing.title}</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {(!listings || listings.length === 0) && (!reviews || reviews.length === 0) && (
        <p className="text-center text-muted-foreground py-12">This host has no listings yet.</p>
      )}
    </div>
  )
}
