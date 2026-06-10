import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { AddStaffDialog } from './add-staff-dialog'
import { StaffTable } from './staff-table'
import { Staff } from './columns'

async function getStaff(): Promise<Staff[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data } = await supabase
    .from('staff_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return data || []
}

async function getCurrentStaff() {
  const supabase = await createClient()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  return staffProfile
}

async function toggleStaffStatus(formData: FormData) {
  'use server'

  const id = formData.get('id') as string
  const currentStatus = formData.get('is_active') === 'true'
  
  const supabase = await createClient()
  if (!supabase) return

  await supabase
    .from('staff_profiles')
    .update({ is_active: !currentStatus })
    .eq('id', id)

  revalidatePath('/admin/staff')
}

async function createStaffMember(formData: FormData) {
  'use server'

  const email = formData.get('email') as string
  const displayName = formData.get('display_name') as string
  const role = formData.get('role') as string

  const supabase = await createClient()
  const adminClient = createAdminClient()

  if (!supabase || !adminClient) {
    return { error: 'Failed to initialize Supabase clients' }
  }

  // Get current admin
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) {
    return { error: 'Not authenticated' }
  }

  // Create user with invite
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      display_name: displayName,
      is_staff: true,
    },
  })

  if (inviteError) {
    return { error: inviteError.message }
  }

  if (!inviteData.user) {
    return { error: 'Failed to create user' }
  }

  // Create staff profile
  const { error: profileError } = await supabase
    .from('staff_profiles')
    .insert({
      id: inviteData.user.id,
      display_name: displayName,
      email: email,
      role: role,
      created_by: currentUser.id,
    })

  if (profileError) {
    return { error: profileError.message }
  }

  revalidatePath('/admin/staff')
  return { success: true }
}

export { createStaffMember }

export default async function StaffPage() {
  const [staff, currentStaff] = await Promise.all([
    getStaff(),
    getCurrentStaff(),
  ])

  const isAdmin = currentStaff?.role === 'admin'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground">
            Manage administrators and moderators.
          </p>
        </div>
        {isAdmin && <AddStaffDialog />}
      </div>

      <StaffTable 
        staff={staff} 
        isAdmin={isAdmin}
        currentUserId={currentStaff?.id}
        toggleStatusAction={toggleStaffStatus}
      />
    </div>
  )
}
