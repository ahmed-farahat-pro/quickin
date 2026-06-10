import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AttributesTable } from './attributes-table'
import { CategoriesTable } from './categories-table'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { PageClientWrapper } from './page-client-wrapper'

export const dynamic = 'force-dynamic'

async function getData() {
  const supabase = await createClient()
  if (!supabase) return { attributes: [], categories: [] }

  const [attributesRes, categoriesRes] = await Promise.all([
    supabase
      .from('attributes')
      .select(`
        id, code, label, is_approved, is_enabled,
        category:attribute_categories(label),
        type:attribute_types(code)
      `)
      .order('label'),
    supabase
      .from('attribute_categories')
      .select('*')
      .order('display_order')
  ])

  return {
    attributes: (attributesRes.data || []).map(a => ({
      ...a,
      category: Array.isArray(a.category) ? a.category[0] : a.category,
      type: Array.isArray(a.type) ? a.type[0] : a.type,
    })),
    categories: categoriesRes.data || []
  }
}

export default async function AttributesPage() {
  const { attributes, categories } = await getData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Amenities & Attributes</h1>
        <p className="text-muted-foreground">
          Manage amenities, rules, and their categories.
        </p>
      </div>

      <PageClientWrapper 
        attributes={attributes} 
        categories={categories} 
      />
    </div>
  )
}
