import { PolicyForm } from '@/components/admin/cancellation-policies/policy-form'

export default function NewPolicyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add New Cancellation Policy</h1>
        <p className="text-muted-foreground">
          Create a new cancellation and refund policy for listings.
        </p>
      </div>

      <PolicyForm />
    </div>
  )
}
