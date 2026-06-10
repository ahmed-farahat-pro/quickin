'use client'

import { useState, useTransition } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThumbsUp, ThumbsDown, Reply, Flag, Trash, AlertTriangle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { ListingCommentWithDetails, Profile } from '@/types/database'
import { CommentForm } from './comment-form'
import { toggleCommentVote, reportComment, moderateComment, editComment, deleteUserComment } from '@/lib/supabase/comments'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { MIN_DOWNVOTES_TO_HIDE_COMMENT, COMMENT_EDIT_WINDOW_MINUTES } from '@/lib/constants'

interface CommentItemProps {
  comment: ListingCommentWithDetails
  listingId: string
  hostId: string
  currentUser: Profile | null | undefined
  isStaff?: boolean
}

export function CommentItem({ comment, listingId, hostId, currentUser, isStaff = false }: CommentItemProps) {
  const format = useFormatter()
  const t = useTranslations('comments')
  const [isReplying, setIsReplying] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [showReplies, setShowReplies] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isHost = currentUser?.id === hostId
  const isAuthor = currentUser?.id === comment.user_id
  const isCommentHost = comment.user_id === hostId
  
  const createdAtTime = new Date(comment.created_at).getTime()
  const canEdit = isAuthor && ((Date.now() - createdAtTime) / (1000 * 60) <= COMMENT_EDIT_WINDOW_MINUTES)

  // A comment is hidden if it has too many downvotes OR an admin manually hid it
  const isCollapsedByDownvotes = comment.downvotes >= MIN_DOWNVOTES_TO_HIDE_COMMENT
  const isHidden = comment.is_hidden || (isCollapsedByDownvotes && !showHidden && !isStaff && !isAuthor)

  // Format Name
  const isAdminComment = (comment.user as any)?.is_admin === true
  let displayName = isAdminComment 
    ? t('adminBadge')
    : (comment.user?.full_name 
        ? (() => {
            const firstName = comment.user.full_name.split(' ')[0]
            const pascal = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
            return pascal.length > 12 ? pascal.slice(0, 12) + '...' : pascal
          })()
        : t('anonymous'))

  const handleVote = (voteType: 1 | -1) => {
    if (!currentUser) {
      toast.error(t('mustBeLoggedInToVote'))
      return
    }

    startTransition(async () => {
      const res = await toggleCommentVote(comment.id, listingId, voteType)
      if (res.error) toast.error(res.error)
    })
  }

  const handleReport = () => {
    startTransition(async () => {
      const res = await reportComment(comment.id, listingId)
      if (res.error) toast.error(res.error)
      else toast.success(t('reportedToAdmins'))
    })
  }

  const handleModerate = (action: 'hide' | 'delete') => {
    if (!confirm(t('confirmModerate', { action }))) return
    
    startTransition(async () => {
      const res = await moderateComment(comment.id, listingId, action)
      if (res.error) toast.error(res.error)
      else toast.success(t('moderateSuccess', { action }))
    })
  }

  const handleDeleteSelf = () => {
    if (!confirm(t('confirmDelete'))) return
    
    startTransition(async () => {
      const res = await deleteUserComment(comment.id, listingId)
      if (res.error) toast.error(res.error)
      else toast.success(t('deleteSuccess'))
    })
  }

  return (
    <div className="flex flex-col gap-2 sm:gap-3 py-3 w-full animate-in fade-in duration-300">
      <div className={cn("flex gap-2 sm:gap-3", isHidden ? "opacity-50 grayscale" : "")}>
        <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
          <AvatarImage src={comment.user?.avatar_url || ''} />
          <AvatarFallback>{displayName[0]}</AvatarFallback>
        </Avatar>

        <div className="flex flex-col flex-1 gap-1">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="font-semibold">{displayName}</span>
            
            {isAdminComment && <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-indigo-500 hover:bg-indigo-600">{t('adminBadge')}</Badge>}
            {isCommentHost && !isAdminComment && <Badge variant="default" className="text-[10px] px-1.5 py-0">{t('hostBadge')}</Badge>}
            {comment.is_host_reported && isStaff && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{t('reportedBadge')}</Badge>}

            <span className="text-muted-foreground text-xs ml-auto">
              {format.relativeTime(new Date(comment.created_at), { now: new Date() })}
            </span>
          </div>

          {!isHidden ? (
            isEditing ? (
              <div className="mt-2">
                <CommentForm 
                  listingId={listingId}
                  parentId={comment.parent_id || undefined}
                  initialContent={comment.content}
                  commentIdToEdit={comment.id}
                  onCancel={() => setIsEditing(false)}
                  onSubmitSuccess={() => setIsEditing(false)}
                />
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap leading-relaxed break-words overflow-hidden">{comment.content}</p>
            )
          ) : (
            <div className="flex items-center gap-2 text-sm text-destructive italic p-2 bg-muted/50 rounded inline-block w-fit">
              <AlertTriangle className="h-4 w-4" />
              <span>{t('hiddenComment')}</span>
              {!showHidden && (
                <Button variant="link" size="sm" onClick={() => setShowHidden(true)} className="p-0 h-auto font-normal">
                  {t('showAnyway')}
                </Button>
              )}
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center gap-2 sm:gap-4 mt-1 flex-wrap">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn("h-7 px-2 gap-1.5", comment.user_vote === 1 && "text-primary bg-primary/10")}
                onClick={() => handleVote(1)}
                disabled={isPending}
              >
                <ThumbsUp className="h-4 w-4" />
                <span className="text-xs">{comment.upvotes > 0 ? comment.upvotes : ''}</span>
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn("h-7 px-2 gap-1.5", comment.user_vote === -1 && "text-destructive bg-destructive/10")}
                onClick={() => handleVote(-1)}
                disabled={isPending}
              >
                <ThumbsDown className="h-4 w-4" />
                <span className="text-xs">{comment.downvotes > 0 ? comment.downvotes : ''}</span>
              </Button>
            </div>

            {!comment.parent_id && currentUser && (
              <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-muted-foreground" onClick={() => setIsReplying(!isReplying)}>
                <Reply className="h-4 w-4" />
                <span className="text-xs">{t('reply')}</span>
              </Button>
            )}

            {isHost && !isCommentHost && !comment.is_host_reported && (
              <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-muted-foreground ml-auto" onClick={handleReport} disabled={isPending}>
                <Flag className="h-3.5 w-3.5" />
                <span className="text-xs hidden sm:inline">{t('reportToAdmin')}</span>
              </Button>
            )}

            {isAuthor && !isEditing && (
              <div className={cn("flex items-center gap-1", (isHost && !isCommentHost && !comment.is_host_reported) ? "ml-2" : "ml-auto")}>
                {canEdit && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-muted-foreground" onClick={() => setIsEditing(true)} disabled={isPending}>
                    <span className="text-xs">{t('edit')}</span>
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-destructive hover:text-destructive" onClick={handleDeleteSelf} disabled={isPending}>
                  <Trash className="h-3.5 w-3.5" />
                  <span className="text-xs">{t('delete')}</span>
                </Button>
              </div>
            )}

            {isStaff && (
              <div className="flex items-center ml-auto gap-1">
                {!comment.is_hidden && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-destructive" onClick={() => handleModerate('hide')} disabled={isPending}>
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="text-xs">Hide</span>
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-destructive" onClick={() => handleModerate('delete')} disabled={isPending}>
                  <Trash className="h-3.5 w-3.5" />
                  <span className="text-xs">Delete</span>
                </Button>
              </div>
            )}
          </div>

          {/* Reply Form */}
          {isReplying && (
            <div className="mt-3 bg-muted/20 p-3 rounded-xl border">
              <CommentForm 
                listingId={listingId} 
                parentId={comment.id} 
                onCancel={() => setIsReplying(false)}
                onSubmitSuccess={() => setIsReplying(false)}
                placeholder="Write a reply..."
              />
            </div>
          )}
        </div>
      </div>

      {/* Render Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 text-sm ml-2 pl-3 sm:ml-4 sm:pl-4 border-l-2 border-border/50 flex flex-col gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-fit h-6 px-2 text-[10px] sm:text-xs text-muted-foreground shrink-0 rounded-full"
            onClick={() => setShowReplies(!showReplies)}
          >
            {showReplies ? <ChevronDown className="h-3.5 w-3.5 mr-1" /> : <ChevronRight className="h-3.5 w-3.5 mr-1" />}
            {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
          </Button>

          {showReplies && comment.replies.map(reply => (
            <CommentItem 
              key={reply.id} 
              comment={reply} 
              listingId={listingId} 
              hostId={hostId} 
              currentUser={currentUser}
              isStaff={isStaff}
            />
          ))}
        </div>
      )}
    </div>
  )
}
