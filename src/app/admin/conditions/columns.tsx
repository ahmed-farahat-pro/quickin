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
import { MoreHorizontal, Pencil, Trash, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'

export interface Condition {
  id: string
  name: string
  description: string | null
  icon_url: string | null
  is_approved: boolean
  is_system: boolean
}

interface ColumnActionsProps {
  onDelete: (condition: Condition) => void
  onToggleApproval: (condition: Condition) => void
}

export function getColumns(actions: ColumnActionsProps): ColumnDef<Condition>[] {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => {
        return (
          <div className="font-medium">{row.original.name}</div>
        )
      }
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => {
        const desc = row.original.description
        return <div className="text-muted-foreground truncate max-w-[300px]">{desc || '-'}</div>
      }
    },
    {
      accessorKey: 'is_system',
      header: 'Type',
      cell: ({ row }) => {
        const isSystem = row.getValue('is_system') as boolean
        return isSystem ? (
          <Badge className="bg-purple-500">System</Badge>
        ) : (
          <Badge variant="outline">Custom</Badge>
        )
      },
    },
    {
      accessorKey: 'is_approved',
      header: 'Status',
      cell: ({ row }) => {
        const isApproved = row.getValue('is_approved') as boolean
        return isApproved ? (
          <Badge className="bg-green-500">Approved</Badge>
        ) : (
          <Badge variant="secondary" className="text-amber-600 bg-amber-50">Pending</Badge>
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const condition = row.original
        const isApproved = condition.is_approved

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/admin/conditions/${condition.id}/edit`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Condition
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onToggleApproval(condition)}>
                {isApproved ? (
                  <>
                    <XCircle className="h-4 w-4 mr-2 text-amber-600" />
                    Unapprove
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                    Approve
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => actions.onDelete(condition)}
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
