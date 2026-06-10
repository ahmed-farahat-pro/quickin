import { ListingForm } from '@/components/admin/listings/listing-form'

export default function NewListingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add New Listing</h1>
        <p className="text-muted-foreground">
          Create a new listing manually.
        </p>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <ListingForm />
      </div>
    </div>
  )
}
