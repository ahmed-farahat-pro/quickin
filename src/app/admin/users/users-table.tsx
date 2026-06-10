'use client'

import * as React from 'react'
import { DataTable } from '@/components/ui/data-table'
import { getColumns, User } from './columns'
import { WarningDialog } from '@/components/admin/warning-dialog'
import { BanDialog } from '@/components/admin/ban-dialog'
import { MessageComposer } from '@/components/admin/message-composer'

interface UsersTableProps {
  users: User[]
}

export function UsersTable({ users }: UsersTableProps) {
  // Dialog states
  const [warningDialogOpen, setWarningDialogOpen] = React.useState(false)
  const [banDialogOpen, setBanDialogOpen] = React.useState(false)
  const [messageDialogOpen, setMessageDialogOpen] = React.useState(false)
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null)

  const handleWarning = (user: User) => {
    setSelectedUser(user)
    setWarningDialogOpen(true)
  }

  const handleBan = (user: User) => {
    setSelectedUser(user)
    setBanDialogOpen(true)
  }

  const handleMessage = (user: User) => {
    setSelectedUser(user)
    setMessageDialogOpen(true)
  }

  const handleActionSuccess = () => {
    window.location.reload()
  }

  const columns = React.useMemo(
    () => getColumns({
      onWarning: handleWarning,
      onBan: handleBan,
      onMessage: handleMessage,
    }),
    []
  )

  return (
    <>
      <DataTable 
        columns={columns} 
        data={users}
        searchKey="email"
        searchPlaceholder="Filter by email..."
      />

      {/* Dialogs */}
      {selectedUser && (
        <>
          <WarningDialog
            open={warningDialogOpen}
            onOpenChange={setWarningDialogOpen}
            userId={selectedUser.id}
            userName={selectedUser.full_name || selectedUser.email}
            currentWarningLevel={selectedUser.warning_count || 0}
            onSuccess={handleActionSuccess}
          />
          <BanDialog
            open={banDialogOpen}
            onOpenChange={setBanDialogOpen}
            userId={selectedUser.id}
            userName={selectedUser.full_name || selectedUser.email}
            warningCount={selectedUser.warning_count || 0}
            onSuccess={handleActionSuccess}
          />
          <MessageComposer
            open={messageDialogOpen}
            onOpenChange={setMessageDialogOpen}
            userId={selectedUser.id}
            userName={selectedUser.full_name || selectedUser.email}
            onSuccess={handleActionSuccess}
          />
        </>
      )}
    </>
  )
}
