import { createClient } from '@/lib/supabase/server'
import { ConditionForm } from '@/components/admin/conditions/condition-form'
import { notFound } from 'next/navigation'

export default async function EditConditionPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const id = params.id
  const supabase = await createClient()
  if (!supabase) return notFound()

  const { data: condition, error } = await supabase
    .from('listing_conditions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !condition) {
    return notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Condition</h1>
        <p className="text-muted-foreground">
          Modify {condition.name}
        </p>
      </div>

      <ConditionForm initialData={condition} isEditing />
    </div>
  )
}
