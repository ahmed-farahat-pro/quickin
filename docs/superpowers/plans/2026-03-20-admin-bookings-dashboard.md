# Admin Bookings Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-view admin bookings management page with Table, Board (grouped list), and Timeline (Gantt) views, a booking detail slide-over sheet, and admin actions (edit, cancel, force-complete, force-checkin, delete).

**Architecture:** Server component fetches all bookings with joins, passes data to a client dashboard component that handles tab switching between 3 views. Clicking any booking opens a right-side Sheet with details and contextual actions. All admin mutations are server actions with mandatory reason, audit logging, and notifications.

**Tech Stack:** Next.js 16 App Router, Supabase (admin client), shadcn/ui (Tabs, Sheet, DataTable, Badge, Card, Collapsible, AlertDialog, Dialog), TanStack React Table, Sonner toasts, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-03-19-admin-bookings-dashboard-design.md`

---

## Chunk 1: Foundation — Migration, Types, Sidebar, Server Actions

### Task 1: Database Migration — Extend `check_listing_availability` RPC

**Files:**
- Create: `supabase/migrations/20260320100000_availability_exclude_booking.sql`

- [ ] **Step 1: Write the migration SQL**

Create migration file that replaces the existing function with an added optional `p_exclude_booking_id` parameter:

```sql
-- Extend check_listing_availability to accept an optional booking ID to exclude.
-- Required for the admin edit-booking flow so the current booking's own dates
-- don't conflict with itself during re-validation.

CREATE OR REPLACE FUNCTION check_listing_availability(
  p_listing_id uuid,
  p_check_in date,
  p_check_out date,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS TABLE (has_conflict boolean, conflict_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Check for host-blocked dates in [check_in, check_out)
  IF EXISTS (
    SELECT 1
    FROM listing_availability la
    WHERE la.listing_id = p_listing_id
      AND la.is_available = false
      AND la.date >= p_check_in
      AND la.date < p_check_out
  ) THEN
    RETURN QUERY SELECT true, 'Selected dates include unavailable dates'::text;
    RETURN;
  END IF;

  -- 2. Check for overlapping confirmed/active/pending bookings, excluding the given booking
  IF EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.listing_id = p_listing_id
      AND b.status IN ('confirmed', 'active', 'pending')
      AND b.check_in < p_check_out
      AND b.check_out > p_check_in
      AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
  ) THEN
    RETURN QUERY SELECT true, 'Selected dates overlap with an existing booking'::text;
    RETURN;
  END IF;

  -- No conflicts
  RETURN QUERY SELECT false, NULL::text;
END;
$$;

-- Re-grant permissions (overload with 4 params needs its own grant)
GRANT EXECUTE ON FUNCTION check_listing_availability(uuid, date, date, uuid) TO anon, authenticated, service_role;
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` tool with name `availability_exclude_booking` and the SQL above. Verify it succeeds.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260320100000_availability_exclude_booking.sql
git commit -m "feat(db): extend check_listing_availability with exclude booking param"
```

---

### Task 2: Booking Types and Shared Utilities

**Files:**
- Create: `src/app/admin/bookings/types.ts`

- [ ] **Step 1: Create the shared booking types file**

This type is used by all views, the detail sheet, and actions. It mirrors the Supabase query shape from `page.tsx`.

```typescript
export type AdminBooking = {
  id: string
  listing_id: string
  user_id: string
  check_in: string
  check_out: string
  guests: number
  subtotal: number
  best_offer_subtotal: number | null
  status: 'pending' | 'confirmed' | 'active' | 'cancelled' | 'completed' | 'rejected' | 'stalled'
  escrow_status: string | null
  is_check_in_confirmed: boolean
  receipt_url: string | null
  created_at: string
  updated_at: string
  guest: { full_name: string | null; email: string } | null
  listing: { title: string; host: { full_name: string | null } | null } | null
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
  if (status === 'completed' || status === 'cancelled' || status === 'rejected') return 'history'
  return 'upcoming' // pending, confirmed, stalled
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
  }).format(amount)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/bookings/types.ts
git commit -m "feat(admin/bookings): add shared types and utilities"
```

---

### Task 3: Add Bookings to Admin Sidebar

**Files:**
- Modify: `src/app/admin/admin-sidebar.tsx`

- [ ] **Step 1: Add CalendarCheck import**

In the Lucide import block at the top of the file (line ~7), add `CalendarCheck` to the import list.

- [ ] **Step 2: Add Bookings nav item to supportNavItems**

Insert a new entry at the beginning of the `supportNavItems` array (before Approvals, around line 139):

```typescript
{
  title: 'Bookings',
  href: '/admin/bookings',
  icon: CalendarCheck,
},
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/admin-sidebar.tsx
git commit -m "feat(admin): add Bookings to admin sidebar"
```

---

### Task 4: Server Actions

**Files:**
- Create: `src/app/admin/bookings/actions.ts`

- [ ] **Step 1: Create the server actions file**

All 5 admin actions in one file. Each action: validates status guards, performs the operation, sends notifications to host + guest, creates audit log, revalidates paths. Follow the pattern from `src/app/admin/payments/actions.ts`.

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendFCMNotification } from '@/lib/actions/notifications'
import { refundEscrow, systemReleaseEscrow } from '@/lib/actions/escrow'

// Helper: send notification to a user (DB + FCM)
async function notifyUser(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  type: string,
  title: string,
  message: string,
  bookingId: string
) {
  if (!adminClient || !userId) return
  await adminClient.from('user_notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    related_entity_id: bookingId,
    related_entity_type: 'booking',
  })
  const { data: profile } = await adminClient
    .from('profiles')
    .select('fcm_token')
    .eq('id', userId)
    .single()
  if (profile?.fcm_token) {
    sendFCMNotification([profile.fcm_token], title, message, {
      type,
      bookingId,
    }).catch(console.error)
  }
}

// Helper: get host ID from booking's listing
function extractHostId(listing: unknown): string | null {
  const data = listing as { user_id?: string } | { user_id?: string }[] | null
  if (!data) return null
  return Array.isArray(data) ? data[0]?.user_id ?? null : data.user_id ?? null
}

export async function adminCancelBooking(bookingId: string, reason: string) {
  if (!reason.trim()) return { error: 'Reason is required' }
  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  try {
    const { data: booking, error: fetchErr } = await adminClient
      .from('bookings')
      .select('id, status, escrow_status, user_id, listing:listings(user_id, title)')
      .eq('id', bookingId)
      .single()

    if (fetchErr || !booking) return { error: 'Booking not found' }
    if (!['pending', 'stalled', 'confirmed'].includes(booking.status)) {
      return { error: `Cannot cancel a booking with status "${booking.status}"` }
    }

    // For confirmed bookings with held escrow, trigger full refund
    if (booking.status === 'confirmed' && booking.escrow_status === 'held') {
      const result = await refundEscrow(bookingId, 0, reason, 'full')
      if (result.error) return { error: `Refund failed: ${result.error}` }
    } else {
      // Just update status for pending/stalled
      await adminClient.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId)
    }

    // Audit log
    await adminClient.rpc('create_audit_log', {
      p_action: 'admin.booking.cancel',
      p_entity_type: 'booking',
      p_entity_id: bookingId,
      p_entity_name: 'Admin cancelled booking',
      p_new_data: { reason, previous_status: booking.status },
    })

    // Notify guest
    const listingData = booking.listing as any
    const listingTitle = Array.isArray(listingData) ? listingData[0]?.title : listingData?.title
    await notifyUser(
      adminClient, booking.user_id,
      'booking_cancelled',
      'Booking Cancelled',
      `Your booking for ${listingTitle || 'a listing'} has been cancelled by an admin. Reason: ${reason}`,
      bookingId
    )

    // Notify host
    const hostId = extractHostId(booking.listing)
    if (hostId) {
      await notifyUser(
        adminClient, hostId,
        'booking_cancelled',
        'Booking Cancelled',
        `A booking for ${listingTitle || 'your listing'} has been cancelled by an admin. Reason: ${reason}`,
        bookingId
      )
    }

    revalidatePath('/admin/bookings')
    revalidatePath('/admin/payments')
    revalidatePath('/admin/payouts')
    revalidatePath('/dashboard/trips')
    return { success: true }
  } catch (err) {
    console.error('adminCancelBooking error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

export async function adminForceComplete(bookingId: string, reason: string) {
  if (!reason.trim()) return { error: 'Reason is required' }
  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  try {
    const { data: booking, error: fetchErr } = await adminClient
      .from('bookings')
      .select('id, status, escrow_status, user_id, listing:listings(user_id, title)')
      .eq('id', bookingId)
      .single()

    if (fetchErr || !booking) return { error: 'Booking not found' }
    if (booking.status !== 'active') {
      return { error: `Cannot force-complete a booking with status "${booking.status}"` }
    }

    // Use systemReleaseEscrow (bypasses is_check_in_confirmed guard)
    if (booking.escrow_status === 'held') {
      const result = await systemReleaseEscrow(bookingId)
      if (result.error) return { error: `Escrow release failed: ${result.error}` }
    }

    await adminClient.from('bookings').update({ status: 'completed' }).eq('id', bookingId)

    await adminClient.rpc('create_audit_log', {
      p_action: 'admin.booking.force_complete',
      p_entity_type: 'booking',
      p_entity_id: bookingId,
      p_entity_name: 'Admin force-completed booking',
      p_new_data: { reason },
    })

    revalidatePath('/admin/bookings')
    revalidatePath('/admin/payouts')
    return { success: true }
  } catch (err) {
    console.error('adminForceComplete error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

export async function adminForceCheckin(bookingId: string, reason: string) {
  if (!reason.trim()) return { error: 'Reason is required' }
  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  try {
    const { data: booking, error: fetchErr } = await adminClient
      .from('bookings')
      .select('id, status, user_id, listing:listings(user_id, title)')
      .eq('id', bookingId)
      .single()

    if (fetchErr || !booking) return { error: 'Booking not found' }
    if (booking.status !== 'confirmed') {
      return { error: `Cannot force check-in a booking with status "${booking.status}"` }
    }

    await adminClient
      .from('bookings')
      .update({ status: 'active', is_check_in_confirmed: true })
      .eq('id', bookingId)

    await adminClient.rpc('create_audit_log', {
      p_action: 'admin.booking.force_checkin',
      p_entity_type: 'booking',
      p_entity_id: bookingId,
      p_entity_name: 'Admin force-checked-in booking',
      p_new_data: { reason },
    })

    const listingData = booking.listing as any
    const listingTitle = Array.isArray(listingData) ? listingData[0]?.title : listingData?.title

    // Notify guest
    await notifyUser(
      adminClient, booking.user_id,
      'booking_checkin',
      'Check-in Confirmed',
      `Your check-in for ${listingTitle || 'a listing'} has been confirmed by an admin. Reason: ${reason}`,
      bookingId
    )

    // Notify host
    const hostId = extractHostId(booking.listing)
    if (hostId) {
      await notifyUser(
        adminClient, hostId,
        'booking_checkin',
        'Guest Checked In',
        `The guest for ${listingTitle || 'your listing'} has been checked in by an admin. Reason: ${reason}`,
        bookingId
      )
    }

    revalidatePath('/admin/bookings')
    return { success: true }
  } catch (err) {
    console.error('adminForceCheckin error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

export async function adminDeleteBooking(bookingId: string, reason: string) {
  if (!reason.trim()) return { error: 'Reason is required' }
  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  try {
    const { data: booking, error: fetchErr } = await adminClient
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (fetchErr || !booking) return { error: 'Booking not found' }
    if (!['pending', 'stalled', 'rejected'].includes(booking.status)) {
      return { error: `Cannot delete a booking with status "${booking.status}". Only pending, stalled, or rejected bookings can be deleted.` }
    }

    // Snapshot to audit log before deletion
    await adminClient.rpc('create_audit_log', {
      p_action: 'admin.booking.delete',
      p_entity_type: 'booking',
      p_entity_id: bookingId,
      p_entity_name: 'Admin deleted booking',
      p_new_data: { reason, booking_snapshot: booking },
    })

    // Delete related notifications
    await adminClient
      .from('user_notifications')
      .delete()
      .eq('related_entity_id', bookingId)
      .eq('related_entity_type', 'booking')

    // Delete the booking
    const { error: deleteErr } = await adminClient
      .from('bookings')
      .delete()
      .eq('id', bookingId)

    if (deleteErr) return { error: `Failed to delete booking: ${deleteErr.message}` }

    revalidatePath('/admin/bookings')
    revalidatePath('/dashboard/trips')
    return { success: true }
  } catch (err) {
    console.error('adminDeleteBooking error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

export async function adminEditBooking(
  bookingId: string,
  data: { checkIn: string; checkOut: string; guests: number },
  reason: string
) {
  if (!reason.trim()) return { error: 'Reason is required' }
  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  try {
    const { data: booking, error: fetchErr } = await adminClient
      .from('bookings')
      .select('id, status, listing_id, check_in, check_out, guests, subtotal, user_id, escrow_status, listing:listings(user_id, title, price_per_night, max_guests)')
      .eq('id', bookingId)
      .single()

    if (fetchErr || !booking) return { error: 'Booking not found' }
    if (booking.status !== 'confirmed') {
      return { error: `Cannot edit a booking with status "${booking.status}"` }
    }

    const listingData = booking.listing as any
    const listing = Array.isArray(listingData) ? listingData[0] : listingData
    if (!listing) return { error: 'Listing not found' }

    // Validate guest count
    if (data.guests > listing.max_guests) {
      return { error: `Guest count exceeds listing maximum of ${listing.max_guests}` }
    }

    // Validate date sanity
    const checkIn = new Date(data.checkIn)
    const checkOut = new Date(data.checkOut)
    if (checkOut <= checkIn) return { error: 'Check-out must be after check-in' }

    // Check availability (excluding this booking)
    const { data: availability } = await adminClient
      .rpc('check_listing_availability', {
        p_listing_id: booking.listing_id,
        p_check_in: data.checkIn,
        p_check_out: data.checkOut,
        p_exclude_booking_id: bookingId,
      })
      .single()

    if (availability?.has_conflict) {
      return { error: availability.conflict_reason || 'Date conflict detected' }
    }

    // Recalculate subtotal if dates changed
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    const newSubtotal = nights * listing.price_per_night
    const oldSubtotal = booking.subtotal

    // Build update
    const updateData: Record<string, unknown> = {
      check_in: data.checkIn,
      check_out: data.checkOut,
      guests: data.guests,
      subtotal: newSubtotal,
    }

    await adminClient.from('bookings').update(updateData).eq('id', bookingId)

    // Handle price difference for wallet-paid bookings with held escrow
    if (booking.escrow_status === 'held' && newSubtotal !== oldSubtotal) {
      const diff = newSubtotal - oldSubtotal
      if (diff > 0) {
        // Charge the guest more
        await adminClient.from('transactions').insert({
          user_id: booking.user_id,
          type: 'payment',
          amount: -diff,
          booking_id: bookingId,
          notes: `Admin booking edit: additional charge of ${diff} EGP. Reason: ${reason}`,
        })
      } else {
        // Refund the guest
        await adminClient.from('transactions').insert({
          user_id: booking.user_id,
          type: 'refund',
          amount: Math.abs(diff),
          booking_id: bookingId,
          notes: `Admin booking edit: refund of ${Math.abs(diff)} EGP. Reason: ${reason}`,
        })
      }
    }

    // Audit log
    await adminClient.rpc('create_audit_log', {
      p_action: 'admin.booking.edit',
      p_entity_type: 'booking',
      p_entity_id: bookingId,
      p_entity_name: 'Admin edited booking',
      p_new_data: {
        reason,
        changes: {
          check_in: { from: booking.check_in, to: data.checkIn },
          check_out: { from: booking.check_out, to: data.checkOut },
          guests: { from: booking.guests, to: data.guests },
          subtotal: { from: oldSubtotal, to: newSubtotal },
        },
      },
    })

    // Notify guest
    await notifyUser(
      adminClient, booking.user_id,
      'booking_updated',
      'Booking Updated',
      `Your booking for ${listing.title || 'a listing'} has been modified by an admin. Reason: ${reason}`,
      bookingId
    )

    // Notify host
    const hostId = extractHostId(booking.listing)
    if (hostId) {
      await notifyUser(
        adminClient, hostId,
        'booking_updated',
        'Booking Updated',
        `A booking for ${listing.title || 'your listing'} has been modified by an admin. Reason: ${reason}`,
        bookingId
      )
    }

    revalidatePath('/admin/bookings')
    revalidatePath('/dashboard/trips')
    return { success: true, newSubtotal, oldSubtotal }
  } catch (err) {
    console.error('adminEditBooking error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

// Fetch fees and timeline for the detail sheet (called client-side)
export async function getBookingDetails(bookingId: string) {
  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  try {
    // Get fee breakdown
    const { data: fees } = await adminClient
      .rpc('calc_booking_fees', { p_booking_id: bookingId })
      .single() as any

    // Get escrow events
    const { data: escrowEvents } = await adminClient
      .from('escrow')
      .select('id, type, status, created_at, notes')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true })

    // Get audit log events
    const { data: auditEvents } = await adminClient
      .from('audit_logs')
      .select('id, action, created_at, new_data')
      .eq('entity_type', 'booking')
      .eq('entity_id', bookingId)
      .order('created_at', { ascending: true })

    return {
      fees: fees || null,
      escrowEvents: escrowEvents || [],
      auditEvents: auditEvents || [],
    }
  } catch (err) {
    console.error('getBookingDetails error:', err)
    return { error: 'Failed to load booking details' }
  }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/app/admin/bookings/actions.ts 2>&1 | head -20`

Fix any type errors if they appear.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/bookings/actions.ts
git commit -m "feat(admin/bookings): add server actions for booking management"
```

---

## Chunk 2: Page Shell, Table View, and Board View

### Task 5: Server Component Page — Data Fetching + KPIs

**Files:**
- Create: `src/app/admin/bookings/page.tsx`

- [ ] **Step 1: Create the server page**

Follows the pattern from `src/app/admin/payments/page.tsx` — server component fetches data, renders KPI cards, passes data to client wrapper.

```typescript
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
        listing:listings(title, host:profiles!listings_user_id_fkey(full_name))
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
    const { data } = await supabase
      .from('bookings')
      .select('status, subtotal, created_at')

    if (!data) return { total: 0, upcoming: 0, active: 0, revenueThisMonth: 0 }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    return {
      total: data.length,
      upcoming: data.filter(b => ['pending', 'confirmed', 'stalled'].includes(b.status)).length,
      active: data.filter(b => b.status === 'active').length,
      revenueThisMonth: data
        .filter(b =>
          ['confirmed', 'active', 'completed'].includes(b.status)
          && b.created_at >= monthStart
        )
        .reduce((sum, b) => sum + (b.subtotal || 0), 0),
    }
  } catch {
    return { total: 0, upcoming: 0, active: 0, revenueThisMonth: 0 }
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
  }).format(amount)
}

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
            <div className="text-2xl font-bold">{formatCurrency(kpis.revenueThisMonth)}</div>
          </CardContent>
        </Card>
      </div>

      <BookingsDashboard bookings={bookings} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/bookings/page.tsx
git commit -m "feat(admin/bookings): add server page with data fetching and KPIs"
```

---

### Task 6: Client Dashboard Shell — Tab Switcher

**Files:**
- Create: `src/app/admin/bookings/bookings-dashboard.tsx`

- [ ] **Step 1: Create the tab switcher component**

```typescript
'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TableProperties, LayoutList, GanttChart } from 'lucide-react'
import { AdminBooking } from './types'
import { TableView } from './views/table-view'
import { BoardView } from './views/board-view'
import { TimelineView } from './views/timeline-view'
import { BookingDetailSheet } from './booking-detail-sheet'

export function BookingsDashboard({ bookings }: { bookings: AdminBooking[] }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const defaultView = searchParams.get('view') || 'table'
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  function onSelectBooking(booking: AdminBooking) {
    setSelectedBooking(booking)
    setSheetOpen(true)
  }

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', value)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <>
      <Tabs defaultValue={defaultView} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="table" className="gap-2">
            <TableProperties className="h-4 w-4" />
            Table
          </TabsTrigger>
          <TabsTrigger value="board" className="gap-2">
            <LayoutList className="h-4 w-4" />
            Board
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2">
            <GanttChart className="h-4 w-4" />
            Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-4">
          <TableView bookings={bookings} onSelectBooking={onSelectBooking} />
        </TabsContent>
        <TabsContent value="board" className="mt-4">
          <BoardView bookings={bookings} onSelectBooking={onSelectBooking} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <TimelineView bookings={bookings} onSelectBooking={onSelectBooking} />
        </TabsContent>
      </Tabs>

      <BookingDetailSheet
        booking={selectedBooking}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/bookings/bookings-dashboard.tsx
git commit -m "feat(admin/bookings): add client dashboard with tab switcher"
```

---

### Task 7: Table View

**Files:**
- Create: `src/app/admin/bookings/views/table-columns.tsx`
- Create: `src/app/admin/bookings/views/table-view.tsx`

- [ ] **Step 1: Create column definitions**

```typescript
'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { AdminBooking, STATUS_COLORS, formatCurrency } from '../types'

export const columns: ColumnDef<AdminBooking>[] = [
  {
    accessorKey: 'listing',
    header: 'Listing',
    cell: ({ row }) => {
      const listing = row.original.listing
      return (
        <div className="max-w-[180px] truncate font-medium">
          {Array.isArray(listing) ? listing[0]?.title : listing?.title || '—'}
        </div>
      )
    },
  },
  {
    accessorKey: 'guest',
    header: 'Guest',
    cell: ({ row }) => {
      const guest = row.original.guest
      const name = Array.isArray(guest) ? guest[0]?.full_name : guest?.full_name
      return <span>{name || '—'}</span>
    },
    filterFn: (row, _, value) => {
      const guest = row.original.guest
      const name = (Array.isArray(guest) ? guest[0]?.full_name : guest?.full_name) || ''
      return name.toLowerCase().includes(value.toLowerCase())
    },
  },
  {
    id: 'host',
    header: 'Host',
    cell: ({ row }) => {
      const listing = row.original.listing
      const data = Array.isArray(listing) ? listing[0] : listing
      const hostName = data?.host
        ? (Array.isArray(data.host) ? data.host[0]?.full_name : data.host?.full_name)
        : null
      return <span>{hostName || '—'}</span>
    },
  },
  {
    accessorKey: 'check_in',
    header: 'Check-in',
    cell: ({ row }) => new Date(row.original.check_in).toLocaleDateString(),
  },
  {
    accessorKey: 'check_out',
    header: 'Check-out',
    cell: ({ row }) => new Date(row.original.check_out).toLocaleDateString(),
  },
  {
    accessorKey: 'guests',
    header: 'Guests',
  },
  {
    accessorKey: 'subtotal',
    header: 'Subtotal',
    cell: ({ row }) => formatCurrency(row.original.subtotal),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge className={STATUS_COLORS[row.original.status]}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: 'escrow_status',
    header: 'Escrow',
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.escrow_status || 'none'}</Badge>
    ),
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
  },
]
```

- [ ] **Step 2: Create the table view wrapper**

```typescript
'use client'

import { DataTable } from '@/components/ui/data-table'
import { columns } from './table-columns'
import { AdminBooking } from '../types'

export function TableView({
  bookings,
  onSelectBooking,
}: {
  bookings: AdminBooking[]
  onSelectBooking: (booking: AdminBooking) => void
}) {
  return (
    <div onClick={(e) => {
      const row = (e.target as HTMLElement).closest('tr[data-state]')
      if (!row) return
      const index = Number(row.getAttribute('data-row-index'))
      if (!isNaN(index) && bookings[index]) onSelectBooking(bookings[index])
    }}>
      <DataTable
        columns={columns}
        data={bookings}
        searchKey="guest"
        searchPlaceholder="Search by guest name..."
      />
    </div>
  )
}
```

Note: the click-to-open-sheet on row click may need refinement during implementation. An alternative approach is to add a clickable "View" button column. The implementer should choose whichever integrates cleanly with the existing `DataTable` component.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/bookings/views/table-columns.tsx src/app/admin/bookings/views/table-view.tsx
git commit -m "feat(admin/bookings): add Table view with columns and search"
```

---

### Task 8: Board View — Collapsible Grouped Sections

**Files:**
- Create: `src/app/admin/bookings/views/board-view.tsx`

- [ ] **Step 1: Create the board view**

Three collapsible sections (Upcoming, Active, History) each with a mini-table. Uses shadcn Collapsible component. History starts collapsed.

```typescript
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { AdminBooking, getBookingGroup, STATUS_COLORS, formatCurrency } from '../types'

type GroupConfig = {
  key: 'upcoming' | 'active' | 'history'
  label: string
  color: string
  defaultOpen: boolean
}

const GROUPS: GroupConfig[] = [
  { key: 'upcoming', label: 'UPCOMING', color: 'bg-blue-500', defaultOpen: true },
  { key: 'active', label: 'ACTIVE', color: 'bg-green-500', defaultOpen: true },
  { key: 'history', label: 'HISTORY', color: 'bg-gray-500', defaultOpen: false },
]

function BookingGroup({
  config,
  bookings,
  onSelectBooking,
}: {
  config: GroupConfig
  bookings: AdminBooking[]
  onSelectBooking: (booking: AdminBooking) => void
}) {
  const [open, setOpen] = useState(config.defaultOpen)

  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/50"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className={`h-2.5 w-2.5 rounded-full ${config.color}`} />
        <span className="font-semibold text-sm">{config.label}</span>
        <Badge variant="secondary" className="ml-1">{bookings.length}</Badge>
      </button>

      {open && bookings.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Listing</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((b) => {
              const listing = Array.isArray(b.listing) ? b.listing[0] : b.listing
              const guest = Array.isArray(b.guest) ? b.guest[0] : b.guest
              return (
                <TableRow
                  key={b.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onSelectBooking(b)}
                >
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {listing?.title || '—'}
                  </TableCell>
                  <TableCell>{guest?.full_name || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(b.check_in).toLocaleDateString()} – {new Date(b.check_out).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{formatCurrency(b.subtotal)}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[b.status]}>{b.status}</Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {open && bookings.length === 0 && (
        <p className="px-4 pb-4 text-sm text-muted-foreground">No bookings in this group.</p>
      )}
    </div>
  )
}

export function BoardView({
  bookings,
  onSelectBooking,
}: {
  bookings: AdminBooking[]
  onSelectBooking: (booking: AdminBooking) => void
}) {
  const grouped = GROUPS.map((config) => ({
    config,
    bookings: bookings.filter((b) => getBookingGroup(b.status) === config.key),
  }))

  return (
    <div className="space-y-4">
      {grouped.map(({ config, bookings: groupBookings }) => (
        <BookingGroup
          key={config.key}
          config={config}
          bookings={groupBookings}
          onSelectBooking={onSelectBooking}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/bookings/views/board-view.tsx
git commit -m "feat(admin/bookings): add Board view with collapsible grouped sections"
```

---

## Chunk 3: Timeline View

### Task 9: Gantt Timeline View

**Files:**
- Create: `src/app/admin/bookings/views/timeline-view.tsx`

- [ ] **Step 1: Create the Gantt timeline component**

This is the most complex view. Rows = listings, bars = bookings. Color-coded by status. Horizontal scroll with day columns and a today marker. Zoom controls switch between day/week/month granularity.

The implementer should build this as a custom component (no external Gantt library needed). Key implementation notes:

- Group bookings by `listing_id` to get one row per listing
- Calculate visible date range (default: 2 weeks centered on today for day view)
- Render day columns as a CSS grid or flex row
- Position booking bars absolutely based on check-in/check-out relative to visible range
- Today marker is a vertical line at the current date position
- Zoom changes the number of visible days (day=14, week=8 weeks, month=3 months) and column width
- Each bar shows guest name on hover (title attribute or custom tooltip)
- Click bar → `onSelectBooking`

Color mapping (from `types.ts`):
- `active` → green, `confirmed` → blue, `pending`/`stalled` → yellow, `completed` → gray, `cancelled`/`rejected` → red

The component should be functional but doesn't need to be pixel-perfect on first pass. Structure:

```typescript
'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AdminBooking } from '../types'

type Zoom = 'day' | 'week' | 'month'

const ZOOM_DAYS: Record<Zoom, number> = { day: 14, week: 56, month: 90 }
const COL_WIDTH: Record<Zoom, number> = { day: 60, week: 20, month: 8 }

const BAR_COLORS: Record<string, string> = {
  active: 'bg-green-500',
  confirmed: 'bg-blue-500',
  pending: 'bg-yellow-500',
  stalled: 'bg-yellow-500',
  completed: 'bg-gray-400',
  cancelled: 'bg-red-500',
  rejected: 'bg-red-500',
}

export function TimelineView({ bookings, onSelectBooking }: {
  bookings: AdminBooking[]
  onSelectBooking: (b: AdminBooking) => void
}) {
  // ... state: zoom, scroll offset, date range
  // ... compute listings with their bookings
  // ... render: left column (listing names) + scrollable date grid with bars
  // ... today marker overlay
  // ... zoom controls (day/week/month buttons)
}
```

The implementer should flesh out the full rendering logic. Key constraints:
- Left column is fixed width (200px), scrollable content to the right
- Bar left position = `(checkIn - rangeStart) / totalDays * 100%`
- Bar width = `(checkOut - checkIn) / totalDays * 100%`
- Clamp bars that extend beyond visible range
- Show listing name + host name in the left column
- Each row height ~40px

- [ ] **Step 2: Verify the page renders**

Run: `npm run dev` and navigate to `http://localhost:3000/admin/bookings?view=timeline`

Confirm the timeline renders without errors. May show empty if no bookings exist.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/bookings/views/timeline-view.tsx
git commit -m "feat(admin/bookings): add Gantt Timeline view"
```

---

## Chunk 4: Detail Sheet and Action Dialogs

### Task 10: Booking Detail Sheet

**Files:**
- Create: `src/app/admin/bookings/booking-detail-sheet.tsx`

- [ ] **Step 1: Create the detail sheet**

Uses shadcn Sheet (`side="right"`). Shows booking info, financial details (fetched via `getBookingDetails` server action), event timeline, and contextual action buttons.

Key implementation notes:
- On open, calls `getBookingDetails(booking.id)` to fetch fees + events
- Shows loading skeleton while awaiting
- Header: listing title, truncated booking ID, status + escrow badges
- Details grid: guest, host, dates, nights, guests, subtotal, fees (from RPC), payment method
- Event timeline: chronological list from escrow events + audit logs
- Action buttons: rendered conditionally based on `booking.status` (see spec table)
- Each action button opens its corresponding dialog component

```typescript
'use client'

import { useEffect, useState, useTransition } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminBooking, STATUS_COLORS, formatCurrency } from './types'
import { getBookingDetails } from './actions'
import { CancelBookingDialog } from './dialogs/cancel-booking'
import { ForceCompleteDialog } from './dialogs/force-complete'
import { ForceCheckinDialog } from './dialogs/force-checkin'
import { DeleteBookingDialog } from './dialogs/delete-booking'
import { EditBookingDialog } from './dialogs/edit-booking'

export function BookingDetailSheet({
  booking,
  open,
  onOpenChange,
}: {
  booking: AdminBooking | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // State for fetched details (fees, events)
  // useEffect to fetch on booking change
  // Render: header, details grid, event timeline, action buttons
  // Each action button opens a dialog component with booking prop
}
```

The implementer should build out the full JSX. The structure follows a vertical layout inside the sheet:
1. SheetHeader with title + badges
2. Details section with label/value pairs in a 2-column grid
3. Separator
4. Event timeline as a vertical list with circle + line connectors
5. Separator
6. Action buttons section

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/bookings/booking-detail-sheet.tsx
git commit -m "feat(admin/bookings): add booking detail slide-over sheet"
```

---

### Task 11: Action Dialogs

**Files:**
- Create: `src/app/admin/bookings/dialogs/cancel-booking.tsx`
- Create: `src/app/admin/bookings/dialogs/force-complete.tsx`
- Create: `src/app/admin/bookings/dialogs/force-checkin.tsx`
- Create: `src/app/admin/bookings/dialogs/delete-booking.tsx`
- Create: `src/app/admin/bookings/dialogs/edit-booking.tsx`

- [ ] **Step 1: Create cancel booking dialog**

Uses shadcn AlertDialog. Has a mandatory reason Textarea. Calls `adminCancelBooking` server action. Shows toast on success/error.

Pattern for all confirmation dialogs:
```typescript
'use client'

import { useState, useTransition } from 'react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { adminCancelBooking } from '../actions'

export function CancelBookingDialog({
  bookingId,
  onComplete,
}: {
  bookingId: string
  onComplete: () => void
}) {
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await adminCancelBooking(bookingId, reason)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Booking cancelled successfully')
        setReason('')
        onComplete()
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">Cancel Booking</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
          <AlertDialogDescription>
            This will cancel the booking and notify the host and guest. For confirmed bookings with held funds, a full refund will be issued.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason (required)</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter the reason for cancellation..."
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Back</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!reason.trim() || isPending}
          >
            {isPending ? 'Cancelling...' : 'Confirm Cancel'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 2: Create force-complete dialog**

Same pattern as cancel but calls `adminForceComplete`. Trigger button: "Force Complete". Warning text: "This will release escrow funds to the host and mark the booking as completed."

- [ ] **Step 3: Create force-checkin dialog**

Same pattern, calls `adminForceCheckin`. Trigger button: "Force Check-in". Description: "This will mark the guest as checked in and activate the booking."

- [ ] **Step 4: Create delete booking dialog**

Stricter pattern — requires typing the booking ID (first 8 chars) to confirm. Uses a standard Dialog (not AlertDialog) to support the input field:
- Shows the booking ID to type
- Input field that must match first 8 chars of booking ID
- Confirm button only enabled when input matches
- Calls `adminDeleteBooking`

- [ ] **Step 5: Create edit booking dialog**

Uses shadcn Dialog with a form. Fields:
- Check-in date picker (shadcn Calendar + Popover)
- Check-out date picker
- Guest count (number Input)
- Reason Textarea (required)
- Shows current vs new price diff before confirming

Calls `adminEditBooking` server action. On success, shows toast and closes.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/bookings/dialogs/
git commit -m "feat(admin/bookings): add action dialogs (cancel, force-complete, force-checkin, delete, edit)"
```

---

## Chunk 5: Integration, Polish, and Verification

### Task 12: Wire Up Detail Sheet Actions

**Files:**
- Modify: `src/app/admin/bookings/booking-detail-sheet.tsx`

- [ ] **Step 1: Connect all dialog components to the detail sheet**

Ensure each dialog is rendered conditionally based on booking status:
- `pending` / `stalled`: CancelBookingDialog, DeleteBookingDialog
- `confirmed`: EditBookingDialog, CancelBookingDialog, ForceCheckinDialog
- `active`: ForceCompleteDialog
- `completed` / `cancelled`: no action buttons (view only)
- `rejected`: DeleteBookingDialog

The `onComplete` callback for each dialog should close the sheet and the page will auto-refresh via `revalidatePath`.

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/bookings/booking-detail-sheet.tsx
git commit -m "feat(admin/bookings): wire action dialogs into detail sheet"
```

---

### Task 13: Build Verification

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Fix any TypeScript errors or build failures. Common issues to watch for:
- Import paths (all should use `@/` alias)
- Missing `'use client'` directives on components using hooks
- Supabase query type mismatches (may need `as unknown as` casts)

- [ ] **Step 2: Run the linter**

```bash
npm run lint
```

Fix any linting issues.

- [ ] **Step 3: Manual smoke test**

Start dev server (`npm run dev`) and verify:
1. `/admin/bookings` loads with KPI cards
2. Table view shows bookings with search and pagination
3. Board view shows 3 collapsible groups with correct categorization
4. Timeline view renders listing rows with booking bars
5. Clicking a booking opens the detail sheet
6. Tab switching works and URL updates (`?view=board`, `?view=timeline`)
7. Action buttons appear based on booking status
8. Cancelling a pending booking works (test with a real booking if available)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix(admin/bookings): build fixes and polish"
```

---

## Summary

| Chunk | Tasks | What it delivers |
|-------|-------|-----------------|
| 1 | Tasks 1–4 | Migration, types, sidebar entry, all server actions |
| 2 | Tasks 5–8 | Page shell, KPIs, tab switcher, Table + Board views |
| 3 | Task 9 | Timeline (Gantt) view |
| 4 | Tasks 10–11 | Detail sheet + all 5 action dialogs |
| 5 | Tasks 12–13 | Wiring, build verification, smoke test |
