import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import
{
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'

function computeBookingFees(
  subtotal: number,
  bestOfferSubtotal: number,
  rates: { host_rate: number; guest_rate: number; best_offer_rate?: number } | null
) {
  const hostRate = rates?.host_rate ?? 0.10
  const guestRate = rates?.guest_rate ?? 0.02
  const bestOfferRate = rates?.best_offer_rate ?? 0
  const guestFee = Math.round(subtotal * guestRate)
  const hostFee = Math.round(subtotal * hostRate)
  const totalWithFees = subtotal + guestFee
  const promoFee = Math.round((bestOfferSubtotal || 0) * bestOfferRate)
  const platformEarnings = guestFee + hostFee + promoFee
  return { totalWithFees, platformEarnings }
}

async function getFinancialStats()
{
  const supabase = await createClient()
  if (!supabase) return null

  // Get all bookings with subtotal and commission rates
  const { data: bookings } = await supabase
    .from('bookings')
    .select('subtotal, best_offer_subtotal, status, created_at, escrow_status, commission_rates:commission_rates(host_rate, guest_rate, best_offer_rate)')

  if (!bookings) {
    return {
      totalRevenue: 0,
      pendingPayouts: 0,
      completedPayouts: 0,
      heldFunds: 0,
      bookingsThisMonth: 0,
      revenueThisMonth: 0,
    }
  }

  // Calculate totals using computed fees
  const validBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed' || b.status === 'active')
  const totalRevenue = validBookings.reduce((sum, b) => {
    const rates = Array.isArray(b.commission_rates) ? b.commission_rates[0] : b.commission_rates
    return sum + computeBookingFees(b.subtotal || 0, b.best_offer_subtotal || 0, rates).totalWithFees
  }, 0)

  const platformCommission = validBookings.reduce((sum, b) => {
    const rates = Array.isArray(b.commission_rates) ? b.commission_rates[0] : b.commission_rates
    return sum + computeBookingFees(b.subtotal || 0, b.best_offer_subtotal || 0, rates).platformEarnings
  }, 0)

  // Get this month's stats
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const thisMonthBookings = bookings.filter(
    b => new Date(b.created_at) >= startOfMonth
  )
  const bookingsThisMonth = thisMonthBookings.length
  const validBookingsThisMonth = thisMonthBookings.filter(b => b.status === 'confirmed' || b.status === 'completed' || b.status === 'active')
  const revenueThisMonth = validBookingsThisMonth.reduce((sum, b) => {
    const rates = Array.isArray(b.commission_rates) ? b.commission_rates[0] : b.commission_rates
    return sum + computeBookingFees(b.subtotal || 0, b.best_offer_subtotal || 0, rates).totalWithFees
  }, 0)
  const commissionThisMonth = validBookingsThisMonth.reduce((sum, b) => {
    const rates = Array.isArray(b.commission_rates) ? b.commission_rates[0] : b.commission_rates
    return sum + computeBookingFees(b.subtotal || 0, b.best_offer_subtotal || 0, rates).platformEarnings
  }, 0)

  // Held funds = escrow_status == 'held'
  const heldFunds = bookings
    .filter(b => b.escrow_status === 'held')
    .reduce((sum, b) => {
      const rates = Array.isArray(b.commission_rates) ? b.commission_rates[0] : b.commission_rates
      return sum + computeBookingFees(b.subtotal || 0, b.best_offer_subtotal || 0, rates).totalWithFees
    }, 0)

  // Check payouts table — compute amounts from linked transactions
  let pendingPayouts = 0
  let completedPayouts = 0
  try {
    const { data: payouts } = await supabase
      .from('payouts')
      .select('status, transactions(amount)')

    if (payouts) {
      const getTotal = (items: typeof payouts) =>
        items.reduce((sum, p) => {
          const txAmounts = ((p as any).transactions || []) as { amount: number }[]
          const txTotal = txAmounts.reduce((s: number, tx: { amount: number }) => s + tx.amount, 0)
          return sum + Math.abs(txTotal)
        }, 0)

      pendingPayouts = getTotal(payouts.filter(p => p.status === 'pending' || p.status === 'processing'))
      completedPayouts = getTotal(payouts.filter(p => p.status === 'completed'))
    }
  } catch {
    // Payouts table might not exist yet
  }

  return {
    totalRevenue,
    platformCommission,
    pendingPayouts,
    completedPayouts,
    heldFunds,
    bookingsThisMonth,
    revenueThisMonth,
    commissionThisMonth,
  }
}

function formatCurrency(amount: number)
{
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default async function FinancialsPage()
{
  const stats = await getFinancialStats()

  if (!stats) {
    return <div>Error loading financial data</div>
  }

  const cards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      description: 'All confirmed bookings',
      icon: DollarSign,
    },
    {
      title: 'Held Funds',
      value: formatCurrency(stats.heldFunds),
      description: 'Awaiting guest check-in',
      icon: Clock,
      highlight: stats.heldFunds > 0,
    },
    {
      title: 'Completed Payouts',
      value: formatCurrency(stats.completedPayouts),
      description: 'Paid to hosts',
      icon: CheckCircle,
    },
    {
      title: 'Pending Payouts',
      value: formatCurrency(stats.pendingPayouts),
      description: 'Awaiting processing',
      icon: AlertCircle,
      highlight: stats.pendingPayouts > 0,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financial Overview</h1>
        <p className="text-muted-foreground">
          Platform revenue, payouts, and financial metrics.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className={card.highlight ? 'border-orange-500' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.highlight ? 'text-orange-500' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>This Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bookings</span>
              <span className="font-medium">{stats.bookingsThisMonth}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Revenue</span>
              <span className="font-medium">{formatCurrency(stats.revenueThisMonth)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform Commission</span>
              <span className="font-medium text-green-600">{formatCurrency(stats.commissionThisMonth || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Commission Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Gross Revenue</span>
              <span className="font-medium">{formatCurrency(stats.totalRevenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform Commission</span>
              <span className="font-medium text-green-600">{formatCurrency(stats.platformCommission || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Host Earnings</span>
              <span className="font-medium">{formatCurrency(stats.totalRevenue - (stats.platformCommission || 0))}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
