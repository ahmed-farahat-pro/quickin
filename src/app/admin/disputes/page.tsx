import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react'
import { DisputesTable } from './disputes-table'
import { Dispute } from './columns'

async function getDisputes(): Promise<Dispute[]> {
  const supabase = await createClient()
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('disputes')
      .select(`
        id,
        booking_id,
        guest_id,
        host_id,
        dispute_type,
        subject,
        status,
        priority,
        created_at,
        guest:profiles!disputes_guest_id_fkey(full_name, email),
        host:profiles!disputes_host_id_fkey(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching disputes:', error)
      return []
    }

    return (data as unknown as Dispute[]) || []
  } catch {
    return []
  }
}

async function getDisputeStats() {
  const supabase = await createClient()
  if (!supabase) return { open: 0, inProgress: 0, resolved: 0, urgent: 0 }

  try {
    const { data } = await supabase
      .from('disputes')
      .select('status, priority')

    if (!data) return { open: 0, inProgress: 0, resolved: 0, urgent: 0 }

    return {
      open: data.filter(d => d.status === 'open').length,
      inProgress: data.filter(d => d.status === 'in_progress').length,
      resolved: data.filter(d => d.status === 'resolved' || d.status === 'closed').length,
      urgent: data.filter(d => d.priority === 'urgent' && d.status !== 'resolved' && d.status !== 'closed').length,
    }
  } catch {
    return { open: 0, inProgress: 0, resolved: 0, urgent: 0 }
  }
}

export default async function DisputesPage() {
  const [disputes, stats] = await Promise.all([getDisputes(), getDisputeStats()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Disputes</h1>
        <p className="text-muted-foreground">
          Handle cancellations, refunds, and user complaints.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className={stats.urgent > 0 ? 'border-red-500' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.urgent}</div>
          </CardContent>
        </Card>
        <Card className={stats.open > 0 ? 'border-yellow-500' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <XCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolved}</div>
          </CardContent>
        </Card>
      </div>

      <DisputesTable disputes={disputes} />
    </div>
  )
}
