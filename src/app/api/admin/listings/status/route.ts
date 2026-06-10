import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Update listing status (activate/deactivate)
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
      listing_id, 
      action, // 'activate' or 'deactivate'
      reason,
      send_message = true
    } = body

    // Validate required fields
    if (!listing_id || !action) {
      return NextResponse.json({ 
        error: 'Missing required fields: listing_id, action' 
      }, { status: 400 })
    }

    if (!['activate', 'deactivate'].includes(action)) {
      return NextResponse.json({ 
        error: 'Action must be "activate" or "deactivate"' 
      }, { status: 400 })
    }

    // Get the listing
    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select(`
        id,
        title,
        status,
        host_id,
        host:profiles!listings_host_id_fkey(full_name, email)
      `)
      .eq('id', listing_id)
      .single()

    if (fetchError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    const newStatus = action === 'activate' ? 'active' : 'inactive'

    if (listing.status === newStatus) {
      return NextResponse.json({ 
        error: `Listing is already ${newStatus}` 
      }, { status: 400 })
    }

    // Update the listing
    const { error: updateError } = await supabase
      .from('listings')
      .update({ status: newStatus })
      .eq('id', listing_id)

    if (updateError) {
      console.error('Error updating listing:', updateError)
      return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 })
    }

    // Send notification to host
    if (send_message) {
      const subject = action === 'activate' 
        ? 'Your Listing Has Been Activated' 
        : 'Your Listing Has Been Deactivated'
      
      const messageBody = action === 'activate'
        ? `Good news! Your listing "${listing.title}" is now active and visible to guests.\n\nThank you for hosting with us!`
        : `Your listing "${listing.title}" has been deactivated by an administrator.\n\n${reason ? `Reason: ${reason}\n\n` : ''}Please contact support if you have questions or believe this is an error.`

      await supabase
        .from('admin_messages')
        .insert({
          user_id: listing.host_id,
          category: action === 'activate' ? 'approval' : 'notice',
          subject,
          body: messageBody,
          related_entity_type: 'listing',
          related_entity_id: listing_id,
          sent_by: staffProfile.id,
        })
    }

    // Create audit log
    await supabase
      .from('audit_logs')
      .insert({
        actor_id: user.id,
        actor_type: staffProfile.role === 'admin' ? 'admin' : 'staff',
        action: `listing.${action}`,
        entity_type: 'listing',
        entity_id: listing_id,
        entity_name: listing.title,
        old_data: { status: listing.status },
        new_data: { status: newStatus },
        notes: reason || `Listing ${action}d by admin`,
      })

    return NextResponse.json({ 
      success: true,
      status: newStatus,
    })
  } catch (error) {
    console.error('Error in PUT /api/admin/listings/status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
