import { createClient } from '@/lib/supabase/server'
import { ConditionsTable } from './conditions-table'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getConditions() {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('listing_conditions')
    .select('*')
    .order('name')

  if (error) {
    console.error('Error fetching conditions:', error)
    return []
  }

  return data
}

export default async function ConditionsPage() {
  const conditions = await getConditions()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Listing Conditions</h1>
          <p className="text-muted-foreground">
            Manage the rules, requirements, and conditions that can be applied to listings.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/conditions/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Condition
          </Link>
        </Button>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <ConditionsTable conditions={conditions} />
      </div>
    </div>
  )
}
