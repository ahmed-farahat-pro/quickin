import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, User, Shield, Settings } from 'lucide-react'

export const dynamic = 'force-dynamic'
import { AuditTable } from './audit-table'
import { AuditLog } from './columns'

async function getAuditLogs(): Promise<AuditLog[]> {
  const supabase = await createClient()
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching audit logs:', error)
      return []
    }

    return (data as AuditLog[]) || []
  } catch {
    return []
  }
}

async function getAuditStats() {
  const supabase = await createClient()
  if (!supabase) return { total: 0, today: 0, byCategory: {} as Record<string, number> }

  try {
    const { data } = await supabase
      .from('audit_logs')
      .select('action_category, created_at')

    if (!data) return { total: 0, today: 0, byCategory: {} as Record<string, number> }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const byCategory: Record<string, number> = {}
    data.forEach(log => {
      const cat = log.action_category || 'other'
      byCategory[cat] = (byCategory[cat] || 0) + 1
    })

    return {
      total: data.length,
      today: data.filter(log => new Date(log.created_at) >= today).length,
      byCategory,
    }
  } catch {
    return { total: 0, today: 0, byCategory: {} as Record<string, number> }
  }
}

export default async function AuditPage() {
  const [logs, stats] = await Promise.all([getAuditLogs(), getAuditStats()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">
          View all admin and staff actions on the platform.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Actions</CardTitle>
            <User className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byCategory.user || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff Actions</CardTitle>
            <Shield className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byCategory.staff || 0}</div>
          </CardContent>
        </Card>
      </div>

      <AuditTable logs={logs} />
    </div>
  )
}
