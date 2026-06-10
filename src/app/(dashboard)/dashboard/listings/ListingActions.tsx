'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ChevronDown, Eye, Pencil, Ban, Globe } from 'lucide-react'
import Link from 'next/link'
import { UnpublishDialog } from '@/components/features/listings/unpublish-dialog'
import { publishListing } from '@/lib/actions/listing-actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface ListingActionsProps {
  listingId: string
  isPublished: boolean
  activeBookingCount: number
  viewUrl: string
  manageUrl: string
}

export function ListingActions({
  listingId,
  isPublished,
  activeBookingCount,
  viewUrl,
  manageUrl,
}: ListingActionsProps) {
  const [isUnpublishDialogOpen, setIsUnpublishDialogOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()
  const t = useTranslations('dashboardListings.card')
  const tActions = useTranslations('dashboardListings.actions')

  const handlePublish = async () => {
    setIsPending(true)
    try {
      const result = await publishListing(listingId)
      if (result.success) {
        toast.success(tActions('publishSuccess'))
        router.refresh()
      } else {
        toast.error(result.error || tActions('publishError'))
      }
    } catch (_error) {
      toast.error(tActions('publishError'))
    } finally {
      setIsPending(false)
    }
  }


  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" disabled={isPending}>
            {t('options')} <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={viewUrl}>
              <Eye className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
              {t('viewListing')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={manageUrl}>
              <Pencil className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
              {t('manage')}
            </Link>
          </DropdownMenuItem>
          {isPublished ? (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setIsUnpublishDialogOpen(true)}
            >
              <Ban className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
              {t('unpublish')}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="text-green-600 focus:text-green-600"
              onClick={handlePublish}
            >
              <Globe className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
              {t('publish')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <UnpublishDialog
        listingId={listingId}
        isOpen={isUnpublishDialogOpen}
        onOpenChange={setIsUnpublishDialogOpen}
        activeBookingCount={activeBookingCount}
      />
    </>
  )
}
