# Unified Transaction Ledger Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace multi-table financial amounts with a single `transactions` ledger table, rename `escrow_transactions` → `escrow`, drop `balance_transactions`, and update all application code.

**Architecture:** A single `transactions` table becomes the sole source of truth for all monetary values. Every other financial table (`escrow`, `refunds`, `payouts`) stores only metadata — status, reasons, actors. User balance is always `SUM(transactions.amount)`. Reversals are new compensating rows, never edits/deletes.

**Tech Stack:** Supabase (Postgres), Next.js 15 (App Router), TypeScript, Server Actions

**Spec:** [docs/superpowers/specs/2026-03-16-unified-transaction-ledger-design.md](../specs/2026-03-16-unified-transaction-ledger-design.md)

**Verification:** No test framework. Verify via `npm run build` (TypeScript compilation) after code changes, and Supabase migration application for schema changes. Regenerate types with `npm run gen-types` after migrations.

**Supabase project ID:** `xpvrgdpsvffmttlwwfuo` (remote, no local dev DB)

---

## Chunk 1: Database Migration

### Task 1: Create and apply the migration SQL

This is a single atomic migration that does everything on the database side.

**Files:**
- Create: `supabase/migrations/059_unified_transaction_ledger.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Migration: Unified Transaction Ledger
-- Spec: docs/superpowers/specs/2026-03-16-unified-transaction-ledger-design.md

-- =============================================================
-- STEP 1: Drop balance_transactions table (before escrow rename to avoid FK confusion)
-- =============================================================

-- Drop RLS policies first
DROP POLICY IF EXISTS "Users can view their own balance transactions" ON balance_transactions;
DROP POLICY IF EXISTS "Service role can insert balance transactions" ON balance_transactions;
DROP POLICY IF EXISTS "Service role can update balance transactions" ON balance_transactions;
DROP POLICY IF EXISTS "Service role can delete balance transactions" ON balance_transactions;
DROP POLICY IF EXISTS "Staff can view all balance transactions" ON balance_transactions;

-- Drop the table (cascades FKs)
DROP TABLE IF EXISTS balance_transactions CASCADE;

-- Drop related enums
DROP TYPE IF EXISTS balance_tx_type CASCADE;
DROP TYPE IF EXISTS balance_transaction_ref_type CASCADE;

-- =============================================================
-- STEP 2: Create transaction_type enum and transactions table
-- =============================================================

CREATE TYPE transaction_type AS ENUM (
  'payment',
  'guest_fee',
  'earning',
  'commission_base',
  'commission_promo',
  'refund',
  'withdrawal',
  'cash_commission',
  'reversal'
);

CREATE TABLE transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id),
  type            transaction_type NOT NULL,
  amount          numeric NOT NULL,
  booking_id      uuid REFERENCES bookings(id),
  refund_id       uuid REFERENCES refunds(id),
  payout_id       uuid REFERENCES payouts(id),
  reversal_of_id  uuid REFERENCES transactions(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  notes           text,

  CONSTRAINT transactions_has_reference
    CHECK (booking_id IS NOT NULL OR payout_id IS NOT NULL OR refund_id IS NOT NULL),

  CONSTRAINT transactions_reversal_integrity
    CHECK (
      (type = 'reversal' AND reversal_of_id IS NOT NULL)
      OR
      (type != 'reversal' AND reversal_of_id IS NULL)
    )
);

-- Prevent double-reversals
CREATE UNIQUE INDEX transactions_single_reversal
  ON transactions (reversal_of_id) WHERE reversal_of_id IS NOT NULL;

-- Query performance indexes
CREATE INDEX transactions_user_id ON transactions (user_id);
CREATE INDEX transactions_booking_id ON transactions (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX transactions_payout_id ON transactions (payout_id) WHERE payout_id IS NOT NULL;
CREATE INDEX transactions_refund_id ON transactions (refund_id) WHERE refund_id IS NOT NULL;

-- Reversal sign enforcement trigger
CREATE OR REPLACE FUNCTION check_reversal_sign()
RETURNS trigger AS $$
BEGIN
  IF NEW.type = 'reversal' THEN
    IF NEW.amount != -1 * (SELECT amount FROM transactions WHERE id = NEW.reversal_of_id) THEN
      RAISE EXCEPTION 'Reversal amount must be opposite sign of original transaction';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_reversal_sign
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION check_reversal_sign();

-- RLS policies
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions" ON transactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Staff can view all transactions" ON transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM staff_profiles WHERE id = auth.uid())
  );

-- No INSERT/UPDATE/DELETE policies for authenticated users.
-- All transaction creation happens server-side via service_role client.

-- =============================================================
-- STEP 3: Rename escrow_transactions → escrow
-- =============================================================

-- Drop old RLS policies (they reference the old table name)
DROP POLICY IF EXISTS "Users can view escrow for their bookings" ON escrow_transactions;
DROP POLICY IF EXISTS "Service role can manage escrow transactions" ON escrow_transactions;
DROP POLICY IF EXISTS "Staff can view all escrow transactions" ON escrow_transactions;
DROP POLICY IF EXISTS "Service role can insert escrow transactions" ON escrow_transactions;
DROP POLICY IF EXISTS "Service role can update escrow transactions" ON escrow_transactions;

ALTER TABLE escrow_transactions RENAME TO escrow;

-- Recreate RLS policies with new table name
CREATE POLICY "Users can view escrow for their bookings" ON escrow
  FOR SELECT USING (
    booking_id IN (
      SELECT id FROM bookings WHERE user_id = auth.uid()
      UNION
      SELECT b.id FROM bookings b
        JOIN listings l ON b.listing_id = l.id
        WHERE l.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view all escrow" ON escrow
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM staff_profiles WHERE id = auth.uid())
  );

-- =============================================================
-- STEP 4: Drop amount from escrow
-- =============================================================

ALTER TABLE escrow DROP COLUMN IF EXISTS amount;

-- =============================================================
-- STEP 5: Drop amount from payouts
-- =============================================================

ALTER TABLE payouts DROP COLUMN IF EXISTS amount;

-- =============================================================
-- STEP 6: Rewrite get_user_balance() function
-- =============================================================

CREATE OR REPLACE FUNCTION get_user_balance(p_user_id uuid)
RETURNS TABLE (
  available_balance numeric,
  on_hold_balance   numeric,
  total_earned      numeric
) AS $$
DECLARE
  v_total numeric;
  v_guest_held numeric;
  v_host_held numeric;
  v_earned numeric;
BEGIN
  -- Total ledger balance (all transactions)
  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_total
  FROM transactions t
  WHERE t.user_id = p_user_id;

  -- Guest on-hold: user's payment + guest_fee txns on bookings still in escrow
  SELECT COALESCE(ABS(SUM(t.amount)), 0)
  INTO v_guest_held
  FROM transactions t
  JOIN bookings b ON t.booking_id = b.id
  WHERE t.user_id = p_user_id
    AND t.type IN ('payment', 'guest_fee')
    AND b.escrow_status = 'held';

  -- Host on-hold: expected payouts for bookings on user's listings that are held
  SELECT COALESCE(SUM(fees.host_payout), 0)
  INTO v_host_held
  FROM bookings b
  JOIN listings l ON b.listing_id = l.id
  CROSS JOIN LATERAL calc_booking_fees(b.id) AS fees
  WHERE l.user_id = p_user_id
    AND b.escrow_status = 'held';

  -- Total earned: only earning-type transactions
  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_earned
  FROM transactions t
  WHERE t.user_id = p_user_id
    AND t.type = 'earning';

  available_balance := v_total - v_guest_held;
  on_hold_balance := v_guest_held + v_host_held;
  total_earned := v_earned;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================
-- STEP 7: Drop functions that are no longer needed
-- =============================================================

DROP FUNCTION IF EXISTS calc_payout_amounts(uuid);
DROP FUNCTION IF EXISTS create_payout_for_booking(uuid, numeric);
```

- [ ] **Step 1b: Audit for DB functions/views referencing `escrow_transactions`**

Before applying, check if any Postgres functions, views, or triggers reference `escrow_transactions` by name. Run this query on the Supabase SQL Editor:
```sql
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_definition LIKE '%escrow_transactions%'
  AND routine_schema = 'public';
```

If any functions are found, add ALTER/REPLACE statements to the migration to update them. The `get_user_balance()` function currently references `escrow_transactions` — verify it gets fully replaced by Step 6 of the migration (which it does via `CREATE OR REPLACE`).

- [ ] **Step 2: Apply the migration to Supabase**

Run: `npx supabase db push --project-ref xpvrgdpsvffmttlwwfuo`

If the CLI push is not configured, apply manually via the Supabase SQL Editor on the dashboard, or use:
```bash
npx supabase migration up --project-ref xpvrgdpsvffmttlwwfuo
```

Expected: Migration applies cleanly. All old tables/columns/functions are dropped, new `transactions` table exists.

- [ ] **Step 3: Regenerate TypeScript types**

Run: `npm run gen-types`

This runs: `supabase gen types typescript --project-id xpvrgdpsvffmttlwwfuo > src/types/supabase.ts`

Expected: `src/types/supabase.ts` is regenerated with:
- New `transactions` table types with `transaction_type` enum
- `escrow` table (renamed from `escrow_transactions`) WITHOUT `amount` column
- `payouts` table WITHOUT `amount` column
- No `balance_transactions` table types
- No `balance_tx_type` or `balance_transaction_ref_type` enums

- [ ] **Step 4: Verify the build breaks as expected**

Run: `npm run build`

Expected: TypeScript compilation FAILS with errors in all files that reference `balance_transactions`, `escrow_transactions`, or `payouts.amount`. This confirms the types are correct and shows us exactly which files need updating. Save the error output — it's the checklist for the remaining tasks.

- [ ] **Step 5: Commit the migration and regenerated types**

```bash
git add supabase/migrations/059_unified_transaction_ledger.sql src/types/supabase.ts
git commit -m "feat(db): add unified transactions ledger, rename escrow, drop balance_transactions"
```

---

## Chunk 2: Core Action Files Rewrite

These are the server-side action files that contain all the financial business logic. They must be rewritten in dependency order: `escrow.ts` first (it's the hub), then `balances.ts`, `refunds.ts`, and `bookings.ts`.

### Task 2: Rewrite `src/lib/actions/escrow.ts`

This is the most critical file — it orchestrates all escrow operations and creates the majority of financial records. After rewrite, it will:
- Create `transactions` rows instead of writing amounts to `escrow_transactions` or `balance_transactions`
- Write to the `escrow` table (renamed) for audit trail only (no amounts)
- Use `calc_booking_fees()` RPC to derive amounts when creating transactions

**Files:**
- Modify: `src/lib/actions/escrow.ts`

**Current functions and what changes:**

1. `createEscrowHold(bookingId, amount)` → Remove `amount` param. Create `payment` + `guest_fee` transaction rows. Insert into `escrow` (no amount).
2. `releaseEscrow(bookingId)` → Create `earning` + `commission_base` (+ optional `commission_promo`) transaction rows. Insert into `escrow` for audit. No more `balance_transactions` insert.
3. `refundEscrow(bookingId, amount, reason, refundType)` → Create `refund` transaction row (+ `reversal` rows if host already paid). Insert into `escrow` for audit. Remove phantom `amount` write to `refunds` table.
4. `systemReleaseEscrow(bookingId)` → Same changes as `releaseEscrow` but for cron context.

- [ ] **Step 1: Read the current file to understand all function signatures and logic**

Read `src/lib/actions/escrow.ts` in full. Note every `.from('escrow_transactions')`, `.from('balance_transactions')`, and `.from('refunds')` call with line numbers.

- [ ] **Step 2: Rewrite `createEscrowHold`**

The function should:
1. Call `calc_booking_fees()` to get `subtotal`, `guest_fee`, `total_with_fees`
2. Insert TWO `transactions` rows: `{ type: 'payment', amount: -subtotal, user_id: guestId, booking_id }` and `{ type: 'guest_fee', amount: -guest_fee, user_id: guestId, booking_id }`
3. Insert ONE `escrow` row: `{ booking_id, type: 'hold', status: 'completed', initiated_by }` (no amount)
4. Update `bookings.escrow_status = 'held'`

Remove the `amount` parameter from the function signature — amounts are always derived from `calc_booking_fees()`.

- [ ] **Step 3: Rewrite `releaseEscrow`**

The function should:
1. Call `calc_booking_fees()` to get `subtotal`, `host_fee`, `host_payout`
2. Look up the booking to get `host_id` (via listing → user_id)
3. Insert `transactions` rows:
   - `{ type: 'earning', amount: +subtotal, user_id: hostId, booking_id }`
   - `{ type: 'commission_base', amount: -host_fee, user_id: hostId, booking_id }`
   - If booking has best_offer applied: `{ type: 'commission_promo', amount: -promo_fee, user_id: hostId, booking_id }`
4. Insert `escrow` row: `{ booking_id, type: 'release', status: 'completed', initiated_by }` (no amount)
5. Update `bookings.escrow_status = 'released'`
6. NO `balance_transactions` insert — that table no longer exists

- [ ] **Step 4: Rewrite `refundEscrow`**

The function should:
1. Call `calc_refund_amount()` to get the refund amount
2. Get guest user_id from booking
3. Insert `transactions` rows:
   - `{ type: 'refund', amount: +refund_amount, user_id: guestId, booking_id, refund_id }`
   - If full refund AND host already paid (escrow_status = 'released'):
     - Query all host `earning` and `commission_*` transactions for this booking
     - Create `reversal` rows for each one (with `reversal_of_id` pointing to original)
   - If full refund: also create reversal for guest_fee transaction
4. Insert `escrow` row: `{ booking_id, type: 'refund', status: 'completed', initiated_by }` (no amount)
5. Update `bookings.escrow_status` based on refund type ('refunded' for full, keep 'held' for partial)
6. Remove the phantom `.from('refunds').insert({ amount })` — refunds table has no amount column

- [ ] **Step 5: Rewrite `systemReleaseEscrow`**

Same logic as `releaseEscrow` but:
- Uses admin/service_role client (no user context)
- `initiated_by` can be null or a system identifier
- No `balance_transactions` insert

- [ ] **Step 6: Verify build**

Run: `npm run build`

Expected: Errors in `escrow.ts` should be resolved. Other files may still have errors (that's expected — we fix them in subsequent tasks).

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/escrow.ts
git commit -m "refactor(escrow): rewrite to use transactions ledger instead of balance_transactions"
```

---

### Task 3: Rewrite `src/lib/actions/balances.ts`

This file handles balance queries and withdrawal requests. After rewrite:
- `getUserBalance()` calls the rewritten `get_user_balance()` RPC (no changes needed here — same function name, same return shape)
- `getBalanceTransactions()` queries `transactions` table instead of `balance_transactions`
- `requestWithdrawal()` creates a `transactions` row (type: 'withdrawal') + `payouts` row, no `balance_transactions`

**Files:**
- Modify: `src/lib/actions/balances.ts`

- [ ] **Step 1: Read the current file**

Read `src/lib/actions/balances.ts` in full.

- [ ] **Step 2: Rewrite `getBalanceTransactions`**

Change `.from('balance_transactions')` to `.from('transactions')`.
Update the select query to use the new column structure (no `reference_type`, `balance_after` — use `type` and the FK columns directly).
Map the `transaction_type` enum values to display labels.

- [ ] **Step 3: Rewrite `requestWithdrawal`**

**Important:** The `transactions` table has a CHECK constraint requiring at least one of `booking_id`, `payout_id`, or `refund_id` to be non-null. So the payout must be created FIRST.

1. Call `get_user_balance()` to check `available_balance >= amount`
2. Insert `payouts` row FIRST: `{ host_id: user_id, status: 'pending', payout_method, notes }` (no `amount` column)
3. Insert `transactions` row with the payout_id: `{ type: 'withdrawal', amount: -amount, user_id, payout_id: newPayout.id }`
4. On failure of step 3: delete the payout row (rollback)

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/balances.ts
git commit -m "refactor(balances): rewrite to use transactions ledger"
```

---

### Task 4: Rewrite `src/lib/actions/refunds.ts`

This file handles refund request/approval/rejection workflows. **Critical:** `approveRefund()` is an independent code path from `refundEscrow()` in `escrow.ts`. It must create `transactions` rows for the refund, not just update table references.

After rewrite:
- `approveRefund()` creates `refund` transaction row (+ `reversal` rows for host if full refund and host was paid) + `reversal` for guest_fee if full refund
- `rejectRefund()` updates escrow on `escrow` table, removes phantom `admin_notes` write
- References to `escrow_transactions` become `escrow`

**Files:**
- Modify: `src/lib/actions/refunds.ts`

- [ ] **Step 1: Read the current file**

Read `src/lib/actions/refunds.ts` in full. Pay close attention to `approveRefund()` — it does NOT call `refundEscrow()`. It independently handles the approval flow.

- [ ] **Step 2: Update all table references**

- Replace all `.from('escrow_transactions')` with `.from('escrow')`
- Remove any reference to `amount` when writing to `escrow` or `refunds`
- Fix `rejectRefund()`: remove `admin_notes` write (column doesn't exist)

- [ ] **Step 3: Add transaction row creation to `approveRefund()`**

After `calc_refund_amount()` returns the refund amount, `approveRefund()` must create transaction rows:

1. Get guest `user_id` from the booking
2. Create `refund` transaction: `{ type: 'refund', amount: +refund_amount, user_id: guestId, booking_id, refund_id }`
3. If full refund:
   - Create `reversal` for guest_fee: query the original `guest_fee` transaction for this booking, create `{ type: 'reversal', amount: +original_guest_fee, user_id: guestId, booking_id, reversal_of_id: original_tx.id }`
   - If host was already paid (`escrow_status = 'released'`):
     - Query ALL host transactions for this booking (`earning`, `commission_base`, `commission_promo`)
     - Create a `reversal` row for EACH one (iterating, not a single row)
4. Update `booking.escrow_status` to `'refunded'` (full) or keep `'held'` (partial)

**Alternative:** Refactor `approveRefund()` to delegate to `refundEscrow()` for the financial operations (creating transactions + escrow audit row), keeping only the status management in `approveRefund()`. This avoids duplicating the reversal logic. Evaluate which approach is cleaner when reading the actual code.

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/refunds.ts
git commit -m "refactor(refunds): create transaction rows in approveRefund, update table references"
```

---

### Task 5: Rewrite `src/lib/actions/bookings.ts`

This file has booking cancellation logic that directly writes to `escrow_transactions` with amounts.

**Files:**
- Modify: `src/lib/actions/bookings.ts`

- [ ] **Step 1: Read the current file**

Read `src/lib/actions/bookings.ts` in full. Focus on the cancellation flow around line 180-190 and the `systemReleaseEscrow` call around line 317.

- [ ] **Step 2: Update escrow inserts**

- Replace `.from('escrow_transactions')` with `.from('escrow')`
- Remove `amount` from all escrow insert objects
- The cancellation flow should create refund `transactions` rows via the rewritten `refundEscrow()` function in `escrow.ts` rather than doing it inline

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/bookings.ts
git commit -m "refactor(bookings): update escrow references and remove inline amount writes"
```

---

### Task 6: Rewrite `src/lib/supabase/bookings.ts`

This file handles booking creation including balance payment and escrow hold creation.

**Files:**
- Modify: `src/lib/supabase/bookings.ts`

- [ ] **Step 1: Read the current file**

Read `src/lib/supabase/bookings.ts` in full. Focus on:
- Line ~151: `balance_transactions` debit insert for balance payment
- Line ~205: `balance_transactions` update with booking reference
- Line ~215: `escrow_transactions` insert for escrow hold

- [ ] **Step 2: Rewrite balance payment flow**

When `payWithBalance = true`:
1. Replace `.from('balance_transactions').insert(...)` with `.from('transactions').insert(...)`:
   - `{ type: 'payment', amount: -subtotal, user_id, booking_id }`
   - `{ type: 'guest_fee', amount: -guest_fee, user_id, booking_id }`
2. Replace `.from('escrow_transactions').insert(...)` with `.from('escrow').insert(...)`:
   - Remove `amount` field from the insert object

- [ ] **Step 3: Update escrow hold for receipt payment flow**

When `payWithBalance = false` (receipt upload):
- Replace `.from('escrow_transactions').insert(...)` with `.from('escrow').insert(...)` (if applicable at booking creation)
- Note: Per the spec, transactions are NOT created at booking creation for receipt payments — only at admin verification (handled by `createEscrowHold` in escrow.ts)

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/bookings.ts
git commit -m "refactor(bookings): use transactions ledger for balance payments"
```

---

## Chunk 3: Admin UI and API Routes

### Task 7: Update `src/app/admin/payouts/columns.tsx`

The `Payout` interface and amount display need updating since `payouts.amount` no longer exists.

**Files:**
- Modify: `src/app/admin/payouts/columns.tsx`

- [ ] **Step 1: Read the current file**

Read `src/app/admin/payouts/columns.tsx`. Note the `Payout` interface (line ~7-18) and the `amount` column render (line ~67).

- [ ] **Step 2: Update the Payout interface**

Remove `amount: number | null` from the interface. Add `transactions: { amount: number }[]` or a computed `total_amount` field that gets passed from the parent page.

The cleanest approach: the parent `page.tsx` fetches payout data and joins with `transactions` to compute the total. The columns component receives a pre-computed `total_amount`.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/payouts/columns.tsx
git commit -m "refactor(admin/payouts): remove amount field, use computed total from transactions"
```

---

### Task 8: Update `src/app/admin/payouts/page.tsx` and `release-actions.tsx`

This page fetches payout data and displays stats. Must join with `transactions` for amounts. Also check `release-actions.tsx` which may accept an `amount` prop for display.

**Files:**
- Modify: `src/app/admin/payouts/page.tsx`
- Modify: `src/app/admin/payouts/release-actions.tsx` (if it references `amount`)

- [ ] **Step 1: Read the current file**

Read `src/app/admin/payouts/page.tsx`. Note:
- Line ~17: payout query selecting `amount`
- Line ~91-96: summing `p.amount` for stats

- [ ] **Step 2: Rewrite payout amount fetching**

For each payout, fetch the linked transaction amount:
```typescript
// Option A: Fetch transactions alongside payouts
const { data: payouts } = await supabase
  .from('payouts')
  .select('*, transactions(amount)')

// Then compute total for each payout:
// payout.total_amount = payout.transactions.reduce((sum, t) => sum + t.amount, 0)
```

Or use an RPC if the join is complex.

Update stat calculations to use the computed amounts instead of `p.amount`.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/payouts/page.tsx
git commit -m "refactor(admin/payouts): compute payout amounts from transactions table"
```

---

### Task 9: Update `src/app/admin/financials/page.tsx`

This page computes platform financial stats. Reads `payouts.amount` directly.

**Files:**
- Modify: `src/app/admin/financials/page.tsx`

- [ ] **Step 1: Read the current file**

Read `src/app/admin/financials/page.tsx`. Note:
- Line ~86: `.from('payouts').select('amount, status')`
- Line ~91-95: Summing amounts by status

- [ ] **Step 2: Rewrite payout stats**

Replace the direct `payouts.amount` query with a join through `transactions`:
```typescript
const { data: payouts } = await supabase
  .from('payouts')
  .select('id, status, transactions(amount)')
```

Compute pending/completed totals by summing `payout.transactions` amounts grouped by `payout.status`.

For platform earnings, query `transactions` directly by the types that represent platform income:
```typescript
const { data: earnings } = await supabase
  .from('transactions')
  .select('amount, type')
  .in('type', ['guest_fee', 'commission_base', 'commission_promo', 'cash_commission'])

// Platform earnings = ABS(SUM of these negative-for-user amounts)
// These are all negative from the user's perspective, so negate to get platform's positive earnings
const platformEarnings = -(earnings?.reduce((sum, t) => sum + t.amount, 0) || 0)
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/financials/page.tsx
git commit -m "refactor(admin/financials): compute stats from transactions ledger"
```

---

### Task 10: Update `src/app/api/admin/payouts/process/route.ts`

This API route processes payouts and uses `payout.amount` in notifications and audit logs.

**Files:**
- Modify: `src/app/api/admin/payouts/process/route.ts`

- [ ] **Step 1: Read the current file**

Read the file. Note:
- Line ~56: Fetching payout
- Line ~123: `const payoutAmount = payout.amount || 0`
- Line ~150: Amount in audit log entity_name

- [ ] **Step 2: Add transaction amount lookup**

After fetching the payout, fetch the linked transaction amount:
```typescript
const { data: txns } = await supabase
  .from('transactions')
  .select('amount')
  .eq('payout_id', payout.id)

const payoutAmount = Math.abs(txns?.reduce((sum, t) => sum + t.amount, 0) || 0)
```

Replace all `payout.amount` references with `payoutAmount`.

When a payout is refused OR cancelled (both `fail` and `cancel` actions in the route), create a reversal transaction:
```typescript
// Find the original withdrawal transaction
const { data: originalTxn } = await supabase
  .from('transactions')
  .select('id, amount')
  .eq('payout_id', payout.id)
  .eq('type', 'withdrawal')
  .single()

// Create reversal (for both 'fail' and 'cancel' actions)
await supabase.from('transactions').insert({
  user_id: payout.host_id,
  type: 'reversal',
  amount: -originalTxn.amount,  // opposite sign
  payout_id: payout.id,
  reversal_of_id: originalTxn.id,
  notes: action === 'fail' ? 'Payout refused by admin' : 'Payout cancelled'
})
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/payouts/process/route.ts
git commit -m "refactor(api/payouts): compute amounts from transactions, add reversal on refusal"
```

---

### Task 11: Update `src/app/admin/refunds/` pages

Refund display pages need to show amounts from `transactions` instead of computed or stored values.

**Files:**
- Modify: `src/app/admin/refunds/page.tsx`
- Modify: `src/app/admin/refunds/refund-actions.tsx`

- [ ] **Step 1: Read both files**

Read `src/app/admin/refunds/page.tsx` and `src/app/admin/refunds/refund-actions.tsx`.

- [ ] **Step 2: Update refund amount display**

For refund display, fetch the linked transaction:
```typescript
const { data: refunds } = await supabase
  .from('refunds')
  .select('*, transactions(amount)')
```

The refund amount is `refund.transactions[0]?.amount` (there should be exactly one `refund` type transaction per refund_id). If the refund is still pending (not yet processed), compute using `calc_refund_amount()` RPC.

- [ ] **Step 3: Update refund actions**

In `refund-actions.tsx`, ensure that:
- `approveRefund` still uses `calc_refund_amount()` (no change needed)
- Any `escrow_transactions` references become `escrow`
- The actual transaction row creation happens in `escrow.ts` `refundEscrow()`, not here

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/refunds/
git commit -m "refactor(admin/refunds): display amounts from transactions ledger"
```

---

### Task 12: Update `src/app/admin/payments/actions.ts`

This file approves booking payments and triggers escrow hold creation.

**Files:**
- Modify: `src/app/admin/payments/actions.ts`

- [ ] **Step 1: Read the current file**

Read `src/app/admin/payments/actions.ts`. Note the call to `createEscrowHold()` around line ~39-56.

- [ ] **Step 2: Update the `createEscrowHold` call**

Since `createEscrowHold` in `escrow.ts` no longer takes an `amount` parameter (amounts are derived from `calc_booking_fees()`), remove the amount argument from the call.

Before:
```typescript
await createEscrowHold(bookingId, totalWithFees)
```

After:
```typescript
await createEscrowHold(bookingId)
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/payments/actions.ts
git commit -m "refactor(admin/payments): remove amount param from createEscrowHold call"
```

---

## Chunk 4: Remaining References and Final Verification

### Task 13: Update `src/app/api/cron/booking-timeouts/route.ts`

This cron route calls `systemReleaseEscrow` which was rewritten in Task 2.

**Files:**
- Modify: `src/app/api/cron/booking-timeouts/route.ts`

- [ ] **Step 1: Read the file**

Read the file. Check if it passes any `amount` to `systemReleaseEscrow` or references `escrow_transactions`.

- [ ] **Step 2: Update if needed**

- If it passes `amount` to `systemReleaseEscrow`, remove the parameter
- If it references `escrow_transactions`, change to `escrow`
- The `escrow_status` check on bookings should still work as-is

- [ ] **Step 3: Commit (if changes needed)**

```bash
git add src/app/api/cron/booking-timeouts/route.ts
git commit -m "refactor(cron): update escrow references for renamed table"
```

---

### Task 14: Update any remaining `escrow_transactions` references

Search the entire codebase for any remaining references to `escrow_transactions` or `balance_transactions` that weren't caught in previous tasks.

**Files:**
- Potentially: Any `.ts` or `.tsx` file in `src/`

- [ ] **Step 1: Search for remaining references**

Use grep/search for:
- `escrow_transactions` — should have ZERO results in `src/` (only in migration files)
- `balance_transactions` — should have ZERO results anywhere except old migration files
- `balance_tx_type` — should have ZERO results
- `balance_transaction_ref_type` — should have ZERO results

- [ ] **Step 2: Fix any remaining references**

Update any found references to use the new table/type names.

- [ ] **Step 3: Commit (if changes needed)**

```bash
git add -A
git commit -m "refactor: clean up remaining old table references"
```

---

### Task 15: Full build verification

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

Run: `npm run build`

Expected: Build succeeds with zero TypeScript errors. All references to old tables/columns are resolved.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: No new lint errors introduced.

- [ ] **Step 3: Final commit (if any lint fixes needed)**

```bash
git add -A
git commit -m "fix: resolve lint issues from financial refactor"
```

---

## Chunk 5: Type Cleanup and Documentation

### Task 16: Verify and clean up `src/types/supabase.ts`

The types were auto-generated in Task 1 Step 3. Verify they're correct.

**Files:**
- Verify: `src/types/supabase.ts`

- [ ] **Step 1: Verify generated types**

Read the generated types and confirm:
- `transactions` table type exists with all columns (`id`, `user_id`, `type`, `amount`, `booking_id`, `refund_id`, `payout_id`, `reversal_of_id`, `created_at`, `notes`)
- `transaction_type` enum exists with all 9 values
- `escrow` table type exists (renamed) WITHOUT `amount`
- `payouts` table type exists WITHOUT `amount`
- No `balance_transactions` table type
- No `balance_tx_type` or `balance_transaction_ref_type` enums

- [ ] **Step 2: Check for custom type files**

Search for any `src/types/database.ts` or similar files that may have hand-written types referencing old tables. Update if found.

- [ ] **Step 3: Commit (if changes needed)**

```bash
git add src/types/
git commit -m "chore(types): verify and clean up generated types after migration"
```

---

### Task 17: Update any remaining custom types or interfaces

Some admin components define local interfaces (like `Payout` in `columns.tsx`). Verify all are updated.

**Files:**
- Search: All `.tsx` files in `src/app/admin/`

- [ ] **Step 1: Search for local financial interfaces**

Grep for `interface.*Payout`, `interface.*Escrow`, `interface.*Balance`, `type.*Payout`, `type.*Balance` in admin files.

- [ ] **Step 2: Update any found interfaces**

Remove `amount` fields from Payout interfaces. Rename EscrowTransaction to Escrow. Remove BalanceTransaction interfaces entirely.

- [ ] **Step 3: Final full build**

Run: `npm run build`

Expected: Clean build, zero errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: clean up local type definitions for financial refactor"
```
