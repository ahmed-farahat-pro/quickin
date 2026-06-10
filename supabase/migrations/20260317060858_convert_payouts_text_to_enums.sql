-- 1. Create the enums if they do not exist
DO $$ BEGIN
    CREATE TYPE public.payout_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.payout_method_type AS ENUM ('bank_transfer', 'vodafone_cash', 'instapay');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Drop existing CHECK constraints explicitly if any
ALTER TABLE public.payouts DROP CONSTRAINT IF EXISTS payouts_status_check;
ALTER TABLE public.payouts DROP CONSTRAINT IF EXISTS payouts_payout_method_check;

-- 3. Alter the payouts table to use the new enums (casting existing text)
ALTER TABLE public.payouts
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.payout_status USING status::text::public.payout_status,
  ALTER COLUMN status SET DEFAULT 'pending'::public.payout_status;

ALTER TABLE public.payouts
  ALTER COLUMN payout_method TYPE public.payout_method_type USING payout_method::text::public.payout_method_type;;
