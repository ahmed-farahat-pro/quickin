# Cancellation & Refund System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a full cancellation & refund system where admins manage policies, hosts pick one per listing, guests accept it on booking, and cancellations auto-calculate refunds processed by admins.

**Architecture:** Extend existing `cancellation_policies` and `refunds` tables with missing columns. Build admin CRUD following conditions system pattern. Add host picker in listing manage page. Wire guest cancellation to create refund records with policy-based calculations. Enhance admin refunds page for processing.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS), shadcn/ui, next-intl, sonner, Tailwind CSS

---

## Chunk 1: Database Schema Changes

All schema changes are applied via Supabase MCP `apply_migration` tool.

### Task 1: Add missing columns to `cancellation_policies`

**DB Changes via Supabase MCP:**

- [ ] **Step 1: Add `is_enabled`, `display_order`, `updated_at` columns**

```sql
ALTER TABLE cancellation_policies
  ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
```

- [ ] **Step 2: Verify columns were added**

Run SQL: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cancellation_policies' ORDER BY ordinal_position;`

### Task 2: Seed Airbnb cancellation policies

- [ ] **Step 1: Delete existing policies and insert the 4 Airbnb ones**

```sql
-- Remove old policies (no FKs reference them yet since refunds has 0 rows)
DELETE FROM cancellation_policies;

INSERT INTO cancellation_policies (code, label, description, full_refund_days_before, partial_refund_days_before, partial_refund_pct, no_refund_days_before, is_enabled, display_order, translations) VALUES
('flexible', 'Flexible',
 'Full refund at least 1 day before check-in. Partial refund within 1 day of check-in.',
 1, 0, 0, 0, true, 1,
 '{"ar": {"label": "مرن", "description": "استرداد كامل قبل يوم واحد على الأقل من تسجيل الوصول. استرداد جزئي خلال يوم واحد من تسجيل الوصول."}}'::jsonb),

('moderate', 'Moderate',
 'Full refund at least 5 days before check-in. Partial refund within 5 days of check-in.',
 5, 1, 50, 0, true, 2,
 '{"ar": {"label": "معتدل", "description": "استرداد كامل قبل 5 أيام على الأقل من تسجيل الوصول. استرداد جزئي خلال 5 أيام من تسجيل الوصول."}}'::jsonb),

('limited', 'Limited',
 'Full refund at least 14 days before check-in. Partial refund 7-14 days before check-in.',
 14, 7, 50, 7, true, 3,
 '{"ar": {"label": "محدود", "description": "استرداد كامل قبل 14 يومًا على الأقل من تسجيل الوصول. استرداد جزئي قبل 7-14 يومًا من تسجيل الوصول."}}'::jsonb),

('firm', 'Firm',
 'Full refund at least 30 days before check-in. Partial refund 7-30 days before check-in.',
 30, 7, 50, 7, true, 4,
 '{"ar": {"label": "صارم", "description": "استرداد كامل قبل 30 يومًا على الأقل من تسجيل الوصول. استرداد جزئي قبل 7-30 يومًا من تسجيل الوصول."}}'::jsonb);
```

- [ ] **Step 2: Verify seed data**

Run SQL: `SELECT code, label, is_enabled, display_order FROM cancellation_policies ORDER BY display_order;`

### Task 3: Add FK constraint on `listings.cancellation_policy`

- [ ] **Step 1: Add FK referencing `cancellation_policies(code)`**

```sql
ALTER TABLE listings
  ADD CONSTRAINT listings_cancellation_policy_fkey
  FOREIGN KEY (cancellation_policy) REFERENCES cancellation_policies(code);
```

- [ ] **Step 2: Verify constraint exists**

Run SQL: `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'listings' AND constraint_type = 'FOREIGN KEY' AND constraint_name = 'listings_cancellation_policy_fkey';`

### Task 4: Add RLS policy for guests to insert refunds

Currently `refunds` only has staff ALL and participant SELECT. Guests need INSERT to create refund records on cancellation.

- [ ] **Step 1: Add INSERT policy for booking guests**

```sql
CREATE POLICY "Guests can create refunds for their bookings"
  ON refunds FOR INSERT
  TO authenticated
  WITH CHECK (
    booking_id IN (
      SELECT b.id FROM bookings b WHERE b.user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Verify policy exists**

Run SQL: `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'refunds';`

### Task 5: Regenerate TypeScript types

- [ ] **Step 1: Generate updated types via Supabase MCP**

Use `generate_typescript_types` tool and update `src/types/supabase.ts`.

- [ ] **Step 2: Commit schema changes**

```bash
git add src/types/supabase.ts
git commit -m "feat(db): add cancellation policy columns, seed Airbnb policies, add listings FK"
```

---

## Chunk 2: Admin CRUD for Cancellation Policies

Follow the exact pattern from `src/app/admin/conditions/` (list page, server actions, table columns, table component, form, create/edit pages).

### Task 6: Create server actions

**Create:** `src/app/admin/cancellation-policies/actions.ts`

- [ ] **Step 1: Create the actions file with CRUD functions**

Functions to implement (follow `src/app/admin/conditions/actions.ts` pattern):
- `createPolicy(data)` — insert into `cancellation_policies`, audit log `policy.create`
- `updatePolicy(code, data)` — update by code, audit log `policy.update` with old/new data
- `deletePolicy(code)` — delete by code, catch FK violation (23503), audit log `policy.delete`
- `togglePolicyEnabled(code, is_enabled, label)` — toggle `is_enabled`, audit log `policy.enable`/`policy.disable`

Each function:
1. Gets supabase client + authenticates user
2. Performs DB operation on `cancellation_policies` table
3. Calls `supabase.rpc('create_audit_log', {...})` with entity_type `'cancellation_policy'`
4. Calls `revalidatePath('/admin/cancellation-policies')`
5. Returns `{ success: true }` or `{ error: string }`

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/cancellation-policies/actions.ts
git commit -m "feat(admin): add cancellation policy server actions"
```

### Task 7: Create table columns definition

**Create:** `src/app/admin/cancellation-policies/columns.tsx`

- [ ] **Step 1: Create columns file**

Follow `src/app/admin/conditions/columns.tsx` pattern.

Columns:
1. **Label** — bold, sortable via `DataTableColumnHeader`
2. **Code** — muted text, monospace
3. **Refund Rules** — summary: "Full: {X}d / Partial: {Y}d @ {Z}%"
4. **Status** — Badge: green "Enabled" / amber "Disabled"
5. **Order** — display_order number
6. **Actions** — DropdownMenu with: Edit (link), Toggle Enable/Disable, Delete (red)

Interface:
```typescript
interface CancellationPolicy {
  code: string
  label: string
  description: string | null
  full_refund_days_before: number
  partial_refund_days_before: number
  partial_refund_pct: number
  no_refund_days_before: number
  is_enabled: boolean
  display_order: number
  translations: Record<string, any>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/cancellation-policies/columns.tsx
git commit -m "feat(admin): add cancellation policy table columns"
```

### Task 8: Create table component

**Create:** `src/app/admin/cancellation-policies/policies-table.tsx`

- [ ] **Step 1: Create the table component**

Follow `src/app/admin/conditions/conditions-table.tsx` pattern:
- Client component with `'use client'`
- Uses `DataTable` with `searchKey: "label"`, `searchPlaceholder: "Filter policies by name..."`
- State: `deleteDialogOpen`, `selectedPolicy`
- Handlers: `handleDeleteClick`, `handleToggleEnabled`, `handleConfirmDelete`
- Uses `deletePolicy` and `togglePolicyEnabled` from actions
- Toast notifications via sonner
- `router.refresh()` on success
- Renders `DeleteDialog` from `@/components/admin/delete-dialog` when selectedPolicy exists

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/cancellation-policies/policies-table.tsx
git commit -m "feat(admin): add cancellation policy table component"
```

### Task 9: Create list page

**Create:** `src/app/admin/cancellation-policies/page.tsx`

- [ ] **Step 1: Create the list page**

Follow `src/app/admin/conditions/page.tsx` pattern:
- Server component, `export const dynamic = 'force-dynamic'`
- `getPolicies()` fetches from `cancellation_policies` ordered by `display_order`
- Header: "Cancellation Policies" + description + "Add Policy" button (Link to `/admin/cancellation-policies/new`)
- Card-wrapped `PoliciesTable` component

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/cancellation-policies/page.tsx
git commit -m "feat(admin): add cancellation policy list page"
```

### Task 10: Create policy form component

**Create:** `src/components/admin/cancellation-policies/policy-form.tsx`

- [ ] **Step 1: Create shared form for create/edit**

Follow `src/components/admin/conditions/condition-form.tsx` pattern:
- Client component
- Props: `initialData?: CancellationPolicy`, `isEditing?: boolean`
- Two Card sections:
  - **Policy Details**: code (Input, disabled if editing), label (Input), description (Textarea), label_ar (Input, dir="rtl"), description_ar (Textarea, dir="rtl")
  - **Refund Rules**: full_refund_days_before (Input number), partial_refund_days_before (Input number), partial_refund_pct (Input number), no_refund_days_before (Input number)
  - **Settings**: is_enabled (Checkbox), display_order (Input number)
- Builds payload with `translations: { ar: { label: label_ar, description: description_ar } }`
- Calls `createPolicy(payload)` or `updatePolicy(code, payload)` from actions
- Redirects to `/admin/cancellation-policies` on success
- Toast for errors

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/cancellation-policies/policy-form.tsx
git commit -m "feat(admin): add cancellation policy form component"
```

### Task 11: Create new/edit pages

**Create:** `src/app/admin/cancellation-policies/new/page.tsx`
**Create:** `src/app/admin/cancellation-policies/[code]/edit/page.tsx`

- [ ] **Step 1: Create the new page**

Follow `src/app/admin/conditions/new/page.tsx`:
- Server component, renders `PolicyForm` without initialData

- [ ] **Step 2: Create the edit page**

Follow `src/app/admin/conditions/[id]/edit/page.tsx`:
- Server component, fetches policy by code from `cancellation_policies` where `code = params.code`
- Renders `PolicyForm` with `initialData={policy}` and `isEditing={true}`
- Returns `notFound()` if not found

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/cancellation-policies/new/page.tsx src/app/admin/cancellation-policies/\[code\]/edit/page.tsx
git commit -m "feat(admin): add cancellation policy create/edit pages"
```

### Task 12: Add admin navigation link

**Modify:** The admin sidebar/navigation to include a link to `/admin/cancellation-policies`.

- [ ] **Step 1: Find and update admin navigation**

Search for existing admin nav links (e.g., `/admin/conditions`) and add `/admin/cancellation-policies` with an appropriate icon (e.g., `ShieldCheck` or `FileText` from lucide-react).

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(admin): add cancellation policies to admin navigation"
```

---

## Chunk 3: Host Policy Picker

### Task 13: Create cancellation policy picker component

**Create:** `src/app/(dashboard)/dashboard/listings/[id]/manage/cancellation-policy-manager.tsx`

- [ ] **Step 1: Create the component**

Client component following the radio-card pattern from the Airbnb screenshot:
- Fetches enabled policies from `cancellation_policies` where `is_enabled = true`, ordered by `display_order`
- Fetches current listing's `cancellation_policy` value
- Renders radio card list — each card shows:
  - Policy label (localized from `translations` based on current locale, fallback to `label`)
  - Refund rules summary (localized from `translations.description`, fallback to `description`)
  - Info icon (i) that could expand details
  - Selected state with border highlight
- Save button updates `listings.cancellation_policy` with selected code
- Cancel button reverts to original
- Change tracking (dirty state) like conditions-manager
- Toast notifications on save/error

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/listings/\[id\]/manage/cancellation-policy-manager.tsx
git commit -m "feat(host): add cancellation policy picker for listings"
```

### Task 14: Wire picker into listing manage page

**Modify:** The listing manage page layout that contains conditions-manager and attributes-manager.

- [ ] **Step 1: Find the manage page and add the cancellation policy manager**

Search for where `conditions-manager` and `attributes-manager` are imported/rendered. Add `CancellationPolicyManager` as a new section (e.g., a tab or accordion section).

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(host): integrate cancellation policy picker in listing manage page"
```

---

## Chunk 4: Guest Booking Flow

### Task 15: Display policy and add acceptance checkbox in booking flow

**Modify:** `src/app/(main)/listings/[id]/book/booking-conditions.tsx` (or the equivalent booking page component)

- [ ] **Step 1: Find the booking/checkout page**

Search for the booking conditions component and the booking creation action to understand the current flow.

- [ ] **Step 2: Add cancellation policy display and acceptance**

In the booking page/component, after the existing conditions section:
- Fetch the listing's cancellation policy by joining `cancellation_policies` on `listings.cancellation_policy`
- Display a card with:
  - Policy label (localized)
  - Full refund rules description (localized)
- Add a required checkbox: "I accept the cancellation and refund policy" (localized via i18n)
- The checkbox must be checked before the booking can be submitted

- [ ] **Step 3: Snapshot policy on booking creation**

Modify the booking creation action/logic:
- When creating the booking, fetch the full policy from `cancellation_policies` where code matches `listing.cancellation_policy`
- Store the entire policy object as JSON in `bookings.cancellation_policy_snapshot`
- This freezes the policy at booking time

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(booking): display cancellation policy and require acceptance"
```

---

## Chunk 5: Guest Cancellation with Refund Calculation

### Task 16: Create refund calculation utility

**Create:** `src/lib/utils/refund-calculator.ts`

- [ ] **Step 1: Create the utility**

```typescript
interface PolicySnapshot {
  code: string
  label: string
  full_refund_days_before: number
  partial_refund_days_before: number
  partial_refund_pct: number
  no_refund_days_before: number
}

interface RefundCalculation {
  refundAmount: number
  refundType: 'full' | 'partial'
  refundPercentage: number
  daysBeforeCheckIn: number
  policyCode: string
}

export function calculateRefund(
  totalPrice: number,
  checkInDate: string,
  policySnapshot: PolicySnapshot,
  cancellationDate?: Date
): RefundCalculation {
  const now = cancellationDate || new Date()
  const checkIn = new Date(checkInDate)
  const diffMs = checkIn.getTime() - now.getTime()
  const daysBeforeCheckIn = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (daysBeforeCheckIn >= policySnapshot.full_refund_days_before) {
    return {
      refundAmount: totalPrice,
      refundType: 'full',
      refundPercentage: 100,
      daysBeforeCheckIn,
      policyCode: policySnapshot.code,
    }
  }

  if (
    policySnapshot.partial_refund_pct > 0 &&
    daysBeforeCheckIn >= policySnapshot.partial_refund_days_before
  ) {
    const amount = Math.round((totalPrice * policySnapshot.partial_refund_pct) / 100)
    return {
      refundAmount: amount,
      refundType: 'partial',
      refundPercentage: policySnapshot.partial_refund_pct,
      daysBeforeCheckIn,
      policyCode: policySnapshot.code,
    }
  }

  return {
    refundAmount: 0,
    refundType: 'partial',
    refundPercentage: 0,
    daysBeforeCheckIn,
    policyCode: policySnapshot.code,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/utils/refund-calculator.ts
git commit -m "feat: add refund calculation utility based on cancellation policy"
```

### Task 17: Update guest cancellation action

**Modify:** `src/lib/actions/bookings.ts` — `updateBookingStatusGuest` function

- [ ] **Step 1: Enhance the cancellation flow**

When `newStatus === 'cancelled'`:
1. Fetch the booking with `cancellation_policy_snapshot` and `check_in`
2. Call `calculateRefund(booking.total_price, booking.check_in, booking.cancellation_policy_snapshot)`
3. Create a `refunds` row via adminClient:
   ```typescript
   await adminClient.from('refunds').insert({
     booking_id: bookingId,
     amount: refundCalc.refundAmount,
     refund_type: refundCalc.refundType,
     policy_applied: refundCalc.policyCode,
     status: 'pending',
     initiated_by: user.id,
     reason: `Guest cancelled ${refundCalc.daysBeforeCheckIn} days before check-in. Policy: ${refundCalc.policyCode}.`,
   })
   ```
4. Create escrow transaction (type: 'refund', status: 'pending', amount: refundCalc.refundAmount)
5. Update booking status to 'cancelled'
6. Create staff notification: "Refund request: {refundAmount} EGP for booking {reservation_code}"
7. Create user notification for guest: "Your booking has been cancelled. Refund of {amount} EGP is pending review."

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/bookings.ts
git commit -m "feat: wire guest cancellation to refund calculation and record creation"
```

### Task 18: Create cancellation confirmation UI

**Modify or create:** A confirmation dialog/page shown to the guest before they confirm cancellation.

- [ ] **Step 1: Find the current cancellation UI**

Search for where `updateBookingStatusGuest` is called from the guest trips/booking pages.

- [ ] **Step 2: Add confirmation screen**

Before calling the cancellation action, show the guest:
- Policy name (localized from the booking's snapshot)
- Days before check-in
- Calculated refund amount (call a server action or API that returns the calculation)
- "No refund" message if amount is 0
- Confirm / Cancel buttons
- All text localized

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(guest): add cancellation confirmation with refund preview"
```

---

## Chunk 6: Admin Refund Processing

### Task 19: Create refund processing server actions

**Create:** `src/lib/actions/refunds.ts` (or enhance existing)

- [ ] **Step 1: Check if this file already exists and what's in it**

Search for `src/lib/actions/refunds.ts` or any existing refund processing actions.

- [ ] **Step 2: Implement refund processing actions**

Functions:
- `approveRefund(refundId)`:
  1. Auth check + staff verification
  2. Update refund status → 'approved'
  3. Fetch related booking + payout
  4. If payout exists for this booking:
     - Full refund → cancel payout (status → 'cancelled')
     - Partial refund → reduce payout amounts (gross, commission, net recalculated)
  5. Update escrow transaction status → 'completed'
  6. Adjust `user_balances`: reduce host `on_hold_balance` by refund amount
  7. Create user notification to guest: "Your refund of {amount} EGP has been approved"
  8. Audit log: `refund.approve`

- `rejectRefund(refundId, reason)`:
  1. Auth check + staff verification
  2. Update refund status → 'rejected'
  3. Update escrow transaction status → 'cancelled'
  4. Create user notification to guest with rejection reason
  5. Audit log: `refund.reject`

- `processRefund(refundId)`:
  1. Update refund status → 'processed', set `processed_at` and `processed_by`
  2. Audit log: `refund.process`

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/refunds.ts
git commit -m "feat(admin): add refund approval, rejection, and processing actions"
```

### Task 20: Enhance admin refunds page

**Modify:** `src/app/admin/refunds/page.tsx` and `src/app/admin/refunds/refund-actions.tsx`

- [ ] **Step 1: Enhance the list page**

Update the refunds query to include:
- `policy_applied` (join to `cancellation_policies` for label)
- `booking.check_in` date
- `booking.cancellation_policy_snapshot` for showing calculation breakdown
- `initiated_by` (join to `profiles` for guest name)

Add columns or details:
- Policy applied (label)
- Days before check-in at cancellation
- Calculation breakdown (full/partial/none)

- [ ] **Step 2: Enhance refund actions component**

Update `RefundActions` to use the new `approveRefund`, `rejectRefund`, `processRefund` actions.
- Approve dialog shows the full calculation breakdown
- Reject dialog includes a reason text field
- Process button appears after approval (for marking actual money movement)

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/refunds/
git commit -m "feat(admin): enhance refunds page with policy details and processing flow"
```

### Task 21: Final integration test and cleanup

- [ ] **Step 1: Update TypeScript types if needed**

Regenerate types via Supabase MCP if any schema changes were made during implementation.

- [ ] **Step 2: Test the full flow manually**

1. Admin: Create/edit/toggle policies at `/admin/cancellation-policies`
2. Host: Pick a policy for a listing in manage page
3. Guest: See policy + accept during booking
4. Guest: Cancel booking, see refund confirmation
5. Admin: Review and process refund at `/admin/refunds`

- [ ] **Step 3: Final commit**

```bash
git commit -m "feat: complete cancellation & refund system integration"
```
