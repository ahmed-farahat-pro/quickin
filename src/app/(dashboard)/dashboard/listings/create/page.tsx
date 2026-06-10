import { getUser } from '@/lib/supabase/auth-actions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ListingWizard } from '@/components/features/host/listing-wizard'
import { VerificationGate, type VerificationStatus } from '@/components/features/verification'

async function getUserVerificationStatus(userId: string): Promise<VerificationStatus>
{
  const supabase = await createClient()
  if (!supabase) return 'unverified'

  // Check if user is staff/admin first
  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', userId)
    .eq('is_active', true)
    .single()

  if (staffProfile) {
    return 'verified'
  }

  const { data } = await supabase
    .from('profiles')
    .select('verification_status:verification_statuses(code)')
    .eq('id', userId)
    .single()

  const statusCode = (data?.verification_status as any)?.code
  return (statusCode as VerificationStatus) || 'unverified'
}

export default async function CreateListingPage()
{
  const user = await getUser()

  if (!user) {
    redirect('/login?redirect=/dashboard/listings/create')
  }

  const verificationStatus = await getUserVerificationStatus(user.id)

  return (
    <VerificationGate status={verificationStatus} action="host">
      <ListingWizard />
    </VerificationGate>
  )
}
