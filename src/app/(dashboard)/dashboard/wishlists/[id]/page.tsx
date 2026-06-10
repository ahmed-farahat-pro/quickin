import { notFound } from 'next/navigation'
import { getWishlist } from '@/lib/supabase/wishlists'
import { ListingCardUnified } from '@/components/features/listings/listing-card-unified'
import { Button } from '@/components/ui/button'
import { WishlistDetailHeader } from '@/components/features/wishlists/wishlist-detail-header'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getRequestLocale } from '@/i18n/request-locale'
import { localizePathname } from '@/lib/i18n/pathname'

export const dynamic = 'force-dynamic'

interface WishlistDetailPageProps
{
    params: {
        id: string
    }
}

export default async function WishlistDetailPage({ params }: WishlistDetailPageProps)
{
    const { id } = await params
    const wishlist = await getWishlist(id)
    const t = await getTranslations('dashboardWishlists')
    const locale = await getRequestLocale()

    if (!wishlist) {
        notFound()
    }

    const getLocalizedUrl = (url: string) => localizePathname(url, locale)

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <WishlistDetailHeader
                id={id}
                name={wishlist.name}
                itemCount={wishlist.listings.length}
            />

            {wishlist.listings.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed rounded-3xl">
                    <p className="text-lg font-medium text-muted-foreground">{t('detailEmptyTitle')}</p>
                    <Button asChild variant="link" className="mt-2">
                        <Link href={getLocalizedUrl('/')}>{t('detailEmptyButton')}</Link>
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {wishlist.listings.map((listing: any) => (
                        <ListingCardUnified
                            key={listing.id}
                            {...listing}
                            price={listing.price_per_night}
                            isFavorite={true}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
