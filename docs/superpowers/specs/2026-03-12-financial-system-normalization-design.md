# Financial System Normalization Design

**Date:** 2026-03-12
**Status:** Approved
**Scope:** Refactor financial data from plain stored values to reference-based computed values

## Problem

The current financial system stores pre-calculated plain values across multiple tables. Commission rates are stored in a flat key-value table (`platform_settings`) with no history. When rates change, there's no way to trace which bookings used which rate. User balances are mutated directly rather than derived from their transaction history, creating drift risk.

**Affected tables:** `bookings`, `escrow_transactions`, `payouts`, `refunds`, `user_balances`, `platform_settings`

## Approach

Full normalization with Postgres computation functions. All derived financial values are computed on-the-fly from source data via Postgres functions. No cached/duplicated amounts except where justified (escrow transactions for partial operations).

## Design

### 1. New Table: `commission_rates`

Replaces the `host_commission_rate`, `guest_commission_rate`, and `best_offer_commission_rate` keys from `platform_settings`.

```sql
CREATE TABLE commission_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_rate       numeric NOT NULL CHECK (host_rate >= 0 AND host_rate < 1),
  guest_rate      numeric NOT NULL CHECK (guest_rate >= 0 AND guest_rate < 1),
  best_offer_rate numeric NOT NULL CHECK (best_offer_rate >= 0 AND best_offer_rate < 1),
  effective_from  timestamptz NOT NULL DEFAULT now(),
  effective_to    timestamptz,              -- NULL = currently active
  created_by      uuid REFERENCES staff_profiles(id),
  created_at      timestamptz DEFAULT now(),
  notes           text
);
```

**Rules:**
- Only ONE row can have `effective_to IS NULL` at any time (the current rate)
- When admin updates rates, the old row gets `effective_to = now()` and a new row is inserted
- A partial unique index enforces the single-active-row rule: `CREATE UNIQUE INDEX ON commission_rates ((true)) WHERE effective_to IS NULL;`

### 2. Table Changes: `bookings`

**Add:**
- `commission_rate_id uuid NOT NULL REFERENCES commission_rates(id)` — set at booking creation to the currently active rate

**Column migration (`total_price` → `subtotal`):**
- Add new column `subtotal numeric NOT NULL`
- Populate: `UPDATE bookings SET subtotal = total_price - guest_fee` (since current `total_price` includes the guest fee)
- Drop `total_price` after population

**Note on refund basis:** Currently refunds are calculated against `total_price` (which includes guest_fee). After migration, refunds will be based on `subtotal` (base price only). This is the correct behavior — the guest fee is a platform service fee, not part of the stay price that refund policies should cover.

**Drop:**
- `total_price` — replaced by `subtotal` (see migration above)
- `guest_fee` — computed as `subtotal * commission_rates.guest_rate`
- `host_fee` — computed as `subtotal * commission_rates.host_rate`
- `platform_earnings` — computed as `guest_fee + host_fee`
- `host_payout_amount` — computed as `subtotal - host_fee`

**Unchanged:**
- `id`, `listing_id`, `user_id`, `check_in`, `check_out`, `guests`, `status`, `reservation_code`, `receipt_url`, `cancellation_policy_snapshot`, `escrow_status`, `is_check_in_confirmed`, `created_at`, `updated_at`

### 3. Table Changes: `payouts`

**Context:** There are two types of payouts:
1. **Booking payouts** — tied to a booking (`booking_id IS NOT NULL`), amounts derived from booking
2. **Withdrawal payouts** — host withdrawals from their balance (`booking_id IS NULL`), need their own stored amount

**Keep (for withdrawal payouts):**
- `amount numeric` — renamed from `gross_amount`, stores the withdrawal amount. For booking payouts this column is NULL and amounts are derived via `calc_payout_amounts()`.

**Drop:**
- `gross_amount` — replaced by nullable `amount` (only used for withdrawals)
- `commission_rate` — lives in `commission_rates` table via booking
- `commission_amount` — computed from booking's commission_rate_id
- `net_amount` — computed from booking

**Unchanged:**
- `id`, `host_id`, `booking_id`, `status`, `payout_method`, `payout_reference`, `created_at`, `processed_at`, `completed_at`, `processed_by`, `notes`

### 4. Table Changes: `refunds`

**Drop:**
- `amount` — computed from booking's subtotal + cancellation_policy_snapshot + refund timing

**Unchanged:**
- `id`, `booking_id`, `reason`, `refund_type` (full/partial), `policy_applied`, `status`, `initiated_by`, `processed_by`, `created_at`, `processed_at`

**Computation logic:** Uses the `cancellation_policy_snapshot` JSONB from the booking (not the live `cancellation_policies` table) to honor the terms the guest agreed to at booking time.

**Flow change:** Currently the refund amount is computed before the refund record is created. After migration, the flow must be: (1) insert refund row without amount, (2) call `calc_refund_amount(refund_id)` to get the computed value for display/escrow operations.

### 5. Table Changes: `escrow_transactions`

**No changes.** Escrow transactions keep their `amount` column because they represent actual financial events that can be partial (a hold for the full host_payout, a partial refund, then a release for the remainder). These amounts aren't derivable from the booking alone.

### 6. Table Dropped: `user_balances`

The `user_balances` table is dropped entirely. Balances are computed on-the-fly by a Postgres function from `balance_transactions` and `escrow_transactions`.

**Withdrawal flow change:** Currently `balances.ts` directly mutates `user_balances.available_balance` and rolls back on failure. After migration: (1) insert a `balance_transactions` debit record, (2) create the payout record. If step 2 fails, delete the balance transaction record. The rollback pattern changes from "restore a stored balance" to "delete the transaction record."

### 7. Table Changes: `platform_settings`

**Keys removed** (moved to `commission_rates` table):
- `host_commission_rate`
- `guest_commission_rate`
- `best_offer_commission_rate`

**Keys unchanged:**
- `auto_cancel_days`
- `auto_complete_days`

## Postgres Functions

### `get_current_commission_rates()`
Returns the active `commission_rates` row (where `effective_to IS NULL`).

### `get_commission_rates_at(ts timestamptz)`
Returns the `commission_rates` row that was active at a given timestamp.

### `calc_booking_fees(p_booking_id uuid)`
Joins `bookings → commission_rates` and returns:
- `subtotal` — booking.subtotal
- `guest_fee` — ROUND(subtotal * guest_rate)
- `host_fee` — ROUND(subtotal * host_rate)
- `total_with_fees` — subtotal + guest_fee (what guest pays)
- `platform_earnings` — guest_fee + host_fee
- `host_payout` — subtotal - host_fee

### `calc_payout_amounts(p_payout_id uuid)`
Joins `payouts → bookings → commission_rates` and returns:
- `gross_amount` — booking subtotal
- `commission_rate` — commission_rates.host_rate
- `commission_amount` — ROUND(subtotal * host_rate)
- `net_amount` — subtotal - commission_amount

**Note:** Returns NULL values if `booking_id IS NULL` (withdrawal payouts). For withdrawals, use the `amount` column directly.

### `calc_refund_amount(p_refund_id uuid)`
Joins `refunds → bookings`, reads `cancellation_policy_snapshot` JSONB, and computes:
1. Days between `refund.created_at` and `booking.check_in`
2. If days >= `full_refund_days_before`: returns subtotal (full refund)
3. If days >= `partial_refund_days_before`: returns ROUND(subtotal * partial_refund_pct / 100)
4. Otherwise: returns 0

Note: `refund_type` is the output/label of the calculation, not an input that overrides it. A `refund_type = 'full'` is set when the calculation yields a full refund, it does not force one.

### `get_user_balance(p_user_id uuid)`
Computes from `balance_transactions` and `escrow_transactions`:
- `available_balance` — SUM of credits/refunds - SUM of debits/withdrawals from balance_transactions
- `on_hold_balance` — SUM of held escrow - SUM of released/refunded escrow for this user's bookings (as host via listings)
- `total_earned` — SUM of all credit-type balance_transactions

## Impact on Application Code

### Core logic files:
- `src/lib/supabase/bookings.ts` — Stop writing fee columns, start setting `commission_rate_id`, use `subtotal` instead of `total_price`
- `src/lib/actions/bookings.ts` — Update cancellation flow: insert refund first, then call `calc_refund_amount()`
- `src/lib/actions/escrow.ts` — Call `calc_booking_fees()` instead of reading stored `host_payout_amount`
- `src/lib/actions/refunds.ts` — Call `calc_refund_amount()` instead of computing/storing amount
- `src/lib/actions/balances.ts` — Call `get_user_balance()` instead of reading `user_balances` table; restructure withdrawal flow (debit transaction → payout, rollback = delete transaction)
- `src/lib/actions/platform-settings.ts` — Update commission CRUD to use `commission_rates` table
- `src/lib/utils/refund-calculator.ts` — Refactor to use subtotal basis instead of total_price, or remove in favor of Postgres function
- `src/lib/constants.ts` — Review/remove default commission rate constants if no longer needed as fallbacks

### API routes:
- `src/app/api/admin/payouts/process/route.ts` — Call `calc_payout_amounts()` instead of reading stored amounts
- `src/app/admin/payments/actions.ts` — Use computed fees from `calc_booking_fees()`

### Admin UI:
- `src/app/admin/payments/columns.tsx` — Display computed `total_with_fees` instead of `total_price`
- `src/app/admin/payments/page.tsx` — Update booking data fetching
- `src/app/admin/payouts/columns.tsx` — Display computed `gross_amount`, `net_amount`
- `src/app/admin/refunds/page.tsx` — Display computed refund amount
- `src/app/admin/refunds/refund-actions.tsx` — Use computed amount
- `src/app/admin/financials/page.tsx` — Use computed `platform_earnings`, `net_amount`

### Type definitions:
- `src/types/supabase.ts` — Regenerate Supabase types after schema migration
- `src/types/database.ts` — Update `total_price` references to `subtotal`, remove dropped column types

### Indirectly affected (via functions already listed):
- `src/app/api/admin/payments/verify/route.ts` — Indirectly affected via `escrow.ts`
- `src/app/api/cron/booking-timeouts/route.ts` — Indirectly affected via `escrow.ts`

## Migration Strategy

Since all current data is mock/test data, this is a clean-break migration:

1. Create `commission_rates` table with CHECK constraints and unique index, seed with initial row matching current settings (host_rate=0.10, guest_rate=0.02, best_offer_rate=0.02)
2. Add `commission_rate_id` to bookings, populate all existing rows with the initial commission_rates row ID
3. Add `subtotal` column to bookings, populate as `total_price - guest_fee`
4. Drop `total_price`, `guest_fee`, `host_fee`, `platform_earnings`, `host_payout_amount` from bookings
5. Rename `gross_amount` to `amount` on payouts, make nullable; drop `commission_rate`, `commission_amount`, `net_amount`
6. Drop `amount` from refunds
7. Create all Postgres functions
8. Drop `user_balances` table
9. Remove commission keys from `platform_settings`
10. Update all application code (core logic, API routes, admin UI, types)
11. Regenerate Supabase TypeScript types
