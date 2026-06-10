'use client'

import { useState, useTransition } from 'react'
import { Eye, EyeOff, Trash2, Loader2, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import
    {
        DropdownMenu,
        DropdownMenuContent,
        DropdownMenuItem,
        DropdownMenuLabel,
        DropdownMenuSeparator,
        DropdownMenuTrigger,
    } from '@/components/ui/dropdown-menu'
import { toggleReviewVisibility, deleteReviewAdmin } from '@/lib/supabase/reviews'
import { toast } from 'sonner'
import
    {
        AlertDialog,
        AlertDialogAction,
        AlertDialogCancel,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogFooter,
        AlertDialogHeader,
        AlertDialogTitle,
    } from '@/components/ui/alert-dialog'

interface ReviewActionsProps
{
    reviewId: string
    isHidden: boolean
}

export function ReviewActions({ reviewId, isHidden }: ReviewActionsProps)
{
    const [isPending, startTransition] = useTransition()
    const [showDeleteAlert, setShowDeleteAlert] = useState(false)

    const handleToggleVisibility = () =>
    {
        startTransition(async () =>
        {
            const result = await toggleReviewVisibility(reviewId, !isHidden)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(isHidden ? 'Review is now visible to the public' : 'Review is now hidden')
            }
        })
    }

    const handleDelete = () =>
    {
        startTransition(async () =>
        {
            const result = await deleteReviewAdmin(reviewId)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Review deleted permanently')
                setShowDeleteAlert(false)
            }
        })
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0" disabled={isPending}>
                        <span className="sr-only">Open menu</span>
                        {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <MoreHorizontal className="h-4 w-4" />
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Admin Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleToggleVisibility} className="cursor-pointer">
                        {isHidden ? (
                            <>
                                <Eye className="mr-2 h-4 w-4" />
                                <span>Make Visible</span>
                            </>
                        ) : (
                            <>
                                <EyeOff className="mr-2 h-4 w-4" />
                                <span>Hide Comment</span>
                            </>
                        )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => setShowDeleteAlert(true)}
                        className="text-destructive focus:text-destructive cursor-pointer"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete Permanently</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this review
                            and remove it from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) =>
                            {
                                e.preventDefault()
                                handleDelete()
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isPending}
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
