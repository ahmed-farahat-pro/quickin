'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { SlidersHorizontal, MapPin, Calendar, Users, Coins, Tag, Home, Coffee } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import
{
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet'
import
{
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { FilterableAttribute } from '@/types'
import type { Locale } from '@/i18n/config'
import { localizePathname } from '@/lib/i18n/pathname'

interface SearchFiltersProps
{
  activeCount: number
  currentFilters: {
    location?: string
    checkIn?: string
    checkOut?: string
    guests?: number
    priceMin?: number
    priceMax?: number

    attributes?: string[]
    propertyType?: string[]
    bestOffer?: string
  }
}

export function SearchFilters({ activeCount, currentFilters }: SearchFiltersProps)
{
  const locale = useLocale() as Locale
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)

  // Filter state
  const [location, setLocation] = useState(currentFilters.location || '')
  const [checkIn, setCheckIn] = useState<Date | undefined>(
    currentFilters.checkIn ? new Date(currentFilters.checkIn) : undefined
  )
  const [checkOut, setCheckOut] = useState<Date | undefined>(
    currentFilters.checkOut ? new Date(currentFilters.checkOut) : undefined
  )
  const [guests, setGuests] = useState(currentFilters.guests?.toString() || '')
  const [priceMin, setPriceMin] = useState(currentFilters.priceMin?.toString() || '')
  const [priceMax, setPriceMax] = useState(currentFilters.priceMax?.toString() || '')
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>(
    currentFilters.attributes || []
  )
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>(
    currentFilters.propertyType || []
  )
  const [isBestOffer, setIsBestOffer] = useState(currentFilters.bestOffer === 'true')

  // Filterable attributes from database
  const [attributes, setAttributes] = useState<FilterableAttribute[]>([])
  const [propertyTypes, setPropertyTypes] = useState<{ id: string, name: string, slug: string }[]>([])
  const [loadingAttributes, setLoadingAttributes] = useState(true)

  // Load filterable attributes
  useEffect(() =>
  {
    async function loadAttributes()
    {
      const supabase = createClient()
      const { data } = await supabase
        .from('attributes')
        .select('id, code, label, icon_class')
        .eq('is_approved', true)
        .eq('is_enabled', true)
        .eq('is_filterable', true)
        .order('label')

      setAttributes(data || [])

      // Fetch property types
      const { data: typeData } = await supabase
        .from('property_types')
        .select('id, name, slug')
        .order('name')

      setPropertyTypes(typeData || [])
      setLoadingAttributes(false)
    }
    loadAttributes()
  }, [])

  function applyFilters()
  {
    const params = new URLSearchParams(searchParams.toString())

    // Clear existing search params
    params.delete('location')
    params.delete('checkIn')
    params.delete('checkOut')
    params.delete('guests')
    params.delete('priceMin')
    params.delete('priceMax')
    params.delete('attributes')
    params.delete('propertyType')
    params.delete('page') // Reset to page 1

    // Set new params
    if (location.trim()) params.set('location', location.trim())
    if (checkIn) params.set('checkIn', format(checkIn, 'yyyy-MM-dd'))
    if (checkOut) params.set('checkOut', format(checkOut, 'yyyy-MM-dd'))
    if (guests && parseInt(guests) > 0) params.set('guests', guests)
    if (priceMin && parseInt(priceMin) > 0) params.set('priceMin', priceMin)
    if (priceMax && parseInt(priceMax) > 0) params.set('priceMax', priceMax)
    if (selectedAttributes.length > 0) params.set('attributes', selectedAttributes.join(','))
    if (selectedPropertyTypes.length > 0) params.set('propertyType', selectedPropertyTypes.join(','))
    if (isBestOffer) params.set('bestOffer', 'true')
    else params.delete('bestOffer')

    router.push(`${localizePathname('/', locale)}?${params.toString()}`)
    setOpen(false)
  }

  function clearFilters()
  {
    setLocation('')
    setCheckIn(undefined)
    setCheckOut(undefined)
    setGuests('')
    setPriceMin('')
    setPriceMax('')
    setSelectedAttributes([])
    setSelectedPropertyTypes([])
    setIsBestOffer(false)
  }

  function toggleAttribute(code: string)
  {
    setSelectedAttributes(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code]
    )
  }

  function togglePropertyType(slug: string)
  {
    setSelectedPropertyTypes(prev =>
      prev.includes(slug)
        ? prev.filter(s => s !== slug)
        : [...prev, slug]
    )
  }

  const filterContent = (
    <div className="space-y-6">
      {/* Best Offers */}
      <div className="flex items-center space-x-2 border-b pb-4">
        <Checkbox
          id="filter-best-offer"
          checked={isBestOffer}
          onCheckedChange={(checked) => setIsBestOffer(checked as boolean)}
        />
        <label
          htmlFor="filter-best-offer"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
        >
          <Tag className="h-4 w-4 text-primary" />
          Show Best Offers Only
        </label>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Location
        </Label>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, country, or area..."
        />
      </div>

      {/* Dates */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Dates
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                {checkIn ? format(checkIn, 'MMM d') : 'Check-in'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={checkIn}
                onSelect={setCheckIn}
                disabled={(date) => date < new Date()}
              />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                {checkOut ? format(checkOut, 'MMM d') : 'Check-out'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={checkOut}
                onSelect={setCheckOut}
                disabled={(date) => date < (checkIn || new Date())}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Guests */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Guests
        </Label>
        <Input
          type="number"
          min="1"
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
          placeholder="Number of guests"
        />
      </div>

      {/* Price Range */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Coins className="h-4 w-4" />
          Price per night
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            min="0"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            placeholder="Min"
          />
          <Input
            type="number"
            min="0"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            placeholder="Max"
          />
        </div>
      </div>

      {/* Property Type */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Home className="h-4 w-4" />
          Property Type
        </Label>
        {loadingAttributes ? (
          <div className="animate-pulse h-10 bg-muted rounded" />
        ) : propertyTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No property types available</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {propertyTypes.map((type) => (
              <div key={type.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`filter-pt-${type.slug}`}
                  checked={selectedPropertyTypes.includes(type.slug)}
                  onCheckedChange={() => togglePropertyType(type.slug)}
                />
                <label
                  htmlFor={`filter-pt-${type.slug}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {type.name}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Amenities */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Coffee className="h-4 w-4" />
          Amenities
        </Label>
        {loadingAttributes ? (
          <div className="animate-pulse h-20 bg-muted rounded" />
        ) : attributes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No amenities available</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {attributes.map((attr) => (
              <div key={attr.id} className="flex items-center space-x-2">
                <Checkbox
                  id={attr.code}
                  checked={selectedAttributes.includes(attr.code)}
                  onCheckedChange={() => toggleAttribute(attr.code)}
                />
                <label
                  htmlFor={attr.code}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {attr.label}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex items-center gap-3">
      {/* Location input - always visible */}
      <div className="flex-1 max-w-xs">
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Where to?"
          className="h-10"
          onKeyDown={(e) =>
          {
            if (e.key === 'Enter') {
              applyFilters()
            }
          }}
        />
      </div>

      {/* Filters button - opens sheet on mobile, popover on larger screens */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                {activeCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[85vh] sm:h-auto sm:max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              Narrow down your search
            </SheetDescription>
          </SheetHeader>

          <div className="py-4">
            {filterContent}
          </div>

          <SheetFooter className="flex-row gap-2 sm:justify-between">
            <Button variant="ghost" onClick={clearFilters}>
              Clear all
            </Button>
            <Button onClick={applyFilters}>
              Show results
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
