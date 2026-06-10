# Listing Sorting Options and Personalized Recommendations

## Purpose
To introduce sorting controls for the listings display (homepage/explore) and to implement a simple, personalized "Recommended" sort that factors in a user's past bookings and saved favorites. The sorting mechanism must integrate seamlessly with existing filters, location searches, and pagination.

## UI / UX
* **Location:** The sorting dropdown will be placed next to the results count and filter badges (Option A).
* **Options:**
  * Recommended (Default)
  * Price: Low to High
  * Price: High to Low
  * Top Rated
  * Closest to destination (only visible/applicable if a location search is active)
  * Newest

## Database & API Updates

### 1. `search_listings` RPC Function
The existing `search_listings` Postgres function handles all searching and filtering. We will modify it to accept two new parameters:
* `p_sort_by` (TEXT): The sort criteria (e.g., 'recommended', 'price_asc', 'price_desc', 'rating', 'newest', 'distance'). Defaults to 'recommended'.
* `p_user_id` (UUID): The current authenticated user's ID. Required for calculating personalized recommendations.

### 2. Personalized "Recommended" Logic
When `p_sort_by` is 'recommended' (or left default) and `p_user_id` is provided, we will calculate a `match_score` for each listing.

**User Preference Data Gathering:**
A CTE (Common Table Expression) within the function will aggregate the user's preferences based on their `bookings` and `wishlists` (via `wishlist_items`).
* **Locations:** Collect distinct `city`, `state`, or `country` from their history. (Or `ST_Centroid` of past locations if available).
* **Price Range:** Calculate the average `price_per_night` of past interactions. Let's say `avg_price +/- 30%` is their target range.
* **Property Types:** Collect an array of `property_type_id`s they've interacted with.
* **Lifestyles:** Collect an array of `lifestyle_category_id`s from their history.

**Scoring Algorithm (Simple Additive Score):**
For each listing in the filtered result set:
* +1 point if `listing.property_type_id` is in their preferred types.
* +1 point if the listing has a lifestyle category matching their preferred lifestyles.
* +1 point if `listing.price_per_night` is within their target price range.
* +1 point if `listing.city` or `country` matches their historical locations.

**Sorting (Recommended):**
1. Primary Sort: `match_score DESC` (Listings with 1-4 points appear first).
2. Secondary Sort: `avg_rating DESC` (Highest rated among those that match preferences).
3. Tertiary Sort: `review_count DESC`.

*Fallback:* If `p_user_id` is null or the user has no history (all scores are 0), the sort naturally falls back to `avg_rating DESC, review_count DESC`.

### 3. Other Sort Options
* **Price (Low/High):** Sort by the calculated `display_price` (which includes best offers) or `total_price` if dates are selected.
* **Top Rated:** Sort by `avg_rating DESC, review_count DESC`.
* **Newest:** Sort by `created_at DESC` (this is currently the default).
* **Closest to destination:** Sort by distance using PostGIS. This requires `p_geo_lat` and `p_geo_lng` to be present. `ST_Distance(listings.location, ST_SetSRID(ST_MakePoint(p_geo_lng, p_geo_lat), 4326)) ASC`.

## Component Updates

### 1. `HomePage` (`src/app/(main)/page.tsx`)
* Read `sort` parameter from `searchParams`.
* Pass `sort` and the current `user_id` (via `createClient().auth.getUser()`) to the `getListings` query.

### 2. `ListingsExplorer` (`src/components/features/listings/listings-explorer.tsx`)
* Provide UI state for the current sort.
* Append the `sort` parameter when calling `fetchMoreListings` for pagination.

### 3. New Sort Dropdown Component
* Create a generic dropdown (using shadcn/ui `Select` or `DropdownMenu`).
* Clicking an option updates the URL `?sort=xyz`, triggering a Server Component re-render (since `searchParams` are read dynamically).

## Error Handling & Edge Cases
* **Missing Geo Data for Distance Sort:** If the user selects "Closest to destination" but there is no location searched, either hide the option in the UI or fallback to 'recommended' gracefully on the server.
* **Pagination:** Since sorting is done in the RPC, pagination (`LIMIT` and `OFFSET`) will naturally apply to the sorted result set. We must ensure the `ORDER BY` clauses are deterministic (e.g., tie-breaking with `l.id ASC` or `l.created_at DESC`) to prevent listings jumping pages.
