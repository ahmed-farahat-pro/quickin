import { createClient } from '@/lib/supabase/server'
import { PolicyForm } from '@/components/admin/cancellation-policies/policy-form'
import { notFound } from 'next/navigation'

export default async function EditPolicyPage(props: { params: Promise<{ code: string }> }) {
  const params = await props.params
  const code = params.code
  const supabase = await createClient()
  if (!supabase) return notFound()

  const { data: policy, error } = await supabase
    .from('cancellation_policies')
    .select('*')
    .eq('code', code)
    .single()

  if (error || !policy) {
    return notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Cancellation Policy</h1>
        <p className="text-muted-foreground">
          Modify {policy.label}
        </p>
      </div>

      <PolicyForm initialData={policy} isEditing />
    </div>
  )
}
