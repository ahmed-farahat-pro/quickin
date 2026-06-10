import { createClient } from '@/lib/supabase/server'
import { AttributeForm } from '@/components/admin/attributes/attribute-form'

export default async function NewAttributePage() {
  const supabase = await createClient()
  if (!supabase) return null

  const [categoriesRes, typesRes] = await Promise.all([
    supabase.from('attribute_categories').select('*').order('display_order'),
    supabase.from('attribute_types').select('*')
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add New Attribute</h1>
        <p className="text-muted-foreground">
          Create a new amenity, rule, or listing feature.
        </p>
      </div>

      <AttributeForm 
        categories={categoriesRes.data || []} 
        types={typesRes.data || []} 
      />
    </div>
  )
}
