import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, Clock, CheckCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'
import { PayoutsTable } from './payouts-table'
import { Payout } from './columns'
import { ReleaseActions } from './release-actions'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

async function getPayouts(): Promise<Payout[]>
{
  const supabase = await createAdminClient()
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('payouts')
      .select(`
        id,
        host_id,
        status,
        payout_method,
        payment_method_details,
        created_at,
        host:profiles!payouts_host_id_fkey(full_name, email),
        transactions(amount)
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching payouts:', error)
      return []
    }

    // Compute amount from linked transactions (withdrawal = negative, so use abs)
    const payoutsWithAmount = (data || []).map((p: any) =>
    {
      const txAmounts = (p.transactions || []) as { amount: number }[]
      const computed = txAmounts.reduce((sum: number, tx: { amount: number }) => sum + tx.amount, 0)
      return {
        id: p.id,
        host_id: p.host_id,
        computed_amount: computed !== 0 ? Math.abs(computed) : null,
        status: p.status,
        payout_method: p.payout_method,
        payment_method_details: p.payment_method_details,
        created_at: p.created_at,
        host: p.host,
      }
    })

    return payoutsWithAmount as Payout[]
  } catch {
    return []
  }
}

async function getHeldEscrows()
{
  const supabase = await createAdminClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      subtotal,
      escrow_status,
      status,
      check_in,
      check_out,
      is_check_in_confirmed,
      guest:profiles!bookings_user_id_fkey(full_name),
      listing:listings(user_id, title, host:profiles!listings_user_id_fkey(full_name))
    `)
    .eq('escrow_status', 'held')
    .in('status', ['confirmed', 'active', 'completed'])
    .order('check_in', { ascending: true })

  if (error) {
    console.error('Error fetching held escrows:', error)
    return []
  }

  // Compute fees for each booking via RPC
  const escrowsWithFees = await Promise.all(
    (data || []).map(async (booking) =>
    {
      const { data: fees } = await supabase.rpc('calc_booking_fees', { p_booking_id: booking.id }).single() as { data: { total_with_fees: number; host_payout: number } | null }
      return {
        ...booking,
        total_with_fees: fees?.total_with_fees ?? booking.subtotal,
        host_payout: fees?.host_payout ?? booking.subtotal,
      }
    })
  )

  return escrowsWithFees
}

async function getPayoutStats()
{
  const supabase = await createAdminClient()
  if (!supabase) return { pending: 0, processing: 0, completed: 0 }

  try {
    const { data: payouts } = await supabase
      .from('payouts')
      .select('status, transactions(amount)')

    if (!payouts) return { pending: 0, processing: 0, completed: 0 }

    const getTotal = (items: typeof payouts) =>
      items.reduce((sum, p) =>
      {
        const txAmounts = ((p as any).transactions || []) as { amount: number }[]
        const txTotal = txAmounts.reduce((s: number, tx: { amount: number }) => s + tx.amount, 0)
        return sum + Math.abs(txTotal)
      }, 0)

    return {
      pending: getTotal(payouts.filter(p => p.status === 'pending')),
      processing: getTotal(payouts.filter(p => p.status === 'processing')),
      completed: getTotal(payouts.filter(p => p.status === 'completed')),
    }
  } catch {
    return { pending: 0, processing: 0, completed: 0 }
  }
}

function formatCurrency(amount: number)
{
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
  }).format(amount)
}

export default async function PayoutsPage()
{
  const [payouts, stats, escrows] = await Promise.all([
    getPayouts(),
    getPayoutStats(),
    getHeldEscrows()
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground">
          Manage host payouts and payment processing.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.pending)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Wallet className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.processing)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.completed)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Escrow Releases</CardTitle>
          <p className="text-sm text-muted-foreground">Bookings with held funds that need to be released to the host's balance after check-in is confirmed.</p>
        </CardHeader>
        <CardContent>
          {escrows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No held escrows found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Listing</TableHead>
                  <TableHead>Booking Total</TableHead>
                  <TableHead>Host Payout</TableHead>
                  <TableHead>Guest Check-In</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {escrows.map((booking: any) => (
                  <TableRow key={booking.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(booking.check_in).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {Array.isArray(booking.listing)
                          ? booking.listing[0]?.host?.full_name
                          : booking.listing?.host?.full_name || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {Array.isArray(booking.listing) ? booking.listing[0]?.title : booking.listing?.title}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(booking.total_with_fees)}
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      {formatCurrency(booking.host_payout)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={booking.is_check_in_confirmed ? 'default' : 'secondary'} className={booking.is_check_in_confirmed ? 'bg-green-500' : ''}>
                        {booking.is_check_in_confirmed ? 'Confirmed' : 'Pending Guest'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {booking.is_check_in_confirmed ? (
                        <ReleaseActions bookingId={booking.id} />
                      ) : (
                        <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Waiting for guest
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Host Withdrawal Requests</CardTitle>
          <p className="text-sm text-muted-foreground">Traditional host payout requests (withdrawals) to external bank accounts.</p>
        </CardHeader>
        <CardContent>
          <PayoutsTable payouts={payouts} />
        </CardContent>
      </Card>
    </div>
  )
}
