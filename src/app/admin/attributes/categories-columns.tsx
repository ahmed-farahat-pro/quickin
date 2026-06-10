'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Pencil, Trash } from 'lucide-react'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { DynamicIcon } from '@/components/ui/dynamic-icon'

export interface AttributeCategory {
  id: string
  code: string
  label: string
  icon_class: string | null
  display_order: number
}

interface ColumnActionsProps {
  onEdit: (category: AttributeCategory) => void
  onDelete: (category: AttributeCategory) => void
}

export function getCategoriesColumns(actions: ColumnActionsProps): ColumnDef<AttributeCategory>[] {
  return [
    {
      accessorKey: 'label',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Label" />
      ),
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-2">
            {row.original.icon_class && (
              <DynamicIcon name={row.original.icon_class} className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium">{row.original.label}</span>
          </div>
        )
      }
    },
    {
      accessorKey: 'code',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Code" />
      ),
      cell: ({ row }) => <code className="text-xs bg-muted px-1 rounded">{row.original.code}</code>
    },
    {
      accessorKey: 'display_order',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Order" />
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const category = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => actions.onEdit(category)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Category
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => actions.onDelete(category)}
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
