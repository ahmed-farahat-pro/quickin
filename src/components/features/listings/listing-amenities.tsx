import { createClient } from '@/lib/supabase/server'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { Badge } from '@/components/ui/badge'

interface ListingAttributeDisplay
{
  attribute_id: string
  attribute_code: string
  attribute_label: string
  category_id: string
  category_label: string
  type_code: string
  icon_class: string | null
  value_option_label: string | null
  value_number: number | null
  notes: string | null
  is_highlighted: boolean
}

interface ListingAmenitiesProps
{
  listingId: string
}

async function fetchListingAmenities(listingId: string): Promise<{
  highlighted: ListingAttributeDisplay[]
  byCategory: Record<string, ListingAttributeDisplay[]>
  categoryLabels: Record<string, string>
}>
{
  const supabase = await createClient()
  if (!supabase) {
    return { highlighted: [], byCategory: {}, categoryLabels: {} }
  }

  const { data, error } = await supabase
    .from('listing_attributes')
    .select(`
      attribute_id,
      value_option_id,
      value_number,
      notes,
      is_highlighted,
      attribute:attributes(
        code,
        label,
        icon_class,
        is_highlighted,
        category_id,
        category:attribute_categories(label)
      ),
      option:attribute_options(label, tier)
    `)
    .eq('listing_id', listingId)

  if (error || !data) {
    return { highlighted: [], byCategory: {}, categoryLabels: {} }
  }

  const highlighted: ListingAttributeDisplay[] = []
  const byCategory: Record<string, ListingAttributeDisplay[]> = {}
  const categoryLabels: Record<string, string> = {}

  for (const la of data) {
    const attr = Array.isArray(la.attribute) ? la.attribute[0] : la.attribute
    const opt = Array.isArray(la.option) ? la.option[0] : la.option
    const cat = (attr as any)?.category
    const catData = Array.isArray(cat) ? cat[0] : cat

    if (!attr) continue

    // Filter out Level 0 (None) if they still exist in DB
    const tier = opt?.tier ?? 1
    if (tier === 0) continue

    // Skip if no meaningful value (for numeric)
    if (la.value_option_id === null && (la.value_number === null || la.value_number <= 0)) {
      continue
    }

    const display: ListingAttributeDisplay = {
      attribute_id: la.attribute_id,
      attribute_code: attr.code,
      attribute_label: attr.label,
      category_id: attr.category_id,
      category_label: catData?.label || 'Other',
      type_code: 'number', // simplified
      icon_class: attr.icon_class,
      value_option_label: opt?.label || null,
      value_number: la.value_number,
      notes: la.notes,
      // Highlight Logic: Host Override OR System Default
      is_highlighted: la.is_highlighted !== null ? la.is_highlighted : attr.is_highlighted
    }

    // Add to highlighted if applicable
    if (display.is_highlighted) {
      highlighted.push(display)
    }

    // Add to category grouping
    const catId = attr.category_id
    categoryLabels[catId] = catData?.label || 'Other'
    if (!byCategory[catId]) {
      byCategory[catId] = []
    }
    byCategory[catId].push(display)
  }

  // Final Highlight Sort: Host choice first, then system defaults
  highlighted.sort((a, b) =>
  {
    // If we want to be more specific, we'd need to fetch more info, 
    // but for now, we'll keep the order they came in or sort by label.
    return a.attribute_label.localeCompare(b.attribute_label)
  })

  return { highlighted, byCategory, categoryLabels }
}

export async function ListingAmenities({ listingId }: ListingAmenitiesProps)
{
  const { highlighted, byCategory, categoryLabels } = await fetchListingAmenities(listingId)

  // Check if there are any amenities
  const totalCount = Object.values(byCategory).reduce((sum, arr) => sum + arr.length, 0)
  if (totalCount === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">What this place offers</h2>

      {/* Highlighted amenities */}
      {highlighted.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {highlighted.map((attr) => (
            <div
              key={attr.attribute_id}
              className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border"
            >
              {attr.icon_class && (
                <DynamicIcon name={attr.icon_class} className="h-5 w-5 text-primary" />
              )}
              <span className="font-medium">{attr.attribute_label}</span>
              {attr.value_option_label && (
                <Badge variant="secondary" className="text-xs">
                  {attr.value_option_label}
                </Badge>
              )}
              {attr.value_number && attr.value_number > 1 && (
                <Badge variant="secondary" className="text-xs">
                  ×{attr.value_number}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {/* All amenities by category */}
      <div className="grid gap-6 sm:grid-cols-2">
        {Object.entries(byCategory).map(([catId, attrs]) => (
          <div key={catId} className="space-y-3">
            <h3 className="font-medium text-muted-foreground">
              {categoryLabels[catId]}
            </h3>
            <ul className="space-y-2">
              {attrs.map((attr) => (
                <li key={attr.attribute_id} className="flex items-center gap-3">
                  {attr.icon_class && (
                    <DynamicIcon name={attr.icon_class} className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>{attr.attribute_label}</span>
                  {attr.value_option_label && (
                    <span className="text-sm text-muted-foreground">
                      ({attr.value_option_label})
                    </span>
                  )}
                  {attr.value_number && attr.value_number > 1 && (
                    <span className="text-sm text-muted-foreground">
                      ×{attr.value_number}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
