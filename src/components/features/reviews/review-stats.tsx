import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RATING_CATEGORIES, MAX_RATING } from '@/lib/constants'
import type { ReviewWithUser } from '@/types'
import { useTranslations } from 'next-intl'

interface ReviewStatsProps
{
    reviews: ReviewWithUser[]
}

export function ReviewStats({ reviews }: ReviewStatsProps)
{
    const t = useTranslations('reviews')
    if (!reviews || reviews.length === 0) return null

    const getAverage = (key: keyof ReviewWithUser) =>
    {
        const validReviews = reviews.filter(r => typeof r[key] === 'number' && (r[key] as number) > 0)
        if (validReviews.length === 0) return null
        const sum = validReviews.reduce((acc, r) => acc + (r[key] as number), 0)
        return sum / validReviews.length
    }

    // Check if we have any valid sub-ratings to display
    const hasSubRatings = RATING_CATEGORIES.some(cat => getAverage(cat.id as keyof ReviewWithUser) !== null)

    if (!hasSubRatings) return null

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-4 mb-8 pt-4 border-t">
            <TooltipProvider>
                {RATING_CATEGORIES.map((cat) =>
                {
                    const avg = getAverage(cat.id as keyof ReviewWithUser)
                    if (avg === null) return null

                    return (
                        <div key={cat.id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{t(`categories.${cat.id}.label`)}</span>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button className="text-muted-foreground/40 hover:text-primary transition-colors focus:outline-none">
                                            <Info className="h-3.5 w-3.5" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p className="max-w-xs text-xs">{t(`categories.${cat.id}.stat_desc`)}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <div className="flex items-center gap-4 w-1/2 justify-end">
                                <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden flex-1 max-w-[120px]">
                                    <div
                                        className="bg-foreground h-full rounded-full"
                                        style={{ width: `${(avg / MAX_RATING) * 100}%` }}
                                    />
                                </div>
                                <span className="text-sm font-medium w-6 text-right">{avg.toFixed(1)}</span>
                            </div>
                        </div>
                    )
                })}
            </TooltipProvider>
        </div>
    )
}
