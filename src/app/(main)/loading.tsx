// =============================================================================
// MAIN SECTION LOADING PAGE
// =============================================================================
// Description: Content-aware skeleton matching the homepage structure
// Shows category bar + search area + listings grid placeholders
// =============================================================================

import { Skeleton } from '@/components/ui/skeleton'

export default function MainLoading()
{
  return (
    <div className="space-y-6">
      {/* Category bar skeleton */}
      <div className="flex items-center gap-3 overflow-hidden px-6 py-4 border-b border-border">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 shrink-0">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>

      {/* Search / filter area skeleton */}
      <div className="flex items-center justify-between px-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>

      {/* Listings grid skeleton */}
      <div className="grid gap-6 px-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
