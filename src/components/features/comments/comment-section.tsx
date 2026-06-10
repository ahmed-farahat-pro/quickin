import { getListingComments } from '@/lib/supabase/comments'
import { CommentItem } from './comment-item'
import { CommentForm } from './comment-form'
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { MessageSquare } from 'lucide-react'

interface CommentsSectionProps {
  listingId: string
  hostId: string
}

export async function CommentsSection({ listingId, hostId }: CommentsSectionProps) {
  const t = await getTranslations('comments')
  const comments = await getListingComments(listingId)
  
  const supabase = await createClient()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  
  // Determine if the user is staff for moderation features
  let isStaff = false
  if (user) {
    const { data: staffProfile } = await supabase
      .from('staff_profiles')
      .select('id')
      .eq('id', user.id)
      .eq('is_active', true)
      .single()
      
    isStaff = !!staffProfile
  }

  // To pass current user down to child client components
  const currentUserProfile = user ? {
    id: user.id,
    email: user.email || '',
    full_name: user.user_metadata?.full_name || null,
    avatar_url: user.user_metadata?.avatar_url || null,
    bio: null,
    phone: null,
    is_host: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } : null

  return (
    <div id="comments" className="mt-2">
      {!user && (
        <div className="bg-muted p-4 rounded-xl text-center mb-6">
          <p className="text-muted-foreground mb-2">{t('loginPrompt')}</p>
        </div>
      )}

      {user && (
        <div className="mb-8">
          <CommentForm listingId={listingId} />
        </div>
      )}

      {comments.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground border-t border-dashed">
          {t('noComments')}
        </div>
      ) : (
        <div className="flex flex-col gap-6 divide-y divide-border/50">
          {comments.map(comment => (
            <CommentItem 
              key={comment.id}
              comment={comment}
              listingId={listingId}
              hostId={hostId}
              currentUser={currentUserProfile}
              isStaff={isStaff}
            />
          ))}
        </div>
      )}
    </div>
  )
}
