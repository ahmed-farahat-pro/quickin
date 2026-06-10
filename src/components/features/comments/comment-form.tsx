'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { addComment, editComment } from '@/lib/supabase/comments'
import { toast } from 'sonner'
import { SendHorizontal, Loader2, AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface CommentFormProps
{
  listingId: string
  parentId?: string
  placeholder?: string
  onSubmitSuccess?: () => void
  onCancel?: () => void
  initialContent?: string
  commentIdToEdit?: string
}

export function CommentForm({ listingId, parentId, placeholder, onSubmitSuccess, onCancel, initialContent = '', commentIdToEdit }: CommentFormProps)
{
  const [content, setContent] = useState(initialContent)
  const [isPending, startTransition] = useTransition()
  const t = useTranslations('comments')

  const handleSubmit = (e: React.FormEvent) =>
  {
    e.preventDefault()

    if (!content.trim()) return

    startTransition(async () =>
    {
      let result;
      if (commentIdToEdit) {
        result = await editComment(commentIdToEdit, listingId, content)
      } else {
        result = await addComment(listingId, content, parentId)
      }

      if (result.error) {
        toast.error(result.error)
      } else {
        if (commentIdToEdit) {
          toast.success(t('commentUpdated'))
        } else {
          toast.success(parentId ? t('replyPosted') : t('commentPosted'))
        }
        if (!commentIdToEdit) setContent('')
        onSubmitSuccess?.()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Textarea
          placeholder={placeholder || t('placeholder')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[80px]"
          disabled={isPending}
        />
        <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 p-2 rounded-md border border-red-100">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span><strong className="font-semibold">{t('warningLabel')}</strong> {t('phoneWarning')}</span>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
            {t('cancel')}
          </Button>
        )}
        <Button type="submit" size="sm" disabled={!content.trim() || isPending || (commentIdToEdit ? content === initialContent : false)}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <SendHorizontal className="h-4 w-4 mr-2" />}
          {commentIdToEdit ? t('saveChanges') : parentId ? t('reply') : t('post')}
        </Button>
      </div>
    </form>
  )
}
