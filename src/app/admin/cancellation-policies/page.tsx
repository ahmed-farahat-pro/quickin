import { createClient } from '@/lib/supabase/server'
import { PoliciesTable } from './policies-table'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getPolicies() {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('cancellation_policies')
    .select('*')
    .order('display_order')

  if (error) {
    console.error('Error fetching cancellation policies:', error)
    return []
  }

  return data
}

export default async function CancellationPoliciesPage() {
  const policies = await getPolicies()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cancellation Policies</h1>
          <p className="text-muted-foreground">
            Manage the cancellation and refund policies that can be applied to listings.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/cancellation-policies/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Policy
          </Link>
        </Button>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <PoliciesTable policies={policies} />
      </div>
    </div>
  )
}
