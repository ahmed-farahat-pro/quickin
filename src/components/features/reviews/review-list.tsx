'use client'

import { Star } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import type { ReviewWithUser } from '@/types'
import { useTranslations, useFormatter } from 'next-intl'

interface ReviewListProps
{
  reviews: ReviewWithUser[]
}

export function ReviewList({ reviews }: ReviewListProps)
{
  const t = useTranslations('reviews.list')
  const format = useFormatter()

  if (reviews.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        {t('noReviews')}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
      {reviews.map((review) => (
        <div key={review.id} className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={review.user?.avatar_url || undefined} alt={review.user?.full_name || t('userAlt')} />
              <AvatarFallback>{(review.user?.full_name || 'U')[0]}</AvatarFallback>
            </Avatar>
            <div>
              <h4 className="font-semibold">{review.user?.full_name || t('anonymous')}</h4>
              <p className="text-sm text-muted-foreground capitalize">
                {format.dateTime(new Date(review.created_at), { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <div className="flex">
                {[...Array(5)].map((_, i) =>
                {
                  const fillAmount = Math.max(0, Math.min(1, review.rating - i));
                  return (
                    <div key={i} className="relative">
                      <Star className="h-4 w-4 text-muted-foreground/30" />
                      {fillAmount > 0 && (
                        <div
                          className="absolute inset-0 overflow-hidden"
                          style={{ width: `${fillAmount * 100}%` }}
                        >
                          <Star className="h-4 w-4 fill-primary text-primary" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {review.comment}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
