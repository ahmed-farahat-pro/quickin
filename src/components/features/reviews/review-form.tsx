'use client'

import { useState, useTransition, useEffect } from 'react'
import { Star, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { createReview, updateReview } from '@/lib/supabase/reviews'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'
import type { ReviewWithUser } from '@/types'
import { RATING_CATEGORIES } from '@/lib/constants'
import { useTranslations } from 'next-intl'

interface ReviewFormProps
{
  listingId: string
  user: User | null
  disabled?: boolean
  existingReview?: ReviewWithUser
}

export function ReviewForm({ listingId, user, disabled, existingReview }: ReviewFormProps)
{
  const t = useTranslations('reviews.form')
  const reviewT = useTranslations('reviews')
  const [isOpen, setIsOpen] = useState(false)
  const [rating, setRating] = useState(existingReview?.rating || 0)
  const [subRatings, setSubRatings] = useState({
    rating_cleanliness: existingReview?.rating_cleanliness || 0,
    rating_accuracy: existingReview?.rating_accuracy || 0,
    rating_communication: existingReview?.rating_communication || 0,
    rating_location: existingReview?.rating_location || 0,
    rating_check_in: existingReview?.rating_check_in || 0,
    rating_value: existingReview?.rating_value || 0,
  })
  const [comment, setComment] = useState(existingReview?.comment || '')
  const [privateFeedback, setPrivateFeedback] = useState('')
  const [isPending, startTransition] = useTransition()
  const [expandedDesc, setExpandedDesc] = useState<string | null>(null)

  useEffect(() =>
  {
    if (isOpen) {
      setRating(existingReview?.rating || 0)
      setSubRatings({
        rating_cleanliness: existingReview?.rating_cleanliness || 0,
        rating_accuracy: existingReview?.rating_accuracy || 0,
        rating_communication: existingReview?.rating_communication || 0,
        rating_location: existingReview?.rating_location || 0,
        rating_check_in: existingReview?.rating_check_in || 0,
        rating_value: existingReview?.rating_value || 0,
      })
      setComment(existingReview?.comment || '')
      setPrivateFeedback('')
    }
  }, [isOpen, existingReview])

  if (!user) return null

  if (disabled && !existingReview) {
    return (
      <div className="flex flex-col items-end rtl:items-start gap-1">
        <Button variant="outline" disabled className="opacity-50 cursor-not-allowed">
          {t('writeReview')}
        </Button>
        <span className="text-[10px] text-muted-foreground">
          {t('onlyPastGuests')}
        </span>
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent) =>
  {
    e.preventDefault()

    if (rating === 0) {
      toast.error(t('errors.overallRating'))
      return
    }

    const missingSub = Object.entries(subRatings).find(([k, v]) => v === 0)
    if (missingSub) {
      const categoryLabel = reviewT(`categories.${missingSub[0]}.label`)
      toast.error(t('errors.subRating', { category: categoryLabel }))
      return
    }

    if (!comment.trim()) {
      toast.error(t('errors.comment'))
      return
    }

    startTransition(async () =>
    {
      let result;

      const payload = {
        rating,
        ...subRatings,
        comment,
        private_feedback: privateFeedback,
        listingId
      }

      if (existingReview) {
        result = await updateReview(existingReview.id, payload)
      } else {
        result = await createReview(payload)
      }

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(existingReview ? t('success.updated') : t('success.submitted'))
        setIsOpen(false)
      }
    })
  }

  const StarRating = ({ value, onChange, size = 'h-8 w-8' }: { value: number, onChange: (v: number) => void, size?: string }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <div key={star} className="relative flex">
          <button
            type="button"
            onClick={() => onChange(star - 0.5)}
            className="absolute left-0 top-0 bottom-0 w-1/2 z-10 focus:outline-none"
            aria-label={`Rate ${star - 0.5} stars`}
          />
          <button
            type="button"
            onClick={() => onChange(star)}
            className="absolute right-0 top-0 bottom-0 w-1/2 z-10 focus:outline-none"
            aria-label={`Rate ${star} stars`}
          />
          <div className="relative pointer-events-none">
            <Star className={`${size} text-muted-foreground/30`} />
            {star <= value && (
              <Star className={`${size} fill-primary text-primary absolute inset-0`} />
            )}
            {star - 0.5 === value && (
              <div className="absolute inset-0 overflow-hidden w-1/2">
                <Star className={`${size} fill-primary text-primary`} />
              </div>
            )}
          </div>
        </div>
      ))}
      <span className="ml-2 text-sm font-bold text-primary self-center">{value > 0 ? value.toFixed(1) : ''}</span>
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="font-semibold shadow-md hover:shadow-lg transition-all">
          {existingReview ? t('editReview') : t('writeReview')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-3">
            <label className="text-base font-semibold">{t('overallExperience')}</label>
            <StarRating value={rating} onChange={setRating} size="h-10 w-10" />
          </div>

          <div className="space-y-4 pt-4 border-t">
            <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('categoryRatings')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
              {RATING_CATEGORIES.map((cat) => (
                <div key={cat.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{reviewT(`categories.${cat.id}.label`)}</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setExpandedDesc(expandedDesc === cat.id ? null : cat.id)}
                            className="text-muted-foreground/50 hover:text-primary transition-colors focus:outline-none"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="max-w-xs text-xs">{reviewT(`categories.${cat.id}.guest_desc`)}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <StarRating
                    value={subRatings[cat.id as keyof typeof subRatings]}
                    onChange={(v) => setSubRatings(prev => ({ ...prev, [cat.id]: v }))}
                    size="h-6 w-6"
                  />
                  {expandedDesc === cat.id && (
                    <p className="text-[11px] text-muted-foreground bg-muted/50 p-2 rounded-md animate-in fade-in slide-in-from-top-1 duration-200">
                      {reviewT(`categories.${cat.id}.guest_desc`)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <label htmlFor="comment" className="text-sm font-medium">
              {t('writtenReview')}
            </label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('placeholderComment')}
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="space-y-2 pt-4 border-t">
            <label htmlFor="private_feedback" className="text-sm font-medium flex items-center gap-2">
              {existingReview ? t('continuePrivateFeedback') : t('privateFeedback')}
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-normal text-muted-foreground uppercase">{t('visibleOnlyToHost')}</span>
            </label>
            <Textarea
              id="private_feedback"
              value={privateFeedback}
              onChange={(e) => setPrivateFeedback(e.target.value)}
              placeholder={existingReview ? t('privatePlaceholderMore') : t('privatePlaceholder')}
              rows={3}
              className="resize-none bg-muted/30"
            />
            {existingReview && existingReview.private_feedback && existingReview.private_feedback.length > 0 && (
              <p className="text-[10px] text-muted-foreground italic">
                {t('previousPrivateSaved')}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
