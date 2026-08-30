#!/bin/sh
# Runs the iOS unit suites that need no simulator: plain executables built from the same pure
# rule files the app compiles (no UIKit, no SwiftUI, no XCTest target — this project has none).
#
#     cd mobile/ios && ./Tests/run.sh
#
# Exits non-zero if any suite fails.
set -e
cd "$(dirname "$0")/.."
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

echo "\nListingPricingRules — what a host may type into a seasonal price field\n"
swiftc -o "$OUT/listing-pricing-rules" \
  Tests/ListingPricingRulesTests/main.swift \
  Sources/ListingPricingRules.swift
"$OUT/listing-pricing-rules"

echo "\nCancellationOutcome — what a cancelled reservation ended as\n"
swiftc -o "$OUT/cancellation-outcome" \
  Tests/CancellationOutcomeTests/main.swift \
  Sources/CancellationOutcome.swift
"$OUT/cancellation-outcome"

echo "\nOwnershipDocRules — what a host may attach as proof of ownership (photo or PDF)\n"
swiftc -o "$OUT/ownership-doc-rules" \
  Tests/OwnershipDocRulesTests/main.swift \
  Sources/OwnershipDocRules.swift
"$OUT/ownership-doc-rules"

echo "\nPaymentFlowRules — which stage a reservation's payment is at\n"
swiftc -o "$OUT/payment-flow-rules" \
  Tests/PaymentFlowRulesTests/main.swift \
  Sources/PaymentFlowRules.swift
"$OUT/payment-flow-rules"

echo "\nStayPassGate — when a reservation earns its QR / Wallet pass / stay link\n"
swiftc -o "$OUT/stay-pass-gate" \
  Tests/StayPassGateTests/main.swift \
  Sources/PaymentFlowRules.swift
"$OUT/stay-pass-gate"

# Builds PaymentFlowRules too: the bucket fold takes the payment STAGE as input
# rather than re-deriving it, so the end-to-end checks need both rules.
echo "\nHostBookingFilterRules — which status chip a host's reservation sits behind\n"
swiftc -o "$OUT/host-booking-filter-rules" \
  Tests/HostBookingFilterRulesTests/main.swift \
  Sources/HostBookingFilterRules.swift \
  Sources/PaymentFlowRules.swift
"$OUT/host-booking-filter-rules"

echo "\nReservationFilter — which chip a guest's reservation is filed behind\n"
swiftc -o "$OUT/reservation-filter" \
  Tests/ReservationFilterTests/main.swift \
  Sources/ReservationFilter.swift \
  Sources/HostBookingFilterRules.swift \
  Sources/PaymentFlowRules.swift
"$OUT/reservation-filter"

echo "\nHostWelcomeRules — when a newly approved host is shown their dashboard once\n"
swiftc -o "$OUT/host-welcome-rules" \
  Tests/HostWelcomeRulesTests/main.swift \
  Sources/HostWelcomeRules.swift
"$OUT/host-welcome-rules"

echo "\nListingCapacityPolicy — how small, and how large, a place may claim to be\n"
swiftc -o "$OUT/listing-capacity-policy" \
  Tests/ListingCapacityPolicyTests/main.swift \
  Sources/ListingCapacityPolicy.swift
"$OUT/listing-capacity-policy"
