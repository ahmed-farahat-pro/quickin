import { createClient } from '@/lib/supabase/server'
import { AttributeForm } from '@/components/admin/attributes/attribute-form'

export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'

export default async function EditAttributePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const id = params.id
  const supabase = await createClient()
  if (!supabase) return notFound()

  const [attrRes, categoriesRes, typesRes] = await Promise.all([
    supabase
      .from('attributes')
      .select(`
        *,
        options:attribute_options(*)
      `)
      .eq('id', id)
      .single(),
    supabase.from('attribute_categories').select('*').order('display_order'),
    supabase.from('attribute_types').select('*')
  ])

  if (attrRes.error || !attrRes.data) {
    return notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Attribute</h1>
        <p className="text-muted-foreground">
          Modify {attrRes.data.label}
        </p>
      </div>

      <AttributeForm 
        initialData={attrRes.data}
        categories={categoriesRes.data || []} 
        types={typesRes.data || []} 
        isEditing
      />
    </div>
  )
}
