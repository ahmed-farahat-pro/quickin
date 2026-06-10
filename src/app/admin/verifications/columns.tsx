'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { Clock, ShieldCheck, XCircle } from 'lucide-react'

export interface PendingVerification {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  id_front_url: string | null
  id_back_url: string | null
  selfie_url: string | null
  verification_submitted_at: string | null
  verification_notes: string | null
  verification_status: {
    id: number
    code: string
    label: string
  } | null
}

function getStatusBadge(status: PendingVerification['verification_status']) {
  if (!status) return <Badge variant="outline">Unknown</Badge>
  
  switch (status.code) {
    case 'pending':
      return (
        <Badge className="bg-yellow-500 gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      )
    case 'verified':
      return (
        <Badge className="bg-green-500 gap-1">
          <ShieldCheck className="h-3 w-3" />
          Verified
        </Badge>
      )
    case 'rejected':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Rejected
        </Badge>
      )
    default:
      return <Badge variant="outline">{status.label}</Badge>
  }
}

export const columns: ColumnDef<PendingVerification>[] = [
  {
    id: 'user',
    accessorFn: (row) => row.full_name || row.email,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="User" />
    ),
    cell: ({ row }) => {
      const v = row.original
      return (
        <div className="text-sm">
          <div className="font-medium">{v.full_name || 'Unknown'}</div>
          <div className="text-muted-foreground text-xs">{v.email}</div>
          {v.phone && <div className="text-muted-foreground text-xs">{v.phone}</div>}
        </div>
      )
    },
  },
  {
    id: 'status',
    accessorFn: (row) => row.verification_status?.code || 'unknown',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => getStatusBadge(row.original.verification_status),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: 'documents',
    header: 'Documents',
    cell: ({ row }) => {
      const v = row.original
      const hasIdFront = !!v.id_front_url
      const hasIdBack = !!v.id_back_url
      const hasSelfie = !!v.selfie_url
      
      return (
        <div className="flex gap-1">
          <Badge variant={hasIdFront ? "default" : "outline"} className="text-xs">
            ID Front
          </Badge>
          <Badge variant={hasIdBack ? "default" : "outline"} className="text-xs">
            ID Back
          </Badge>
          <Badge variant={hasSelfie ? "default" : "outline"} className="text-xs">
            Selfie
          </Badge>
        </div>
      )
    },
  },
  {
    accessorKey: 'verification_submitted_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Submitted" />
    ),
    cell: ({ row }) => {
      const date = row.getValue('verification_submitted_at') as string | null
      return date ? new Date(date).toLocaleDateString() : '-'
    },
  },
]
