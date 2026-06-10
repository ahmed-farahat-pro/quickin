'use client'

import * as React from 'react'
import { DataTable } from '@/components/ui/data-table'
import { getColumns, CommentAdmin } from './columns'
import { DeleteDialog } from '@/components/admin/delete-dialog'
import { deleteComment, toggleCommentVisibility } from './actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

interface CommentsTableProps {
  comments: CommentAdmin[]
}

export function CommentsTable({ comments }: CommentsTableProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [selectedComment, setSelectedComment] = React.useState<CommentAdmin | null>(null)

  const handleDeleteClick = (comment: CommentAdmin) => {
    setSelectedComment(comment)
    setDeleteDialogOpen(true)
  }

  const handleToggleVisibility = async (comment: CommentAdmin) => {
    try {
      const result = await toggleCommentVisibility(comment.id, !comment.is_hidden)
      if (result.error) throw new Error(result.error)
      toast.success(`Comment ${comment.is_hidden ? 'published' : 'hidden'} successfully`)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update comment visibility')
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedComment) return
    const result = await deleteComment(selectedComment.id)
    if (result.error) {
      throw new Error(result.error)
    }
    toast.success('Comment deleted successfully')
    router.refresh()
  }

  const columns = React.useMemo(() => getColumns({ 
    onDelete: handleDeleteClick,
    onToggleVisibility: handleToggleVisibility
  }), [])

  // Filters
  const [listingFilter, setListingFilter] = React.useState<string>('all')
  const [userFilter, setUserFilter] = React.useState<string>('all')
  const [statusFilter, setStatusFilter] = React.useState<string>('all')

  const uniqueListings = React.useMemo(() => {
    const map = new Map()
    comments.forEach(c => { if (c.listing) map.set(c.listing.title, c.listing.title) })
    return Array.from(map.values())
  }, [comments])

  const uniqueUsers = React.useMemo(() => {
    const map = new Map()
    comments.forEach(c => { if (c.author) map.set(c.author.full_name || 'Anonymous', c.author.full_name || 'Anonymous') })
    return Array.from(map.values())
  }, [comments])

  const filteredComments = React.useMemo(() => {
    return comments.filter(c => {
      // Listing filter
      if (listingFilter !== 'all' && (c.listing?.title || 'Unknown Listing') !== listingFilter) return false
      // User filter
      if (userFilter !== 'all' && (c.author?.full_name || 'Anonymous') !== userFilter) return false
      // Status filter
      if (statusFilter === 'reported' && !c.is_host_reported) return false
      if (statusFilter === 'hidden' && !c.is_hidden) return false
      if (statusFilter === 'visible' && c.is_hidden) return false
      return true
    })
  }, [comments, listingFilter, userFilter, statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center mb-4">
        <Select value={listingFilter} onValueChange={setListingFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by Listing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Listings</SelectItem>
            {uniqueListings.map(l => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by User" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {uniqueUsers.map(u => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="reported">Reported</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
            <SelectItem value="visible">Visible</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable 
        columns={columns} 
        data={filteredComments}
        searchKey="content"
        searchPlaceholder="Search comments..."
      />
      
      {selectedComment && (
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Comment"
          itemName="Comment"
          description={`Are you sure you want to completely delete this comment by ${selectedComment.author?.full_name || 'this user'}? This action cannot be undone.`}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}
