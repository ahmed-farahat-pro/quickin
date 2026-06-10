-- Migration: 058_refactor_balance_transactions.sql

-- 1. Create the new ENUM for strictly typed references
CREATE TYPE balance_transaction_ref_type AS ENUM (
  'booking',
  'payout',
  'refund',
  'escrow'
);

-- 2. Add specific foreign key columns to balance_transactions
ALTER TABLE balance_transactions
  ADD COLUMN booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  ADD COLUMN payout_id UUID REFERENCES payouts(id) ON DELETE SET NULL,
  ADD COLUMN refund_id UUID REFERENCES refunds(id) ON DELETE SET NULL,
  ADD COLUMN escrow_transaction_id UUID REFERENCES escrow_transactions(id) ON DELETE SET NULL;

-- 3. Clean up orphaned records before migrating to enforce FK constraints
UPDATE balance_transactions SET reference_type = 'payout' WHERE reference_type = 'withdrawal';

DELETE FROM balance_transactions 
WHERE reference_type = 'booking' AND NOT EXISTS (SELECT 1 FROM bookings WHERE id = balance_transactions.reference_id);

DELETE FROM balance_transactions 
WHERE reference_type = 'payout' AND NOT EXISTS (SELECT 1 FROM payouts WHERE id = balance_transactions.reference_id);

DELETE FROM balance_transactions 
WHERE reference_type = 'refund' AND NOT EXISTS (SELECT 1 FROM refunds WHERE id = balance_transactions.reference_id);

DELETE FROM balance_transactions 
WHERE reference_type = 'escrow' AND NOT EXISTS (SELECT 1 FROM escrow_transactions WHERE id = balance_transactions.reference_id);

-- 4. Migrate data from the old polymorphic columns to the new strictly typed columns
UPDATE balance_transactions SET booking_id = reference_id WHERE reference_type = 'booking';
UPDATE balance_transactions SET payout_id = reference_id WHERE reference_type = 'payout';
UPDATE balance_transactions SET refund_id = reference_id WHERE reference_type = 'refund';
UPDATE balance_transactions SET escrow_transaction_id = reference_id WHERE reference_type = 'escrow';

-- 5. Alter the reference_type column to use the ENUM
ALTER TABLE balance_transactions
  ALTER COLUMN reference_type TYPE balance_transaction_ref_type
  USING reference_type::balance_transaction_ref_type;

-- 6. Add CHECK constraint to enforce exactly one reference is set
ALTER TABLE balance_transactions
  ADD CONSTRAINT balance_transactions_single_ref CHECK (
    (booking_id IS NOT NULL)::int +
    (payout_id IS NOT NULL)::int +
    (refund_id IS NOT NULL)::int +
    (escrow_transaction_id IS NOT NULL)::int = 1
  );

-- 7. Drop the old polymorphic reference_id column
ALTER TABLE balance_transactions
  DROP COLUMN reference_id;

-- 8. Add comments explaining the strict relationships
COMMENT ON COLUMN balance_transactions.amount IS 'Amount of the transaction. Derived from the referenced operation.';
COMMENT ON COLUMN balance_transactions.balance_after IS 'Calculated balance after this transaction. Kept for historical ledger integrity.';