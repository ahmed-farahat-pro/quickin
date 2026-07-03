// Shared property-type list + icons, used by the create-listing form (icon grid),
// explore cards and the listing detail page. The stored/API value stays English
// so existing data + the location ILIKE filter keep working; only the label is
// translated (key into hostPage.create.propertyTypes.*).
import {
  Building2,
  Home,
  Castle,
  Tent,
  LayoutGrid,
  Warehouse,
  Mountain,
  TreePine,
  Hotel,
  type LucideIcon,
} from 'lucide-react'

export interface PropertyType {
  value: string
  key: string
  Icon: LucideIcon
}

export const PROPERTY_TYPES: PropertyType[] = [
  { value: 'Apartment', key: 'apartment', Icon: Building2 },
  { value: 'House', key: 'house', Icon: Home },
  { value: 'Villa', key: 'villa', Icon: Castle },
  { value: 'Cabin', key: 'cabin', Icon: TreePine },
  { value: 'Studio', key: 'studio', Icon: LayoutGrid },
  { value: 'Loft', key: 'loft', Icon: Warehouse },
  { value: 'Chalet', key: 'chalet', Icon: Mountain },
  { value: 'Cottage', key: 'cottage', Icon: Tent },
  { value: 'Guest suite', key: 'guestSuite', Icon: Hotel },
]

/** Look up the icon for a stored property_type value (case-insensitive). */
export function iconForPropertyType(value: string | null | undefined): LucideIcon {
  if (!value) return Home
  const match = PROPERTY_TYPES.find((p) => p.value.toLowerCase() === value.toLowerCase())
  return match?.Icon ?? Home
}

/** Max photos a host can attach to a listing from the website. */
export const MAX_WEB_LISTING_PHOTOS = 10
