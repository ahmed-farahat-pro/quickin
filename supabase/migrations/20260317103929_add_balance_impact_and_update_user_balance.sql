-- Add balance_impact flag to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS balance_impact boolean NOT NULL DEFAULT true;

-- Backfill external payments: receipt_url or approved payment verification
UPDATE public.transactions t
SET balance_impact = false
FROM public.bookings b
WHERE t.booking_id = b.id
  AND t.type IN ('payment', 'guest_fee')
  AND (
    b.receipt_url IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.payment_verifications pv
      WHERE pv.booking_id = b.id
        AND pv.status = 'approved'
    )
  );

-- Update balance RPC to ignore non-impacting transactions
CREATE OR REPLACE FUNCTION public.get_user_balance(p_user_id uuid)
RETURNS TABLE(available_balance numeric, on_hold_balance numeric, total_earned numeric)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_total numeric;
  v_guest_held numeric;
  v_host_held numeric;
  v_earned numeric;
BEGIN
  -- Total ledger balance (wallet-impacting transactions only)
  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_total
  FROM public.transactions t
  WHERE t.user_id = p_user_id
    AND t.balance_impact = true;

  -- Guest on-hold: wallet-impacting payment + guest_fee on bookings still in escrow
  SELECT COALESCE(ABS(SUM(t.amount)), 0)
  INTO v_guest_held
  FROM public.transactions t
  JOIN public.bookings b ON t.booking_id = b.id
  WHERE t.user_id = p_user_id
    AND t.type IN ('payment', 'guest_fee')
    AND t.balance_impact = true
    AND b.escrow_status = 'held';

  -- Host on-hold: expected payouts for bookings on user's listings that are held
  SELECT COALESCE(SUM(fees.host_payout), 0)
  INTO v_host_held
  FROM public.bookings b
  JOIN public.listings l ON b.listing_id = l.id
  CROSS JOIN LATERAL public.calc_booking_fees(b.id) AS fees
  WHERE l.user_id = p_user_id
    AND b.escrow_status = 'held';

  -- Total earned: wallet-impacting earning-type transactions
  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_earned
  FROM public.transactions t
  WHERE t.user_id = p_user_id
    AND t.type = 'earning'
    AND t.balance_impact = true;

  available_balance := v_total - v_guest_held;
  on_hold_balance := v_guest_held + v_host_held;
  total_earned := v_earned;

  RETURN NEXT;
END;
$function$;;
