# Performance Learnings & Critical Optimizations

## Query Optimization
* **Date**: 2025-02-03
* **Issue**: N+1 Query in Listings Rating Fetch (`src/lib/supabase/queries.ts`)
* **Solution**: Replaced N+1 RPC calls with a single `select` query to `reviews` table and in-memory aggregation.
* **Impact**: ~2.1x latency reduction in synthetic benchmarks (108ms -> 51ms for 12 items).
# Performance Optimizations
# Performance Learnings

## Attribute Comparison Optimization
- **Problem**: `JSON.stringify` was used for deep comparison of `ListingAttributeValue` objects in a `useEffect` hook, causing unnecessary re-renders and CPU usage during form interactions, especially with many attributes.
- **Solution**: Replaced with a custom `areAttributeValuesEqual` function that performs a shallow key check and a deep field check.
- **Impact**: Benchmark showed ~4x speedup for equal objects and ~18x speedup for different objects.
- **Location**: `src/app/(dashboard)/dashboard/listings/[id]/manage/attributes-manager.tsx`

## 2025-02-27 - Server Component Data Fetching
**Learning:** Moving static data fetching (like filter attributes) from Client Components (`useEffect` waterfall) to Server Components (`layout` or `page`) significantly improves interactivity and reduces layout shift.
**Action:** Always fetch global or static configuration data in the root Layout or Page and pass it down as props, using `React.cache` for request-level deduplication.

## 2025-03-05 - Listing Availability and Adjustments Fetch Optimization
**Learning:** Redundant parallel queries to the same table (e.g., `listing_availability`) for different attributes (like blocked dates vs custom price dates) cause unnecessary network and database overhead, even when parallelized with `Promise.all`.
**Action:** Consolidate related data fetching into a single query with combined conditions (e.g., `.or('is_available.eq.false,price_override.not.is.null')`) to reduce latency and database load.
