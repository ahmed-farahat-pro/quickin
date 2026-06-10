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

export interface CancellationPolicy {
  code: string
  label: string
  description: string | null
  full_refund_days_before: number | null
  partial_refund_days_before: number | null
  partial_refund_pct: number | null
  no_refund_days_before: number | null
  is_enabled: boolean
  display_order: number
  translations: any
}

interface ColumnActionsProps {
  onDelete: (policy: CancellationPolicy) => void
  onToggleEnabled: (policy: CancellationPolicy) => void
}

export function getColumns(actions: ColumnActionsProps): ColumnDef<CancellationPolicy>[] {
  return [
    {
      accessorKey: 'label',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Label" />
      ),
      cell: ({ row }) => {
        return (
          <div className="font-medium">{row.original.label}</div>
        )
      }
    },
    {
      accessorKey: 'code',
      header: 'Code',
      cell: ({ row }) => {
        return <div className="text-muted-foreground font-mono text-sm">{row.original.code}</div>
      }
    },
    {
      id: 'refund_rules',
      header: 'Refund Rules',
      cell: ({ row }) => {
        const p = row.original
        const parts: string[] = []
        if (p.full_refund_days_before != null) parts.push(`Full: ${p.full_refund_days_before}d`)
        if (p.partial_refund_days_before != null && p.partial_refund_pct != null) parts.push(`${p.partial_refund_pct}%: ${p.partial_refund_days_before}d`)
        if (p.no_refund_days_before != null) parts.push(`None: ${p.no_refund_days_before}d`)
        return <div className="text-muted-foreground text-sm">{parts.join(' / ') || '-'}</div>
      }
    },
    {
      accessorKey: 'is_enabled',
      header: 'Status',
      cell: ({ row }) => {
        const isEnabled = row.getValue('is_enabled') as boolean
        return isEnabled ? (
          <Badge className="bg-green-500">Enabled</Badge>
        ) : (
          <Badge variant="secondary" className="text-amber-600 bg-amber-50">Disabled</Badge>
        )
      },
    },
    {
      accessorKey: 'display_order',
      header: 'Order',
      cell: ({ row }) => {
        return <div className="text-muted-foreground">{row.original.display_order}</div>
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const policy = row.original
        const isEnabled = policy.is_enabled

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/admin/cancellation-policies/${policy.code}/edit`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Policy
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onToggleEnabled(policy)}>
                {isEnabled ? (
                  <>
                    <XCircle className="h-4 w-4 mr-2 text-amber-600" />
                    Disable
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                    Enable
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => actions.onDelete(policy)}
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
