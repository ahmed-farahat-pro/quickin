
-- ============================================================
-- DESTRUCTIVE MIGRATION: Drop old financial columns
-- All code references have been updated to use computed values
-- ============================================================

-- 1. Drop old columns from bookings
ALTER TABLE public.bookings DROP COLUMN IF EXISTS total_price;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS guest_fee;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS host_fee;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS platform_earnings;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS host_payout_amount;

-- 2. Rename gross_amount to amount on payouts (nullable for computed payouts)
ALTER TABLE public.payouts RENAME COLUMN gross_amount TO amount;
ALTER TABLE public.payouts ALTER COLUMN amount DROP NOT NULL;

-- 3. Drop old payout columns
ALTER TABLE public.payouts DROP COLUMN IF EXISTS commission_rate;
ALTER TABLE public.payouts DROP COLUMN IF EXISTS commission_amount;
ALTER TABLE public.payouts DROP COLUMN IF EXISTS net_amount;

-- 4. Drop amount from refunds (computed via calc_refund_amount)
ALTER TABLE public.refunds DROP COLUMN IF EXISTS amount;

-- 5. Drop user_balances table (balances now derived from balance_transactions)
DROP TABLE IF EXISTS public.user_balances CASCADE;

-- 6. Remove commission keys from platform_settings
DELETE FROM public.platform_settings 
WHERE key IN ('host_commission_rate', 'guest_commission_rate', 'best_offer_commission_rate');
;
