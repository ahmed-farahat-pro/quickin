ALTER TABLE payouts
  DROP COLUMN IF EXISTS booking_id,
  DROP COLUMN IF EXISTS gross_amount,
  DROP COLUMN IF EXISTS commission_rate,
  DROP COLUMN IF EXISTS commission_amount,
  DROP COLUMN IF EXISTS net_amount;;
