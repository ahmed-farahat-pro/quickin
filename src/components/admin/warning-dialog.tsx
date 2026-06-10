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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface WarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string
  currentWarningLevel?: number
  onSuccess?: () => void
}

const warningLevels = [
  { value: '1', label: 'Level 1 - First Warning', description: 'Informal reminder about policy violation' },
  { value: '2', label: 'Level 2 - Formal Warning', description: 'Official warning on record' },
  { value: '3', label: 'Level 3 - Final Warning', description: 'Last chance before account action' },
]

export function WarningDialog({
  open,
  onOpenChange,
  userId,
  userName,
  currentWarningLevel = 0,
  onSuccess,
}: WarningDialogProps) {
  const [level, setLevel] = React.useState<string>('')
  const [reason, setReason] = React.useState('')
  const [details, setDetails] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      const suggestedLevel = Math.min(currentWarningLevel + 1, 3)
      setLevel(suggestedLevel.toString())
      setReason('')
      setDetails('')
      setError(null)
    }
  }, [open, currentWarningLevel])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/users/warnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          warning_level: parseInt(level),
          reason,
          details: details || undefined,
          send_message: true,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to issue warning')
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Issue Warning
          </DialogTitle>
          <DialogDescription>
            Issue a warning to <strong>{userName}</strong>. They will be notified via their account inbox.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {currentWarningLevel > 0 && (
              <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
                This user currently has {currentWarningLevel} active warning(s).
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="level">Warning Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select warning level" />
                </SelectTrigger>
                <SelectContent>
                  {warningLevels.map((wl) => (
                    <SelectItem key={wl.value} value={wl.value}>
                      <div>
                        <div className="font-medium">{wl.label}</div>
                        <div className="text-xs text-muted-foreground">{wl.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Brief reason for the warning..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="details">Additional Details (optional)</Label>
              <Textarea
                id="details"
                placeholder="Any additional context or evidence..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
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
              disabled={isSubmitting || !level || !reason}
              className="bg-yellow-500 hover:bg-yellow-600"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Issue Warning
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
