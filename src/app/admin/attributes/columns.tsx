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
import { MoreHorizontal, Pencil, Trash, Power, PowerOff } from 'lucide-react'
import Link from 'next/link'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'

export interface Attribute {
  id: string
  code: string
  label: string
  is_approved: boolean
  is_enabled: boolean
  category: { label: string } | null
  type: { code: string } | null
}

interface ColumnActionsProps {
  onDelete: (attribute: Attribute) => void
  onToggleStatus: (attribute: Attribute) => void
}

export function getColumns(actions: ColumnActionsProps): ColumnDef<Attribute>[] {
  return [
    {
      accessorKey: 'label',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Label" />
      ),
      cell: ({ row }) => {
        return (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.label}</span>
            <span className="text-xs text-muted-foreground">{row.original.code}</span>
          </div>
        )
      }
    },
    {
      id: 'category',
      accessorFn: (row) => row.category?.label || 'Uncategorized',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Category" />
      ),
    },
    {
      id: 'type',
      accessorFn: (row) => row.type?.code || 'unknown',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => <Badge variant="outline">{row.original.type?.code}</Badge>
    },
    {
      accessorKey: 'is_approved',
      header: 'Approved',
      cell: ({ row }) => {
        const isApproved = row.getValue('is_approved') as boolean
        return isApproved ? (
          <Badge className="bg-green-500">Yes</Badge>
        ) : (
          <Badge variant="secondary" className="text-amber-600 bg-amber-50">Pending</Badge>
        )
      },
    },
    {
      accessorKey: 'is_enabled',
      header: 'Status',
      cell: ({ row }) => {
        const isEnabled = row.getValue('is_enabled') as boolean
        return isEnabled ? (
          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Active</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const attribute = row.original
        const isEnabled = attribute.is_enabled

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/admin/attributes/${attribute.id}/edit`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Attribute
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onToggleStatus(attribute)}>
                {isEnabled ? (
                  <>
                    <PowerOff className="h-4 w-4 mr-2 text-amber-600" />
                    Disable
                  </>
                ) : (
                  <>
                    <Power className="h-4 w-4 mr-2 text-green-600" />
                    Enable
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => actions.onDelete(attribute)}
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
