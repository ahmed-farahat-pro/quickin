import { ConditionForm } from '@/components/admin/conditions/condition-form'

export default function NewConditionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add New Condition</h1>
        <p className="text-muted-foreground">
          Create a new global rule or condition for listings.
        </p>
      </div>

      <ConditionForm />
    </div>
  )
}
