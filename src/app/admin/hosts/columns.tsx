'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Eye, Home } from 'lucide-react'
import Link from 'next/link'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'

export interface Host {
  id: string
  full_name: string | null
  email: string
  created_at: string
  listings_count: number
  total_bookings: number
}

export const columns: ColumnDef<Host>[] = [
  {
    accessorKey: 'full_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Host" />
    ),
    cell: ({ row }) => {
      const host = row.original
      const initials = (host.full_name || host.email)
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
            {host.full_name || 'No name'}
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
    accessorKey: 'listings_count',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Listings" />
    ),
    cell: ({ row }) => {
      const count = row.getValue('listings_count') as number
      return (
        <Badge variant="secondary" className="gap-1">
          <Home className="h-3 w-3" />
          {count}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'total_bookings',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total Bookings" />
    ),
    cell: ({ row }) => {
      const count = row.getValue('total_bookings') as number
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
      const host = row.original

      return (
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/admin/hosts/${host.id}`}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
      )
    },
  },
]
