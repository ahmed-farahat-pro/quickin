import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Update verification status (approve/reject)
export async function POST(request: NextRequest) {
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
    .select('id, role, display_name')
    .eq('id', user.id)
    .eq('is_active', true)
    .single()

  if (!staffProfile) {
    return NextResponse.json({ error: 'Staff access required' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { user_id, action, notes } = body

    // Validate required fields
    if (!user_id || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ 
        error: 'Missing required fields: user_id, action (approve/reject)' 
      }, { status: 400 })
    }

    // For rejection, require notes
    if (action === 'reject' && !notes?.trim()) {
      return NextResponse.json({ 
        error: 'Notes are required for rejection' 
      }, { status: 400 })
    }

    // Get target user info
    const { data: targetUser } = await supabase
      .from('profiles')
      .select('full_name, email, verification_status:verification_statuses(code)')
      .eq('id', user_id)
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const previousStatus = (targetUser.verification_status as any)?.code || 'unverified'
    const newStatusId = action === 'approve' ? 3 : 4 // 3 = verified, 4 = rejected
    const newStatusCode = action === 'approve' ? 'verified' : 'rejected'

    // Update verification status
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        verification_status_id: newStatusId,
        verification_notes: notes || null,
        verified_at: new Date().toISOString(),
        verified_by: staffProfile.id,
      })
      .eq('id', user_id)

    if (updateError) {
      console.error('Error updating verification status:', updateError)
      return NextResponse.json({ error: 'Failed to update verification status' }, { status: 500 })
    }

    // Create audit log
    await supabase
      .from('audit_logs')
      .insert({
        actor_id: user.id,
        actor_type: staffProfile.role === 'admin' ? 'admin' : 'staff',
        action: action === 'approve' ? 'verification.approve' : 'verification.reject',
        entity_type: 'user',
        entity_id: user_id,
        entity_name: targetUser.full_name || targetUser.email,
        old_data: { status: previousStatus },
        new_data: { status: newStatusCode, notes: notes || null },
        notes: action === 'approve' 
          ? `Identity verification approved by ${staffProfile.display_name}`
          : `Identity verification rejected by ${staffProfile.display_name}: ${notes}`,
      })

    // Send notification to user (optional - via admin_messages if table exists)
    try {
      if (action === 'reject') {
        await supabase
          .from('admin_messages')
          .insert({
            user_id,
            category: 'verification',
            subject: 'Identity Verification Rejected',
            body: `Your identity verification was not approved.\n\nReason: ${notes}\n\nPlease review the requirements and submit new documents.`,
            sent_by: staffProfile.id,
          })
      } else {
        await supabase
          .from('admin_messages')
          .insert({
            user_id,
            category: 'verification',
            subject: 'Identity Verified',
            body: 'Congratulations! Your identity has been verified. You can now book and list properties on our platform.',
            sent_by: staffProfile.id,
          })
      }
    } catch {
      // admin_messages table may not exist, ignore
    }

    return NextResponse.json({ 
      success: true,
      message: action === 'approve' ? 'User verified successfully' : 'Verification rejected',
    })
  } catch (error) {
    console.error('Error in POST /api/admin/verifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
