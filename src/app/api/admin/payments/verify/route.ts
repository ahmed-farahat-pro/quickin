import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Approve or reject a payment verification
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
  }

  // Get current staff user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is staff
  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('id, role')
    .eq('id', user.id)
    .eq('is_active', true)
    .single()

  if (!staffProfile) {
    return NextResponse.json({ error: 'Staff access required' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { 
      verification_id, 
      action, // 'approve' or 'reject'
      rejection_reason,
      send_message = true
    } = body

    // Validate required fields
    if (!verification_id || !action) {
      return NextResponse.json({ 
        error: 'Missing required fields: verification_id, action' 
      }, { status: 400 })
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ 
        error: 'Action must be "approve" or "reject"' 
      }, { status: 400 })
    }

    if (action === 'reject' && !rejection_reason) {
      return NextResponse.json({ 
        error: 'rejection_reason is required when rejecting' 
      }, { status: 400 })
    }

    // Get the verification record
    const { data: verification, error: fetchError } = await supabase
      .from('payment_verifications')
      .select(`
        *,
        guest:profiles!payment_verifications_guest_id_fkey(full_name, email),
        booking:bookings!payment_verifications_booking_id_fkey(listing_id)
      `)
      .eq('id', verification_id)
      .single()

    if (fetchError || !verification) {
      return NextResponse.json({ error: 'Verification not found' }, { status: 404 })
    }

    if (verification.status !== 'pending') {
      return NextResponse.json({ 
        error: 'Verification has already been processed' 
      }, { status: 400 })
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    // Update the verification
    const { error: updateError } = await supabase
      .from('payment_verifications')
      .update({
        status: newStatus,
        rejection_reason: action === 'reject' ? rejection_reason : null,
        verified_at: new Date().toISOString(),
        verified_by: staffProfile.id,
      })
      .eq('id', verification_id)

    if (updateError) {
      console.error('Error updating verification:', updateError)
      return NextResponse.json({ error: 'Failed to update verification' }, { status: 500 })
    }

    // If approved, update booking using the main approval logic (handles under/overpayments)
    if (action === 'approve') {
      const { approveBookingPayment } = await import('@/app/admin/payments/actions')
      const result = await approveBookingPayment(verification.booking_id, verification.amount)
      
      if (result.error) {
        console.error('Error approving booking via verification:', result.error)
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
    }

    // Send notification to guest
    if (send_message) {
      const subject = action === 'approve' 
        ? 'Payment Verification Approved' 
        : 'Payment Verification Failed'
      
      const messageBody = action === 'approve'
        ? `Great news! Your payment of EGP ${verification.amount.toFixed(0)} via ${verification.payment_method.replace('_', ' ')} has been verified.`
        : `Unfortunately, we were unable to verify your payment of EGP ${verification.amount.toFixed(0)} via ${verification.payment_method.replace('_', ' ')}.\n\nReason: ${rejection_reason}\n\nPlease submit a new payment or contact support if you believe this is an error.`

      await supabase
        .from('admin_messages')
        .insert({
          user_id: verification.guest_id,
          category: action === 'approve' ? 'approval' : 'rejection',
          subject,
          body: messageBody,
          related_entity_type: 'booking',
          related_entity_id: verification.booking_id,
          sent_by: staffProfile.id,
        })
    }

    // Create audit log
    await supabase
      .from('audit_logs')
      .insert({
        actor_id: user.id,
        actor_type: staffProfile.role === 'admin' ? 'admin' : 'staff',
        action: action === 'approve' ? 'payment.verify' : 'payment.reject',
        entity_type: 'payment_verification',
        entity_id: verification_id,
        entity_name: `${verification.payment_method} - EGP ${verification.amount.toFixed(0)}`,
        old_data: { status: 'pending' },
        new_data: { status: newStatus, rejection_reason },
        notes: action === 'approve' 
          ? 'Payment verified and applied to booking' 
          : `Payment rejected: ${rejection_reason}`,
      })

    return NextResponse.json({ 
      success: true,
      status: newStatus,
    })
  } catch (error) {
    console.error('Error in PUT /api/admin/payments/verify:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get payment verifications
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
  }

  // Check staff access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('id')
    .eq('id', user.id)
    .eq('is_active', true)
    .single()

  if (!staffProfile) {
    return NextResponse.json({ error: 'Staff access required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  try {
    let query = supabase
      .from('payment_verifications')
      .select(`
        *,
        guest:profiles!payment_verifications_guest_id_fkey(full_name, email),
        verified_by_staff:staff_profiles!payment_verifications_verified_by_fkey(display_name)
      `)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: verifications, error } = await query.limit(100)

    if (error) {
      console.error('Error fetching verifications:', error)
      return NextResponse.json({ error: 'Failed to fetch verifications' }, { status: 500 })
    }

    return NextResponse.json({ verifications })
  } catch (error) {
    console.error('Error in GET /api/admin/payments/verify:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
