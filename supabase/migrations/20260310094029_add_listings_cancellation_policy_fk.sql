
-- Add FK constraint on listings.cancellation_policy
ALTER TABLE listings
  ADD CONSTRAINT listings_cancellation_policy_fkey
  FOREIGN KEY (cancellation_policy) REFERENCES cancellation_policies(code);
;
