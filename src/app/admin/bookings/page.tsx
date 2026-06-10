import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarCheck, Clock, Activity, DollarSign } from 'lucide-react'
import { BookingsDashboard } from './bookings-dashboard'
import { AdminBooking } from './types'

async function getBookings(): Promise<AdminBooking[]> {
  const supabase = await createAdminClient()
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, listing_id, user_id, check_in, check_out, guests, subtotal,
        best_offer_subtotal, status, escrow_status, is_check_in_confirmed,
        receipt_url, created_at, updated_at,
        guest:profiles!bookings_user_id_fkey(full_name, email),
        listing:listings(title, host:profiles!listings_user_id_fkey(full_name)),
        booking_messages(count)
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('Error fetching bookings:', error)
      return []
    }

    return (data || []) as unknown as AdminBooking[]
  } catch {
    return []
  }
}

async function getKPIs() {
  const supabase = await createAdminClient()
  if (!supabase) return { total: 0, upcoming: 0, active: 0, revenueThisMonth: 0 }

  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('status, subtotal, created_at')

    if (error || !data) {
      console.error('Error fetching booking KPIs:', error)
      return { total: 0, upcoming: 0, active: 0, revenueThisMonth: 0 }
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const total = data.length
    const upcoming = data.filter(
      (b) => b.status === 'pending' || b.status === 'confirmed' || b.status === 'stalled'
    ).length
    const active = data.filter((b) => b.status === 'active').length
    const revenueThisMonth = data
      .filter(
        (b) =>
          (b.status === 'confirmed' || b.status === 'active' || b.status === 'completed') &&
          b.created_at >= monthStart
      )
      .reduce((sum, b) => sum + (b.subtotal || 0), 0)

    return { total, upcoming, active, revenueThisMonth }
  } catch {
    return { total: 0, upcoming: 0, active: 0, revenueThisMonth: 0 }
  }
}

const currencyFormat = new Intl.NumberFormat('en-EG', {
  style: 'currency',
  currency: 'EGP',
  minimumFractionDigits: 0,
})

export default async function AdminBookingsPage() {
  const [bookings, kpis] = await Promise.all([getBookings(), getKPIs()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
        <p className="text-muted-foreground">
          Manage all platform bookings across their lifecycle.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.upcoming}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue This Month</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currencyFormat.format(kpis.revenueThisMonth)}
            </div>
          </CardContent>
        </Card>
      </div>

      <BookingsDashboard bookings={bookings} />
    </div>
  )
}
