'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Trash, Unlock } from 'lucide-react'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { format } from 'date-fns'

export interface UserBan {
  id: string
  user_id: string
  ban_type: string
  reason: string
  details: string | null
  duration_days: number | null
  expires_at: string | null
  created_at: string
  is_active: boolean
  target_user: { full_name: string, email: string }
  banned_by_user: { full_name: string, email: string }
}

interface ColumnActionsProps {
  onDelete: (ban: UserBan) => void
  onLiftBan: (ban: UserBan) => void
}

export function getColumns(actions: ColumnActionsProps): ColumnDef<UserBan>[] {
  return [
    {
      id: 'target_user',
      accessorFn: (row) => row.target_user?.full_name || row.target_user?.email || 'Unknown',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="User" />
      ),
      cell: ({ row }) => {
        return (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.target_user?.full_name || 'Unknown User'}</span>
            <span className="text-xs text-muted-foreground">{row.original.target_user?.email}</span>
          </div>
        )
      }
    },
    {
      accessorKey: 'ban_type',
      header: 'Type',
      cell: ({ row }) => {
        const type = row.getValue('ban_type') as string
        return (
          <Badge variant={type === 'permanent' ? 'destructive' : 'secondary'}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </Badge>
        )
      }
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
    },
    {
      accessorKey: 'expires_at',
      header: 'Expires',
      cell: ({ row }) => {
        const expiresAt = row.getValue('expires_at') as string | null
        if (!expiresAt) return <span className="text-muted-foreground">-</span>
        
        const isExpired = new Date(expiresAt) < new Date()
        return (
          <span className={isExpired ? 'text-muted-foreground line-through' : ''}>
            {format(new Date(expiresAt), 'MMM d, yyyy')}
          </span>
        )
      }
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => {
        const isActive = row.getValue('is_active') as boolean
        const expiresAt = row.original.expires_at
        const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false

        if (!isActive) return <Badge variant="outline" className="text-muted-foreground">Lifted</Badge>
        if (isExpired) return <Badge variant="outline" className="text-muted-foreground">Expired</Badge>
        return <Badge className="bg-red-500 hover:bg-red-600">Active</Badge>
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Date Applied',
      cell: ({ row }) => {
        return format(new Date(row.getValue('created_at')), 'MMM d, yyyy')
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const ban = row.original
        const isLiftable = ban.is_active && (!ban.expires_at || new Date(ban.expires_at) > new Date())

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isLiftable && (
                <>
                  <DropdownMenuItem onClick={() => actions.onLiftBan(ban)}>
                    <Unlock className="h-4 w-4 mr-2 text-green-600" />
                    Lift Ban
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem 
                onClick={() => actions.onDelete(ban)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete Record
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
