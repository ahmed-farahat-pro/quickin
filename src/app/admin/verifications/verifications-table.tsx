'use client'

import { useState, useEffect } from 'react'
import { DataTable } from '@/components/ui/data-table'
import { columns, PendingVerification } from './columns'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Eye, CheckCircle, XCircle, Loader2, ImageOff } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface VerificationsTableProps {
  verifications: PendingVerification[]
}

export function VerificationsTable({ verifications }: VerificationsTableProps) {
  const [selectedUser, setSelectedUser] = useState<PendingVerification | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [signedUrls, setSignedUrls] = useState<{
    id_front: string | null
    id_back: string | null
    selfie: string | null
  }>({ id_front: null, id_back: null, selfie: null })
  const [loadingUrls, setLoadingUrls] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Extract file path from URL stored in database
  const extractFilePath = (url: string | null): string | null => {
    if (!url) return null
    // URL format: .../storage/v1/object/public/identity-documents/{userId}/{filename}
    const match = url.match(/identity-documents\/(.+)$/)
    return match ? match[1] : null
  }

  // Generate signed URLs when dialog opens
  useEffect(() => {
    const generateSignedUrls = async () => {
      if (!selectedUser || !isDialogOpen) return

      setLoadingUrls(true)
      const urls = { id_front: null as string | null, id_back: null as string | null, selfie: null as string | null }

      try {
        // Extract paths from stored URLs
        const paths = {
          id_front: extractFilePath(selectedUser.id_front_url),
          id_back: extractFilePath(selectedUser.id_back_url),
          selfie: extractFilePath(selectedUser.selfie_url),
        }

        for (const [key, path] of Object.entries(paths)) {
          if (path) {
            const { data, error } = await supabase.storage
              .from('identity-documents')
              .createSignedUrl(path, 3600) // 1 hour expiry

            if (!error && data?.signedUrl) {
              urls[key as keyof typeof urls] = data.signedUrl
            }
          }
        }
      } catch (error) {
        console.error('Error generating signed URLs:', error)
      }

      setSignedUrls(urls)
      setLoadingUrls(false)
    }

    generateSignedUrls()
  }, [selectedUser, isDialogOpen, supabase])

  const handleViewDetails = (verification: PendingVerification) => {
    setSelectedUser(verification)
    setNotes(verification.verification_notes || '')
    setSignedUrls({ id_front: null, id_back: null, selfie: null })
    setIsDialogOpen(true)
  }

  const handleApprove = async () => {
    if (!selectedUser) return
    setIsProcessing(true)

    try {
      const response = await fetch('/api/admin/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          action: 'approve',
          notes: notes || null,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to approve')

      toast.success(`User ${selectedUser.full_name || selectedUser.email} verified successfully`)
      setIsDialogOpen(false)
      router.refresh()
    } catch (error: any) {
      console.error('Error approving verification:', error)
      toast.error(error.message || 'Failed to approve verification', {
        action: { label: "Retry", onClick: () => handleApprove() }
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedUser) return
    if (!notes.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }
    setIsProcessing(true)

    try {
      const response = await fetch('/api/admin/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          action: 'reject',
          notes: notes,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to reject')

      toast.success(`User ${selectedUser.full_name || selectedUser.email} verification rejected`)
      setIsDialogOpen(false)
      router.refresh()
    } catch (error: any) {
      console.error('Error rejecting verification:', error)
      toast.error(error.message || 'Failed to reject verification', {
        action: { label: "Retry", onClick: () => handleReject() }
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const actionColumn = {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }: { row: { original: PendingVerification } }) => (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleViewDetails(row.original)}
      >
        <Eye className="h-4 w-4 mr-1" />
        Review
      </Button>
    ),
  }

  const allColumns = [...columns, actionColumn]

  return (
    <>
      <DataTable
        columns={allColumns}
        data={verifications}
        searchKey="user"
        searchPlaceholder="Search by name or email..."
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Identity Documents</DialogTitle>
            <DialogDescription>
              {selectedUser?.full_name || selectedUser?.email} - Review submitted documents
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              {/* User Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>{' '}
                  <span className="font-medium">{selectedUser.full_name || 'Not provided'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>{' '}
                  <span className="font-medium">{selectedUser.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>{' '}
                  <span className="font-medium">{selectedUser.phone || 'Not provided'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Submitted:</span>{' '}
                  <span className="font-medium">
                    {selectedUser.verification_submitted_at 
                      ? new Date(selectedUser.verification_submitted_at).toLocaleString()
                      : 'Unknown'}
                  </span>
                </div>
              </div>

              {/* Document Images */}
              <Tabs defaultValue="id_front" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="id_front">ID Front</TabsTrigger>
                  <TabsTrigger value="id_back">ID Back</TabsTrigger>
                  <TabsTrigger value="selfie">Selfie</TabsTrigger>
                </TabsList>
                <TabsContent value="id_front" className="mt-4">
                  <DocumentImage url={signedUrls.id_front} alt="ID Card Front" loading={loadingUrls} />
                </TabsContent>
                <TabsContent value="id_back" className="mt-4">
                  <DocumentImage url={signedUrls.id_back} alt="ID Card Back" loading={loadingUrls} />
                </TabsContent>
                <TabsContent value="selfie" className="mt-4">
                  <DocumentImage url={signedUrls.selfie} alt="Selfie" loading={loadingUrls} />
                </TabsContent>
              </Tabs>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Admin Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add notes about this verification (required for rejection)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  readOnly={selectedUser?.verification_status?.code !== 'pending'}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isProcessing}
            >
              Close
            </Button>
            {selectedUser?.verification_status?.code === 'pending' && (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Approve
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function DocumentImage({ url, alt, loading }: { url: string | null; alt: string; loading?: boolean }) {
  const [imageError, setImageError] = useState(false)

  if (loading) {
    return (
      <div className="aspect-[4/3] bg-muted rounded-lg flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!url || imageError) {
    return (
      <div className="aspect-[4/3] bg-muted rounded-lg flex flex-col items-center justify-center gap-2">
        <ImageOff className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          {!url ? 'No document uploaded' : 'Failed to load image'}
        </p>
      </div>
    )
  }

  return (
    <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className="w-full h-full object-contain"
        onError={() => setImageError(true)}
      />
    </div>
  )
}
