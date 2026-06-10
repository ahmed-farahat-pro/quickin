# Financial System Normalization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace pre-calculated plain financial values with reference-based computed values using a `commission_rates` table, Postgres functions, and derived balances.

**Architecture:** New `commission_rates` table holds rate history. Bookings reference the active rate via FK. All fee/payout/refund amounts are computed on-the-fly by Postgres functions. `user_balances` table is dropped — balances derived from `balance_transactions` and `escrow_transactions`. Payouts keep a nullable `amount` column for withdrawal-type payouts only.

**Tech Stack:** Supabase (Postgres), Next.js Server Actions, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-12-financial-system-normalization-design.md`

**Migration ordering:** Additive schema changes → Postgres functions → Application code updates → Destructive schema changes (drop columns/tables). This ensures no intermediate broken state.

---

## Chunk 1: Additive Schema Changes

All additive-only changes. Nothing is dropped or deleted. Old columns remain until code is migrated.

### Task 1: Create `commission_rates` table and seed initial data

**Files:**
- Create: Supabase migration (applied via MCP)

- [ ] **Step 1: Create the `commission_rates` table**

Apply migration via Supabase MCP `apply_migration`:

```sql
CREATE TABLE public.commission_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_rate       numeric NOT NULL CHECK (host_rate >= 0 AND host_rate < 1),
  guest_rate      numeric NOT NULL CHECK (guest_rate >= 0 AND guest_rate < 1),
  best_offer_rate numeric NOT NULL CHECK (best_offer_rate >= 0 AND best_offer_rate < 1),
  effective_from  timestamptz NOT NULL DEFAULT now(),
  effective_to    timestamptz,
  created_by      uuid REFERENCES public.staff_profiles(id),
  created_at      timestamptz DEFAULT now(),
  notes           text
);

CREATE UNIQUE INDEX commission_rates_single_active
  ON public.commission_rates ((true))
  WHERE effective_to IS NULL;

ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read commission rates"
  ON public.commission_rates FOR SELECT USING (true);

CREATE POLICY "Staff can manage commission rates"
  ON public.commission_rates FOR ALL USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Seed initial row from current platform_settings values**

Execute SQL via Supabase MCP `execute_sql`:

```sql
INSERT INTO public.commission_rates (host_rate, guest_rate, best_offer_rate, notes)
VALUES (0.10, 0.02, 0.02, 'Initial rates migrated from platform_settings');
```

- [ ] **Step 3: Verify**

Execute SQL: `SELECT * FROM public.commission_rates;`
Expected: One row with host_rate=0.10, guest_rate=0.02, best_offer_rate=0.02, effective_to=NULL.

### Task 2: Add `commission_rate_id` and `subtotal` to bookings (additive only)

**Files:**
- Create: Supabase migration (applied via MCP)

- [ ] **Step 1: Add new columns and populate them**

Apply migration:

```sql
ALTER TABLE public.bookings
  ADD COLUMN commission_rate_id uuid REFERENCES public.commission_rates(id),
  ADD COLUMN subtotal numeric;

-- Populate from existing data
UPDATE public.bookings
SET commission_rate_id = (SELECT id FROM public.commission_rates WHERE effective_to IS NULL LIMIT 1),
    subtotal = total_price - guest_fee;

-- Make NOT NULL after population
ALTER TABLE public.bookings
  ALTER COLUMN commission_rate_id SET NOT NULL,
  ALTER COLUMN subtotal SET NOT NULL;
```

- [ ] **Step 2: Verify**

Execute SQL: `SELECT id, subtotal, commission_rate_id, total_price, guest_fee FROM public.bookings LIMIT 5;`
Expected: All rows have subtotal = total_price - guest_fee, commission_rate_id set.

- [ ] **Step 3: Commit checkpoint**

```bash
git add -A && git commit -m "feat(db): add commission_rates table and additive booking columns"
```

---

## Chunk 2: Postgres Functions

### Task 3: Create `get_current_commission_rates()` function

- [ ] **Step 1: Create function**

Apply migration:

```sql
CREATE OR REPLACE FUNCTION public.get_current_commission_rates()
RETURNS TABLE (
  id uuid,
  host_rate numeric,
  guest_rate numeric,
  best_offer_rate numeric,
  effective_from timestamptz
)
LANGUAGE sql STABLE
AS $$
  SELECT id, host_rate, guest_rate, best_offer_rate, effective_from
  FROM public.commission_rates
  WHERE effective_to IS NULL
  LIMIT 1;
$$;
```

- [ ] **Step 2: Verify**

Execute SQL: `SELECT * FROM public.get_current_commission_rates();`

### Task 4: Create `get_commission_rates_at()` function

- [ ] **Step 1: Create function**

Apply migration:

```sql
CREATE OR REPLACE FUNCTION public.get_commission_rates_at(p_ts timestamptz)
RETURNS TABLE (
  id uuid,
  host_rate numeric,
  guest_rate numeric,
  best_offer_rate numeric,
  effective_from timestamptz,
  effective_to timestamptz
)
LANGUAGE sql STABLE
AS $$
  SELECT id, host_rate, guest_rate, best_offer_rate, effective_from, effective_to
  FROM public.commission_rates
  WHERE effective_from <= p_ts
    AND (effective_to IS NULL OR effective_to > p_ts)
  LIMIT 1;
$$;
```

- [ ] **Step 2: Verify**

Execute SQL: `SELECT * FROM public.get_commission_rates_at(now());`

### Task 5: Create `calc_booking_fees()` function

- [ ] **Step 1: Create function**

Apply migration:

```sql
CREATE OR REPLACE FUNCTION public.calc_booking_fees(p_booking_id uuid)
RETURNS TABLE (
  subtotal numeric,
  guest_fee numeric,
  host_fee numeric,
  total_with_fees numeric,
  platform_earnings numeric,
  host_payout numeric
)
LANGUAGE sql STABLE
AS $$
  SELECT
    b.subtotal,
    ROUND(b.subtotal * cr.guest_rate) AS guest_fee,
    ROUND(b.subtotal * cr.host_rate) AS host_fee,
    b.subtotal + ROUND(b.subtotal * cr.guest_rate) AS total_with_fees,
    ROUND(b.subtotal * cr.guest_rate) + ROUND(b.subtotal * cr.host_rate) AS platform_earnings,
    b.subtotal - ROUND(b.subtotal * cr.host_rate) AS host_payout
  FROM public.bookings b
  JOIN public.commission_rates cr ON b.commission_rate_id = cr.id
  WHERE b.id = p_booking_id;
$$;
```

- [ ] **Step 2: Verify with existing booking**

Execute SQL: `SELECT * FROM public.calc_booking_fees((SELECT id FROM public.bookings LIMIT 1));`

### Task 6: Create `calc_payout_amounts()` function

- [ ] **Step 1: Create function**

Apply migration:

```sql
CREATE OR REPLACE FUNCTION public.calc_payout_amounts(p_payout_id uuid)
RETURNS TABLE (
  gross_amount numeric,
  commission_rate numeric,
  commission_amount numeric,
  net_amount numeric
)
LANGUAGE sql STABLE
AS $$
  SELECT
    b.subtotal AS gross_amount,
    cr.host_rate AS commission_rate,
    ROUND(b.subtotal * cr.host_rate) AS commission_amount,
    b.subtotal - ROUND(b.subtotal * cr.host_rate) AS net_amount
  FROM public.payouts p
  JOIN public.bookings b ON p.booking_id = b.id
  JOIN public.commission_rates cr ON b.commission_rate_id = cr.id
  WHERE p.id = p_payout_id
    AND p.booking_id IS NOT NULL;
$$;
```

- [ ] **Step 2: Verify**

Execute SQL: `SELECT * FROM public.calc_payout_amounts((SELECT id FROM public.payouts WHERE booking_id IS NOT NULL LIMIT 1));`

### Task 7: Create `calc_refund_amount()` function

- [ ] **Step 1: Create function**

Apply migration:

```sql
CREATE OR REPLACE FUNCTION public.calc_refund_amount(p_refund_id uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_subtotal numeric;
  v_check_in date;
  v_created_at timestamptz;
  v_snapshot jsonb;
  v_days_before integer;
  v_full_refund_days integer;
  v_partial_refund_days integer;
  v_partial_refund_pct numeric;
BEGIN
  SELECT b.subtotal, b.check_in, r.created_at, b.cancellation_policy_snapshot
  INTO v_subtotal, v_check_in, v_created_at, v_snapshot
  FROM public.refunds r
  JOIN public.bookings b ON r.booking_id = b.id
  WHERE r.id = p_refund_id;

  IF v_subtotal IS NULL OR v_snapshot IS NULL THEN
    RETURN 0;
  END IF;

  v_days_before := (v_check_in - v_created_at::date);
  v_full_refund_days := COALESCE((v_snapshot->>'full_refund_days_before')::integer, 1);
  v_partial_refund_days := COALESCE((v_snapshot->>'partial_refund_days_before')::integer, 0);
  v_partial_refund_pct := COALESCE((v_snapshot->>'partial_refund_pct')::numeric, 0);

  IF v_days_before >= v_full_refund_days THEN
    RETURN v_subtotal;
  ELSIF v_partial_refund_pct > 0 AND v_days_before >= v_partial_refund_days THEN
    RETURN ROUND(v_subtotal * v_partial_refund_pct / 100);
  ELSE
    RETURN 0;
  END IF;
END;
$$;
```

- [ ] **Step 2: Verify**

Execute SQL: `SELECT id, public.calc_refund_amount(id) AS computed_amount FROM public.refunds LIMIT 5;`

### Task 8: Create `get_user_balance()` function

- [ ] **Step 1: Create function**

Apply migration:

```sql
CREATE OR REPLACE FUNCTION public.get_user_balance(p_user_id uuid)
RETURNS TABLE (
  available_balance numeric,
  on_hold_balance numeric,
  total_earned numeric
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((
      SELECT SUM(
        CASE WHEN bt.type IN ('credit', 'refund') THEN bt.amount
             WHEN bt.type IN ('debit', 'withdrawal') THEN bt.amount
             ELSE 0
        END
      )
      FROM public.balance_transactions bt
      WHERE bt.user_id = p_user_id
    ), 0)::numeric AS available_balance,

    COALESCE((
      SELECT
        SUM(CASE WHEN et.type = 'hold' THEN et.amount ELSE 0 END) -
        SUM(CASE WHEN et.type IN ('release', 'refund') THEN et.amount ELSE 0 END)
      FROM public.escrow_transactions et
      JOIN public.bookings b ON et.booking_id = b.id
      JOIN public.listings l ON b.listing_id = l.id
      WHERE l.user_id = p_user_id
        AND et.status = 'completed'
    ), 0)::numeric AS on_hold_balance,

    COALESCE((
      SELECT SUM(bt.amount)
      FROM public.balance_transactions bt
      WHERE bt.user_id = p_user_id
        AND bt.type = 'credit'
    ), 0)::numeric AS total_earned;
END;
$$;
```

- [ ] **Step 2: Verify**

Execute SQL: `SELECT * FROM public.get_user_balance((SELECT user_id FROM public.balance_transactions LIMIT 1));`

- [ ] **Step 3: Commit checkpoint**

```bash
git add -A && git commit -m "feat(db): add Postgres computation functions for financial system"
```

---

## Chunk 3: Core Logic — Commission Rates & Booking Creation

### Task 9: Rewrite `src/lib/actions/platform-settings.ts`

**Files:**
- Modify: `src/lib/actions/platform-settings.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Rewrite `getCommissionRates()` and `updateCommissionRates()`**

Replace entire content of `src/lib/actions/platform-settings.ts`:

```typescript
'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'

export interface CommissionRates {
  id: string
  hostRate: number
  guestRate: number
  bestOfferRate: number
}

export async function getCommissionRates(): Promise<CommissionRates> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return { id: '', hostRate: 0.10, guestRate: 0.02, bestOfferRate: 0.02 }
    }

    const { data } = await supabase.rpc('get_current_commission_rates').single()

    if (!data) {
      return { id: '', hostRate: 0.10, guestRate: 0.02, bestOfferRate: 0.02 }
    }

    return {
      id: data.id,
      hostRate: Number(data.host_rate),
      guestRate: Number(data.guest_rate),
      bestOfferRate: Number(data.best_offer_rate),
    }
  } catch {
    return { id: '', hostRate: 0.10, guestRate: 0.02, bestOfferRate: 0.02 }
  }
}

export async function updateCommissionRates(hostRate: number, guestRate: number, bestOfferRate: number = 0.02) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Database not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: staff } = await supabase
    .from('staff_profiles')
    .select('id, role')
    .eq('id', user.id)
    .eq('is_active', true)
    .single()

  if (!staff) return { error: 'Unauthorized: staff only' }

  if (hostRate < 0 || hostRate >= 1 || guestRate < 0 || guestRate >= 1 || bestOfferRate < 0 || bestOfferRate >= 1) {
    return { error: 'Commission rates must be between 0 and <1 (0% to <100%)' }
  }

  const oldRates = await getCommissionRates()

  const adminClient = await createAdminClient()
  if (!adminClient) return { error: 'Database admin not configured' }

  // Atomic: close old + insert new in a single transaction
  const { error: txError } = await adminClient.rpc('update_commission_rates', {
    p_host_rate: hostRate,
    p_guest_rate: guestRate,
    p_best_offer_rate: bestOfferRate,
    p_created_by: user.id,
    p_notes: `Updated: Host ${oldRates.hostRate * 100}% → ${hostRate * 100}%, Guest ${oldRates.guestRate * 100}% → ${guestRate * 100}%, Best Offer ${oldRates.bestOfferRate * 100}% → ${bestOfferRate * 100}%`
  })

  if (txError) {
    // Fallback to non-atomic approach
    await adminClient
      .from('commission_rates')
      .update({ effective_to: new Date().toISOString() })
      .is('effective_to', null)

    const { error: insertError } = await adminClient
      .from('commission_rates')
      .insert({
        host_rate: hostRate,
        guest_rate: guestRate,
        best_offer_rate: bestOfferRate,
        created_by: user.id,
        notes: `Updated: Host ${oldRates.hostRate * 100}% → ${hostRate * 100}%, Guest ${oldRates.guestRate * 100}% → ${guestRate * 100}%, Best Offer ${oldRates.bestOfferRate * 100}% → ${bestOfferRate * 100}%`,
      })

    if (insertError) {
      console.error('Error inserting new rate:', insertError)
      return { error: 'Failed to create new commission rate' }
    }
  }

  await supabase.rpc('create_audit_log', {
    p_action: 'commission.update',
    p_entity_type: 'commission',
    p_entity_id: null,
    p_entity_name: 'Platform Commission Rates',
    p_old_data: { host_rate: oldRates.hostRate, guest_rate: oldRates.guestRate, best_offer_rate: oldRates.bestOfferRate },
    p_new_data: { host_rate: hostRate, guest_rate: guestRate, best_offer_rate: bestOfferRate },
    p_notes: `Commission rates updated`
  })

  return { success: true }
}
```

- [ ] **Step 2: Create the atomic `update_commission_rates` Postgres function**

Apply migration:

```sql
CREATE OR REPLACE FUNCTION public.update_commission_rates(
  p_host_rate numeric,
  p_guest_rate numeric,
  p_best_offer_rate numeric,
  p_created_by uuid,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.commission_rates
  SET effective_to = now()
  WHERE effective_to IS NULL;

  INSERT INTO public.commission_rates (host_rate, guest_rate, best_offer_rate, created_by, notes)
  VALUES (p_host_rate, p_guest_rate, p_best_offer_rate, p_created_by, p_notes);
END;
$$;
```

- [ ] **Step 3: Remove commission constants from `src/lib/constants.ts`**

Delete these lines:
```
export const DEFAULT_HOST_COMMISSION_RATE = 0.10
export const DEFAULT_GUEST_COMMISSION_RATE = 0.02
export const DEFAULT_BEST_OFFER_COMMISSION_RATE = 0.02
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/platform-settings.ts src/lib/constants.ts
git commit -m "refactor(commission): use commission_rates table with atomic updates"
```

### Task 10: Rewrite `src/lib/supabase/bookings.ts` — booking creation

**Files:**
- Modify: `src/lib/supabase/bookings.ts`

- [ ] **Step 1: Update `createBooking()` function**

Key changes to `createBooking()`:
1. `getCommissionRates()` now returns `{ id, hostRate, guestRate, bestOfferRate }` — use `rates.id` for `commission_rate_id`
2. The payload changes from `total_price: totalWithGuestFee` → `subtotal: data.totalPrice` (the param IS the subtotal)
3. Add `commission_rate_id: rates.id` to the payload
4. Keep `guest_fee: guestFee, host_fee: hostFee, platform_earnings: platformEarnings, host_payout_amount: hostPayoutAmount` in the payload **for now** (old columns still exist, will be dropped in Chunk 6). This ensures backward compatibility during the transition.
5. Replace `user_balances` direct reads/writes with `get_user_balance` RPC and `balance_transactions` inserts
6. Keep local fee calculation for the balance check and escrow amounts

Changes in `createBooking()`:
- Line ~146: Replace `.from('user_balances').select('available_balance')` with admin RPC call: `adminClient.rpc('get_user_balance', { p_user_id: user.id }).single()`
- Line ~156-160: Remove direct `user_balances` update. Instead, the balance_transactions insert (line ~203-213) handles the debit.
- Line ~189-195: Remove rollback that reads/writes `user_balances`. If booking fails after balance_transactions debit, delete the debit record.
- Line ~219-240: Remove direct `user_balances` upsert/update for host on_hold_balance. The escrow transaction insert already handles this (on_hold comes from escrow_transactions via `get_user_balance`).
- Line ~166-181: Update payload — add `subtotal: data.totalPrice, commission_rate_id: rates.id`. Keep old columns too (they still exist in DB).

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit` and check for errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/bookings.ts
git commit -m "refactor(bookings): use commission_rate_id, subtotal, and derived balances"
```

---

## Chunk 4: Core Logic — Escrow, Balances, Refunds

### Task 11: Rewrite `src/lib/actions/balances.ts`

**Files:**
- Modify: `src/lib/actions/balances.ts`

- [ ] **Step 1: Rewrite `getUserBalance()` to use Postgres function**

```typescript
export async function getUserBalance(userId: string): Promise<UserBalance> {
  const supabase = await createClient()
  if (!supabase) return { available_balance: 0, on_hold_balance: 0, total_earned: 0 }

  const { data } = await supabase.rpc('get_user_balance', { p_user_id: userId }).single()

  return data || { available_balance: 0, on_hold_balance: 0, total_earned: 0 }
}
```

- [ ] **Step 2: Rewrite `requestWithdrawal()` — transaction-based pattern**

Key changes:
1. Call `get_user_balance` RPC instead of reading `user_balances` table
2. Insert `balance_transactions` debit record first
3. Create payout record with `amount` (the withdrawal amount), `host_id`, `status`, `payout_method`, `notes` — no `gross_amount`, `commission_rate`, `commission_amount`, `net_amount`
4. If payout insert fails, DELETE the balance_transaction record (rollback)
5. Remove all `user_balances` table references

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/balances.ts
git commit -m "refactor(balances): derive balances from transactions via Postgres function"
```

### Task 12: Rewrite `src/lib/actions/escrow.ts`

**Files:**
- Modify: `src/lib/actions/escrow.ts`

- [ ] **Step 1: Update `createEscrowHold()`**

Changes:
1. Replace `booking.host_payout_amount` read with `calc_booking_fees` RPC: `adminClient.rpc('calc_booking_fees', { p_booking_id: bookingId }).single()`
2. Remove all `user_balances` upsert/select/update operations (lines 65-87). On-hold balance is now derived from escrow_transactions.
3. Keep the escrow_transactions insert with the amount param.

- [ ] **Step 2: Update `releaseEscrow()`**

Changes:
1. Replace the booking SELECT (line 130-131) that reads `total_price, guest_fee, host_fee, platform_earnings, host_payout_amount` — instead SELECT only `id, escrow_status, is_check_in_confirmed, user_id, listing:listings(user_id, title)`, then call `calc_booking_fees` RPC to get `host_payout` and `host_fee`.
2. Remove all `user_balances` upsert/select/update operations (lines 180-209). Instead, insert a single `balance_transactions` credit record — this IS the balance update.
3. Use computed `host_payout` from the RPC for the escrow release amount.
4. Use computed `host_fee` / `subtotal` for the commission percentage in the description string.

- [ ] **Step 3: Update `refundEscrow()`**

Changes:
1. Replace `booking.total_price` and `host_payout_amount` reads with `calc_booking_fees` RPC
2. Remove all `user_balances` upsert/select/update operations (lines 320-332, 368-391). Instead, insert a `balance_transactions` refund record for the guest.
3. Keep escrow_transactions insert with amount param.

- [ ] **Step 4: Update `systemReleaseEscrow()`**

Same changes as `releaseEscrow()` but without user auth (system initiated). Replace booking SELECT (line 470-471), remove `user_balances` mutations (lines 520-550), use `calc_booking_fees` RPC.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/escrow.ts
git commit -m "refactor(escrow): use calc_booking_fees RPC, remove user_balances mutations"
```

### Task 13: Rewrite `src/lib/actions/refunds.ts`

**Files:**
- Modify: `src/lib/actions/refunds.ts`

- [ ] **Step 1: Update `initiateRefund()`**

Remove `amount` from the refund insert call (line 31). The function signature can still accept it for the audit log message, but does NOT write it to DB.

- [ ] **Step 2: Update `approveRefund()`**

Changes:
1. Replace `refund.amount` reads with `calc_refund_amount` RPC: `adminClient.rpc('calc_refund_amount', { p_refund_id: refundId }).single()`
2. Replace `booking.total_price` comparison with `calc_booking_fees` RPC to get `subtotal`
3. Remove payout adjustment that writes `gross_amount`, `commission_amount`, `net_amount` (lines 146-148). For full refund, cancel the payout. For partial, just update status.
4. Remove `user_balances` on_hold_balance updates (lines 169-185) — on_hold is now derived from escrow_transactions.
5. Use computed refund amount for the guest notification message.

- [ ] **Step 3: Update `rejectRefund()` and `processRefund()`**

Replace `refund.amount` reads in notifications/audit logs with `calc_refund_amount` RPC.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/refunds.ts
git commit -m "refactor(refunds): use calc_refund_amount RPC, remove stored amount reads"
```

### Task 14: Update `src/lib/actions/bookings.ts` and `src/lib/utils/refund-calculator.ts`

**Files:**
- Modify: `src/lib/actions/bookings.ts`
- Modify: `src/lib/utils/refund-calculator.ts`

- [ ] **Step 1: Update `updateBookingStatusGuest()` cancellation flow**

Changes:
1. In the booking SELECT (line 89), add `subtotal` alongside `total_price` (both exist during transition)
2. Replace `calculateRefund(booking.total_price, ...)` with `calculateRefund(booking.subtotal, ...)`
3. Remove `amount: refundCalc.refundAmount` from the refunds insert (line 173)
4. Keep `refundCalc.refundAmount` for escrow_transactions insert (amount stays on escrow) and notification messages

- [ ] **Step 2: Update `previewCancellationRefund()`**

In the SELECT (line 256), add `subtotal`. Use `booking.subtotal` in `calculateRefund()` call.

- [ ] **Step 3: Update `calculateRefund()` in `refund-calculator.ts`**

Rename parameter `totalPrice` to `subtotal` for clarity. The logic stays the same.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/bookings.ts src/lib/utils/refund-calculator.ts
git commit -m "refactor(cancellation): use subtotal for refund calculation"
```

---

## Chunk 5: Admin UI, API Routes & Dashboard

### Task 15: Update admin payments

**Files:**
- Modify: `src/app/admin/payments/actions.ts`
- Modify: `src/app/admin/payments/columns.tsx`
- Modify: `src/app/admin/payments/page.tsx`

- [ ] **Step 1: Update `actions.ts`**

For the escrow hold amount, call `calc_booking_fees` RPC to get `total_with_fees` instead of reading `total_price`.

- [ ] **Step 2: Update `columns.tsx` and `page.tsx`**

Replace `total_price` in the interface/SELECT/display with `subtotal`. Use `calc_booking_fees` RPC to show `total_with_fees` (what guest pays).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/payments/
git commit -m "refactor(admin/payments): use subtotal and computed fees"
```

### Task 16: Update admin payouts

**Files:**
- Modify: `src/app/admin/payouts/page.tsx`
- Modify: `src/app/admin/payouts/columns.tsx`

- [ ] **Step 1: Update `columns.tsx`**

The `Payout` interface: replace `gross_amount`, `commission_amount`, `net_amount` with optional computed fields that the page populates.

```typescript
export interface Payout {
  id: string
  host_id: string
  booking_id: string | null
  amount: number | null          // Only set for withdrawals
  computed_gross?: number         // From calc_payout_amounts
  computed_commission?: number    // From calc_payout_amounts
  computed_net?: number           // From calc_payout_amounts
  status: string
  created_at: string
  host: { full_name: string | null; email: string } | null
}
```

Update column definitions to use `computed_gross || amount`, `computed_commission`, `computed_net || amount`.

- [ ] **Step 2: Update `page.tsx`**

`getPayouts()`: SELECT `id, host_id, booking_id, amount, status, created_at, host:profiles(...)`. For each payout with `booking_id`, call `calc_payout_amounts` to populate computed fields.

`getHeldEscrows()`: Replace `total_price, host_fee, host_payout_amount` with `subtotal, commission_rate_id`. Call `calc_booking_fees` for each to get payout amount.

`getPayoutStats()`: For withdrawal payouts (`booking_id IS NULL`), sum `amount`. For booking payouts, use a SQL query that joins through `commission_rates` to compute net amounts.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/payouts/
git commit -m "refactor(admin/payouts): use computed payout amounts"
```

### Task 17: Update admin financials

**Files:**
- Modify: `src/app/admin/financials/page.tsx`

- [ ] **Step 1: Update `getFinancialStats()`**

Replace direct reads of `total_price`, `platform_earnings` with an RPC or SQL query that joins through `commission_rates`:

Use `adminClient.rpc('execute_sql', ...)` or restructure to call `calc_booking_fees` per booking, or write a bulk aggregation function.

Simpler approach: SELECT `subtotal, commission_rate_id` from bookings, JOIN `commission_rates`, compute aggregates inline.

For payout stats: Use `amount` for withdrawal payouts directly. For booking payouts, derive via join.

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/financials/page.tsx
git commit -m "refactor(admin/financials): use computed financial values"
```

### Task 18: Update admin refunds

**Files:**
- Modify: `src/app/admin/refunds/page.tsx`
- Modify: `src/app/admin/refunds/refund-actions.tsx`

- [ ] **Step 1: Update pages**

Replace `refund.amount` display with computed amount from `calc_refund_amount` RPC. Replace `booking.total_price` with `booking.subtotal`.

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/refunds/
git commit -m "refactor(admin/refunds): use computed refund amounts"
```

### Task 19: Update payout processing API route

**Files:**
- Modify: `src/app/api/admin/payouts/process/route.ts`

- [ ] **Step 1: Update route handler**

Replace `net_amount` reads in notifications/audit logs with computed values from `calc_payout_amounts` RPC or from `amount` for withdrawals.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/payouts/process/route.ts
git commit -m "refactor(api/payouts): use computed amounts in notifications"
```

### Task 20: Update dashboard pages

**Files:**
- Modify: `src/app/(dashboard)/dashboard/trips/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/trips/guest-trip-actions.tsx`
- Modify: `src/app/(dashboard)/dashboard/bookings/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/balance/page.tsx`

- [ ] **Step 1: Update trips page**

Replace `total_price` references with `subtotal`. For display of total amount paid, compute via `subtotal + guest_fee` using the booking's commission rate.

- [ ] **Step 2: Update guest-trip-actions**

Pass computed refund amounts from parent page.

- [ ] **Step 3: Update bookings page**

Replace `total_price` in type definitions and data transformations.

- [ ] **Step 4: Update balance page**

Replace `user_balances` table query with `get_user_balance` RPC.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/dashboard/"
git commit -m "refactor(dashboard): use computed values and derived balances"
```

### Task 21: Update booking/listing pages and listing components

**Files:**
- Modify: `src/app/(main)/listings/[id]/book/page.tsx`
- Modify: `src/app/(main)/listings/[id]/page.tsx`
- Modify: `src/app/admin/settings/commissions/page.tsx`
- Modify: `src/app/admin/settings/commissions/commissions-form.tsx`
- Modify: `src/components/features/listings/listings-grid.tsx`
- Modify: `src/components/features/listings/listings-explorer.tsx`
- Modify: `src/lib/supabase/queries.ts`

- [ ] **Step 1: Update book page**

Replace `user_balances` table query with `get_user_balance` RPC. The commission rate display uses `getCommissionRates()` which already returns the `id` field.

- [ ] **Step 2: Update listing detail page and commission settings**

Verify `getCommissionRates()` works with the new interface (now has `id`). Update if needed.

- [ ] **Step 3: Check listing grid/explorer components**

The `totalPrice` in listing components is the listing's display price for date ranges (not booking fee data). Verify it doesn't reference booking columns. Update if needed.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(main)/listings/" src/app/admin/settings/commissions/ src/components/features/listings/ src/lib/supabase/queries.ts
git commit -m "refactor(listings): use updated commission rates and derived balances"
```

### Task 22: Update type definitions

**Files:**
- Modify: `src/types/database.ts`
- Regenerate: `src/types/supabase.ts`

- [ ] **Step 1: Update `src/types/database.ts`**

In the `Booking` interface: add `subtotal: number` and `commission_rate_id: string`. Keep `total_price: number` for now (column still exists until Chunk 6).

- [ ] **Step 2: Regenerate Supabase types**

Use Supabase MCP `generate_typescript_types` to get updated types, or run:
```bash
npx supabase gen types typescript --project-id xpvrgdpsvffmttlwwfuo > src/types/supabase.ts
```

- [ ] **Step 3: Fix TypeScript errors**

Run: `npx tsc --noEmit` and fix remaining type errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/
git commit -m "refactor(types): add subtotal and commission_rate_id, regenerate Supabase types"
```

---

## Chunk 6: Destructive Schema Changes (Final)

All code now uses the new columns/functions. Safe to drop old columns and tables.

### Task 23: Drop old booking columns

- [ ] **Step 1: Drop columns**

Apply migration:

```sql
ALTER TABLE public.bookings
  DROP COLUMN IF EXISTS total_price,
  DROP COLUMN IF EXISTS guest_fee,
  DROP COLUMN IF EXISTS host_fee,
  DROP COLUMN IF EXISTS platform_earnings,
  DROP COLUMN IF EXISTS host_payout_amount;
```

- [ ] **Step 2: Verify**

Execute SQL: `SELECT column_name FROM information_schema.columns WHERE table_name = 'bookings' AND table_schema = 'public' ORDER BY ordinal_position;`
Expected: No `total_price`, `guest_fee`, `host_fee`, `platform_earnings`, `host_payout_amount`.

### Task 24: Drop old payout columns

- [ ] **Step 1: Rename and drop columns**

Apply migration:

```sql
ALTER TABLE public.payouts RENAME COLUMN gross_amount TO amount;
ALTER TABLE public.payouts ALTER COLUMN amount DROP NOT NULL;
ALTER TABLE public.payouts
  DROP COLUMN IF EXISTS commission_rate,
  DROP COLUMN IF EXISTS commission_amount,
  DROP COLUMN IF EXISTS net_amount;
```

- [ ] **Step 2: Verify**

Execute SQL: `SELECT column_name FROM information_schema.columns WHERE table_name = 'payouts' AND table_schema = 'public' ORDER BY ordinal_position;`

### Task 25: Drop refunds amount column

- [ ] **Step 1: Drop column**

Apply migration:

```sql
ALTER TABLE public.refunds DROP COLUMN IF EXISTS amount;
```

### Task 26: Drop `user_balances` table

- [ ] **Step 1: Drop table**

Apply migration:

```sql
DROP TABLE IF EXISTS public.user_balances;
```

- [ ] **Step 2: Verify**

Execute SQL: `SELECT count(*) FROM information_schema.tables WHERE table_name = 'user_balances' AND table_schema = 'public';`
Expected: count = 0.

### Task 27: Remove commission keys from `platform_settings`

- [ ] **Step 1: Delete keys**

Apply migration:

```sql
DELETE FROM public.platform_settings
WHERE key IN ('host_commission_rate', 'guest_commission_rate', 'best_offer_commission_rate');
```

- [ ] **Step 2: Verify**

Execute SQL: `SELECT * FROM public.platform_settings;`
Expected: Only `auto_cancel_days` and `auto_complete_days` remain.

### Task 28: Regenerate types and fix compilation

- [ ] **Step 1: Regenerate Supabase types**

Use `generate_typescript_types` MCP tool or CLI.

- [ ] **Step 2: Update `src/types/database.ts`**

Remove `total_price` from the `Booking` interface (now fully replaced by `subtotal`).

- [ ] **Step 3: Fix all TypeScript errors**

Run: `npx tsc --noEmit` and fix any remaining issues.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(db): drop old financial columns, user_balances table, and commission settings keys"
```

---

## Chunk 7: Verification & Cleanup

### Task 29: Run security and performance advisors

- [ ] **Step 1: Security advisor**

Use Supabase MCP `get_advisors` type="security". Check `commission_rates` RLS policies.

- [ ] **Step 2: Performance advisor**

Use Supabase MCP `get_advisors` type="performance".

- [ ] **Step 3: Fix any critical findings**

### Task 30: Full compilation and smoke test

- [ ] **Step 1: TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Start dev server and smoke test**

Run: `npm run dev`

Test these paths:
1. Create a booking → verify `commission_rate_id` is set, `subtotal` stored
2. Admin financials → computed values display correctly
3. Admin payouts → pending escrows show correct amounts
4. Balance page → `get_user_balance` returns correct values
5. Admin settings → commission rates CRUD works
6. Cancel a booking → refund computed correctly

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "refactor(financial): complete financial system normalization

Replaces pre-calculated stored values with reference-based computed values:
- New commission_rates table with history tracking
- Bookings reference active rate via FK, store subtotal only
- All fees computed on-the-fly by Postgres functions
- User balances derived from balance_transactions
- Payouts and refunds use computed amounts
- Escrow transactions retain stored amounts for partial operations"
```
