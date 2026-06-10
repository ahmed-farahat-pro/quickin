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
import { Ban, Loader2 } from 'lucide-react'

interface BanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string
  warningCount?: number
  onSuccess?: () => void
}

export function BanDialog({
  open,
  onOpenChange,
  userId,
  userName,
  warningCount = 0,
  onSuccess,
}: BanDialogProps) {
  const [banType, setBanType] = React.useState<string>('temporary')
  const [durationDays, setDurationDays] = React.useState<string>('7')
  const [reason, setReason] = React.useState('')
  const [details, setDetails] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setBanType('temporary')
      setDurationDays('7')
      setReason('')
      setDetails('')
      setError(null)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/users/bans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          ban_type: banType,
          duration_days: banType === 'temporary' ? parseInt(durationDays) : undefined,
          reason,
          details: details || undefined,
          send_message: true,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to ban user')
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
            <Ban className="h-5 w-5 text-red-500" />
            Ban User
          </DialogTitle>
          <DialogDescription>
            Ban <strong>{userName}</strong> from the platform. This action can be reversed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {warningCount < 1 && (
              <div className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800">
                ⚠️ This user has no warnings. Consider issuing warnings first before banning.
              </div>
            )}

            {warningCount > 0 && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                This user has {warningCount} active warning(s).
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="banType">Ban Type</Label>
              <Select value={banType} onValueChange={setBanType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="temporary">
                    <div>
                      <div className="font-medium">Temporary Suspension</div>
                      <div className="text-xs text-muted-foreground">Account disabled for a set period</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="permanent">
                    <div>
                      <div className="font-medium">Permanent Ban</div>
                      <div className="text-xs text-muted-foreground">Account permanently disabled</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {banType === 'temporary' && (
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (days)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  max="365"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  User will be automatically unbanned after this period.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Reason for the ban..."
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
              disabled={isSubmitting || !reason || (banType === 'temporary' && !durationDays)}
              variant="destructive"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {banType === 'permanent' ? 'Permanently Ban' : 'Suspend User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
