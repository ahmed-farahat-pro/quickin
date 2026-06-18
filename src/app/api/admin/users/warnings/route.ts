import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Issue a warning to a user
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
      user_id, 
      warning_level, 
      reason, 
      details,
      related_entity_type,
      related_entity_id,
      send_message = true
    } = body

    // Validate required fields
    if (!user_id || !warning_level || !reason) {
      return NextResponse.json({ 
        error: 'Missing required fields: user_id, warning_level, reason' 
      }, { status: 400 })
    }

    // Validate warning level
    if (warning_level < 1 || warning_level > 3) {
      return NextResponse.json({ 
        error: 'Warning level must be between 1 and 3' 
      }, { status: 400 })
    }

    // Get user's current warning count for context
    const { data: existingWarnings } = await supabase
      .from('user_warnings')
      .select('id, warning_level')
      .eq('user_id', user_id)
      .eq('is_active', true)

    // Insert the warning
    const { data: warning, error: warningError } = await supabase
      .from('user_warnings')
      .insert({
        user_id,
        warning_level,
        reason,
        details,
        related_entity_type,
        related_entity_id,
        issued_by: staffProfile.id,
      })
      .select()
      .single()

    if (warningError) {
      console.error('Error creating warning:', warningError)
      return NextResponse.json({ error: 'Failed to create warning' }, { status: 500 })
    }

    // Optionally send an admin message about the warning
    if (send_message) {
      const warningLevelText = warning_level === 1 ? 'First Warning' : 
                               warning_level === 2 ? 'Second Warning' : 
                               'Final Warning'
      
      await supabase
        .from('admin_messages')
        .insert({
          user_id,
          category: 'warning',
          subject: `${warningLevelText} - Policy Violation`,
          body: `You have received a ${warningLevelText.toLowerCase()} for the following reason:\n\n${reason}${details ? `\n\nDetails: ${details}` : ''}\n\nPlease review our community guidelines to avoid further action on your account.`,
          sent_by: staffProfile.id,
        })
    }

    // Create audit log
    await supabase
      .from('audit_logs')
      .insert({
        actor_id: user.id,
        actor_type: staffProfile.role === 'admin' ? 'admin' : 'staff',
        action: 'user.warn',
        entity_type: 'user',
        entity_id: user_id,
        new_data: { warning_level, reason },
        notes: `Warning level ${warning_level} issued. Total active warnings: ${(existingWarnings?.length || 0) + 1}`,
      })

    return NextResponse.json({ 
      success: true, 
      warning,
      total_warnings: (existingWarnings?.length || 0) + 1
    })
  } catch (error) {
    console.error('Error in POST /api/admin/users/warnings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get warnings for a specific user
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
  const userId = searchParams.get('user_id')

  try {
    let query = supabase
      .from('user_warnings')
      .select(`
        *,
        issued_by_staff:staff_profiles!user_warnings_issued_by_fkey(display_name)
      `)
      .order('created_at', { ascending: false })

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: warnings, error } = await query.limit(100)

    if (error) {
      console.error('Error fetching warnings:', error)
      return NextResponse.json({ error: 'Failed to fetch warnings' }, { status: 500 })
    }

    return NextResponse.json({ warnings })
  } catch (error) {
    console.error('Error in GET /api/admin/users/warnings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
