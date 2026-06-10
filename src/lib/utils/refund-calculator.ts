export interface PolicySnapshot {
  code: string
  label: string
  full_refund_days_before: number
  partial_refund_days_before: number
  partial_refund_pct: number
  no_refund_days_before: number
}

export interface RefundCalculation {
  refundAmount: number
  refundType: 'full' | 'partial'
  refundPercentage: number
  daysBeforeCheckIn: number
  policyCode: string
}

export function calculateRefund(
  subtotal: number,
  checkInDate: string,
  policySnapshot: PolicySnapshot,
  cancellationDate?: Date
): RefundCalculation {
  const now = cancellationDate || new Date()
  const checkIn = new Date(checkInDate)
  const diffMs = checkIn.getTime() - now.getTime()
  const daysBeforeCheckIn = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (daysBeforeCheckIn >= policySnapshot.full_refund_days_before) {
    return {
      refundAmount: subtotal,
      refundType: 'full',
      refundPercentage: 100,
      daysBeforeCheckIn,
      policyCode: policySnapshot.code,
    }
  }

  if (
    policySnapshot.partial_refund_pct > 0 &&
    daysBeforeCheckIn >= policySnapshot.partial_refund_days_before
  ) {
    const amount = Math.round((subtotal * policySnapshot.partial_refund_pct) / 100)
    return {
      refundAmount: amount,
      refundType: 'partial',
      refundPercentage: policySnapshot.partial_refund_pct,
      daysBeforeCheckIn,
      policyCode: policySnapshot.code,
    }
  }

  return {
    refundAmount: 0,
    refundType: 'partial',
    refundPercentage: 0,
    daysBeforeCheckIn,
    policyCode: policySnapshot.code,
  }
}
