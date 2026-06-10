
-- 1. get_current_commission_rates()
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

-- 2. get_commission_rates_at(ts)
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

-- 3. calc_booking_fees(booking_id)
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

-- 4. calc_payout_amounts(payout_id)
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

-- 5. calc_refund_amount(refund_id)
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

-- 6. get_user_balance(user_id)
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
             WHEN bt.type IN ('debit', 'withdrawal') THEN -bt.amount
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

-- 7. update_commission_rates (atomic close + insert)
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
;
