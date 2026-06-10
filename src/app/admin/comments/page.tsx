import { createClient } from '@/lib/supabase/server'
import { CommentsTable } from './comments-table'

export const dynamic = 'force-dynamic'

async function getComments() {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('listing_comments')
    .select(`
      *,
      listing:listings(title),
      author:profiles!listing_comments_user_id_fkey(full_name, email)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching comments:', error)
    return []
  }

  // Flatten relations
  return data.map(comment => ({
    ...comment,
    listing: Array.isArray(comment.listing) ? comment.listing[0] : comment.listing,
    author: Array.isArray(comment.author) ? comment.author[0] : comment.author,
  }))
}

export default async function CommentsAdminPage() {
  const comments = await getComments()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comment Moderation</h1>
          <p className="text-muted-foreground">
            Manage user comments & Q&amp;A across all listings. Hide or delete inappropriate content.
          </p>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <CommentsTable comments={comments} />
      </div>
    </div>
  )
}
