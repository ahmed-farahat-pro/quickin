'use client'

import * as React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  itemName: string
  onConfirm: () => Promise<void>
}

export function DeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  itemName,
  onConfirm,
}: DeleteDialogProps) {
  const [confirmText, setConfirmText] = React.useState('')
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setConfirmText('')
      setIsDeleting(false)
    }
  }, [open])

  const isMatch = confirmText === itemName

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!isMatch) return

    try {
      setIsDeleting(true)
      await onConfirm()
      toast.success('Successfully deleted')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete')
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-600">{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description || 'This action cannot be undone. This will permanently delete this item and remove its data from our servers.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="my-4 space-y-4">
          <div className="rounded-md bg-red-50 dark:bg-red-950/50 p-4 text-sm text-red-800 dark:text-red-200 border border-red-200 dark:border-red-900">
            <p>Warning: This is a destructive action. Non-technical administrators should proceed with extreme caution.</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmText">
              Please type <strong>{itemName}</strong> to confirm.
            </Label>
            <Input
              id="confirmText"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={itemName}
              className="mt-2"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!isMatch || isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
