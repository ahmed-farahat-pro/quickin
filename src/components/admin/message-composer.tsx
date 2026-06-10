'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Mail, Loader2 } from 'lucide-react'

interface MessageComposerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string
  defaultCategory?: 'warning' | 'approval' | 'rejection' | 'notice'
  defaultSubject?: string
  relatedEntityType?: string
  relatedEntityId?: string
  onSuccess?: () => void
}

const categories = [
  { value: 'notice', label: 'Notice', description: 'General notification' },
  { value: 'approval', label: 'Approval', description: 'Approval notification' },
  { value: 'rejection', label: 'Rejection', description: 'Rejection notification' },
  { value: 'warning', label: 'Warning', description: 'Warning notice' },
]

export function MessageComposer({
  open,
  onOpenChange,
  userId,
  userName,
  defaultCategory = 'notice',
  defaultSubject = '',
  relatedEntityType,
  relatedEntityId,
  onSuccess,
}: MessageComposerProps) {
  const [category, setCategory] = React.useState<string>(defaultCategory)
  const [subject, setSubject] = React.useState(defaultSubject)
  const [body, setBody] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setCategory(defaultCategory)
      setSubject(defaultSubject)
      setBody('')
      setError(null)
    }
  }, [open, defaultCategory, defaultSubject])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/users/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          category,
          subject,
          body,
          related_entity_type: relatedEntityType,
          related_entity_id: relatedEntityId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            Send Message
          </DialogTitle>
          <DialogDescription>
            Send a message to <strong>{userName}</strong>. They will see it in their account inbox.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div>
                        <span className="font-medium">{cat.label}</span>
                        <span className="text-muted-foreground"> - {cat.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                placeholder="Message subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Message *</Label>
              <Textarea
                id="body"
                placeholder="Write your message here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={6}
                className="resize-none"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !subject || !body}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Message
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
