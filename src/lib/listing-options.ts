// Shared listing option catalogs — the curated browse areas (`region`) and the
// amenity checklist (`amenities`) a host picks from. Companion to
// property-types.ts, which owns the property-type grid.
//
// The stored / API value stays ENGLISH and is byte-identical to the catalogs the
// other surfaces use — quickin-backend `REGIONS`, iOS `Amenities.all`, Android
// `REGIONS` / `AMENITY_OPTIONS` — so the same listing reads the same everywhere
// and the region chips on search keep matching. Only the label is translated
// (key into hostPage.create.regions.* / hostPage.create.amenities.*).
import {
  Bath,
  ChefHat,
  CircleParking,
  Coffee,
  Dumbbell,
  Flame,
  Laptop,
  PawPrint,
  Snowflake,
  Thermometer,
  Tv,
  Umbrella,
  WashingMachine,
  Waves,
  Wifi,
  type LucideIcon,
} from 'lucide-react'

export interface ListingOption {
  /** What is stored / sent to the API (English, canonical). */
  value: string
  /** Translation key under hostPage.create.<catalog>.*. */
  key: string
}

export interface AmenityOption extends ListingOption {
  Icon: LucideIcon
}

/** Curated browse areas. Same four the search chips and the mobile apps offer. */
export const REGIONS: ListingOption[] = [
  { value: 'North Coast', key: 'northCoast' },
  { value: 'Ain Sokhna', key: 'ainSokhna' },
  { value: 'El Gouna', key: 'elGouna' },
  { value: 'Cairo', key: 'cairo' },
]

/** The amenity chips, in display order (identical order to iOS + Android). */
export const AMENITIES: AmenityOption[] = [
  { value: 'WiFi', key: 'wifi', Icon: Wifi },
  { value: 'Pool', key: 'pool', Icon: Waves },
  { value: 'Kitchen', key: 'kitchen', Icon: ChefHat },
  { value: 'Air conditioning', key: 'airConditioning', Icon: Snowflake },
  { value: 'Free parking', key: 'freeParking', Icon: CircleParking },
  { value: 'Washer', key: 'washer', Icon: WashingMachine },
  { value: 'TV', key: 'tv', Icon: Tv },
  { value: 'Heating', key: 'heating', Icon: Thermometer },
  { value: 'Workspace', key: 'workspace', Icon: Laptop },
  { value: 'Gym', key: 'gym', Icon: Dumbbell },
  { value: 'Beach access', key: 'beachAccess', Icon: Umbrella },
  { value: 'Pets allowed', key: 'petsAllowed', Icon: PawPrint },
  { value: 'Hot tub', key: 'hotTub', Icon: Bath },
  { value: 'BBQ grill', key: 'bbqGrill', Icon: Flame },
  { value: 'Breakfast', key: 'breakfast', Icon: Coffee },
]

/** Region values the API accepts (server-side validation reads this list). */
export const REGION_VALUES: readonly string[] = REGIONS.map((r) => r.value)

/**
 * Property types the API accepts. The web icon grid (property-types.ts) shows a
 * subset; this is the UNION with the mobile catalogs, so a listing created on
 * iOS/Android ("Guest House") can still be saved from the web editor.
 */
export const PROPERTY_TYPE_VALUES: readonly string[] = [
  'Apartment', 'House', 'Villa', 'Cabin', 'Studio', 'Loft', 'Chalet', 'Cottage',
  'Guest suite', 'Guest House',
]

/** Longest amenity name we store — anything longer is truncated, never rejected. */
export const MAX_AMENITY_CHARS = 64

/** Max amenities on one listing (guards the payload; the catalog is far smaller). */
export const MAX_AMENITIES = 60

/** Icon for a stored amenity value (case-insensitive), or null when unknown. */
export function iconForAmenity(value: string): LucideIcon | null {
  const match = AMENITIES.find((a) => a.value.toLowerCase() === value.toLowerCase())
  return match?.Icon ?? null
}

/** Canonical catalog casing for a stored value, or the trimmed input when the
 *  catalog doesn't know it (legacy rows keep whatever they hold). */
export function canonicalAmenity(value: string): string {
  const s = value.trim()
  return AMENITIES.find((a) => a.value.toLowerCase() === s.toLowerCase())?.value ?? s
}
