import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Home, 
  Users, 
  CalendarCheck, 
  AlertCircle,
} from 'lucide-react'

async function getStats() {
  const supabase = await createClient()
  if (!supabase) return null

  // Get listing count
  const { count: listingsCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })

  // Get users count
  const { count: usersCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  // Get bookings count (this month)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count: bookingsCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonth.toISOString())

  // Get pending approvals count
  const { count: pendingAttributesCount } = await supabase
    .from('attributes')
    .select('*', { count: 'exact', head: true })
    .eq('is_approved', false)

  return {
    listings: listingsCount || 0,
    users: usersCount || 0,
    bookingsThisMonth: bookingsCount || 0,
    pendingApprovals: pendingAttributesCount || 0,
  }
}

export default async function AdminOverviewPage() {
  const stats = await getStats()

  if (!stats) {
    return <div>Error loading stats</div>
  }

  const cards = [
    {
      title: 'Total Listings',
      value: stats.listings,
      icon: Home,
      description: 'Active listings on the platform',
    },
    {
      title: 'Total Users',
      value: stats.users,
      icon: Users,
      description: 'Registered users',
    },
    {
      title: 'Bookings This Month',
      value: stats.bookingsThisMonth,
      icon: CalendarCheck,
      description: 'New bookings in current month',
    },
    {
      title: 'Pending Approvals',
      value: stats.pendingApprovals,
      icon: AlertCircle,
      description: 'Items awaiting review',
      highlight: stats.pendingApprovals > 0,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground">
          Welcome to the admin dashboard. Here&apos;s what&apos;s happening on your platform.
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
              <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
