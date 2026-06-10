import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { getBaseUrl } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const { email, display_name, role } = await request.json()

    // Validate input
    if (!email || !display_name || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!['admin', 'moderator'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const adminClient = createAdminClient()

    if (!supabase || !adminClient) {
      return NextResponse.json(
        { error: 'Failed to initialize Supabase' },
        { status: 500 }
      )
    }

    // Get current user and verify they are an admin
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { data: currentStaff } = await supabase
      .from('staff_profiles')
      .select('role')
      .eq('id', currentUser.id)
      .eq('is_active', true)
      .single()

    if (!currentStaff || currentStaff.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can add staff members' },
        { status: 403 }
      )
    }

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    let userId: string

    if (existingUser) {
      // User already exists in auth, just add them to staff
      userId = existingUser.id

      // Check if already a staff member
      const { data: existingStaff } = await supabase
        .from('staff_profiles')
        .select('id')
        .eq('id', userId)
        .single()

      if (existingStaff) {
        return NextResponse.json(
          { error: 'This user is already a staff member' },
          { status: 400 }
        )
      }
    } else {
      // Create new user with invite
      // Use the centralized getBaseUrl utility
      const origin = getBaseUrl()
      
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          display_name: display_name,
          is_staff: true,
        },
        redirectTo: `${origin}/auth/invite`,
      })

      if (inviteError) {
        return NextResponse.json(
          { error: inviteError.message },
          { status: 400 }
        )
      }

      if (!inviteData.user) {
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        )
      }

      userId = inviteData.user.id
    }

    // Create staff profile using admin client to bypass RLS (first admin case)
    const { error: profileError } = await adminClient
      .from('staff_profiles')
      .insert({
        id: userId,
        display_name,
        email,
        role,
        created_by: currentUser.id,
      })

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error creating staff:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
