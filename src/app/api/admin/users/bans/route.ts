import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Schema for ban request validation
const banSchema = z.object({
  user_id: z.string().uuid('Invalid user ID format'),
  ban_type: z.enum(['temporary', 'permanent']).default('temporary'),
  reason: z.string().min(1, 'Reason is required'),
  details: z.string().optional(),
  // Coerce string numbers to actual numbers to prevent concatenation bugs
  duration_days: z.coerce.number().min(1, 'Duration must be at least 1 day').max(3650, 'Duration limit is 10 years').optional(),
  send_message: z.boolean().optional().default(true)
}).refine(data => {
  if (data.ban_type === 'temporary' && !data.duration_days) {
    return false;
  }
  return true;
}, {
  message: "Temporary bans require duration_days",
  path: ["duration_days"]
});

// Ban a user
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
    const rawBody = await request.json()

    // Validate request body using Zod
    const validation = banSchema.safeParse(rawBody)

    if (!validation.success) {
      // Return first error message or generic validation error
      const errorMessage = validation.error.issues[0]?.message || 'Validation error'
      return NextResponse.json({
        error: errorMessage,
        details: validation.error.issues
      }, { status: 400 })
    }

    const { 
      user_id, 
      ban_type,
      reason, 
      details,
      duration_days,
      send_message
    } = validation.data

    // Check if user already has an active ban
    const { data: existingBan } = await supabase
      .from('user_bans')
      .select('id')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .single()

    if (existingBan) {
      return NextResponse.json({ 
        error: 'User already has an active ban' 
      }, { status: 400 })
    }

    // Get user's warning count
    const { data: warnings } = await supabase
      .from('user_warnings')
      .select('id')
      .eq('user_id', user_id)
      .eq('is_active', true)

    // Calculate expiration date for temporary bans
    let expiresAt: string | null = null
    if (ban_type === 'temporary' && duration_days) {
      const expiry = new Date()
      // duration_days is guaranteed to be a number by Zod coercion
      expiry.setDate(expiry.getDate() + duration_days)
      expiresAt = expiry.toISOString()
    }

    // Get user info for audit log
    const { data: targetUser } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user_id)
      .single()

    // Insert the ban
    const { data: ban, error: banError } = await supabase
      .from('user_bans')
      .insert({
        user_id,
        ban_type,
        reason,
        details,
        duration_days: ban_type === 'temporary' ? duration_days : null,
        expires_at: expiresAt,
        banned_by: staffProfile.id,
      })
      .select()
      .single()

    if (banError) {
      console.error('Error creating ban:', banError)
      return NextResponse.json({ error: 'Failed to create ban' }, { status: 500 })
    }

    // Send ban notification message
    if (send_message) {
      const banTypeText = ban_type === 'permanent' ? 
        'permanently banned' : 
        `suspended for ${duration_days} days`
      
      await supabase
        .from('admin_messages')
        .insert({
          user_id,
          category: 'ban',
          subject: ban_type === 'permanent' ? 'Account Permanently Banned' : 'Account Suspended',
          body: `Your account has been ${banTypeText} for the following reason:\n\n${reason}${details ? `\n\nDetails: ${details}` : ''}${ban_type === 'temporary' ? `\n\nYour suspension will end on ${new Date(expiresAt!).toLocaleDateString()}.` : '\n\nThis action is final. If you believe this is an error, please contact support.'}`,
          sent_by: staffProfile.id,
        })
    }

    // Create audit log
    await supabase
      .from('audit_logs')
      .insert({
        actor_id: user.id,
        actor_type: staffProfile.role === 'admin' ? 'admin' : 'staff',
        action: 'user.ban',
        entity_type: 'user',
        entity_id: user_id,
        entity_name: targetUser?.full_name || targetUser?.email,
        new_data: { ban_type, reason, duration_days, expires_at: expiresAt },
        notes: `User banned. Had ${warnings?.length || 0} active warnings.`,
      })

    return NextResponse.json({ 
      success: true, 
      ban,
    })
  } catch (error) {
    console.error('Error in POST /api/admin/users/bans:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Unban a user
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
  }

  // Get current staff user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is staff (only admins can unban)
  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('id, role')
    .eq('id', user.id)
    .eq('is_active', true)
    .single()

  if (!staffProfile || staffProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required for unbanning' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Find active ban
    const { data: existingBan } = await supabase
      .from('user_bans')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (!existingBan) {
      return NextResponse.json({ error: 'No active ban found' }, { status: 404 })
    }

    // Get user info for audit log
    const { data: targetUser } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single()

    // Unban the user
    const { error: unbanError } = await supabase
      .from('user_bans')
      .update({
        is_active: false,
        unbanned_by: staffProfile.id,
        unbanned_at: new Date().toISOString(),
      })
      .eq('id', existingBan.id)

    if (unbanError) {
      console.error('Error unbanning user:', unbanError)
      return NextResponse.json({ error: 'Failed to unban user' }, { status: 500 })
    }

    // Send unban notification
    await supabase
      .from('admin_messages')
      .insert({
        user_id: userId,
        category: 'notice',
        subject: 'Account Restored',
        body: 'Your account has been restored and you can now access the platform again. Please ensure you follow our community guidelines to avoid future restrictions.',
        sent_by: staffProfile.id,
      })

    // Create audit log
    await supabase
      .from('audit_logs')
      .insert({
        actor_id: user.id,
        actor_type: 'admin',
        action: 'user.unban',
        entity_type: 'user',
        entity_id: userId,
        entity_name: targetUser?.full_name || targetUser?.email,
        notes: 'User ban lifted',
      })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/admin/users/bans:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get bans
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
  const activeOnly = searchParams.get('active_only') !== 'false'

  try {
    let query = supabase
      .from('user_bans')
      .select(`
        *,
        banned_by_staff:staff_profiles!user_bans_banned_by_fkey(display_name),
        unbanned_by_staff:staff_profiles!user_bans_unbanned_by_fkey(display_name)
      `)
      .order('created_at', { ascending: false })

    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data: bans, error } = await query.limit(100)

    if (error) {
      console.error('Error fetching bans:', error)
      return NextResponse.json({ error: 'Failed to fetch bans' }, { status: 500 })
    }

    return NextResponse.json({ bans })
  } catch (error) {
    console.error('Error in GET /api/admin/users/bans:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
