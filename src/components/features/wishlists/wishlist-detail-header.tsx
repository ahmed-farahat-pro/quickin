'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, MoreHorizontal, Trash2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import
    {
        DropdownMenu,
        DropdownMenuContent,
        DropdownMenuItem,
        DropdownMenuTrigger
    } from '@/components/ui/dropdown-menu'
import { deleteWishlist } from '@/lib/supabase/wishlists'
import { toast } from 'sonner'

interface WishlistDetailHeaderProps
{
    id: string
    name: string
    itemCount: number
}

export function WishlistDetailHeader({ id, name, itemCount }: WishlistDetailHeaderProps)
{
    const router = useRouter()
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () =>
    {
        try {
            setIsDeleting(true)
            await deleteWishlist(id)
            toast.success('Wishlist deleted')
            router.push('/dashboard/wishlists')
            router.refresh()
        } catch (error) {
            toast.error('Failed to delete wishlist')
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <Link
                href="/dashboard/wishlists"
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-fit"
            >
                <ChevronLeft className="h-4 w-4" />
                Back to wishlists
            </Link>

            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">{name}</h1>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full" disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="h-5 w-5 animate-spin" /> : <MoreHorizontal className="h-5 w-5" />}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive cursor-pointer"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete wishlist
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <p className="text-muted-foreground">
                {itemCount} {itemCount === 1 ? 'listing' : 'listings'} saved
            </p>
        </div>
    )
}
