# Unified Transaction Ledger Design

**Date:** 2026-03-16
**Status:** Approved
**Scope:** Replace multi-table financial amounts with a single `transactions` ledger; rename `escrow_transactions` to `escrow`; drop `balance_transactions`
**Supersedes:** [2026-03-12 Financial System Normalization](2026-03-12-financial-system-normalization-design.md)

## Problem

The current financial system, while already normalized, still stores amounts in multiple tables (`balance_transactions.amount`, `escrow_transactions.amount`, `payouts.amount`). This creates multiple sources of truth for monetary values and requires keeping them in sync. Additionally, the system needs to support future payment methods (cash-on-check-in) where the platform collects commission by debiting the host's balance, and all operations must be reversible without editing or deleting records.

## Approach

**Unified single-entry ledger.** A single `transactions` table holds every monetary value in the system. Every other financial table (`escrow`, `refunds`, `payouts`) becomes pure metadata — tracking state, status, reasons, and actors, but never amounts. User balance is always `SUM(transactions.amount) WHERE user_id = X`. Platform earnings are always `-SUM(transactions.amount)` (zero-sum implied). No edits, no deletes — reversals are new rows with opposite signs.

## Design

### 1. New Table: `transactions`

The single source of truth for every monetary value.

```sql
CREATE TYPE transaction_type AS ENUM (
  'payment',          -- guest pays for booking (-)
  'guest_fee',        -- platform service fee charged to guest (-)
  'earning',          -- host credited from booking (+)
  'commission_base',  -- base platform commission from host (-)
  'commission_promo', -- best-offer/promo commission from host (-)
  'refund',           -- money returned to guest (+)
  'withdrawal',       -- user cashes out from balance (-)
  'cash_commission',  -- commission deducted for cash booking (-)
  'reversal'          -- compensating entry that undoes any of the above (opposite sign)
);

CREATE TABLE transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id),
  type            transaction_type NOT NULL,
  amount          numeric NOT NULL,  -- signed: + = money in, - = money out
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

CREATE UNIQUE INDEX transactions_single_reversal
  ON transactions (reversal_of_id) WHERE reversal_of_id IS NOT NULL;

CREATE INDEX transactions_user_id ON transactions (user_id);
CREATE INDEX transactions_booking_id ON transactions (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX transactions_payout_id ON transactions (payout_id) WHERE payout_id IS NOT NULL;
CREATE INDEX transactions_refund_id ON transactions (refund_id) WHERE refund_id IS NOT NULL;

-- Enforce reversal sign correctness
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

-- Users can read their own transactions
CREATE POLICY transactions_select_own ON transactions
  FOR SELECT USING (user_id = auth.uid());

-- Staff can read all transactions
CREATE POLICY transactions_select_staff ON transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM staff_profiles WHERE id = auth.uid())
  );

-- Insert only via service_role (server-side actions)
-- No INSERT/UPDATE/DELETE policies for authenticated users
-- This enforces immutability at the RLS level
```

**Rules:**

| Rule | Meaning |
|------|---------|
| `amount` is signed | `+` = user gains, `-` = user loses |
| User balance | `SUM(amount) FROM transactions WHERE user_id = X` |
| Platform earnings | `-SUM(amount) FROM transactions` (zero-sum) |
| Immutable | Never edit or delete. Undo = create a `reversal` row |
| `reversal` type | Must set `reversal_of_id`, amount is opposite sign of original (enforced by trigger) |
| `refund` is NOT a reversal | It's a forward event driven by cancellation policy, may be partial |
| `reversal_of_id` is unique | Can't reverse the same transaction twice |

**Granularity:** Each financial event within a booking is its own row. A single booking may generate 2-5 transaction rows (payment, guest_fee, earning, commission_base, commission_promo). This enables direct queries like "total platform earnings from promo commissions this month" without recomputation.

### 2. Renamed Table: `escrow` (from `escrow_transactions`)

Stripped of amounts. Now purely an event log tracking escrow state changes.

```sql
ALTER TABLE escrow_transactions RENAME TO escrow;
ALTER TABLE escrow DROP COLUMN amount;
```

**Final columns:**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `booking_id` | FK → bookings | Which booking |
| `type` | enum: `hold`, `release`, `refund` | What happened |
| `status` | enum: `pending`, `completed`, `failed`, `cancelled` | Outcome |
| `initiated_by` | FK → profiles | Who triggered it |
| `created_at` | timestamptz | When |
| `completed_at` | timestamptz | When finished |
| `notes` | text | Context |

Escrow is a **gate** (booking status), not a **movement** (transaction). It controls when the host gets paid. For "how much money?", always check `transactions`.

### 3. Changes to `payouts`

Drop the `amount` column. Payout amounts now live in `transactions`.

**Drop:** `amount`

**Unchanged:** `id`, `host_id`, `booking_id`, `status`, `payout_method`, `payout_reference`, `processed_by`, `created_at`, `processed_at`, `completed_at`, `notes`

For any payout, the amount is `SUM(transactions.amount) WHERE payout_id = X`.

### 4. Changes to `refunds`

No schema changes. The `amount` column was already dropped in the previous refactor. The refund amount lives in `transactions` (type = `refund`, linked via `refund_id`).

### 5. Changes to `bookings`

No schema changes. Bookings keep `subtotal`, `commission_rate_id`, `escrow_status`, `cancellation_policy_snapshot`. These are the inputs that drive transaction generation.

### 6. Dropped Table: `balance_transactions`

Dropped entirely. Replaced by the `transactions` table.

### 7. Final Table Lineup

| Table | Role |
|-------|------|
| `bookings` | Where money enters. Holds `subtotal` + `commission_rate_id` |
| `transactions` | **The ledger.** Single source of truth for all amounts |
| `escrow` | Event log of escrow state changes (no amounts) |
| `refunds` | Refund request metadata (reason, policy, status) |
| `payouts` | Withdrawal/payout request metadata (method, status) |
| `payment_verifications` | Receipt verification metadata (unchanged, out of scope) |
| `commission_rates` | Time-versioned commission configuration (unchanged) |

## Postgres Functions

### Keep as-is

- `calc_booking_fees(booking_id)` — derives fees from `booking.subtotal` + `commission_rates`
- `calc_refund_amount(refund_id)` — derives from `cancellation_policy_snapshot` + timing
- `get_current_commission_rates()` — returns active commission_rates row
- `get_commission_rates_at(ts)` — returns commission_rates row at a given time

### Rewrite: `get_user_balance(user_id)`

Reads from `transactions` for the user's own ledger, and derives host on-hold amounts from bookings on their listings via `calc_booking_fees()`.

**Key design decisions:**
- `available_balance` = total ledger sum MINUS on-hold amounts (so held funds can't be spent)
- `on_hold_balance` has two components: guest-side (their payment/guest_fee txns on held bookings) and host-side (derived from bookings on their listings that are held but not yet released)
- `total_earned` = only `earning` type transactions (not refunds or reversals)

```sql
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
  -- No host transactions exist yet (created at release), so derive from booking fees
  SELECT COALESCE(SUM(fees.host_payout), 0)
  INTO v_host_held
  FROM bookings b
  JOIN listings l ON b.listing_id = l.id
  CROSS JOIN LATERAL calc_booking_fees(b.id) AS fees
  WHERE l.user_id = p_user_id
    AND b.escrow_status = 'held';

  -- Total earned: only earning-type transactions (host income from completed bookings)
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
```

**Note on `available_balance`:** We subtract `v_guest_held` (not `v_host_held`) from the total because host-held amounts have no transactions yet — they're derived, not in the ledger. Guest-held amounts ARE in the ledger (as negative payment/guest_fee rows) and must be excluded from the spendable balance.

### Drop

- `calc_payout_amounts(payout_id)` — replaced by `SUM(transactions.amount) WHERE payout_id = X`
- `create_payout_for_booking(booking_id)` — rewritten as application logic

## Money Flows

### Flow 1: Digital Payment Booking

Subtotal 1000, guest_rate 2%, host_rate 10%.

**Important:** Transaction rows are created when admin verifies the receipt, NOT when the guest uploads it. Until verification, no financial records exist — only the booking and the uploaded receipt image. This prevents fake receipts from creating ledger entries.

```
1. GUEST UPLOADS RECEIPT
   No transactions yet — receipt is unverified
   booking.status = 'pending'
   escrow:
     { booking_id: B1, type: hold, status: pending }

2. ADMIN VERIFIES RECEIPT → transactions created
   transactions:
     { user: guest, type: payment,   amount: -1000, booking_id: B1 }
     { user: guest, type: guest_fee, amount: -20,   booking_id: B1 }
   escrow: update status = 'completed'
   booking.escrow_status = 'held'
   booking.status = 'confirmed'

2b. ADMIN REJECTS RECEIPT → no transactions, booking cancelled
    escrow: update status = 'cancelled'
    booking.status = 'cancelled'

3. CHECK-IN CONFIRMED → RELEASE FUNDS
   transactions:
     { user: host, type: earning,         amount: +1000, booking_id: B1 }
     { user: host, type: commission_base, amount: -100,  booking_id: B1 }
   escrow:
     { booking_id: B1, type: release, status: completed }
   booking.escrow_status = 'released'

   Guest balance: -1020
   Host balance:  +900
   Platform:      +120
```

### Flow 2: Digital Payment with Best Offer (promo commission)

Subtotal 1000, guest_rate 2%, host_rate 10%, best_offer_rate 2%.

```
Steps 1-2: Same as Flow 1

3. RELEASE FUNDS (with promo commission)
   transactions:
     { user: host, type: earning,          amount: +1000, booking_id: B1 }
     { user: host, type: commission_base,  amount: -100,  booking_id: B1 }
     { user: host, type: commission_promo, amount: -20,   booking_id: B1 }

   Guest balance: -1020 (from step 2)
   Host balance:  +880
   Platform:      +140 (20 guest_fee + 100 base + 20 promo)
```

### Flow 3: Cash-on-Check-in Booking

Host balance must cover platform commission. Subtotal 1000, host_rate 10%.

**Guard:** The cash-on-check-in option is only available if the host's `available_balance >= commission amount`. This is validated at booking creation time. If the host's balance is insufficient, the cash option is blocked and the guest must pay digitally.

```
1. BOOKING CREATED (cash option, host balance validated)
   No transactions — money hasn't entered the system
   booking.escrow_status = 'none'

2. CHECK-IN CONFIRMED → Platform takes commission from host balance
   transactions:
     { user: host, type: cash_commission, amount: -100, booking_id: B1 }
   booking.status = 'completed'

   Guest balance: 0 (paid cash physically)
   Host balance:  -100
   Platform:      +100
```

### Flow 4: Full Refund (guest paid digitally, host already paid)

**Important:** The refund flow must reverse ALL commission-type transactions for the booking individually. If both `commission_base` and `commission_promo` exist, each gets its own reversal row.

```
1. REFUND INITIATED
   refunds: { booking_id: B1, reason: '...', status: pending }

2. REFUND APPROVED
   calc_refund_amount(R1) → 1000 (full subtotal)
   transactions:
     { user: guest, type: refund,   amount: +1000, booking_id: B1, refund_id: R1 }
     { user: guest, type: reversal, amount: +20,   booking_id: B1, reversal_of_id: TX_guest_fee }

   Reverse host earnings (one reversal per original transaction):
     { user: host, type: reversal, amount: -1000, booking_id: B1, reversal_of_id: TX_earning }
     { user: host, type: reversal, amount: +100,  booking_id: B1, reversal_of_id: TX_commission_base }
     { user: host, type: reversal, amount: +20,   booking_id: B1, reversal_of_id: TX_commission_promo }
     (commission_promo reversal only if best-offer was applied)

   refund.status = 'processed'
   booking.escrow_status = 'refunded'
```

### Flow 5: Partial Refund

```
   calc_refund_amount(R1) → 600 (60% per cancellation policy)
   transactions:
     { user: guest, type: refund, amount: +600, booking_id: B1, refund_id: R1 }

   No reversal of host earnings (host keeps their payout)
   Guest fee NOT reversed (platform keeps service fee for partial refunds)
   booking.escrow_status remains 'held' (host still gets remaining payout at release)
```

### Flow 6: Withdrawal (host requests payout)

```
1. HOST REQUESTS WITHDRAWAL (500 via Vodafone Cash)
   transactions:
     { user: host, type: withdrawal, amount: -500, payout_id: P1 }
   payouts:
     { host_id: host, status: pending, payout_method: vodafone_cash }

2a. APPROVED → staff processes externally
    payout.status = 'completed'

2b. REFUSED → reversal
    transactions:
      { user: host, type: reversal, amount: +500, payout_id: P1, reversal_of_id: TX_withdrawal }
    payout.status = 'failed'
```

## Impact on Application Code

### Core logic (rewrite):
- `src/lib/actions/balances.ts` — Query `transactions` instead of `balance_transactions`; withdrawal creates `transactions` row + `payouts` row
- `src/lib/actions/escrow.ts` — Stop writing amounts to escrow in all 4 insertion points (`createEscrowHold`, `releaseEscrow`, `systemReleaseEscrow`, `refundEscrow`); create `transactions` rows for payments, earnings, commissions instead; update `escrow` table for audit trail only. **Pre-existing bug:** `refundEscrow()` writes `amount` to `refunds` table which has no such column — clean this up during rewrite.
- `src/lib/actions/refunds.ts` — Create `refund` + `reversal` transaction rows; link via `refund_id`. **Pre-existing bug:** `rejectRefund()` writes to `admin_notes` column which doesn't exist on refunds — clean up during rewrite.
- `src/lib/actions/bookings.ts` — Directly inserts into `escrow_transactions` with `amount` during guest cancellation; calls `systemReleaseEscrow()`. Must be rewritten to use `escrow` (renamed) and `transactions` table.
- `src/lib/supabase/bookings.ts` — Payment creates `payment` + `guest_fee` transaction rows instead of `balance_transactions`

### API routes:
- `src/app/api/admin/payouts/process/route.ts` — Read amount from `transactions` instead of `payouts.amount`. Note: this requires a new subquery/RPC call since the amount is used in notification messages and audit logs (not just a column swap).
- `src/app/admin/payments/actions.ts` — Use `calc_booking_fees()` (unchanged)

### Admin UI:
- `src/app/admin/payments/columns.tsx` — No change (already uses computed fees)
- `src/app/admin/payouts/columns.tsx` — Display payout amount from linked transactions
- `src/app/admin/refunds/` — Display refund amount from linked transactions
- `src/app/admin/financials/page.tsx` — Query `transactions` for platform earnings AND payout amounts (currently reads `payouts.amount` directly for pending/completed payout sums)

### Types:
- `src/types/supabase.ts` — Regenerate after migration
- Update all references from `escrow_transactions` to `escrow`
- Update all references from `balance_transactions` to `transactions`

## Migration Strategy

Since existing financial data is test/mock data, this is a clean-break migration. Historical test amounts in `escrow_transactions` and `balance_transactions` will be lost — this is acceptable for test data.

1. Drop `balance_transactions` table and its related types/enums (must come before escrow rename to avoid FK confusion)
2. Create `transaction_type` enum
3. Create `transactions` table with all constraints, indexes, trigger, and RLS policies
4. Rename `escrow_transactions` → `escrow`
5. Drop `escrow.amount` column
6. Drop `payouts.amount` column
7. Rewrite `get_user_balance()` function
8. Drop `calc_payout_amounts()` and `create_payout_for_booking()` functions
9. Update all RLS policies referencing renamed tables
10. Update all application code
11. Regenerate Supabase TypeScript types
