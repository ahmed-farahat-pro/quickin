'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Shield, ShieldCheck, UserX, UserPlus } from 'lucide-react'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'

export interface Staff {
  id: string
  display_name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

interface ColumnOptions {
  isAdmin: boolean
  currentUserId?: string
  onToggleStatus: (id: string, currentStatus: boolean) => void
}

export function getColumns({ isAdmin, currentUserId, onToggleStatus }: ColumnOptions): ColumnDef<Staff>[] {
  const columns: ColumnDef<Staff>[] = [
    {
      accessorKey: 'display_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Staff Member" />
      ),
      cell: ({ row }) => {
        const member = row.original
        const initials = member.display_name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
        const isCurrentUser = member.id === currentUserId

        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="font-medium">{member.display_name}</span>
            {isCurrentUser && (
              <Badge variant="outline" className="text-xs">You</Badge>
            )}
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
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => {
        const role = row.getValue('role') as string
        return (
          <div className="flex items-center gap-1">
            {role === 'admin' ? (
              <ShieldCheck className="h-4 w-4 text-primary" />
            ) : (
              <Shield className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="capitalize">{role}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => {
        const isActive = row.getValue('is_active') as boolean
        return isActive ? (
          <Badge className="bg-green-500">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
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
  ]

  if (isAdmin) {
    columns.push({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const member = row.original
        const isCurrentUser = member.id === currentUserId

        if (isCurrentUser) return null

        return (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={member.is_active ? 'text-destructive' : 'text-green-600'}
            onClick={() => onToggleStatus(member.id, member.is_active)}
          >
            {member.is_active ? (
              <>
                <UserX className="h-4 w-4 mr-1" />
                Deactivate
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-1" />
                Activate
              </>
            )}
          </Button>
        )
      },
    })
  }

  return columns
}
