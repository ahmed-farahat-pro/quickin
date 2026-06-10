'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Heart, Loader2 } from 'lucide-react'
import
{
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import
{
    getListingWishlistStatus,
    createWishlist,
    addToWishlist,
    removeFromWishlist
} from '@/lib/supabase/wishlists'
import { useTranslations } from 'next-intl'

interface WishlistModalProps
{
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    listingId: string
    listingTitle: string
    onStatusChange?: (isSaved: boolean) => void
}

export function WishlistModal({
    isOpen,
    onOpenChange,
    listingId,
    listingTitle,
    onStatusChange
}: WishlistModalProps)
{
    const router = useRouter()
    const t = useTranslations('wishlistModal')
    const [wishlists, setWishlists] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [newListName, setNewListName] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const fetchStatus = async () =>
    {
        setIsLoading(true)
        try {
            const status = await getListingWishlistStatus(listingId)
            setWishlists(status.wishlists)
        } catch (error) {
            console.error('Error fetching wishlists:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() =>
    {
        if (isOpen) {
            fetchStatus()
        } else {
            // Reset state when closing
            setIsCreating(false)
            setNewListName('')
        }
    }, [isOpen, listingId])

    const handleToggle = async (wishlistId: string, isSaved: boolean) =>
    {
        // Optimistic update
        setWishlists(prev => prev.map(w => w.id === wishlistId ? { ...w, isSaved: !isSaved } : w))

        const result = isSaved
            ? await removeFromWishlist(wishlistId, listingId)
            : await addToWishlist(wishlistId, listingId)

        if (result.error) {
            toast.error(result.error)
            // Rollback
            setWishlists(prev => prev.map(w => w.id === wishlistId ? { ...w, isSaved: isSaved } : w))
        } else {
            toast.success(isSaved ? t('toastRemoved') : t('toastSaved'))

            // Check if still saved in ANY wishlist for global icon state
            const stillSaved = !isSaved || wishlists.some(w => w.id !== wishlistId && w.isSaved)
            onStatusChange?.(stillSaved)
            router.refresh()
        }
    }

    const handleCreate = async (e: React.FormEvent) =>
    {
        e.preventDefault()
        if (!newListName.trim()) return

        setIsSubmitting(true)
        const result = await createWishlist(newListName)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(t('toastCreated'))
            setNewListName('')
            setIsCreating(false)

            // Auto-add listing to the newly created wishlist
            if (result.data) {
                await addToWishlist(result.data.id, listingId)
                // Refresh status to show the new list as saved
                await fetchStatus()
                onStatusChange?.(true)
                router.refresh()
            }
        }
        setIsSubmitting(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-3xl gap-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-xl font-semibold">{t('title')}</DialogTitle>
                    <DialogDescription className="text-sm text-balance">
                        {t('description', { listingTitle: listingTitle })}
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <ScrollArea className="max-h-[300px] -mr-4 pr-4 py-2">
                            <div className="space-y-1">
                                {wishlists.map((wishlist) => (
                                    <button
                                        key={wishlist.id}
                                        onClick={() => handleToggle(wishlist.id, wishlist.isSaved)}
                                        className="w-full flex items-center justify-between gap-4 p-3 rounded-xl hover:bg-accent transition-colors group text-left rtl:text-right"
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                                                <Heart className={wishlist.isSaved ? "h-6 w-6 fill-primary text-primary" : "h-6 w-6 text-muted-foreground"} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold truncate">{wishlist.name}</p>
                                                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                                                    {wishlist.isSaved ? t('saved') : t('notSaved')}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))}

                                {wishlists.length === 0 && !isCreating && (
                                    <div className="text-center py-12 space-y-2">
                                        <p className="text-muted-foreground font-medium">{t('emptyTitle')}</p>
                                        <p className="text-xs text-muted-foreground">{t('emptyDesc')}</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <div className="p-6 border-t mt-2">
                    {isCreating ? (
                        <form onSubmit={handleCreate} className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                            <div className="space-y-2">
                                <Label htmlFor="wishlist-name" className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    {t('nameLabel')}
                                </Label>
                                <Input
                                    id="wishlist-name"
                                    placeholder={t('namePlaceholder')}
                                    value={newListName}
                                    onChange={(e) => setNewListName(e.target.value)}
                                    autoFocus
                                    maxLength={50}
                                    className="h-12 rounded-xl text-base"
                                />
                                <p className="text-xs text-right rtl:text-left text-muted-foreground">{newListName.length}/50</p>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <Button type="button" variant="ghost" className="rounded-xl h-12 px-6" onClick={() => setIsCreating(false)}>
                                    {t('cancel')}
                                </Button>
                                <Button type="submit" className="rounded-xl h-12 px-6" disabled={!newListName.trim() || isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {t('createAndSave')}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <Button
                            variant="outline"
                            className="w-full h-14 rounded-xl border-2 border-dashed hover:border-solid hover:bg-accent flex items-center justify-center gap-2 group transition-all"
                            onClick={() => setIsCreating(true)}
                        >
                            <div className="h-8 w-8 rounded-lg bg-accent group-hover:bg-background flex items-center justify-center">
                                <Plus className="h-5 w-5" />
                            </div>
                            <span className="font-semibold">{t('createNew')}</span>
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
