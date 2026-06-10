import { getWishlists } from '@/lib/supabase/wishlists'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Heart } from 'lucide-react'
import Link from 'next/link'
import { WishlistCard } from '@/components/features/wishlists/wishlist-card'
import { getTranslations } from 'next-intl/server'
import { getRequestLocale } from '@/i18n/request-locale'
import { localizePathname } from '@/lib/i18n/pathname'

export const dynamic = 'force-dynamic'

export default async function WishlistsPage()
{
  const wishlists = await getWishlists()
  const t = await getTranslations('dashboardWishlists')
  const locale = await getRequestLocale()

  const getLocalizedUrl = (url: string) => localizePathname(url, locale)

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('listsCount', { count: wishlists.length })}
          </p>
        </div>
      </div>

      {wishlists.length === 0 ? (
        <Card className="border-dashed h-[400px] flex items-center justify-center rounded-3xl">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-accent flex items-center justify-center mb-4">
              <Heart className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl mb-2">{t('empty.title')}</CardTitle>
            <CardDescription className="max-w-xs mb-6 text-base">
              {t('empty.description')}
            </CardDescription>
            <Button asChild size="lg" className="rounded-xl px-8"><Link href={getLocalizedUrl('/')}>{t('empty.button')}</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {wishlists.map((wishlist) => (
            <WishlistCard
              key={wishlist.id}
              id={wishlist.id}
              name={wishlist.name}
              itemCount={wishlist.itemCount}
              previewImages={wishlist.previewImages}
            />
          ))}
        </div>
      )}
    </div>
  )
}
