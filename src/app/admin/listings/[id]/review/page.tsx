import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, History } from 'lucide-react'
import Link from 'next/link'
import { ReviewActions } from './review-actions'

export default async function ListingReviewPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const id = params.id
  const supabase = await createClient()
  if (!supabase) return notFound()

  // Fetch listing basic info
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, title, review_status, user_id, user:profiles!user_id(full_name, email)')
    .eq('id', id)
    .single()

  if (listingError || !listing) {
    return notFound()
  }

  // Fetch the latest audit log for this listing review submission
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_id', id)
    .in('action', ['listing.submitted_for_review', 'listing.updated', 'listing.created'])
    .order('created_at', { ascending: false })
    .limit(1)

  const latestLog = logs && logs.length > 0 ? logs[0] : null
  const oldData = latestLog?.old_data as Record<string, any> || {}
  const newData = latestLog?.new_data as Record<string, any> || {}

  // Find all keys that have different values
  const changedKeys = new Set<string>()
  if (latestLog?.action === 'listing.created') {
    // If created, all keys are new
    Object.keys(newData).forEach(k => changedKeys.add(k))
  } else {
    // Diff
    for (const key of Object.keys(newData)) {
      if (JSON.stringify(newData[key]) !== JSON.stringify(oldData[key])) {
        changedKeys.add(key)
      }
    }
  }

  // Define some human readable labels for common keys
  const getLabel = (key: string) => {
    const labels: Record<string, string> = {
      title: 'Title',
      description: 'Description',
      price_per_night: 'Price Per Night',
      max_guests: 'Max Guests',
      bedrooms: 'Bedrooms',
      beds: 'Beds',
      bathrooms: 'Bathrooms',
      location: 'Location',
      city_id: 'City ID',
      country_id: 'Country ID',
      is_guest_favorite: 'Guest Favorite',
      translations: 'Translations (Arabic)',
      cleaning_fee: 'Cleaning Fee',
      currency: 'Currency',
      min_nights: 'Minimum Nights',
      google_maps_link: 'Google Maps Link',
    }
    return labels[key] || key
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/admin/approvals">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Review Listing Changes</h1>
            <p className="text-muted-foreground">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {listing.title} &bull; Host: {(listing.user as any)?.full_name || (listing.user as any)?.email || 'Unknown'}
            </p>
          </div>
        </div>
        {listing.review_status === 'pending_review' && (
          <div className="flex items-center gap-3">
            <ReviewActions listingId={listing.id} />
          </div>
        )}
      </div>

      {!latestLog ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <History className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No review history found</h3>
            <p className="text-muted-foreground">We couldn&apos;t find the exact changes that triggered this review.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Details</CardTitle>
              <CardDescription>
                {latestLog.action === 'listing.created' 
                  ? 'This is a brand new listing submitted for review.'
                  : 'The host edited their existing listing and submitted it for review.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {changedKeys.size === 0 ? (
                <div className="p-4 bg-muted/50 rounded-lg text-center text-muted-foreground">
                  No explicit data changes detected in the audit log payload.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="p-3 font-medium text-muted-foreground w-1/4">Field</th>
                        <th className="p-3 font-medium text-red-600/80 w-1/3">Previous Value</th>
                        <th className="p-3 font-medium text-green-600/80 w-1/3">New Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {Array.from(changedKeys).map(key => {
                        // Skip internal noise fields
                        if (['updated_at', 'review_status', 'is_published'].includes(key)) return null

                        const oldVal = oldData[key]
                        const newVal = newData[key]

                        return (
                          <tr key={key} className="bg-white">
                            <td className="p-3 font-medium align-top">{getLabel(key)}</td>
                            <td className="p-3 bg-red-50/50 align-top whitespace-pre-wrap break-words">
                              {oldVal === undefined || oldVal === null ? (
                                <span className="text-muted-foreground italic">None</span>
                              ) : typeof oldVal === 'object' ? (
                                <pre className="text-[11px] overflow-x-auto bg-white/50 p-2 rounded border border-red-100">{JSON.stringify(oldVal, null, 2)}</pre>
                              ) : String(oldVal)}
                            </td>
                            <td className="p-3 bg-green-50/50 align-top whitespace-pre-wrap break-words">
                              {newVal === undefined || newVal === null ? (
                                <span className="text-muted-foreground italic">None</span>
                              ) : typeof newVal === 'object' ? (
                                <pre className="text-[11px] overflow-x-auto bg-white/50 p-2 rounded border border-green-100">{JSON.stringify(newVal, null, 2)}</pre>
                              ) : String(newVal)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}