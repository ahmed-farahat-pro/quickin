import { createClient } from '@/lib/supabase/server'
import { ReviewsTable } from './reviews-table'

export const dynamic = 'force-dynamic'

async function getReviews() {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('reviews')
    .select(`
      *,
      listing:listings(title),
      reviewer:profiles!reviews_user_id_fkey(full_name, email)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching reviews:', error)
    return []
  }

  // Flatten relations
  return data.map(review => ({
    ...review,
    listing: Array.isArray(review.listing) ? review.listing[0] : review.listing,
    reviewer: Array.isArray(review.reviewer) ? review.reviewer[0] : review.reviewer,
  }))
}

export default async function ReviewsPage() {
  const reviews = await getReviews()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review Moderation</h1>
          <p className="text-muted-foreground">
            Manage user reviews across all listings. Hide or delete inappropriate content.
          </p>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <ReviewsTable reviews={reviews} />
      </div>
    </div>
  )
}
