import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/disputes/[id]
 * Get dispute details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    // Check if user is staff
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: staffProfile } = await supabase
      .from('staff_profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (!staffProfile) {
      return NextResponse.json({ error: 'Staff access required' }, { status: 403 })
    }

    // Get dispute details
    const { data: dispute, error } = await supabase
      .from('disputes')
      .select(`
        *,
        guest:profiles!disputes_guest_id_fkey(id, full_name, email),
        host:profiles!disputes_host_id_fkey(id, full_name, email)
      `)
      .eq('id', id)
      .single()

    if (error || !dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }

    // Get dispute messages
    const { data: messages } = await supabase
      .from('dispute_messages')
      .select('*')
      .eq('dispute_id', id)
      .order('created_at', { ascending: true })

    return NextResponse.json({ dispute, messages: messages || [] })
  } catch (error) {
    console.error('Error fetching dispute:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/disputes/[id]
 * Update dispute status or add resolution
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, notes, refund_amount, resolution_notes } = body

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    // Check if user is staff
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: staffProfile } = await supabase
      .from('staff_profiles')
      .select('id, role, full_name')
      .eq('id', user.id)
      .single()

    if (!staffProfile) {
      return NextResponse.json({ error: 'Staff access required' }, { status: 403 })
    }

    // Get current dispute
    const { data: dispute } = await supabase
      .from('disputes')
      .select('*')
      .eq('id', id)
      .single()

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }

    let newStatus = dispute.status
    let updateData: any = { updated_at: new Date().toISOString() }

    switch (action) {
      case 'start_investigation':
        newStatus = 'in_progress'
        updateData.status = newStatus
        updateData.assigned_staff_id = user.id
        break

      case 'request_guest_info':
        newStatus = 'pending_guest'
        updateData.status = newStatus
        break

      case 'request_host_info':
        newStatus = 'pending_host'
        updateData.status = newStatus
        break

      case 'approve_refund':
        if (!refund_amount) {
          return NextResponse.json({ error: 'Refund amount required' }, { status: 400 })
        }
        newStatus = 'resolved'
        updateData.status = newStatus
        updateData.resolution = 'refund_approved'
        updateData.refund_amount = refund_amount
        updateData.resolution_notes = resolution_notes || `Refund of $${refund_amount} approved`
        updateData.resolved_at = new Date().toISOString()
        updateData.resolved_by = user.id
        break

      case 'reject_refund':
        newStatus = 'resolved'
        updateData.status = newStatus
        updateData.resolution = 'refund_rejected'
        updateData.resolution_notes = resolution_notes || 'Refund request rejected'
        updateData.resolved_at = new Date().toISOString()
        updateData.resolved_by = user.id
        break

      case 'close':
        newStatus = 'closed'
        updateData.status = newStatus
        updateData.resolution = 'closed'
        updateData.resolution_notes = resolution_notes || 'Dispute closed'
        updateData.resolved_at = new Date().toISOString()
        updateData.resolved_by = user.id
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Update dispute
    const { error: updateError } = await supabase
      .from('disputes')
      .update(updateData)
      .eq('id', id)

    if (updateError) {
      console.error('Error updating dispute:', updateError)
      return NextResponse.json({ error: 'Failed to update dispute' }, { status: 500 })
    }

    // Add staff message if notes provided
    if (notes) {
      await supabase
        .from('dispute_messages')
        .insert({
          dispute_id: id,
          sender_id: user.id,
          sender_type: 'staff',
          message: notes,
          is_internal: false,
        })
    }

    // Log the action
    try {
      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        actor_type: 'staff',
        action: `dispute_${action}`,
        entity_type: 'dispute',
        entity_id: id,
        notes: `${action} on dispute. Status: ${dispute.status} → ${newStatus}`,
        metadata: {
          previous_status: dispute.status,
          new_status: newStatus,
          refund_amount: refund_amount || null,
        },
      })
    } catch {
      // Audit logging is non-critical
    }

    // Send notification to guest
    if (action === 'approve_refund' || action === 'reject_refund' || action === 'close') {
      try {
        await supabase.from('admin_messages').insert({
          user_id: dispute.guest_id,
          staff_id: user.id,
          subject: `Update on your dispute: ${dispute.subject}`,
          message: action === 'approve_refund'
            ? `Your refund request has been approved. A refund of $${refund_amount} will be processed.`
            : action === 'reject_refund'
            ? `Your refund request was reviewed but could not be approved. ${resolution_notes || ''}`
            : `Your dispute has been closed. ${resolution_notes || ''}`,
          category: 'dispute_update',
        })
      } catch {
        // Notification is non-critical
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Dispute ${action.replace('_', ' ')} completed`,
      newStatus 
    })
  } catch (error) {
    console.error('Error updating dispute:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/disputes/[id]
 * Add a message to the dispute thread
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { message, is_internal = false } = body

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    // Check if user is staff
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: staffProfile } = await supabase
      .from('staff_profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (!staffProfile) {
      return NextResponse.json({ error: 'Staff access required' }, { status: 403 })
    }

    // Verify dispute exists
    const { data: dispute } = await supabase
      .from('disputes')
      .select('id, guest_id, subject')
      .eq('id', id)
      .single()

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }

    // Add message to thread
    const { data: newMessage, error } = await supabase
      .from('dispute_messages')
      .insert({
        dispute_id: id,
        sender_id: user.id,
        sender_type: 'staff',
        message,
        is_internal,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding message:', error)
      return NextResponse.json({ error: 'Failed to add message' }, { status: 500 })
    }

    // If not internal, notify the guest
    if (!is_internal) {
      try {
        await supabase.from('admin_messages').insert({
          user_id: dispute.guest_id,
          staff_id: user.id,
          subject: `New message on your dispute: ${dispute.subject}`,
          message: `Staff has responded to your dispute. Please check the dispute details for the full message.`,
          category: 'dispute_update',
        })
      } catch {
        // Notification is non-critical
      }
    }

    return NextResponse.json({ success: true, message: newMessage })
  } catch (error) {
    console.error('Error adding dispute message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
