
import { DestinationForm } from '@/components/admin/destinations/destination-form'

export default function NewDestinationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Destination</h1>
        <p className="text-muted-foreground">
          Add a new search destination or curated area.
        </p>
      </div>
      <DestinationForm />
    </div>
  )
}
