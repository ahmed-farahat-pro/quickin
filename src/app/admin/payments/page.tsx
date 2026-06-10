import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, CheckCircle, XCircle } from 'lucide-react'
import { PaymentsTable } from './payments-table'

import { BookingWithReceipt } from './columns'

async function getPaymentVerifications(): Promise<BookingWithReceipt[]>
{
  const supabase = await createAdminClient()
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        reservation_code,
        status,
        subtotal,
        paid_amount,
        best_offer_subtotal,
        escrow_status,
        receipt_url,
        created_at,
        guest:profiles!bookings_user_id_fkey(id, full_name, email),
        listing:listings(id, title),
        commission_rates:commission_rates(guest_rate)
      `)
      .not('receipt_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching bookings with receipts:', error)
      return []
    }

    // Compute total_with_fees from subtotal + guest fee for display
    const transformed = (data || []).map((b: any) =>
    {
      const rates = Array.isArray(b.commission_rates) ? b.commission_rates[0] : b.commission_rates
      const guestRate = rates?.guest_rate ?? 0.02
      const guestFee = Math.round((b.subtotal || 0) * guestRate)
      return {
        id: b.id,
        reservation_code: b.reservation_code,
        status: b.status,
        subtotal: b.subtotal,
        paid_amount: b.paid_amount,
        best_offer_subtotal: b.best_offer_subtotal,
        escrow_status: b.escrow_status,
        total_with_fees: (b.subtotal || 0) + guestFee,
        receipt_url: b.receipt_url,
        created_at: b.created_at,
        guest: b.guest,
        listing: b.listing,
      }
    })

    return transformed as BookingWithReceipt[]
  } catch {
    return []
  }
}

async function getVerificationStats()
{
  const supabase = await createAdminClient()
  if (!supabase) return { pending: 0, approved: 0, rejected: 0 }

  try {
    const { data } = await supabase
      .from('bookings')
      .select('status')
      .not('receipt_url', 'is', null)

    if (!data) return { pending: 0, approved: 0, rejected: 0 }

    return {
      pending: data.filter(p => p.status === 'pending').length,
      approved: data.filter(p => p.status === 'confirmed').length,
      rejected: data.filter(p => p.status === 'cancelled').length,
    }
  } catch {
    return { pending: 0, approved: 0, rejected: 0 }
  }
}

export default async function PaymentsPage()
{
  const [verifications, stats] = await Promise.all([
    getPaymentVerifications(),
    getVerificationStats(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payment Verification</h1>
        <p className="text-muted-foreground">
          Verify manual payments (Vodafone Cash, InstaPay) from guests.
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
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
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

      <PaymentsTable verifications={verifications} />
    </div>
  )
}
