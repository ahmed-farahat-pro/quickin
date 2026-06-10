# Listing Sorting and Personalized Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement sorting options for the listings explorer, including a personalized "Recommended" default sort based on user history, along with Price, Rating, and Newest criteria.

**Architecture:** We will update the `search_listings` PostgreSQL function to accept sorting parameters and user ID. It will compute a personalized `match_score` using a CTE to aggregate user preferences from their booking and wishlist history. The frontend will pass the `sort` parameter via URL and the components will be updated to include a Sort dropdown UI.

**Tech Stack:** PostgreSQL (Supabase RPC), Next.js 15 (React Server Components, Server Actions), TypeScript, Tailwind CSS, shadcn/ui.

---

### Task 1: Update `search_listings` database function

**Files:**
- Create: `supabase/migrations/048_add_listing_sorting.sql`

- [ ] **Step 1: Write the migration to drop and recreate the function**
Create the migration file `supabase/migrations/048_add_listing_sorting.sql` with the new signature.

```sql
-- =============================================================================
-- Migration: Add sorting parameters to search_listings
-- =============================================================================

DROP FUNCTION IF EXISTS search_listings(
  TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
  UUID[], TEXT, BOOLEAN, TEXT, TEXT[], INT, NUMERIC, NUMERIC,
  DATE, DATE, TEXT[], BOOLEAN, INT, INT
);

CREATE OR REPLACE FUNCTION search_listings(
  -- Location / geo
  p_location TEXT DEFAULT NULL,
  p_geo_lat DOUBLE PRECISION DEFAULT NULL,
  p_geo_lng DOUBLE PRECISION DEFAULT NULL,
  p_geo_radius_km DOUBLE PRECISION DEFAULT NULL,
  p_specific_ids UUID[] DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_include_surrounding BOOLEAN DEFAULT TRUE,
  -- Filters
  p_category_slug TEXT DEFAULT NULL,
  p_property_type_slugs TEXT[] DEFAULT NULL,
  p_guests INT DEFAULT NULL,
  p_price_min NUMERIC DEFAULT NULL,
  p_price_max NUMERIC DEFAULT NULL,
  p_check_in DATE DEFAULT NULL,
  p_check_out DATE DEFAULT NULL,
  p_attribute_codes TEXT[] DEFAULT NULL,
  p_best_offer BOOLEAN DEFAULT FALSE,
  -- Pagination
  p_limit INT DEFAULT 12,
  p_offset INT DEFAULT 0,
  -- Sorting & Personalization
  p_sort_by TEXT DEFAULT 'recommended',
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID, user_id UUID, title TEXT, description TEXT, price_per_night NUMERIC,
  location TEXT, city TEXT, state TEXT, country TEXT, max_guests INT, bedrooms INT, beds INT,
  bathrooms INT, property_type_id UUID, is_guest_favorite BOOLEAN, is_published BOOLEAN,
  cleaning_fee NUMERIC, currency TEXT, cancellation_policy TEXT, listing_code TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, avg_rating DECIMAL, review_count INT,
  best_offer_price NUMERIC, display_price NUMERIC, total_price NUMERIC, num_nights INT,
  lifestyles JSONB, images JSONB, total_count BIGINT
) AS $$
DECLARE
  v_category_id UUID;
  v_property_type_ids UUID[];
  v_attribute_ids UUID[];
  
  -- User preference variables
  v_pref_cities TEXT[];
  v_pref_countries TEXT[];
  v_pref_avg_price NUMERIC;
  v_pref_property_types UUID[];
  v_pref_lifestyles UUID[];
BEGIN
  -- 1. Resolve Slugs to IDs (same as before)
  IF p_category_slug IS NOT NULL THEN
    SELECT lc.id INTO v_category_id FROM public.lifestyle_categories lc WHERE lc.slug = p_category_slug;
    IF v_category_id IS NULL THEN RETURN; END IF;
  END IF;

  IF p_property_type_slugs IS NOT NULL AND array_length(p_property_type_slugs, 1) > 0 THEN
    SELECT array_agg(pt.id) INTO v_property_type_ids FROM public.property_types pt WHERE pt.slug = ANY(p_property_type_slugs);
    IF v_property_type_ids IS NULL THEN RETURN; END IF;
  END IF;

  IF p_attribute_codes IS NOT NULL AND array_length(p_attribute_codes, 1) > 0 THEN
    SELECT array_agg(a.id) INTO v_attribute_ids FROM public.attributes a WHERE a.code = ANY(p_attribute_codes);
    IF v_attribute_ids IS NULL THEN RETURN; END IF;
  END IF;

  -- 2. Gather User Preferences if sorting by recommended and user is provided
  IF p_sort_by = 'recommended' AND p_user_id IS NOT NULL THEN
    -- Get cities and countries from past bookings
    SELECT array_agg(DISTINCT l.city), array_agg(DISTINCT l.country), AVG(l.price_per_night)
    INTO v_pref_cities, v_pref_countries, v_pref_avg_price
    FROM public.bookings b
    JOIN public.listings l ON b.listing_id = l.id
    WHERE b.user_id = p_user_id;

    -- Get preferred property types from bookings and wishlists
    SELECT array_agg(DISTINCT l.property_type_id) INTO v_pref_property_types
    FROM (
      SELECT listing_id FROM public.bookings WHERE user_id = p_user_id
      UNION
      SELECT wi.listing_id FROM public.wishlist_items wi JOIN public.wishlists w ON wi.wishlist_id = w.id WHERE w.user_id = p_user_id
    ) user_listings
    JOIN public.listings l ON l.id = user_listings.listing_id;

    -- Get preferred lifestyles from bookings and wishlists
    SELECT array_agg(DISTINCT ll.lifestyle_category_id) INTO v_pref_lifestyles
    FROM (
      SELECT listing_id FROM public.bookings WHERE user_id = p_user_id
      UNION
      SELECT wi.listing_id FROM public.wishlist_items wi JOIN public.wishlists w ON wi.wishlist_id = w.id WHERE w.user_id = p_user_id
    ) user_listings
    JOIN public.listing_lifestyles ll ON ll.listing_id = user_listings.listing_id;
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT l.*,
      CASE
        WHEN p_sort_by = 'distance' AND p_geo_lat IS NOT NULL AND p_geo_lng IS NOT NULL THEN
           ST_Distance(l.location_geo, ST_SetSRID(ST_MakePoint(p_geo_lng, p_geo_lat), 4326))
        ELSE NULL
      END as distance_calc,
      CASE
        WHEN p_sort_by = 'recommended' AND p_user_id IS NOT NULL THEN
          (CASE WHEN l.city = ANY(v_pref_cities) OR l.country = ANY(v_pref_countries) THEN 1 ELSE 0 END) +
          (CASE WHEN l.price_per_night BETWEEN (v_pref_avg_price * 0.7) AND (v_pref_avg_price * 1.3) THEN 1 ELSE 0 END) +
          (CASE WHEN l.property_type_id = ANY(v_pref_property_types) THEN 1 ELSE 0 END) +
          (CASE WHEN EXISTS (SELECT 1 FROM public.listing_lifestyles ll WHERE ll.listing_id = l.id AND ll.lifestyle_category_id = ANY(v_pref_lifestyles)) THEN 1 ELSE 0 END)
        ELSE 0
      END as match_score
    FROM public.listings l
    WHERE l.is_published = TRUE
      -- Geo filters
      AND (
        (p_geo_lat IS NULL OR p_geo_lng IS NULL OR p_geo_radius_km IS NULL)
        OR (ST_DWithin(l.location_geo, ST_SetSRID(ST_MakePoint(p_geo_lng, p_geo_lat), 4326), p_geo_radius_km * 1000))
      )
      AND (p_specific_ids IS NULL OR l.id = ANY(p_specific_ids))
      AND (
        (p_include_surrounding = TRUE AND p_country IS NULL) 
        OR (p_include_surrounding = FALSE AND p_country IS NOT NULL AND l.country = p_country)
        OR (p_geo_lat IS NULL AND p_geo_lng IS NULL AND p_specific_ids IS NULL AND p_country IS NOT NULL AND l.country = p_country)
        OR (p_geo_lat IS NOT NULL AND p_geo_lng IS NOT NULL) -- if true, handled by ST_DWithin
      )
      -- Basic filters
      AND (p_location IS NULL OR l.city ILIKE '%' || p_location || '%' OR l.state ILIKE '%' || p_location || '%' OR l.country ILIKE '%' || p_location || '%')
      AND (p_guests IS NULL OR l.max_guests >= p_guests)
      AND (p_price_min IS NULL OR l.price_per_night >= p_price_min)
      AND (p_price_max IS NULL OR l.price_per_night <= p_price_max)
      AND (p_property_type_slugs IS NULL OR l.property_type_id = ANY(v_property_type_ids))
      -- Category filter
      AND (
        v_category_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.listing_lifestyles ll
          WHERE ll.listing_id = l.id AND ll.lifestyle_category_id = v_category_id
        )
      )
      -- Best offer filter
      AND (
        p_best_offer = FALSE
        OR EXISTS (
          SELECT 1 FROM public.listing_best_offers lbo
          WHERE lbo.listing_id = l.id AND lbo.status = 'approved' AND lbo.end_date >= CURRENT_DATE
        )
      )
      -- Availability filter
      AND (
        p_check_in IS NULL OR p_check_out IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.listing_id = l.id
            AND b.status IN ('confirmed', 'pending')
            AND (b.check_in < p_check_out AND b.check_out > p_check_in)
        )
      )
      -- Attribute ALL-match filter
      AND (
        v_attribute_ids IS NULL
        OR (
          SELECT count(DISTINCT la2.attribute_id)
          FROM public.listing_attributes la2
          WHERE la2.listing_id = l.id
            AND la2.attribute_id = ANY(v_attribute_ids)
        ) = array_length(v_attribute_ids, 1)
      )
  ),
  counted AS (
    SELECT count(*) AS cnt FROM filtered
  )
  SELECT
    l.id, l.user_id, l.title, l.description, l.price_per_night, l.location, l.city, l.state, l.country,
    l.max_guests, l.bedrooms, l.beds, l.bathrooms, l.property_type_id, l.is_guest_favorite, l.is_published,
    l.cleaning_fee, l.currency, l.cancellation_policy, l.listing_code, l.created_at, l.updated_at,
    COALESCE(r_agg.avg_rating, 0) AS avg_rating,
    COALESCE(r_agg.review_count, 0) AS review_count,
    bo.offer_price AS best_offer_price,
    pricing.display_price,
    pricing.total_price,
    pricing.num_nights,
    ls_agg.lifestyles,
    img_agg.images,
    counted.cnt AS total_count
  FROM filtered l
  CROSS JOIN counted
  LEFT JOIN LATERAL (
    SELECT COALESCE(ROUND(AVG(rv.rating)::numeric, 2), 0) AS avg_rating, COUNT(rv.id) AS review_count
    FROM public.reviews rv
    WHERE rv.listing_id = l.id AND rv.is_hidden = false
  ) r_agg ON TRUE
  LEFT JOIN LATERAL (
    SELECT lbo2.offer_price
    FROM public.listing_best_offers lbo2
    WHERE lbo2.listing_id = l.id AND lbo2.status = 'approved' AND lbo2.end_date >= CURRENT_DATE AND lbo2.offer_price IS NOT NULL
    ORDER BY lbo2.offer_price ASC LIMIT 1
  ) bo ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      CASE
        WHEN p_check_in IS NOT NULL AND p_check_out IS NOT NULL THEN
          ROUND((
            SELECT AVG(COALESCE(day_offer.offer_price, calculate_listing_price(l.id, d.d::DATE)))
            FROM generate_series(p_check_in, p_check_out - 1, '1 day'::interval) AS d(d)
            LEFT JOIN LATERAL (
              SELECT lbo3.offer_price FROM public.listing_best_offers lbo3
              WHERE lbo3.listing_id = l.id AND lbo3.status = 'approved' AND lbo3.offer_price IS NOT NULL
                AND d.d::DATE >= (lbo3.start_date AT TIME ZONE 'UTC')::DATE AND d.d::DATE <= (lbo3.end_date AT TIME ZONE 'UTC')::DATE
              ORDER BY lbo3.offer_price ASC LIMIT 1
            ) day_offer ON TRUE
          ), 2)
        ELSE
          COALESCE(
            (SELECT lbo3.offer_price FROM public.listing_best_offers lbo3
             WHERE lbo3.listing_id = l.id AND lbo3.status = 'approved' AND lbo3.offer_price IS NOT NULL
               AND CURRENT_DATE >= (lbo3.start_date AT TIME ZONE 'UTC')::DATE AND CURRENT_DATE <= (lbo3.end_date AT TIME ZONE 'UTC')::DATE
             ORDER BY lbo3.offer_price ASC LIMIT 1),
            calculate_listing_price(l.id, CURRENT_DATE)
          )
      END AS display_price,
      CASE
        WHEN p_check_in IS NOT NULL AND p_check_out IS NOT NULL THEN
          ROUND((
            SELECT SUM(COALESCE(day_offer.offer_price, calculate_listing_price(l.id, d.d::DATE)))
            FROM generate_series(p_check_in, p_check_out - 1, '1 day'::interval) AS d(d)
            LEFT JOIN LATERAL (
              SELECT lbo3.offer_price FROM public.listing_best_offers lbo3
              WHERE lbo3.listing_id = l.id AND lbo3.status = 'approved' AND lbo3.offer_price IS NOT NULL
                AND d.d::DATE >= (lbo3.start_date AT TIME ZONE 'UTC')::DATE AND d.d::DATE <= (lbo3.end_date AT TIME ZONE 'UTC')::DATE
              ORDER BY lbo3.offer_price ASC LIMIT 1
            ) day_offer ON TRUE
          ), 2)
        ELSE NULL
      END AS total_price,
      CASE WHEN p_check_in IS NOT NULL AND p_check_out IS NOT NULL THEN (p_check_out - p_check_in) ELSE NULL END AS num_nights
  ) pricing ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('lifestyle_category', to_jsonb(lc.*), 'is_primary', ll2.is_primary)) AS lifestyles
    FROM public.listing_lifestyles ll2 JOIN public.lifestyle_categories lc ON lc.id = ll2.lifestyle_category_id
    WHERE ll2.listing_id = l.id
  ) ls_agg ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('url', li.url, 'order', li."order") ORDER BY li."order" ASC) AS images
    FROM public.listing_images li WHERE li.listing_id = l.id
  ) img_agg ON TRUE
  ORDER BY 
    CASE WHEN p_sort_by = 'price_asc' THEN pricing.display_price END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'price_desc' THEN pricing.display_price END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'rating' THEN COALESCE(r_agg.avg_rating, 0) END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'rating' THEN COALESCE(r_agg.review_count, 0) END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'distance' THEN l.distance_calc END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'newest' THEN l.created_at END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'recommended' THEN l.match_score END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'recommended' THEN COALESCE(r_agg.avg_rating, 0) END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'recommended' THEN COALESCE(r_agg.review_count, 0) END DESC NULLS LAST,
    l.created_at DESC, -- tie breaker
    l.id ASC
  OFFSET p_offset
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

- [ ] **Step 2: Apply the migration locally**
Run `npx supabase db push` or `npx supabase migration up` to apply.

---

### Task 2: Update TypeScript Types and `getListings` Function

**Files:**
- Modify: `src/lib/supabase/queries.ts`

- [ ] **Step 1: Update `GetListingsOptions` interface**
Add `sortBy` and `userId`.

```typescript
export interface GetListingsOptions {
  // ... existing fields ...
  sortBy?: string
  userId?: string
}
```

- [ ] **Step 2: Update `getListings` implementation**
Pass the new parameters to the RPC call.

```typescript
// inside getListings
  const { data, error } = await supabase.rpc('search_listings', {
    // ... existing ...
    p_limit: limit,
    p_offset: offset,
    p_sort_by: options?.sortBy ?? 'recommended',
    p_user_id: options?.userId ?? null
  })
```

---

### Task 3: Create Sort Dropdown Component

**Files:**
- Create: `src/components/features/search/sort-dropdown.tsx`
- Create: `src/messages/en.json` (Add translation keys)
- Create: `src/messages/ar.json` (Add translation keys)

- [ ] **Step 1: Add translation keys for sort options**
In `src/messages/en.json` under `"filters"`, add:
```json
    "sortBy": "Sort by",
    "sortRecommended": "Recommended",
    "sortPriceAsc": "Price: Low to High",
    "sortPriceDesc": "Price: High to Low",
    "sortRating": "Top Rated",
    "sortNewest": "Newest",
    "sortDistance": "Closest to destination"
```

In `src/messages/ar.json` under `"filters"`, add:
```json
    "sortBy": "ترتيب حسب",
    "sortRecommended": "موصى به",
    "sortPriceAsc": "السعر: من الأقل للأعلى",
    "sortPriceDesc": "السعر: من الأعلى للأقل",
    "sortRating": "الأعلى تقييماً",
    "sortNewest": "الأحدث",
    "sortDistance": "الأقرب للوجهة"
```

- [ ] **Step 2: Create `SortDropdown` component**
```tsx
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SortDropdownProps {
  hasLocation?: boolean
}

export function SortDropdown({ hasLocation }: SortDropdownProps) {
  const t = useTranslations('filters')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const currentSort = searchParams.get('sort') || 'recommended'

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'recommended') {
      params.delete('sort')
    } else {
      params.set('sort', value)
    }
    // Reset to page 1 when sorting changes
    params.delete('page')
    
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground whitespace-nowrap">{t('sortBy')}:</span>
      <Select value={currentSort} onValueChange={handleSortChange}>
        <SelectTrigger className="w-[180px] h-8 text-sm bg-white">
          <SelectValue placeholder={t('sortRecommended')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recommended">{t('sortRecommended')}</SelectItem>
          <SelectItem value="price_asc">{t('sortPriceAsc')}</SelectItem>
          <SelectItem value="price_desc">{t('sortPriceDesc')}</SelectItem>
          <SelectItem value="rating">{t('sortRating')}</SelectItem>
          <SelectItem value="newest">{t('sortNewest')}</SelectItem>
          {hasLocation && (
            <SelectItem value="distance">{t('sortDistance')}</SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
```

---

### Task 4: Integrate Sort Dropdown into Homepage

**Files:**
- Modify: `src/app/(main)/page.tsx`

- [ ] **Step 1: Read `sort` parameter and User ID**
```typescript
  // In HomePage component
  const sort = params.sort
  // ...
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
```

- [ ] **Step 2: Pass new parameters to `getListings`**
```typescript
    getListings({
      // ... existing params ...
      sortBy: sort,
      userId: user?.id,
      locale,
    }),
```

- [ ] **Step 3: Render `SortDropdown` next to results count**
```typescript
import { SortDropdown } from '@/components/features/search/sort-dropdown'

// Update the filter badges section:
        {(category || hasFilters) && (
          <div className='mb-6 flex flex-col sm:flex-row sm:items-center justify-between flex-wrap gap-4'>
            <div className='flex items-center gap-2 flex-wrap'>
              <p className='text-muted-foreground'>
                {t('filters.showingResults', { count: listings.length, total: totalCount })}
              </p>
              {/* existing badges... */}
            </div>
            
            <div className='flex items-center gap-4 ml-auto'>
              <SortDropdown hasLocation={!!geoSearch || !!location} />
              
              <Link href={localizePathname('/', locale)} className='text-sm text-primary hover:underline font-medium whitespace-nowrap'>
                {t('filters.clearAll')}
              </Link>
            </div>
          </div>
        )}
```
*Wait, what if there are NO filters active? The user still needs to sort.* Let's fix that.

- [ ] **Step 4: Ensure SortDropdown is always visible**
```typescript
        {/* Results Count & Sort Dropdown */}
        <div className='mb-6 flex flex-col sm:flex-row sm:items-center justify-between flex-wrap gap-4'>
          <div className='flex items-center gap-2 flex-wrap'>
             <p className='text-muted-foreground font-medium'>
                {t('filters.showingResults', { count: listings.length, total: totalCount })}
             </p>
             {/* Render badges if category or hasFilters */}
             {category && <Badge variant="secondary" className='rounded-full'>{category}</Badge>}
             {location && <Badge variant="outline" className='rounded-full'>{t('filters.location', { location })}</Badge>}
             {/* ...other badges */}
          </div>
          
          <div className='flex items-center gap-4 ml-auto'>
            <SortDropdown hasLocation={!!geoSearch || !!location} />
            
            {(category || hasFilters) && (
              <Link href={localizePathname('/', locale)} className='text-sm text-primary hover:underline font-medium whitespace-nowrap'>
                {t('filters.clearAll')}
              </Link>
            )}
          </div>
        </div>
```

---

### Task 5: Support sorting in "Load More" pagination

**Files:**
- Modify: `src/components/features/listings/listings-explorer.tsx`
- Modify: `src/lib/actions/listing-actions.ts`

- [ ] **Step 1: Update `fetchMoreListings` signature in `listing-actions.ts`**
Add `sortBy` to the params.

```typescript
// in src/lib/actions/listing-actions.ts
export async function fetchMoreListings(
  page: number,
  params: {
    // ... existing ...
    sortBy?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  return getListings({
    // ... existing ...
    sortBy: params.sortBy,
    userId: user?.id
  })
}
```

- [ ] **Step 2: Read and pass `sort` in `listings-explorer.tsx`**
```typescript
// Inside handleShowMore
      const newListings = await fetchMoreListings(nextPage, {
        // ... existing ...
        sortBy: searchParams.get('sort') || undefined,
        // ... existing ...
      })
```

- [ ] **Step 3: Update `searchKey` for state resets**
Include `sort` in the key so changing it resets to page 1.
```typescript
  const searchKey = `${searchParams.toString()}-${geoSearch?.lat}-${country}-${includeSurrounding}-${searchParams.get('sort')}`
```

- [ ] **Step 4: Commit all changes**
Run: `git add . && git commit -m "feat: add listing sorting and personalized recommendations"`