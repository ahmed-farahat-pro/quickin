# Cancellation & Refund System Design

## Overview

Implement a complete cancellation and refund system where admins manage policies, hosts pick a policy per listing, guests accept it on booking, and cancellations auto-calculate refunds based on the policy rules and days before check-in.

## 1. Schema Changes

### Alter `cancellation_policies`

Add columns:
- `is_enabled` boolean NOT NULL DEFAULT true
- `display_order` integer NOT NULL DEFAULT 0
- `updated_at` timestamptz DEFAULT now()

### Seed Airbnb Policies

Replace existing 3 rows (flexible, moderate, strict) with 4 Airbnb-matching policies:

| code | label | full_refund_days_before | partial_refund_days_before | partial_refund_pct | no_refund_days_before |
|---|---|---|---|---|---|
| flexible | Flexible | 1 | 0 | 0 | 0 |
| moderate | Moderate | 5 | 1 | 50 | 0 |
| limited | Limited | 14 | 7 | 50 | 7 |
| firm | Firm | 30 | 7 | 50 | 7 |

Each row includes `translations` jsonb with Arabic (`ar`) label and description.

### Alter `listings.cancellation_policy`

Add FK constraint: `listings.cancellation_policy` REFERENCES `cancellation_policies(code)`.
Existing data already uses `"flexible"` which matches, so no data migration needed.

## 2. Admin CRUD (`/admin/cancellation-policies`)

Follows the same pattern as `/admin/conditions` and `/admin/attributes`:

- **List view**: Table with code, label, refund rules summary, enabled/disabled badge, display order
- **Create/Edit form**: code (slug, unique), label, description, full_refund_days_before, partial_refund_days_before, partial_refund_pct, no_refund_days_before, translations (ar), is_enabled, display_order
- **Toggle enable/disable**: Quick action. Warning if active listings reference a policy being disabled
- **Delete**: Blocked if referenced by any listing or refund record
- **Audit logging**: All changes logged to `audit_logs`

## 3. Host Policy Selection

Located in listing manage page (`/dashboard/listings/[id]/manage`), alongside conditions-manager and attributes-manager:

- Radio card list of enabled policies (one per listing, required)
- Each card shows: label, refund rules summary, info icon expanding full description
- Styled as card-style radio options (matching Airbnb screenshot)
- Saves to `listings.cancellation_policy` FK
- All text localized via `translations` jsonb + existing i18n system
- Required field for listing publishing

## 4. Guest Booking Flow

During booking checkout, alongside existing conditions acceptance:

- Display the listing's cancellation policy as a card with localized label and full refund rules description
- Required checkbox: "I accept the cancellation and refund policy" (localized)
- On booking creation:
  - Snapshot full policy into `bookings.cancellation_policy_snapshot` (jsonb) — freezes rules at booking time
  - Store acceptance alongside existing conditions acceptance

## 5. Guest Cancellation & Refund Calculation

When guest cancels a confirmed/active booking (`updateBookingStatusGuest`):

1. Calculate days until check-in (current date vs `bookings.check_in`)
2. Read policy from `bookings.cancellation_policy_snapshot` (not live policy)
3. Determine refund:
   - Days >= `full_refund_days_before` -> full refund of `total_price`
   - Days >= `partial_refund_days_before` -> partial refund (`total_price * partial_refund_pct / 100`)
   - Otherwise -> no refund (amount = 0, record still created for audit)
4. Create `refunds` row: amount, refund_type (full/partial), policy_applied (code), status = pending, initiated_by = guest
5. Update booking: status -> cancelled
6. Create escrow transaction: type = refund, status = pending, amount = refund amount
7. Notifications: staff notification for admin review, user notification to guest with cancellation confirmation and expected refund amount

Guest sees a **cancellation confirmation screen** before confirming — showing policy name, days before check-in, calculated refund amount (or "no refund"). Localized.

## 6. Admin Refund Processing

Enhanced `/admin/refunds` page:

- **List view**: Pending refunds with booking details, guest info, refund amount, policy applied, days-before-checkin at cancellation time
- **Review**: Full calculation breakdown — policy snapshot, dates, derived amount
- **Approve**: Status -> approved, admin processes money movement (bank transfer / vodafone cash / instapay), then marks processed. Escrow transaction -> completed. Adjusts `user_balances` (reduce host on_hold_balance, adjust platform earnings)
- **Reject**: Status -> rejected with reason. User notification to guest. Escrow transaction -> cancelled
- **Payout adjustment**: If host payout already created, recalculate (reduce for partial refund, cancel for full refund)

## Key Principles

- All guest/host facing UI localized via translations jsonb + i18n system
- Policy snapshot at booking time ensures rule changes don't affect existing bookings
- Refunds are auto-calculated but require admin approval (semi-manual payment system)
- Follows existing patterns: conditions system (admin CRUD + host picker), attributes system (enable/disable), financial system (escrow + payouts + balances)
