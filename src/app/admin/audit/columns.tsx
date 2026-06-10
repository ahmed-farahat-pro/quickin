'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'

export interface AuditLog {
  id: string
  actor_id: string
  actor_type: string
  actor_email: string | null
  action: string
  action_category: string | null
  entity_type: string | null
  entity_id: string | null
  entity_name: string | null
  notes: string | null
  created_at: string
}

function getActorTypeBadge(type: string) {
  switch (type) {
    case 'admin':
      return <Badge className="bg-purple-500">Admin</Badge>
    case 'staff':
      return <Badge className="bg-blue-500">Staff</Badge>
    case 'user':
      return <Badge variant="secondary">User</Badge>
    case 'system':
      return <Badge variant="outline">System</Badge>
    default:
      return <Badge>{type}</Badge>
  }
}

function getActionBadge(action: string) {
  const [category] = action.split('.')
  const colors: Record<string, string> = {
    user: 'bg-blue-100 text-blue-800 border-blue-200',
    listing: 'bg-green-100 text-green-800 border-green-200',
    booking: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    payout: 'bg-purple-100 text-purple-800 border-purple-200',
    payment: 'bg-orange-100 text-orange-800 border-orange-200',
    dispute: 'bg-red-100 text-red-800 border-red-200',
    staff: 'bg-gray-100 text-gray-800 border-gray-200',
  }
  return (
    <Badge variant="outline" className={colors[category] || ''}>
      {action}
    </Badge>
  )
}

function formatRelativeTime(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

export const columns: ColumnDef<AuditLog>[] = [
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="When" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue('created_at'))
      return (
        <div className="whitespace-nowrap">
          <div className="text-sm">{formatRelativeTime(date)}</div>
          <div className="text-xs text-muted-foreground">
            {date.toLocaleTimeString()}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'actor_type',
    header: 'Actor',
    cell: ({ row }) => {
      const log = row.original
      return (
        <div className="flex flex-col gap-1">
          {getActorTypeBadge(log.actor_type)}
          <span className="text-xs text-muted-foreground">
            {log.actor_email || log.actor_id?.slice(0, 8) || 'Unknown'}
          </span>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'action',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Action" />
    ),
    cell: ({ row }) => getActionBadge(row.getValue('action')),
  },
  {
    accessorKey: 'entity_type',
    header: 'Entity',
    cell: ({ row }) => {
      const log = row.original
      return log.entity_type ? (
        <div className="text-sm">
          <span className="capitalize">{log.entity_type}</span>
          {log.entity_name && (
            <div className="text-xs text-muted-foreground truncate max-w-[150px]">
              {log.entity_name}
            </div>
          )}
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      )
    },
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
    cell: ({ row }) => {
      const notes = row.getValue('notes') as string | null
      return notes ? (
        <span className="text-sm truncate max-w-[200px] block">
          {notes}
        </span>
      ) : (
        <span className="text-muted-foreground">-</span>
      )
    },
  },
]
