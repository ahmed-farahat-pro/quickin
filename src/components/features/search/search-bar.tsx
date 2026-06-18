// =============================================================================
// AIRBNB-STYLE SEARCH BAR COMPONENT (Updated)
// =============================================================================
// Description: Expandable search bar with Where/When/Who/Filters tabs
// Features: Date range picker, guest counter, price range, amenities filter
// =============================================================================

'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import { Search, X, MapPin, Calendar, Users, Minus, Plus, SlidersHorizontal, Coins, Sparkles, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

import
{
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import type { FilterableAttribute, SearchDestination } from '@/types'
import type { Locale } from '@/i18n/config'
import { localizePathname } from '@/lib/i18n/pathname'

type SearchTab = 'where' | 'when' | 'who' | 'filters' | null

interface SearchBarProps
{
  className?: string
  onToggle?: (expanded: boolean) => void
  variant?: 'default' | 'hero' | 'compact'
  attributes?: FilterableAttribute[]
  destinations?: SearchDestination[]
  disableBoxShadow?: boolean
  /** Called immediately before router.push so the parent can show a loading indicator */
  onNavigate?: () => void
}

/**
 * Format date to display string
 */
function formatDate(date: Date | null, locale: string = 'en-US'): string
{
  if (!date) return ''
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

export function SearchBar({ className, onToggle, variant = 'default', attributes: initialAttributes, destinations, disableBoxShadow = false, onNavigate }: SearchBarProps)
{
  const locale = useLocale() as Locale
  const t = useTranslations('searchBar')
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<SearchTab>(null)
  const [location, setLocation] = useState('')
  const [checkIn, setCheckIn] = useState<Date | null>(null)
  const [checkOut, setCheckOut] = useState<Date | null>(null)
  const [guests, setGuests] = useState(1)
  // New filter state
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([])
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([])
  const [fetchedAttributes, setFetchedAttributes] = useState<FilterableAttribute[]>([])
  const [propertyTypes, setPropertyTypes] = useState<{ id: string, name: string, slug: string }[]>([])
  const [loadingFetched, setLoadingFetched] = useState(true)

  const attributes = initialAttributes || fetchedAttributes
  const loadingAttributes = initialAttributes ? false : loadingFetched

  const urlParams = useSearchParams()
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Restore search state from URL on mount (e.g., after back-navigation)
  useEffect(() => {
    const loc = urlParams.get('location')
    const ci = urlParams.get('checkIn')
    const co = urlParams.get('checkOut')
    const g = urlParams.get('guests')
    const pmin = urlParams.get('priceMin')
    const pmax = urlParams.get('priceMax')
    const attrs = urlParams.get('attributes')
    const propTypes = urlParams.get('propertyType')
    if (loc) setLocation(loc)
    if (ci) { try { setCheckIn(new Date(ci)) } catch (_) {} }
    if (co) { try { setCheckOut(new Date(co)) } catch (_) {} }
    if (g && !isNaN(parseInt(g))) setGuests(parseInt(g))
    if (pmin) setPriceMin(pmin)
    if (pmax) setPriceMax(pmax)
    if (attrs) setSelectedAttributes(attrs.split(','))
    if (propTypes) setSelectedPropertyTypes(propTypes.split(','))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load filterable attributes from database
  useEffect(() =>
  {
    if (initialAttributes) return

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

      setFetchedAttributes(data || [])

      // Fetch property types
      const { data: typeData } = await supabase
        .from('property_types')
        .select('id, name, slug')
        .order('name')

      setPropertyTypes(typeData || [])
      setLoadingFetched(false)
    }
    loadAttributes()
  }, [initialAttributes])

  // Notify parent of expansion state change
  useEffect(() =>
  {
    onToggle?.(isExpanded)
  }, [isExpanded, onToggle])

  // Close on outside click
  useEffect(() =>
  {
    const handleClickOutside = (event: MouseEvent) =>
    {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false)
        setActiveTab(null)
      }
    }

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isExpanded])

  // Auto-scroll panel into view when opened
  useEffect(() =>
  {
    if (activeTab && panelRef.current) {
      setTimeout(() =>
      {
        panelRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        })
      }, 100)
    }
  }, [activeTab])

  // Count active filters
  const activeFilterCount = [
    priceMin || priceMax,
    selectedAttributes.length > 0,
    selectedPropertyTypes.length > 0
  ].filter(Boolean).length

  // Toggle attribute selection
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

  /**
   * Handle search submission
   */
  const handleSearch = async () =>
  {
    // Check if location is a 4-character listing code (strip # if present)
    const query = location.trim().replace(/^#/, '')
    if (query.length === 4 && /^[a-zA-Z0-9]{4}$/.test(query)) {
      try {
        const { findListingByCode } = await import('@/app/search-actions')
        const listingId = await findListingByCode(query)
        if (listingId) {
          router.push(localizePathname(`/listings/${listingId}`, locale))
          return
        }
      } catch (error) {
        console.error('Error checking listing code:', error)
      }
    }

    const params = new URLSearchParams()
    if (location.trim()) {
      params.set('location', location.trim())
    }
    if (checkIn) {
      params.set('checkIn', checkIn.toISOString().split('T')[0])
    }
    if (checkOut) {
      params.set('checkOut', checkOut.toISOString().split('T')[0])
    }
    if (guests > 1) {
      params.set('guests', String(guests))
    }
    if (priceMin) {
      params.set('priceMin', priceMin)
    }
    if (priceMax) {
      params.set('priceMax', priceMax)
    }
    if (selectedAttributes.length > 0) {
      params.set('attributes', selectedAttributes.join(','))
    }
    if (selectedPropertyTypes.length > 0) {
      params.set('propertyType', selectedPropertyTypes.join(','))
    }
    onNavigate?.()
    router.push(`${localizePathname('/', locale)}?${params.toString()}`)
    setIsExpanded(false)
    setActiveTab(null)
    setTimeout(() => document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400)
  }

  /**
   * Open a specific tab
   */
  const openTab = (tab: SearchTab) =>
  {
    setIsExpanded(true)
    setActiveTab(tab)
  }

  /**
   * Get date display text
   */
  const getDateDisplay = () =>
  {
    if (checkIn && checkOut) {
      return `${formatDate(checkIn, locale)} - ${formatDate(checkOut, locale)}`
    }
    if (checkIn) {
      return `${formatDate(checkIn, locale)} - ${t('placeholders.addCheckout')}`
    }
    return t('placeholders.anyDates')
  }

  // Hero variant - always render the bar with inline dropdown (no modal)
  if (variant === 'hero') {
    return (
      <div ref={containerRef} className={cn('w-full max-w-4xl mx-auto relative', className)}>
        {/* Main search bar */}
        <div
          className="flex items-center rounded-full overflow-hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: disableBoxShadow ? 'none' : '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 0 0 1px rgba(255, 255, 255, 0.6)',
          }}
        >
          {/* Where */}
          <button
            onClick={() => activeTab === 'where' ? setActiveTab(null) : openTab('where')}
            className={cn(
              'flex-1 flex flex-col items-start px-6 py-4 hover:bg-black/5 transition-colors text-left',
              activeTab === 'where' && 'bg-white rounded-full shadow-md'
            )}
          >
            <span className='text-xs font-semibold text-[#5B0F16]'>{t('tabs.where')}</span>
            <span className='text-sm text-[#7A746A] truncate max-w-[140px]'>
              {location || t('placeholders.where')}
            </span>
          </button>

          {/* Divider */}
          <div className='w-px h-10 bg-[#E2D8C8]' />

          {/* When */}
          <button
            onClick={() => activeTab === 'when' ? setActiveTab(null) : openTab('when')}
            className={cn(
              'flex-1 flex flex-col items-start px-6 py-4 hover:bg-black/5 transition-colors text-left',
              activeTab === 'when' && 'bg-white rounded-full shadow-md'
            )}
          >
            <span className='text-xs font-semibold text-[#5B0F16]'>{t('tabs.when')}</span>
            <span className='text-sm text-[#7A746A]'>
              {getDateDisplay() || t('placeholders.anyDates')}
            </span>
          </button>

          {/* Divider */}
          <div className='w-px h-10 bg-[#E2D8C8]' />

          {/* Who */}
          <button
            onClick={() => activeTab === 'who' ? setActiveTab(null) : openTab('who')}
            className={cn(
              'flex-1 flex flex-col items-start px-6 py-4 hover:bg-black/5 transition-colors text-left',
              activeTab === 'who' && 'bg-white rounded-full shadow-md'
            )}
          >
            <span className='text-xs font-semibold text-[#5B0F16]'>{t('tabs.who')}</span>
            <span className='text-sm text-[#7A746A]'>
              {guests > 1 ? t('placeholders.guests', { count: guests }) : t('placeholders.addGuests')}
            </span>
          </button>

          {/* Divider */}
          <div className='w-px h-10 bg-[#E2D8C8]' />

          {/* Filters */}
          <button
            onClick={() => activeTab === 'filters' ? setActiveTab(null) : openTab('filters')}
            className={cn(
              'flex-1 flex flex-col items-start px-6 py-4 hover:bg-black/5 transition-colors text-left',
              activeTab === 'filters' && 'bg-white rounded-full shadow-md'
            )}
          >
            <span className='text-xs font-semibold text-[#5B0F16]'>{t('tabs.filters')}</span>
            <span className='text-sm text-[#7A746A]'>
              {t('placeholders.priceAndAmenities')}
            </span>
          </button>

          {/* Search Button */}
          <div className='px-3'>
            <Button
              onClick={handleSearch}
              className='h-12 rounded-full bg-[#5B0F16] hover:bg-[#5B0F16]/90 text-[#F6F1E6] px-6 gap-2'
            >
              <Search className='h-4 w-4' />
              <span className='hidden sm:inline'>{t('placeholders.search')}</span>
            </Button>
          </div>
        </div>

        {/* Dropdown panel - slides down under the search bar */}
        {activeTab && (
          <div ref={panelRef} className='absolute left-0 right-0 top-full mt-3 bg-[#FDFBF7]/50 backdrop-blur-md rounded-3xl shadow-xl border border-[#E2D8C8] p-6 animate-in fade-in slide-in-from-top-2 duration-200 z-[60]'>
            {activeTab === 'where' && (
              <div className='space-y-2'>
                <Command className="rounded-lg border-0 shadow-none bg-transparent">
                  <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                    <MapPin className="mr-2 h-5 w-5 shrink-0 opacity-50" />
                    <CommandInput
                      placeholder={t('placeholders.where')}
                      value={location}
                      onValueChange={setLocation}
                      className="flex h-12 w-full rounded-md bg-transparent py-3 text-lg outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {location && (
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => setLocation('')}
                        className='h-8 w-8 ml-2'
                      >
                        <X className='h-4 w-4' />
                      </Button>
                    )}
                  </div>
                  <CommandList className="max-h-[300px] overflow-y-auto overflow-x-hidden">
                    <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                      {location.trim() ? (
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-slate-100 rounded-md flex items-center gap-2"
                          onClick={() =>
                          {
                            // Fallback: Use text as location
                            setActiveTab('when')
                          }}
                        >
                          <Search className="h-4 w-4" />
                          <span>{t('placeholders.searchFor', { location })}</span>
                        </button>
                      ) : t('placeholders.noDestinations')}
                    </CommandEmpty>

                    {(destinations || []).length > 0 && (
                      <CommandGroup heading={t('placeholders.destinationsHeading')}>
                        {(destinations || []).map((dest) => (
                          <CommandItem
                            key={dest.id}
                            value={dest.en_label || dest.label}
                            onSelect={(val) =>
                            {
                              setLocation(dest.en_label || dest.label) // Normalized value
                              setActiveTab('when')
                            }}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-3 w-full">
                              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                                {dest.image_url ? (
                                  <Image
                                    src={dest.image_url}
                                    alt={dest.label}
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-slate-200">
                                    <MapPin className="h-5 w-5 text-slate-400" />
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-medium">{dest.label}</span>
                                <span className="text-xs text-muted-foreground">{dest.country}</span>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}

                    <CommandSeparator />

                    {/* Popular / Recent could go here */}
                  </CommandList>
                </Command>

                {/* Listing Code Shortcut */}
                <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{t('placeholders.haveCode')}</span>
                  <Input
                    placeholder={t('placeholders.enterCode')}
                    className="h-6 text-sm bg-transparent border-0 focus-visible:ring-0 px-2 shadow-none"
                    value={location.startsWith('#') ? location : ''}
                    onChange={(e) =>
                    {
                      let val = e.target.value;
                      if (val && !val.startsWith('#')) val = '#' + val;
                      setLocation(val);
                    }}
                  />
                </div>
              </div>
            )}

            {activeTab === 'when' && (
              <div className='space-y-4'>
                <div className='flex items-center gap-3'>
                  <Calendar className='h-5 w-5 text-muted-foreground' />
                  <p className='text-lg font-medium'>{t('placeholders.selectDates')}</p>
                </div>

                {/* Display selected dates */}
                <div className='flex items-center gap-4 p-4 bg-[#F6F1E6] rounded-xl'>
                  <div className='flex-1'>
                    <Label className='text-xs text-[#7A746A]'>{t('placeholders.checkIn')}</Label>
                    <p className='font-medium text-[#2B2B2B]'>{checkIn ? formatDate(checkIn, locale) : t('placeholders.addDate')}</p>
                  </div>
                  <div className='flex-1'>
                    <Label className='text-xs text-[#7A746A]'>{t('placeholders.checkOut')}</Label>
                    <p className='font-medium text-[#2B2B2B]'>{checkOut ? formatDate(checkOut, locale) : t('placeholders.addDate')}</p>
                  </div>
                </div>

                {/* Single unified calendar - centered */}
                <div className='flex justify-center'>
                  <CalendarComponent
                    mode='range'
                    selected={{ from: checkIn || undefined, to: checkOut || undefined }}
                    onSelect={(range) =>
                    {
                      if (range?.from) setCheckIn(range.from)
                      if (range?.to && range.from && range.to.getTime() !== range.from.getTime()) setCheckOut(range.to)
                      else setCheckOut(null)
                    }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    numberOfMonths={2}
                    className='rounded-xl border border-[#E2D8C8]'
                  />
                </div>

                {/* Quick options - centered */}
                <div className='pt-4 border-t border-[#E2D8C8]'>
                  <p className='text-xs font-semibold text-muted-foreground mb-3 text-center'>
                    {t('placeholders.quickOptions')}
                  </p>
                  <div className='flex flex-wrap gap-2 justify-center'>
                    {[
                      { label: t('placeholders.thisWeekend'), days: 2 },
                      { label: t('placeholders.nextWeek'), days: 7 },
                      { label: t('placeholders.nextMonth'), days: 30 },
                    ].map((option) => (
                      <button
                        key={option.label}
                        className='px-4 py-2 rounded-full border border-[#E2D8C8] hover:border-[#5B0F16] hover:bg-[#F6F1E6] transition-colors text-sm'
                        onClick={() =>
                        {
                          const start = new Date()
                          start.setHours(0, 0, 0, 0)
                          const end = new Date()
                          end.setDate(end.getDate() + option.days)
                          end.setHours(0, 0, 0, 0)
                          setCheckIn(start)
                          setCheckOut(end)
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                    <button
                      className='px-4 py-2 rounded-full border border-[#E2D8C8] hover:border-[#5B0F16] hover:bg-[#F6F1E6] transition-colors text-sm'
                      onClick={() =>
                      {
                        setCheckIn(null)
                        setCheckOut(null)
                      }}
                    >
                      {t('placeholders.clearDates')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'who' && (
              <div className='space-y-4'>
                <div className='flex items-center gap-3'>
                  <Users className='h-5 w-5 text-muted-foreground' />
                  <p className='text-lg font-medium'>{t('placeholders.numberOfGuests')}</p>
                </div>

                <div className='flex items-center justify-between p-4 bg-[#F6F1E6] rounded-xl'>
                  <span className='font-medium'>{t('placeholders.guestsLabel')}</span>
                  <div className='flex items-center gap-4'>
                    <Button
                      variant='outline'
                      size='icon'
                      className='h-10 w-10 rounded-full'
                      onClick={() => setGuests(Math.max(1, guests - 1))}
                      disabled={guests <= 1}
                      aria-label={t('aria.decreaseGuests')}
                    >
                      <span className='text-lg'>−</span>
                    </Button>
                    <span className='text-xl font-semibold w-8 text-center'>{guests}</span>
                    <Button
                      variant='outline'
                      size='icon'
                      className='h-10 w-10 rounded-full'
                      onClick={() => setGuests(guests + 1)}
                      aria-label={t('aria.increaseGuests')}
                    >
                      <span className='text-lg'>+</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'filters' && (
              <div className='space-y-4'>
                <div className='flex items-center gap-3'>
                  <SlidersHorizontal className='h-5 w-5 text-muted-foreground' />
                  <p className='text-lg font-medium'>{t('placeholders.priceAndAmenities')}</p>
                </div>

                {/* Price range */}
                <div className='space-y-3'>
                  <Label>{t('placeholders.priceRange')}</Label>
                  <div className='flex items-center gap-4'>
                    <Input
                      type='number'
                      placeholder={t('placeholders.min')}
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      className='w-full'
                    />
                    <span>{t('placeholders.to')}</span>
                    <Input
                      type='number'
                      placeholder={t('placeholders.max')}
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      className='w-full'
                    />
                  </div>
                </div>

                {/* Property Type */}
                {propertyTypes.length > 0 && (
                  <div className='space-y-3 pt-4 border-t border-[#E2D8C8]'>
                    <Label>{t('placeholders.propertyType')}</Label>
                    <div className='grid grid-cols-2 gap-2'>
                      {propertyTypes.map((type) => (
                        <div key={type.id} className='flex items-center gap-2'>
                          <Checkbox
                            id={`pt-${type.slug}`}
                            checked={selectedPropertyTypes.includes(type.slug)}
                            onCheckedChange={() => togglePropertyType(type.slug)}
                          />
                          <label htmlFor={`pt-${type.slug}`} className='text-sm cursor-pointer'>
                            {type.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Amenities */}
                {attributes.length > 0 && (
                  <div className='space-y-3 pt-4 border-t border-[#E2D8C8]'>
                    <Label>{t('placeholders.amenities')}</Label>
                    <div className='grid grid-cols-2 gap-2'>
                      {attributes.map((attr) => (
                        <div key={attr.id} className='flex items-center gap-2'>
                          <Checkbox
                            id={attr.code}
                            checked={selectedAttributes.includes(attr.code)}
                            onCheckedChange={() => toggleAttribute(attr.code)}
                          />
                          <label htmlFor={attr.code} className='text-sm cursor-pointer'>
                            {attr.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Default variant - Collapsed state (compact pill for navbar - if needed elsewhere)
  if (!isExpanded) {
    return (
      <div className={cn('flex items-center', className)}>
        {/* Mobile search button */}
        <button
          onClick={() => openTab('where')}
          className='md:hidden flex items-center gap-2 pl-4 pr-2 py-2 rounded-full border border-[#E2D8C8] shadow-sm hover:shadow-md transition-all bg-white'
          aria-label={t('placeholders.search')}
        >
          <span className='text-sm font-medium text-[#2B2B2B]'>{t('placeholders.search')}</span>
          <div className='bg-[#5B0F16] text-[#F6F1E6] p-1.5 rounded-full'>
            <Search className='h-3 w-3' />
          </div>
        </button>

        {/* Desktop search bar - Glass effect */}
        <button
          onClick={() => openTab('where')}
          className='hidden md:flex items-center gap-3 rounded-full px-4 py-3 shadow-sm hover:shadow-md transition-all bg-white/60 backdrop-blur-sm border border-white/35'
        >
          <span className='text-sm font-medium text-[#2B2B2B]'>
            {location || t('placeholders.anywhere')}
          </span>
          <span className='h-6 w-px bg-[#E2D8C8]' />
          <span className='text-sm font-medium text-[#2B2B2B]'>
            {getDateDisplay()}
          </span>
          <span className='h-6 w-px bg-[#E2D8C8]' />
          <span className='text-sm text-[#7A746A]'>
            {guests > 1 ? t('placeholders.guests', { count: guests }) : t('placeholders.addGuests')}
          </span>
          <div className='bg-[#5B0F16] text-[#F6F1E6] p-2 rounded-full'>
            <Search className='h-4 w-4' />
          </div>
        </button>
      </div>
    )
  }

  // Expanded state with tabs
  return (
    <>
      {/* Backdrop overlay - High z-index to stay on top */}
      {isExpanded && (
        <div className='fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] animate-in fade-in duration-300' />
      )}

      {isExpanded && (
        <div
          ref={containerRef}
          className='fixed left-1/2 -translate-x-1/2 top-4 md:top-24 z-[101] w-full max-w-3xl px-4 max-h-[calc(100vh-20px)] overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-top-5 duration-300'
        >
          {/* Main search container - Glass effect */}
          <div className='glass-strong rounded-[2rem] md:rounded-full shadow-xl'>
            <div className='flex flex-col md:flex-row md:items-center'>
              {/* WHERE tab */}
              <button
                onClick={() => setActiveTab('where')}
                className={cn(
                  'flex-1 flex flex-col items-start px-6 py-4 md:py-3 rounded-full transition-all text-left relative',
                  activeTab === 'where'
                    ? 'bg-background shadow-md z-10'
                    : 'hover:bg-muted/50'
                )}
              >
                <span className='text-xs font-semibold'>{t('tabs.where')}</span>
                <span className='text-sm text-muted-foreground w-full truncate'>
                  {location || t('placeholders.where')}
                </span>
              </button>

              <div className='hidden md:block h-8 w-px bg-border' />
              <div className='md:hidden w-full h-px bg-border my-0' />

              {/* WHEN tab */}
              <button
                onClick={() => setActiveTab('when')}
                className={cn(
                  'flex-1 flex flex-col items-start px-6 py-4 md:py-3 rounded-full transition-all text-left relative',
                  activeTab === 'when'
                    ? 'bg-background shadow-md z-10'
                    : 'hover:bg-muted/50'
                )}
              >
                <span className='text-xs font-semibold'>{t('tabs.when')}</span>
                <span className='text-sm text-muted-foreground'>
                  {getDateDisplay()}
                </span>
              </button>

              <div className='hidden md:block h-8 w-px bg-border' />
              <div className='md:hidden w-full h-px bg-border my-0' />

              {/* WHO tab */}
              <button
                onClick={() => setActiveTab('who')}
                className={cn(
                  'flex-1 flex flex-col items-start px-6 py-4 md:py-3 rounded-full transition-all text-left relative',
                  activeTab === 'who'
                    ? 'bg-background shadow-md z-10'
                    : 'hover:bg-muted/50'
                )}
              >
                <span className='text-xs font-semibold'>{t('tabs.who')}</span>
                <span className='text-sm text-muted-foreground'>
                  {guests > 1 ? t('placeholders.guests', { count: guests }) : t('placeholders.addGuests')}
                </span>
              </button>

              <div className='hidden md:block h-8 w-px bg-border' />
              <div className='md:hidden w-full h-px bg-border my-0' />

              {/* FILTERS tab */}
              <button
                onClick={() => setActiveTab('filters')}
                className={cn(
                  'flex-1 flex flex-col items-start px-6 py-4 md:py-3 rounded-full transition-all text-left relative',
                  activeTab === 'filters'
                    ? 'bg-background shadow-md z-10'
                    : 'hover:bg-muted/50'
                )}
              >
                <div className='flex items-center gap-1'>
                  <span className='text-xs font-semibold'>{t('tabs.filters')}</span>
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </div>
                <span className='text-sm text-muted-foreground'>
                  {activeFilterCount > 0 ? `${activeFilterCount} active` : t('placeholders.priceAndAmenities')}
                </span>
              </button>

              {/* Search button */}
              <div className="p-2 md:p-0 md:pr-2">
                <Button
                  onClick={handleSearch}
                  size='lg'
                  className='w-full md:w-auto rounded-full gap-2 md:m-2 text-base h-12 md:h-12'
                >
                  <Search className='h-5 w-5 md:h-4 md:w-4' />
                  <span>{t('placeholders.search')}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Dropdown panels */}
          {activeTab && (
            <div className='mt-3 bg-background rounded-3xl shadow-xl border p-6 animate-in fade-in slide-in-from-top-2 duration-200'>
              {activeTab === 'where' && (
                <div className='space-y-4'>
                  <div className='flex items-center gap-3'>
                    <MapPin className='h-5 w-5 text-muted-foreground' />
                    <Input
                      placeholder={t('placeholders.where')}
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className='border-0 text-lg focus-visible:ring-0 p-0 h-auto'
                      autoFocus
                    />
                    {location && (
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => setLocation('')}
                        className='h-8 w-8'
                        aria-label={t('aria.clearLocation')}
                      >
                        <X className='h-4 w-4' />
                      </Button>
                    )}
                  </div>

                  {/* Popular destinations / CMS Destinations */}
                  {destinations && destinations.length > 0 && (
                    <div className='pt-4 border-t'>
                      <p className='text-xs font-semibold text-muted-foreground mb-3'>
                        {t('placeholders.popularDestinations')}
                      </p>
                      <div className='grid grid-cols-2 gap-3'>
                        {destinations.map((dest) => (
                          <button
                            key={dest.id}
                            className='flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors text-left group'
                            onClick={() =>
                            {
                              setLocation(dest.en_label || dest.label)
                              setActiveTab('when')
                            }}
                          >
                            <div className='h-12 w-12 shrink-0 rounded-lg bg-muted relative overflow-hidden'>
                              {dest.image_url ? (
                                <Image
                                  src={dest.image_url}
                                  alt={dest.label}
                                  fill
                                  className="object-cover group-hover:scale-110 transition-transform"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                  <MapPin className='h-5 w-5 text-muted-foreground' />
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                              <span className='font-medium text-sm truncate'>{dest.label}</span>
                              <span className='text-[10px] text-muted-foreground truncate'>{dest.country}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'when' && (
                <div className='space-y-6'>
                  <div className='flex items-center gap-3'>
                    <Calendar className='h-5 w-5 text-muted-foreground' />
                    <p className='text-lg font-medium'>{t('placeholders.selectDates')}</p>
                  </div>

                  {/* Display selected dates */}
                  <div className='flex items-center gap-4 p-4 border rounded-xl'>
                    <div className='flex-1'>
                      <Label className='text-xs text-muted-foreground'>{t('placeholders.checkIn')}</Label>
                      <p className='font-medium'>{checkIn ? formatDate(checkIn, locale) : t('placeholders.addDate')}</p>
                    </div>
                    <div className='flex-1'>
                      <Label className='text-xs text-muted-foreground'>{t('placeholders.checkOut')}</Label>
                      <p className='font-medium'>{checkOut ? formatDate(checkOut, locale) : t('placeholders.addDate')}</p>
                    </div>
                  </div>

                  {/* Single unified calendar - centered */}
                  <div className='flex justify-center'>
                    <CalendarComponent
                      mode='range'
                      selected={{ from: checkIn || undefined, to: checkOut || undefined }}
                      onSelect={(range) =>
                      {
                        if (range?.from) setCheckIn(range.from)
                        if (range?.to) setCheckOut(range.to)
                        else if (range?.from && !range?.to) setCheckOut(null)
                      }}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      numberOfMonths={2}
                      className='rounded-xl border'
                    />
                  </div>

                  {/* Quick date options - centered */}
                  <div className='pt-4 border-t'>
                    <p className='text-xs font-semibold text-muted-foreground mb-3 text-center'>
                      {t('placeholders.quickOptions')}
                    </p>
                    <div className='flex flex-wrap gap-2 justify-center'>
                      {[
                        { label: t('placeholders.thisWeekend'), days: 2 },
                        { label: t('placeholders.nextWeek'), days: 7 },
                        { label: t('placeholders.nextMonth'), days: 30 },
                      ].map((option) => (
                        <button
                          key={option.label}
                          className='px-4 py-2 rounded-full border hover:border-foreground transition-colors text-sm'
                          onClick={() =>
                          {
                            const start = new Date()
                            start.setHours(0, 0, 0, 0)
                            const end = new Date()
                            end.setDate(end.getDate() + option.days)
                            end.setHours(0, 0, 0, 0)
                            setCheckIn(start)
                            setCheckOut(end)
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                      <button
                        className='px-4 py-2 rounded-full border hover:border-foreground transition-colors text-sm'
                        onClick={() =>
                        {
                          setCheckIn(null)
                          setCheckOut(null)
                        }}
                      >
                        {t('placeholders.clearDates')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'who' && (
                <div className='space-y-4'>
                  <div className='flex items-center gap-3'>
                    <Users className='h-5 w-5 text-muted-foreground' />
                    <p className='text-lg font-medium'>{t('placeholders.howManyGuests')}</p>
                  </div>

                  {/* Guest counter */}
                  <div className='flex items-center justify-between p-4 border rounded-xl'>
                    <div>
                      <p className='font-medium'>{t('placeholders.guestsLabel')}</p>
                      <p className='text-sm text-muted-foreground'>{t('placeholders.agesLabel')}</p>
                    </div>
                    <div className='flex items-center gap-4'>
                      <Button
                        variant='outline'
                        size='icon'
                        className='h-10 w-10 rounded-full'
                        onClick={() => setGuests(Math.max(1, guests - 1))}
                        disabled={guests <= 1}
                        aria-label={t('aria.decreaseGuests')}
                      >
                        <Minus className='h-4 w-4' />
                      </Button>
                      <span className='w-8 text-center text-lg font-medium'>{guests}</span>
                      <Button
                        variant='outline'
                        size='icon'
                        className='h-10 w-10 rounded-full'
                        onClick={() => setGuests(guests + 1)}
                        aria-label={t('aria.increaseGuests')}
                      >
                        <Plus className='h-4 w-4' />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'filters' && (
                <div className='space-y-6'>
                  {/* Price Range */}
                  <div className='space-y-4'>
                    <div className='flex items-center gap-3'>
                      <Coins className='h-5 w-5 text-muted-foreground' />
                      <p className='text-lg font-medium'>{t('placeholders.pricePerNight')}</p>
                    </div>
                    <div className='grid grid-cols-2 gap-4'>
                      <div className='space-y-2'>
                        <Label htmlFor='price-min'>{t('placeholders.minimum')}</Label>
                        <Input
                          id='price-min'
                          type='number'
                          min='0'
                          placeholder={t('placeholders.noMin')}
                          value={priceMin}
                          onChange={(e) => setPriceMin(e.target.value)}
                          className='h-12'
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='price-max'>{t('placeholders.maximum')}</Label>
                        <Input
                          id='price-max'
                          type='number'
                          min='0'
                          placeholder={t('placeholders.noMax')}
                          value={priceMax}
                          onChange={(e) => setPriceMax(e.target.value)}
                          className='h-12'
                        />
                      </div>
                    </div>
                  </div>

                  {/* Amenities */}
                  <div className='space-y-4'>
                    <div className='flex items-center gap-3'>
                      <Sparkles className='h-5 w-5 text-muted-foreground' />
                      <p className='text-lg font-medium'>{t('placeholders.amenities')}</p>
                    </div>
                    {attributes.length === 0 ? (
                      <p className='text-sm text-muted-foreground'>{t('placeholders.noAmenities')}</p>
                    ) : (
                      <div className='grid grid-cols-2 gap-3'>
                        {attributes.map((attr) => (
                          <div
                            key={attr.id}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer',
                              selectedAttributes.includes(attr.code)
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted/50'
                            )}
                            onClick={() => toggleAttribute(attr.code)}
                          >
                            <Checkbox
                              id={attr.code}
                              checked={selectedAttributes.includes(attr.code)}
                              onCheckedChange={() => toggleAttribute(attr.code)}
                            />
                            <label
                              htmlFor={attr.code}
                              className='text-sm font-medium cursor-pointer'
                            >
                              {attr.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Clear filters */}
                  {(priceMin || priceMax || selectedAttributes.length > 0) && (
                    <div className='pt-4 border-t'>
                      <Button
                        variant='ghost'
                        onClick={() =>
                        {
                          setPriceMin('')
                          setPriceMax('')
                          setSelectedAttributes([])
                        }}
                        className='text-muted-foreground'
                      >
                        {t('placeholders.clearAllFilters')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
