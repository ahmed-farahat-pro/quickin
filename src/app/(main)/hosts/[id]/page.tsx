import { notFound } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Star, BadgeCheck, CalendarDays, Home } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { localizePathname } from '@/lib/i18n/pathname'
import type { Locale } from '@/i18n/config'
import type { Metadata } from 'next'
import { getUserById, getHostProfile } from '@/lib/local/db'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const user = await getUserById(id).catch(() => null)
  return { title: user?.full_name ? `${user.full_name} · QuickIn Host` : 'Host Profile' }
}

export default async function HostProfilePage({ params }: Props) {
  const { id } = await params
  const locale = (await getLocale()) as Locale

  // Read straight from the local stack — the same data source the rest of the
  // live journey uses (explore/listing/account pages). The Supabase `profiles`
  // table is empty in production, so preferring it here made every valid host
  // render Next's not-found page.
  const data = await getHostProfile(id)
  if (!data) notFound()

  const { profile, listings, reviews, avgRating, totalReviews } = data

  const memberYear = profile.created_at
    ? new Date(profile.created_at).getFullYear()
    : null

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
      {listings.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Home className="h-5 w-5" />
            {listings.length} {listings.length === 1 ? 'listing' : 'listings'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map(listing => (
              <Link
                key={listing.id}
                href={localizePathname(`/explore/${listing.id}`, locale)}
                className="group block rounded-2xl overflow-hidden border bg-card hover:shadow-md transition-shadow"
              >
                <div className="aspect-[4/3] bg-muted relative">
                  {listing.image_url ? (
                    <Image
                      src={listing.image_url}
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
            ))}
          </div>
        </section>
      )}

      {/* Reviews received */}
      {reviews.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Guest reviews</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map(review => (
              <div key={review.id} className="p-4 rounded-2xl border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={review.reviewer_avatar ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {(review.reviewer_name ?? 'G')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{review.reviewer_name ?? 'Guest'}</p>
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
                {review.listing_title && (
                  <p className="text-xs text-muted-foreground/60 mt-2">For: {review.listing_title}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {listings.length === 0 && reviews.length === 0 && (
        <p className="text-center text-muted-foreground py-12">This host has no listings yet.</p>
      )}
    </div>
  )
}
