export type AdminBooking = {
  id: string
  listing_id: string
  user_id: string
  check_in: string
  check_out: string
  guests: number
  subtotal: number
  best_offer_subtotal: number | null
  status:
    | 'pending'
    | 'confirmed'
    | 'active'
    | 'cancelled'
    | 'completed'
    | 'rejected'
    | 'stalled'
  escrow_status: string | null
  is_check_in_confirmed: boolean
  receipt_url: string | null
  created_at: string
  updated_at: string
  guest: { full_name: string | null; email: string } | null
  listing: { title: string; host: { full_name: string | null } | null } | null
  booking_messages: { count: number }[] | null
}

export type BookingGroup = 'upcoming' | 'active' | 'history'

export const STATUS_COLORS: Record<AdminBooking['status'], string> = {
  pending: 'bg-yellow-500',
  stalled: 'bg-yellow-500',
  confirmed: 'bg-blue-500',
  active: 'bg-green-500',
  completed: 'bg-gray-500',
  cancelled: 'bg-red-500',
  rejected: 'bg-red-500',
}

export function getBookingGroup(status: AdminBooking['status']): BookingGroup {
  if (status === 'active') return 'active'
  if (status === 'completed' || status === 'cancelled' || status === 'rejected')
    return 'history'
  return 'upcoming'
}

const currencyFormatter = new Intl.NumberFormat('en-EG', {
  style: 'currency',
  currency: 'EGP',
  minimumFractionDigits: 0,
})

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}
