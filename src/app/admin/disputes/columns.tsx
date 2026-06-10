'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'
import Link from 'next/link'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'

export interface Dispute {
  id: string
  booking_id: string
  guest_id: string
  host_id: string
  dispute_type: string
  subject: string
  status: string
  priority: string
  created_at: string
  guest: {
    full_name: string | null
    email: string
  } | null
  host: {
    full_name: string | null
  } | null
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'open':
      return <Badge className="bg-yellow-500">Open</Badge>
    case 'in_progress':
      return <Badge className="bg-blue-500">In Progress</Badge>
    case 'pending_guest':
      return <Badge variant="secondary">Awaiting Guest</Badge>
    case 'pending_host':
      return <Badge variant="secondary">Awaiting Host</Badge>
    case 'resolved':
      return <Badge className="bg-green-500">Resolved</Badge>
    case 'closed':
      return <Badge variant="outline">Closed</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'urgent':
      return <Badge variant="destructive">Urgent</Badge>
    case 'high':
      return <Badge className="bg-orange-500">High</Badge>
    case 'normal':
      return <Badge variant="secondary">Normal</Badge>
    case 'low':
      return <Badge variant="outline">Low</Badge>
    default:
      return <Badge variant="secondary">{priority}</Badge>
  }
}

function getTypeBadge(type: string) {
  const labels: Record<string, string> = {
    cancellation: 'Cancellation',
    refund: 'Refund Request',
    complaint: 'Complaint',
    property_issue: 'Property Issue',
    payment_issue: 'Payment Issue',
    other: 'Other',
  }
  return <Badge variant="outline">{labels[type] || type}</Badge>
}

export const columns: ColumnDef<Dispute>[] = [
  {
    accessorKey: 'subject',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Subject" />
    ),
    cell: ({ row }) => {
      return (
        <div className="font-medium max-w-[200px] truncate">
          {row.getValue('subject')}
        </div>
      )
    },
  },
  {
    accessorKey: 'dispute_type',
    header: 'Type',
    cell: ({ row }) => getTypeBadge(row.getValue('dispute_type')),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: 'guest',
    accessorFn: (row) => row.guest?.full_name || 'Unknown',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Guest" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-sm">
          {row.original.guest?.full_name || 'Unknown'}
        </div>
      )
    },
  },
  {
    id: 'host',
    accessorFn: (row) => row.host?.full_name || 'Unknown',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Host" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-sm">
          {row.original.host?.full_name || 'Unknown'}
        </div>
      )
    },
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Priority" />
    ),
    cell: ({ row }) => getPriorityBadge(row.getValue('priority')),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => getStatusBadge(row.getValue('status')),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => {
      return new Date(row.getValue('created_at')).toLocaleDateString()
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      const dispute = row.original

      return (
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/admin/disputes/${dispute.id}`}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
      )
    },
  },
]
