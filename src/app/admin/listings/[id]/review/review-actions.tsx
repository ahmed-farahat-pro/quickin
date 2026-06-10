'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Trash } from 'lucide-react'
import { reviewListing } from '../../actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function ReviewActions({ listingId }: { listingId: string }) {
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const router = useRouter()

  const handleReview = async (action: 'approve' | 'reject') => {
    let notes: string | undefined;

    if (action === 'reject') {
      const input = window.prompt('Reason for rejection:')
      if (!input) return // User cancelled or entered empty
      notes = input
      setIsRejecting(true)
    } else {
      setIsApproving(true)
    }
    
    try {
      const result = await reviewListing(listingId, action, notes)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Listing ${action}d successfully.`)
        router.push('/admin/approvals')
      }
    } catch {
      toast.error('Failed to update review status')
    } finally {
      setIsApproving(false)
      setIsRejecting(false)
    }
  }

  return (
    <>
      <Button 
        variant="outline" 
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
        onClick={() => handleReview('reject')}
        disabled={isApproving || isRejecting}
      >
        <Trash className="h-4 w-4 mr-2" />
        {isRejecting ? 'Rejecting...' : 'Reject'}
      </Button>
      <Button 
        className="bg-green-600 hover:bg-green-700"
        onClick={() => handleReview('approve')}
        disabled={isApproving || isRejecting}
      >
        <Check className="h-4 w-4 mr-2" />
        {isApproving ? 'Approving...' : 'Approve'}
      </Button>
    </>
  )
}
