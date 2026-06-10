# Admin Bookings Dashboard — Design Spec

## Overview

A comprehensive admin bookings management page at `/admin/bookings` with three switchable views (Table, Board, Timeline), a booking detail slide-over sheet, and full admin action capabilities for managing booking lifecycles.

## Page Structure

### Layout

- **KPI summary cards** at top: Total Bookings, Upcoming Count, Active Count, Revenue This Month
- **Revenue This Month** = sum of `subtotal` for bookings with `status IN ('confirmed', 'active', 'completed')` and `created_at` within the current calendar month
- **Tab bar** below KPIs: Table | Board | Timeline
- Active tab stored in URL search param (`?view=board`) — bookmarkable
- **Global controls** (persist across views): search bar (listing/guest name), date range filter
- Clicking any booking opens a **right-side slide-over sheet**

### Route

`/admin/bookings` — single page, views are tab-switched (not separate routes).

### States

- **Page loading**: Use existing admin `loading.tsx` skeleton pattern
- **View switching**: Instant (data already loaded, no refetch)
- **Detail sheet loading**: Show skeleton while fetching fees via `calc_booking_fees` and audit log entries
- **Action errors**: Display via toast notification (Sonner, consistent with existing admin patterns)
- **Empty states**: Show placeholder message per group/view when no bookings match

## Views

### Table View (default)

Standard shadcn DataTable.

**Columns**: Listing, Guest, Host, Check-in, Check-out, Guests, Subtotal, Status, Escrow, Created.

**Features**: Sortable columns, text search, status filter dropdown (includes all 7 statuses), row click opens detail sheet. Limited to 100 most recent bookings with pagination controls.

### Board View (Grouped List)

Three vertical collapsible sections, each with its own mini-table.

| Group | Statuses | Default State | Columns |
|-------|----------|---------------|---------|
| **Upcoming** (blue dot) | `pending`, `confirmed`, `stalled` | Expanded | Listing, Guest, Dates, Amount, Status badge |
| **Active** (green dot) | `active` | Expanded | Listing, Guest, Dates, Amount, Check-in confirmed badge |
| **History** (gray dot) | `completed`, `cancelled`, `rejected` | Collapsed | Listing, Guest, Dates, Amount, Final status badge |

Each section header shows count badge. Chevron toggle for collapse/expand.

### Timeline View (Gantt)

- **Rows** = Listings (every listing with at least one booking in the visible date range)
- **Bars** = Bookings spanning check-in → check-out
- **Color coding**: Green = active, Blue = confirmed, Yellow = pending/stalled, Gray = completed, Red = cancelled/rejected
- Left column: listing name + host name
- Horizontal date header with day columns
- **Today marker**: vertical accent line
- **Zoom controls**: Day / Week / Month granularity
- **Scroll**: horizontal, centered on today by default
- **Interactions**: Click bar → opens detail sheet, hover → tooltip (guest, dates, amount, status)

## Booking Detail Sheet

Right-side Sheet (shadcn Sheet component, `side="right"`).

### Header

Listing title, booking ID (truncated UUID), status badge, escrow status badge.

### Details Section

| Field | Source |
|-------|--------|
| Guest name | `profiles` via `bookings.user_id` |
| Host name | `profiles` via `listings.user_id` |
| Check-in / Check-out | `bookings.check_in`, `bookings.check_out` |
| Nights | Computed from dates |
| Guest count | `bookings.guests` |
| Subtotal | `bookings.subtotal` |
| Guest fee | `calc_booking_fees` RPC |
| Total with fees | `calc_booking_fees` RPC |
| Host payout | `calc_booking_fees` RPC |
| Payment method | Inferred from `receipt_url` presence |
| Cancellation policy | `bookings.cancellation_policy_snapshot` |

### Timeline Section

Chronological event log showing key lifecycle events with timestamps. Data sources:
- **Created**: `bookings.created_at`
- **Payment held**: `escrow` table where `booking_id` matches and `type = 'hold'`
- **Checked in**: `bookings.is_check_in_confirmed` flag + `bookings.updated_at` as proxy
- **Completed / Cancelled**: `escrow` table with `type = 'release'` or `type = 'refund'`
- **Admin actions**: `audit_logs` table where `entity_type = 'booking'` and `entity_id` matches

### Actions Section

Actions are contextual based on booking status:

| Status | Available Actions |
|--------|-------------------|
| `pending` | Cancel, Delete |
| `stalled` | Cancel, Delete |
| `confirmed` | Edit (dates/guests), Cancel, Force check-in |
| `active` | Force complete (release escrow) |
| `completed` | View only |
| `cancelled` | View only |
| `rejected` | Delete |

Note: Payment approval for `pending`/`stalled` bookings remains on the existing `/admin/payments` page. The detail sheet links to it when relevant.

## Admin Actions

All actions require a **mandatory reason** text field, **auto-notify** host and guest, and **create an audit log** entry via `create_audit_log` RPC.

### Edit Booking

**Available for**: `confirmed` bookings only.

**Editable fields**: Check-in date, check-out date, guest count.

**Prerequisites**: Requires a new migration to add an optional `p_exclude_booking_id uuid DEFAULT NULL` parameter to the `check_listing_availability` RPC, so the current booking's own date range does not conflict with itself during validation.

**Flow**:
1. Admin opens edit dialog from detail sheet
2. Changes dates and/or guest count
3. System re-validates availability via `check_listing_availability` RPC (passing `p_exclude_booking_id` to exclude current booking)
4. System recalculates pricing based on new dates using listing's `price_per_night` and any `listing_price_adjustments`
5. `commission_rate_id` is NOT updated — the original snapshotted rate is preserved; `calc_booking_fees` will use the existing rate for recalculation
6. Shows price diff to admin for confirmation
7. Admin enters mandatory reason
8. On save: update booking record, recalculate fees if dates changed, send notification to host + guest with reason, create audit log

**Price recalculation**: If dates change, the subtotal is recalculated. If the booking was paid via platform balance and the new price differs, the difference is handled via a new transaction (charge or refund the delta).

### Cancel Booking

**Available for**: `pending`, `stalled`, `confirmed` bookings.

**Flow**:
1. Admin clicks Cancel in detail sheet
2. Confirmation dialog with mandatory reason field
3. For `pending`/`stalled` bookings: no escrow handling needed (these have `escrow_status = 'none'`)
4. For `confirmed` bookings with `escrow_status = 'held'`: trigger full refund via existing `refundEscrow` server action
5. Update `bookings.status` → `cancelled`
6. Send notification to host + guest with admin's reason
7. Create audit log entry

### Force Complete

**Available for**: `active` bookings only.

**Purpose**: Close bookings past check-out that the daily cron hasn't processed yet.

**Flow**:
1. Admin clicks "Force Complete" in detail sheet
2. Confirmation dialog: "Release escrow and mark as completed?" with mandatory reason
3. Uses `systemReleaseEscrow` (not `releaseEscrow`) — this bypasses the `is_check_in_confirmed` guard, which is necessary because some active bookings may have been force-activated by the cron without digital guest confirmation
4. Update `bookings.status` → `completed`
5. Create audit log entry

### Force Check-in

**Available for**: `confirmed` bookings only.

**Purpose**: Mark check-in when guest arrived but didn't confirm digitally.

**Flow**:
1. Admin clicks "Force Check-in" in detail sheet
2. Confirmation dialog with mandatory reason
3. Set `is_check_in_confirmed = true`, update `bookings.status` → `active`
4. Send notification to host and guest
5. Create audit log entry

### Delete Booking

**Available for**: `pending`, `stalled`, `rejected` bookings only (no financial records exist for these statuses).

**Flow**:
1. Admin clicks Delete in detail sheet
2. Double-confirmation dialog: "This will permanently erase this booking. Type the booking ID to confirm."
3. Record what's being deleted in audit log (snapshot booking data before deletion)
4. Hard cascade delete: booking record + related `user_notifications`
5. No transaction cleanup needed (these statuses have no financial records)

## Data Fetching

### Server Component (page.tsx)

Fetches all bookings with joins:
```
bookings → profiles (guest)
bookings → listings → profiles (host)
```

With fields: id, listing_id, user_id, check_in, check_out, guests, subtotal, status, escrow_status, is_check_in_confirmed, receipt_url, created_at, updated_at, plus guest name/email and listing title/host name.

Limited to 200 most recent bookings. Pagination via offset for Table view.

### Client-Side

- View switching is client-side (no refetch)
- Detail sheet fetches additional data on open (fees via `calc_booking_fees` RPC, audit log entries)
- Actions are server actions that revalidate the page path on completion

## Database Migration

A migration is required to extend `check_listing_availability`:

```sql
-- Add optional exclude parameter for edit-booking flow
CREATE OR REPLACE FUNCTION check_listing_availability(
  p_listing_id uuid,
  p_check_in date,
  p_check_out date,
  p_exclude_booking_id uuid DEFAULT NULL
)
-- ... existing logic, adding: AND bookings.id != COALESCE(p_exclude_booking_id, '00000000-...')
```

## File Structure

```
src/app/admin/bookings/
├── page.tsx                    # Server component — data fetch, KPIs, pass to client
├── bookings-dashboard.tsx      # Client component — tab switcher, view container
├── views/
│   ├── table-view.tsx          # DataTable with columns
│   ├── table-columns.tsx       # Column definitions
│   ├── board-view.tsx          # Grouped collapsible sections
│   └── timeline-view.tsx       # Gantt chart
├── booking-detail-sheet.tsx    # Slide-over with details + actions
├── dialogs/
│   ├── edit-booking.tsx        # Edit dialog component
│   ├── cancel-booking.tsx      # Cancel confirmation dialog
│   ├── force-complete.tsx      # Force complete dialog
│   ├── force-checkin.tsx       # Force check-in dialog
│   └── delete-booking.tsx      # Delete confirmation dialog (with ID typing)
└── actions.ts                  # Server actions for all admin booking operations
```

## Sidebar Integration

Add "Bookings" entry to the admin sidebar in the **Support** section, with `CalendarCheck` icon from Lucide.
