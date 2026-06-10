import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, CheckCircle, XCircle, ShieldCheck } from 'lucide-react'
import { VerificationsTable } from './verifications-table'
import { PendingVerification } from './columns'

async function getPendingVerifications(): Promise<PendingVerification[]> {
  const supabase = await createClient()
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        phone,
        id_front_url,
        id_back_url,
        selfie_url,
        verification_submitted_at,
        verification_notes,
        verification_status:verification_statuses(id, code, label)
      `)
      .not('verification_submitted_at', 'is', null)
      .order('verification_submitted_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching verifications:', error)
      return []
    }

    return (data as unknown as PendingVerification[]) || []
  } catch {
    return []
  }
}

async function getVerificationStats() {
  const supabase = await createClient()
  if (!supabase) return { pending: 0, verified: 0, rejected: 0 }

  try {
    const { data } = await supabase
      .from('profiles')
      .select(`
        verification_status:verification_statuses(code)
      `)
      .not('verification_submitted_at', 'is', null)

    if (!data) return { pending: 0, verified: 0, rejected: 0 }

    return {
      pending: data.filter((p: any) => p.verification_status?.code === 'pending').length,
      verified: data.filter((p: any) => p.verification_status?.code === 'verified').length,
      rejected: data.filter((p: any) => p.verification_status?.code === 'rejected').length,
    }
  } catch {
    return { pending: 0, verified: 0, rejected: 0 }
  }
}

export default async function VerificationsPage() {
  const [verifications, stats] = await Promise.all([
    getPendingVerifications(),
    getVerificationStats(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Identity Verification</h1>
        <p className="text-muted-foreground">
          Review and approve user identity documents.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className={stats.pending > 0 ? 'border-yellow-500' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.verified}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      <VerificationsTable verifications={verifications} />
    </div>
  )
}
