'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  ArrowLeft, 
  MessageSquare, 
  Clock,
  User,
  Home,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Send,
  Lock
} from 'lucide-react'

interface DisputeDetailClientProps {
  dispute: {
    id: string
    booking_id: string
    dispute_type: string
    subject: string
    description: string
    status: string
    priority: string
    created_at: string
    updated_at: string
    resolution?: string
    resolution_notes?: string
    refund_amount?: number
    resolved_at?: string
    guest: {
      id: string
      full_name: string | null
      email: string
    } | null
    host: {
      id: string
      full_name: string | null
      email: string
    } | null
  }
  messages: Array<{
    id: string
    sender_id: string
    sender_type: string
    message: string
    is_internal: boolean
    created_at: string
  }>
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

export function DisputeDetailClient({ dispute, messages: initialMessages }: DisputeDetailClientProps) {
  const router = useRouter()
  const [messages, setMessages] = React.useState(initialMessages)
  const [newMessage, setNewMessage] = React.useState('')
  const [isInternal, setIsInternal] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  
  // Action dialog states
  const [actionDialogOpen, setActionDialogOpen] = React.useState(false)
  const [currentAction, setCurrentAction] = React.useState<string>('')
  const [refundAmount, setRefundAmount] = React.useState('')
  const [resolutionNotes, setResolutionNotes] = React.useState('')

  const isResolved = dispute.status === 'resolved' || dispute.status === 'closed'

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return
    setLoading(true)

    try {
      const res = await fetch(`/api/admin/disputes/${dispute.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: newMessage,
          is_internal: isInternal,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setMessages([...messages, data.message])
        setNewMessage('')
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setLoading(false)
    }
  }

  const openActionDialog = (action: string) => {
    setCurrentAction(action)
    setRefundAmount('')
    setResolutionNotes('')
    setActionDialogOpen(true)
  }

  const handleAction = async () => {
    setLoading(true)

    try {
      const res = await fetch(`/api/admin/disputes/${dispute.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: currentAction,
          refund_amount: refundAmount ? parseFloat(refundAmount) : undefined,
          resolution_notes: resolutionNotes,
        }),
      })

      if (res.ok) {
        setActionDialogOpen(false)
        window.location.reload()
      }
    } catch (error) {
      console.error('Error performing action:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Dispute Details</h1>
          <p className="text-muted-foreground">{dispute.subject}</p>
        </div>
        <div className="flex items-center gap-2">
          {getPriorityBadge(dispute.priority)}
          {getStatusBadge(dispute.status)}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Dispute Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
              <CardDescription>
                <Badge variant="outline" className="mr-2">{dispute.dispute_type}</Badge>
                Created {new Date(dispute.created_at).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{dispute.description}</p>
            </CardContent>
          </Card>

          {/* Resolution (if resolved) */}
          {isResolved && dispute.resolution && (
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Resolution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="font-medium">Outcome:</span>{' '}
                  <Badge variant="outline">{dispute.resolution}</Badge>
                </div>
                {dispute.refund_amount && (
                  <div>
                    <span className="font-medium">Refund Amount:</span>{' '}
                    ${dispute.refund_amount}
                  </div>
                )}
                {dispute.resolution_notes && (
                  <div>
                    <span className="font-medium">Notes:</span>{' '}
                    <p className="text-muted-foreground">{dispute.resolution_notes}</p>
                  </div>
                )}
                {dispute.resolved_at && (
                  <div className="text-sm text-muted-foreground">
                    Resolved on {new Date(dispute.resolved_at).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Message Thread */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Communication Thread
              </CardTitle>
              <CardDescription>{messages.length} message(s)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {messages.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">
                  No messages yet
                </p>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg ${
                        msg.sender_type === 'staff'
                          ? 'bg-blue-50 dark:bg-blue-950/20 ml-8'
                          : msg.sender_type === 'guest'
                          ? 'bg-gray-100 dark:bg-gray-800 mr-8'
                          : 'bg-purple-50 dark:bg-purple-950/20 mr-8'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {msg.sender_type === 'staff' ? 'Staff' : msg.sender_type === 'guest' ? 'Guest' : 'Host'}
                          {msg.is_internal && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              <Lock className="h-3 w-3 mr-1" />
                              Internal
                            </Badge>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply Form */}
              {!isResolved && (
                <div className="border-t pt-4 space-y-3">
                  <Textarea
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={3}
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="rounded"
                      />
                      <Lock className="h-3 w-3" />
                      Internal note (not visible to user)
                    </label>
                    <Button onClick={handleSendMessage} disabled={loading || !newMessage.trim()}>
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Parties Involved */}
          <Card>
            <CardHeader>
              <CardTitle>Parties Involved</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Guest</p>
                  <p className="text-sm">{dispute.guest?.full_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{dispute.guest?.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Host</p>
                  <p className="text-sm">{dispute.host?.full_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{dispute.host?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          {!isResolved && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dispute.status === 'open' && (
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => openActionDialog('start_investigation')}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Start Investigation
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => openActionDialog('request_guest_info')}
                >
                  <User className="h-4 w-4 mr-2" />
                  Request Info from Guest
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => openActionDialog('request_host_info')}
                >
                  <Home className="h-4 w-4 mr-2" />
                  Request Info from Host
                </Button>
                <div className="border-t my-2" />
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-green-600"
                  onClick={() => openActionDialog('approve_refund')}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Refund
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-red-600"
                  onClick={() => openActionDialog('reject_refund')}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Refund
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => openActionDialog('close')}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Close Dispute
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Created: {new Date(dispute.created_at).toLocaleDateString()}</span>
                </div>
                {dispute.updated_at !== dispute.created_at && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span>Updated: {new Date(dispute.updated_at).toLocaleDateString()}</span>
                  </div>
                )}
                {dispute.resolved_at && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Resolved: {new Date(dispute.resolved_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentAction === 'approve_refund' && 'Approve Refund'}
              {currentAction === 'reject_refund' && 'Reject Refund'}
              {currentAction === 'close' && 'Close Dispute'}
              {currentAction === 'start_investigation' && 'Start Investigation'}
              {currentAction === 'request_guest_info' && 'Request Guest Information'}
              {currentAction === 'request_host_info' && 'Request Host Information'}
            </DialogTitle>
            <DialogDescription>
              This action will update the dispute status and notify the involved parties.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {currentAction === 'approve_refund' && (
              <div className="space-y-2">
                <Label htmlFor="refund">Refund Amount ($)</Label>
                <Input
                  id="refund"
                  type="number"
                  placeholder="0.00"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Resolution Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this action..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAction} 
              disabled={loading || (currentAction === 'approve_refund' && !refundAmount)}
            >
              {loading ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
