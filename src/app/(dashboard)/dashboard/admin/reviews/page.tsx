import { getUser } from '@/lib/supabase/auth-actions'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Star, ShieldAlert } from 'lucide-react'
import { getAdminReviews } from '@/lib/supabase/reviews'
import { ReviewActions } from './review-actions'
import { DashboardSearch } from '@/components/features/dashboard/dashboard-search'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReviewChat } from '@/components/features/reviews/review-chat'

export const dynamic = 'force-dynamic'

export default async function AdminReviewsPage({
    searchParams,
}: {
    searchParams: Promise<{ search?: string; filter?: string }>
})
{
    const { search, filter } = await searchParams
    const user = await getUser()

    if (!user) {
        redirect('/login')
    }

    // Real app: verify user is admin/staff here

    // Ensure filter matches allowed types
    const statusFilter = (filter === 'hidden' || filter === 'visible')
        ? filter
        : 'all'

    const reviews = await getAdminReviews(search, statusFilter as 'all' | 'hidden' | 'visible')

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center gap-2">
                        <ShieldAlert className="h-6 w-6 text-primary" />
                        Review Moderation
                    </h1>
                    <p className="text-muted-foreground">
                        Monitor and moderate guest reviews across all listings
                    </p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1 max-w-sm">
                    <DashboardSearch placeholder="Search comments..." />
                </div>
            </div>

            <Tabs defaultValue={statusFilter} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="all" asChild>
                        <a href={`?filter=all${search ? `&search=${search}` : ''}`}>All Reviews</a>
                    </TabsTrigger>
                    <TabsTrigger value="visible" asChild>
                        <a href={`?filter=visible${search ? `&search=${search}` : ''}`}>Visible</a>
                    </TabsTrigger>
                    <TabsTrigger value="hidden" asChild>
                        <a href={`?filter=hidden${search ? `&search=${search}` : ''}`}>Hidden</a>
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            <div className="grid gap-4">
                {reviews.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            No reviews found matching your criteria.
                        </CardContent>
                    </Card>
                ) : (
                    reviews.map((review) => (
                        <Card key={review.id} className={review.is_hidden ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20' : ''}>
                            <CardContent className="p-5 flex flex-col sm:flex-row gap-4">
                                <div className="flex-1 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center">
                                                <Star className="h-4 w-4 fill-primary text-primary mr-1" />
                                                <span className="font-semibold">{review.rating}</span>
                                            </div>
                                            <span className="text-muted-foreground text-sm flex items-center gap-1.5">
                                                on <span className="font-medium text-foreground">{review.listing?.title}</span>
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {review.is_hidden && (
                                                <Badge variant="outline" className="text-amber-600 border-amber-300 dark:border-amber-700">
                                                    Hidden
                                                </Badge>
                                            )}
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(review.created_at), 'MMM d, yyyy')}
                                            </span>
                                        </div>
                                    </div>

                                    <p className="text-sm">
                                        {review.comment || <span className="italic text-muted-foreground">No comment provided</span>}
                                    </p>

                                    <ReviewChat
                                        reviewId={review.id}
                                        messages={(review.private_feedback as any[]) || []}
                                        userRole="admin"
                                    />

                                    <div className="text-xs text-muted-foreground pt-1">
                                        By: <span className="font-medium text-foreground">{review.user?.full_name || 'Anonymous'}</span> ({review.user?.email})
                                    </div>
                                </div>

                                <div className="flex sm:flex-col justify-end items-end sm:border-l pl-0 sm:pl-4 pt-4 sm:pt-0 mt-4 sm:mt-0 border-t sm:border-t-0">
                                    <ReviewActions reviewId={review.id} isHidden={review.is_hidden} />
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}
