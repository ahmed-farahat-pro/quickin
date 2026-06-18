import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Send admin message to a user
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
      category = 'notice',
      subject,
      body: messageBody,
      related_entity_type,
      related_entity_id,
    } = body

    // Validate required fields
    if (!user_id || !subject || !messageBody) {
      return NextResponse.json({ 
        error: 'Missing required fields: user_id, subject, body' 
      }, { status: 400 })
    }

    // Validate category
    const validCategories = ['warning', 'approval', 'rejection', 'notice', 'ban']
    if (!validCategories.includes(category)) {
      return NextResponse.json({ 
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}` 
      }, { status: 400 })
    }

    // Get user info for audit log
    const { data: targetUser } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user_id)
      .single()

    // Insert the message
    const { data: message, error: messageError } = await supabase
      .from('admin_messages')
      .insert({
        user_id,
        category,
        subject,
        body: messageBody,
        related_entity_type,
        related_entity_id,
        sent_by: staffProfile.id,
      })
      .select()
      .single()

    if (messageError) {
      console.error('Error creating message:', messageError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Create audit log
    await supabase
      .from('audit_logs')
      .insert({
        actor_id: user.id,
        actor_type: staffProfile.role === 'admin' ? 'admin' : 'staff',
        action: 'user.message',
        entity_type: 'user',
        entity_id: user_id,
        entity_name: targetUser?.full_name || targetUser?.email,
        new_data: { category, subject },
        notes: `Admin message sent: ${subject}`,
      })

    return NextResponse.json({ 
      success: true, 
      message,
    })
  } catch (error) {
    console.error('Error in POST /api/admin/users/messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get admin messages for a user
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
      .from('admin_messages')
      .select(`
        *,
        sent_by_staff:staff_profiles!admin_messages_sent_by_fkey(display_name)
      `)
      .order('created_at', { ascending: false })

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: messages, error } = await query.limit(100)

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Error in GET /api/admin/users/messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
