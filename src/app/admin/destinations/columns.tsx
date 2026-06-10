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
import { MoreHorizontal, Pencil, Trash } from 'lucide-react'
import Link from 'next/link'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { SearchDestination } from '@/types/database'

interface ColumnActionsProps {
  onDelete: (destination: SearchDestination) => void
}

export function getColumns(actions: ColumnActionsProps): ColumnDef<SearchDestination>[] {
  return [
    {
      accessorKey: 'label',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Label" />
      ),
    },
    {
      accessorKey: 'type',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => {
        const type = row.getValue('type') as string
        return <Badge variant="outline">{type}</Badge>
      },
    },
    {
      accessorKey: 'country',
      header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Country" />
      ),
    },
    {
      id: 'active',
      accessorKey: 'is_active',
      header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const isActive = row.getValue('active') as boolean
        return isActive ? (
          <Badge className="bg-green-500">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        )
      },
    },
    {
      accessorKey: 'radius_km',
      header: 'Radius (km)',
      cell: ({ row }) => {
          return <span>{row.getValue('radius_km')} km</span>
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const destination = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/admin/destinations/${destination.id}`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => actions.onDelete(destination)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}

