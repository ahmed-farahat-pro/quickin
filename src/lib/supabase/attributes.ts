import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// Types
export interface AttributeCategory {
  id: string
  code: string
  label: string
  icon_class: string | null
  display_order: number
}

export interface Attribute {
  id: string
  code: string
  label: string
  description: string | null
  category_id: string
  type_id: string
  type_code: string  // 'option' | 'number'
  icon_class: string | null
  icon_url: string | null
  is_filterable: boolean
  is_highlighted: boolean
  is_approved: boolean
  is_enabled: boolean
  options?: AttributeOption[]
}

export interface AttributeOption {
  id: string
  code: string
  label: string
  display_order: number
}

export interface ListingAttribute {
  id: string
  attribute_id: string
  attribute_code: string
  attribute_label: string
  type_code: string
  icon_class: string | null
  value_option_id: string | null
  value_option_label: string | null
  value_number: number | null
  notes: string | null
}

/**
 * Fetch all approved attributes grouped by category
 */
export async function getAttributesByCategory(): Promise<{
  categories: AttributeCategory[]
  attributes: Record<string, Attribute[]>
}> {
  const supabase = await createClient()
  if (!supabase) {
    return { categories: [], attributes: {} }
  }

  // Fetch categories
  const { data: categories } = await supabase
    .from('attribute_categories')
    .select('*')
    .order('display_order')

  // Fetch approved attributes with options
  const { data: attributesData } = await supabase
    .from('attributes')
    .select(`
      *,
      type:attribute_types(code),
      options:attribute_options(id, code, label, display_order)
    `)
    .eq('is_approved', true)
    .eq('is_enabled', true)
    .order('label')

  // Transform and group by category
  const grouped: Record<string, Attribute[]> = {}
  
  for (const attr of attributesData || []) {
    const categoryId = attr.category_id
    if (!grouped[categoryId]) {
      grouped[categoryId] = []
    }
    grouped[categoryId].push({
      ...attr,
      type_code: attr.type?.code || 'number',
      options: attr.options?.sort((a: AttributeOption, b: AttributeOption) => 
        a.display_order - b.display_order
      )
    })
  }

  return {
    categories: categories || [],
    attributes: grouped
  }
}

/**
 * Fetch a listing's attribute values
 */
export async function getListingAttributes(listingId: string): Promise<ListingAttribute[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('listing_attributes')
    .select(`
      id,
      attribute_id,
      value_option_id,
      value_number,
      notes,
      attribute:attributes(
        code,
        label,
        icon_class,
        type:attribute_types(code)
      ),
      option:attribute_options(label)
    `)
    .eq('listing_id', listingId)

  if (error || !data) return []

  return data.map(la => {
    // Handle Supabase returning either array or single object for joins
    const attr = Array.isArray(la.attribute) ? la.attribute[0] : la.attribute
    const opt = Array.isArray(la.option) ? la.option[0] : la.option
    const typeObj = (attr as any)?.type
    const typeCode = Array.isArray(typeObj) ? typeObj[0]?.code : typeObj?.code
    
    return {
      id: la.id,
      attribute_id: la.attribute_id,
      attribute_code: attr?.code || '',
      attribute_label: attr?.label || '',
      type_code: typeCode || 'number',
      icon_class: attr?.icon_class || null,
      value_option_id: la.value_option_id,
      value_option_label: opt?.label || null,
      value_number: la.value_number,
      notes: la.notes
    }
  })
}

/**
 * Fetch filterable attributes for search sidebar
 */
export const getFilterableAttributes = cache(async function getFilterableAttributes(): Promise<Attribute[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data } = await supabase
    .from('attributes')
    .select(`
      *,
      type:attribute_types(code),
      options:attribute_options(id, code, label, display_order)
    `)
    .eq('is_approved', true)
    .eq('is_enabled', true)
    .eq('is_filterable', true)
    .order('label')

  return (data || []).map(attr => ({
    ...attr,
    type_code: attr.type?.code || 'number',
    options: attr.options?.sort((a: AttributeOption, b: AttributeOption) => 
      a.display_order - b.display_order
    )
  }))
})
