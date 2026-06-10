'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, MoreHorizontal, Trash } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { format } from 'date-fns'

export type CommentAdmin = {
  id: string
  content: string
  is_hidden: boolean
  is_host_reported: boolean
  created_at: string
  listing?: { title: string }
  author?: { full_name: string; email: string }
}

interface ColumnsProps {
  onDelete: (comment: CommentAdmin) => void
  onToggleVisibility: (comment: CommentAdmin) => void
}

export const getColumns = ({ onDelete, onToggleVisibility }: ColumnsProps): ColumnDef<CommentAdmin>[] => [
  {
    accessorKey: 'content',
    header: 'Comment',
    cell: ({ row }) => {
      const content = row.original.content
      return (
        <div className="max-w-[400px]">
          <p className="text-sm font-medium line-clamp-2">{content}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {row.original.listing?.title || 'Unknown Listing'}
            </span>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'author',
    header: 'Author',
    cell: ({ row }) => {
      const author = row.original.author
      return (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{author?.full_name || 'Anonymous'}</span>
          <span className="text-xs text-muted-foreground">{author?.email || 'No email'}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const isHidden = row.original.is_hidden
      const isReported = row.original.is_host_reported

      return (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={isHidden ? 'secondary' : 'default'}>
            {isHidden ? 'Hidden' : 'Visible'}
          </Badge>
          {isReported && (
             <Badge variant="destructive">Reported</Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Date',
    cell: ({ row }) => {
      return (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {format(new Date(row.original.created_at), 'MMM d, yyyy')}
        </span>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const comment = row.original
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onToggleVisibility(comment)}>
              {comment.is_hidden ? (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Make Visible
                </>
              ) : (
                <>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Hide Comment
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDelete(comment)}
              className="text-destructive focus:text-destructive"
            >
              <Trash className="mr-2 h-4 w-4" />
              Delete Comment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
