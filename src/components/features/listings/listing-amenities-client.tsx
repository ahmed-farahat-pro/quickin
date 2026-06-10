'use client'

import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from 'next-intl'

export interface ListingAttributeDisplay
{
  attribute_id: string
  attribute_code: string
  attribute_label: string
  category_id: string
  category_label: string
  icon_class: string | null
  value_option_label: string | null
  value_number: number | null
  notes: string | null
  is_highlighted: boolean
}

interface ListingAmenitiesClientProps
{
  highlighted: ListingAttributeDisplay[]
  byCategory: Record<string, ListingAttributeDisplay[]>
  categoryLabels: Record<string, string>
}

export function ListingAmenitiesClient({
  highlighted,
  byCategory,
  categoryLabels
}: ListingAmenitiesClientProps)
{
  const t = useTranslations('listingDetail')
  // Check if there are any amenities
  const totalCount = Object.values(byCategory).reduce((sum, arr) => sum + arr.length, 0)
  if (totalCount === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">{t('sections.whatPlaceOffers')}</h3>

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
            <h4 className="font-medium text-muted-foreground text-sm">
              {categoryLabels[catId]}
            </h4>
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
