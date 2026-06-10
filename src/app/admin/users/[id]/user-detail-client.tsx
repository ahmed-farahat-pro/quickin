'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, 
  AlertTriangle, 
  Ban, 
  Mail, 
  Calendar, 
  Home,
  CreditCard,
  Shield,
  Clock
} from 'lucide-react'
import { WarningDialog } from '@/components/admin/warning-dialog'
import { BanDialog } from '@/components/admin/ban-dialog'
import { MessageComposer } from '@/components/admin/message-composer'

interface UserDetailClientProps {
  user: {
    id: string
    full_name: string | null
    email: string
    is_host: boolean
    phone: string | null
    bio: string | null
    created_at: string
    listings_count: number
    bookings_count: number
  }
  warnings: Array<{
    id: string
    warning_level: number
    reason: string
    created_at: string
    staff_name: string | null
    is_active: boolean
  }>
  bans: Array<{
    id: string
    ban_type: string
    reason: string
    created_at: string
    expires_at: string | null
    unbanned_at: string | null
    staff_name: string | null
    is_active: boolean
  }>
  messages: Array<{
    id: string
    subject: string
    message: string
    category: string
    created_at: string
    is_read: boolean
    staff_name: string | null
  }>
  listings: Array<{
    id: string
    title: string
    is_published: boolean
    price_per_night: number
    created_at: string
  }>
}

export function UserDetailClient({ user, warnings, bans, messages, listings }: UserDetailClientProps) {
  const router = useRouter()
  
  // Dialog states
  const [warningDialogOpen, setWarningDialogOpen] = React.useState(false)
  const [banDialogOpen, setBanDialogOpen] = React.useState(false)
  const [messageDialogOpen, setMessageDialogOpen] = React.useState(false)

  const initials = (user.full_name || user.email)
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const activeWarnings = warnings.filter(w => w.is_active)
  const isCurrentlyBanned = bans.some(b => b.is_active)

  const handleActionSuccess = () => {
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">User Details</h1>
          <p className="text-muted-foreground">
            View and manage user information
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setMessageDialogOpen(true)}>
            <Mail className="h-4 w-4 mr-2" />
            Send Message
          </Button>
          <Button 
            variant="outline" 
            className="text-yellow-600"
            onClick={() => setWarningDialogOpen(true)}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Issue Warning
          </Button>
          {!isCurrentlyBanned && (
            <Button 
              variant="outline" 
              className="text-red-600"
              onClick={() => setBanDialogOpen(true)}
            >
              <Ban className="h-4 w-4 mr-2" />
              Ban User
            </Button>
          )}
        </div>
      </div>

      {/* User Profile Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{user.full_name || 'No name'}</h2>
                {user.is_host ? (
                  <Badge className="bg-blue-500">Host</Badge>
                ) : (
                  <Badge variant="secondary">Guest</Badge>
                )}
                {isCurrentlyBanned ? (
                  <Badge variant="destructive">Banned</Badge>
                ) : activeWarnings.length > 0 ? (
                  <Badge variant="secondary" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {activeWarnings.length} warning(s)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    <Shield className="h-3 w-3 mr-1" />
                    Good Standing
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{user.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Joined</p>
                  <p className="font-medium">{new Date(user.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">User ID</p>
                  <p className="font-mono text-xs">{user.id}</p>
                </div>
              </div>
              {user.bio && (
                <div>
                  <p className="text-muted-foreground text-sm">Bio</p>
                  <p className="text-sm">{user.bio}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Listings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{user.listings_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Bookings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{user.bookings_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Active Warnings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeWarnings.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Messages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{messages.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different sections */}
      <Tabs defaultValue="warnings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="warnings">
            Warnings ({warnings.length})
          </TabsTrigger>
          <TabsTrigger value="bans">
            Ban History ({bans.length})
          </TabsTrigger>
          <TabsTrigger value="messages">
            Messages ({messages.length})
          </TabsTrigger>
          <TabsTrigger value="listings">
            Listings ({listings.length})
          </TabsTrigger>
        </TabsList>

        {/* Warnings Tab */}
        <TabsContent value="warnings">
          <Card>
            <CardHeader>
              <CardTitle>Warning History</CardTitle>
              <CardDescription>All warnings issued to this user</CardDescription>
            </CardHeader>
            <CardContent>
              {warnings.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No warnings issued</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Level</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Issued By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warnings.map((warning) => (
                      <TableRow key={warning.id}>
                        <TableCell>
                          <Badge variant={warning.warning_level >= 3 ? 'destructive' : 'secondary'}>
                            Level {warning.warning_level}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px]">{warning.reason}</TableCell>
                        <TableCell>{warning.staff_name || 'System'}</TableCell>
                        <TableCell>{new Date(warning.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {warning.is_active ? (
                            <Badge variant="outline" className="text-yellow-600">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Expired</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bans Tab */}
        <TabsContent value="bans">
          <Card>
            <CardHeader>
              <CardTitle>Ban History</CardTitle>
              <CardDescription>All bans for this user</CardDescription>
            </CardHeader>
            <CardContent>
              {bans.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No bans on record</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Banned By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bans.map((ban) => (
                      <TableRow key={ban.id}>
                        <TableCell>
                          <Badge variant={ban.ban_type === 'permanent' ? 'destructive' : 'secondary'}>
                            {ban.ban_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[250px]">{ban.reason}</TableCell>
                        <TableCell>{ban.staff_name || 'System'}</TableCell>
                        <TableCell>{new Date(ban.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {ban.expires_at 
                            ? new Date(ban.expires_at).toLocaleDateString()
                            : 'Never'
                          }
                        </TableCell>
                        <TableCell>
                          {ban.is_active ? (
                            <Badge variant="destructive">Active</Badge>
                          ) : ban.unbanned_at ? (
                            <Badge variant="outline">Unbanned</Badge>
                          ) : (
                            <Badge variant="secondary">Expired</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Admin Messages</CardTitle>
              <CardDescription>Messages sent to this user by admins</CardDescription>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No messages sent</p>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{msg.subject}</h4>
                            <Badge variant="outline" className="text-xs">{msg.category}</Badge>
                            {!msg.is_read && (
                              <Badge variant="secondary" className="text-xs">Unread</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {msg.message}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(msg.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Sent by: {msg.staff_name || 'System'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Listings Tab */}
        <TabsContent value="listings">
          <Card>
            <CardHeader>
              <CardTitle>User Listings</CardTitle>
              <CardDescription>Properties listed by this user</CardDescription>
            </CardHeader>
            <CardContent>
              {listings.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No listings</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listings.map((listing) => (
                      <TableRow key={listing.id}>
                        <TableCell className="font-medium">{listing.title}</TableCell>
                        <TableCell>${listing.price_per_night}/night</TableCell>
                        <TableCell>
                          {listing.is_published ? (
                            <Badge className="bg-green-500">Published</Badge>
                          ) : (
                            <Badge variant="secondary">Draft</Badge>
                          )}
                        </TableCell>
                        <TableCell>{new Date(listing.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <WarningDialog
        open={warningDialogOpen}
        onOpenChange={setWarningDialogOpen}
        userId={user.id}
        userName={user.full_name || user.email}
        currentWarningLevel={activeWarnings.length}
        onSuccess={handleActionSuccess}
      />
      <BanDialog
        open={banDialogOpen}
        onOpenChange={setBanDialogOpen}
        userId={user.id}
        userName={user.full_name || user.email}
        warningCount={activeWarnings.length}
        onSuccess={handleActionSuccess}
      />
      <MessageComposer
        open={messageDialogOpen}
        onOpenChange={setMessageDialogOpen}
        userId={user.id}
        userName={user.full_name || user.email}
        onSuccess={handleActionSuccess}
      />
    </div>
  )
}
