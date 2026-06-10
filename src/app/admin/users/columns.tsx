'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, AlertTriangle, Ban, Mail, Eye, Shield } from 'lucide-react'
import Link from 'next/link'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'

export interface User {
  id: string
  full_name: string | null
  email: string
  is_host: boolean
  created_at: string
  listings_count: number
  warning_count?: number
  is_banned?: boolean
}

interface ColumnActionsProps {
  user: User
  onWarning: (user: User) => void
  onBan: (user: User) => void
  onMessage: (user: User) => void
}

export function getColumns(actions: Omit<ColumnActionsProps, 'user'>): ColumnDef<User>[] {
  return [
    {
      accessorKey: 'full_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="User" />
      ),
      cell: ({ row }) => {
        const user = row.original
        const initials = (user.full_name || user.email)
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)

        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="font-medium">
              {user.full_name || 'No name'}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
    },
    {
      accessorKey: 'is_host',
      header: 'Role',
      cell: ({ row }) => {
        const isHost = row.getValue('is_host') as boolean
        return isHost ? (
          <Badge className="bg-blue-500">Host</Badge>
        ) : (
          <Badge variant="secondary">Guest</Badge>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const user = row.original
        if (user.is_banned) {
          return <Badge variant="destructive">Banned</Badge>
        }
        if (user.warning_count && user.warning_count > 0) {
          return (
            <Badge variant="secondary" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {user.warning_count} warning(s)
            </Badge>
          )
        }
        return (
          <Badge variant="outline" className="text-green-600 border-green-300">
            <Shield className="h-3 w-3 mr-1" />
            Good
          </Badge>
        )
      },
    },
    {
      accessorKey: 'listings_count',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Listings" />
      ),
      cell: ({ row }) => {
        const count = row.getValue('listings_count') as number
        return count > 0 ? (
          <span className="font-medium">{count}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Joined" />
      ),
      cell: ({ row }) => {
        return new Date(row.getValue('created_at')).toLocaleDateString()
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const user = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/admin/users/${user.id}`}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onMessage(user)}>
                <Mail className="h-4 w-4 mr-2" />
                Send Message
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => actions.onWarning(user)}
                className="text-yellow-600"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Issue Warning
              </DropdownMenuItem>
              {!user.is_banned && (
                <DropdownMenuItem 
                  onClick={() => actions.onBan(user)}
                  className="text-red-600"
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Ban User
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
