'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import dynamic from 'next/dynamic'
import { Loader2, ArrowLeft, ArrowRight, Check, Home, Building, Tent, Warehouse, Castle, Ship, Hotel, TreePine } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations, useLocale } from 'next-intl'

// Simple Icon Map
const IconMap: Record<string, any> = {
  Home, Building, Tent, Warehouse, Castle, Ship, Hotel, TreePine
}

import { useUIStore } from '@/stores/ui-store'
import { createClient } from '@/lib/supabase/client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ComboboxMulti, Option } from '@/components/ui/combobox-multi'
import { PhotoUploader, type ListingImageFile } from './photo-uploader'
import { LocationSelector } from './location-selector'
import type { PropertyType, LifestyleCategory } from '@/types/database'

// Dynamic import for Map to avoid SSR issues
const LocationPicker = dynamic(() => import('./location-picker'), {
  ssr: false,
  loading: () => <div className="h-[400px] w-full bg-slate-100 animate-pulse rounded-xl" />
})

export function ListingWizard()
{
  const t = useTranslations('dashboardListingCreate')
  const locale = useLocale()
  const router = useRouter()
  const { openAuthModal } = useUIStore()
  const [step, setStep] = useState(0)
  const [photos, setPhotos] = useState<ListingImageFile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Data State
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([])
  const [lifestyleCategories, setLifestyleCategories] = useState<LifestyleCategory[]>([])
  const [conditionsOptions, setConditionsOptions] = useState<Option[]>([])

  // UI State
  const [selectedClass, setSelectedClass] = useState<'home' | 'service' | null>('home')

  const STEPS = useMemo(() => [
    t('steps.type'),
    t('steps.vibe'),
    t('steps.basics'),
    t('steps.location'),
    t('steps.photos'),
    t('steps.details'),
    t('steps.pricing'),
    t('steps.review')
  ], [t])

  const listingSchema = useMemo(() => z.object({
    property_type_id: z.string().uuid(t('errors.propertyType')),
    lifestyle_category_ids: z.array(z.string()).min(1, t('errors.tagsMin')).max(2, t('errors.tagsMax')),
    title: z.string().min(5, t('errors.titleMin')).max(100, t('errors.titleMax')).regex(/^[a-zA-Z0-9\s.,!?'"()\-]+$/, t('errors.englishOnly')),
    title_ar: z.string().min(5, t('errors.titleMin')).max(100, t('errors.titleMax')).regex(/^[\u0600-\u06FF\s0-9.,!?'"()\-]+$/, t('errors.arabicOnly')),
    description: z.string().min(20, t('errors.descMin')).regex(/^[a-zA-Z0-9\s.,!?'"()\-\n\r]+$/, t('errors.englishOnly')),
    description_ar: z.string().min(20, t('errors.descMin')).max(1000).regex(/^[\u0600-\u06FF\s0-9.,!?'"()\-\n\r]+$/, t('errors.arabicOnly')),
    location: z.string().min(1, t('errors.addressReq')),
    country: z.string().min(1, t('errors.countryReq')),
    country_id: z.string().min(1, t('errors.countryReq')),
    state: z.string().optional(),
    state_id: z.string().optional(),
    city: z.string().min(1, t('errors.cityReq')),
    city_id: z.string().min(1, t('errors.cityReq')),
    latitude: z.number().min(-90).max(90, t('errors.latInvalid')),
    longitude: z.number().min(-180).max(180, t('errors.lngInvalid')),
    google_maps_link: z.string().optional(),
    listing_conditions: z.array(z.string()).optional(),
    max_guests: z.coerce.number().min(1),
    bedrooms: z.coerce.number().min(0),
    beds: z.coerce.number().min(0),
    bathrooms: z.coerce.number().min(0),
    min_nights: z.coerce.number().min(1).default(1),
    price_per_night: z.coerce.number().min(1),
    cleaning_fee: z.coerce.number().min(0),
    currency: z.enum(['EGP', 'EUR', 'GBP', 'AED', 'SAR']).default('EGP'),
  }), [t])

  type ListingFormData = z.infer<typeof listingSchema>

  // Fetch initial data
  useEffect(() =>
  {
    const fetchData = async () =>
    {
      const supabase = createClient()

      // Fetch Property Types
      const { data: ptData } = await supabase.from('property_types').select('*')
      if (ptData) setPropertyTypes(ptData)

      // Fetch Lifestyle Categories
      const { data: lcData } = await supabase
        .from('lifestyle_categories')
        .select('*')
        .order('display_order')
      if (lcData) setLifestyleCategories(lcData)

      // Fetch Conditions
      const { data: cData } = await supabase
        .from('listing_conditions')
        .select('id, name, description, translations')
      if (cData) {
        setConditionsOptions(cData.map(c => {
          const trans = ((c as any).translations as any)?.[locale]
          const transName = typeof trans === 'string' ? trans : trans?.name
          const transDesc = typeof trans === 'string' ? undefined : trans?.description
          return {
            label: transName || c.name,
            value: c.id,
            description: transDesc || c.description || undefined
          }
        }))
      }
    }
    fetchData()
  }, [locale])

  const form = useForm<ListingFormData>({
    resolver: zodResolver(listingSchema) as any,
    defaultValues: {
      property_type_id: '',
      lifestyle_category_ids: [],
      title: '',
      title_ar: '',
      description: '',
      description_ar: '',
      location: '',
      country: '',
      country_id: '',
      city: '',
      city_id: '',
      state: '',
      state_id: '',
      listing_conditions: [],
      max_guests: 1,
      bedrooms: 1,
      beds: 1,
      bathrooms: 1,
      price_per_night: 0,
      cleaning_fee: 0,
      currency: 'EGP',
      latitude: 30.0444,
      longitude: 31.2357,
      min_nights: 1,
      google_maps_link: ''
    },
    mode: 'onTouched'
  })

  // Prevent Enter key from submitting
  const handleKeyDown = (e: React.KeyboardEvent) =>
  {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault();
    }
  }

  const handleNext = async () =>
  {
    let fieldsToValidate: (keyof ListingFormData)[] = []

    switch (step) {
      case 0: fieldsToValidate = ['property_type_id']; break;
      case 1: fieldsToValidate = ['lifestyle_category_ids']; break;
      case 2: fieldsToValidate = ['title', 'title_ar', 'description', 'description_ar', 'listing_conditions']; break;
      case 3: fieldsToValidate = ['location', 'country_id', 'city_id', 'latitude', 'longitude']; break;
      case 4:
        if (photos.length < 1) {
          toast.error(t('errors.photosMin'))
          return
        }
        break;
      case 5: fieldsToValidate = ['max_guests', 'bedrooms', 'beds', 'bathrooms']; break;
      case 6: fieldsToValidate = ['price_per_night', 'cleaning_fee', 'currency']; break;
    }

    if (fieldsToValidate.length > 0) {
      const result = await form.trigger(fieldsToValidate)
      if (!result) return
    }

    setStep(prev => Math.min(prev + 1, STEPS.length - 1))
  }

  const handleBack = () =>
  {
    setStep(prev => Math.max(prev - 1, 0))
  }

  const handleCreateCondition = async (value: string) =>
  {
    // Add to UI options immediately
    const tempId = `new:${value}`
    setConditionsOptions(prev => [...prev, { label: value, value: tempId }])

    // Select it
    const current = form.getValues('listing_conditions') || []
    form.setValue('listing_conditions', [...current, tempId])
  }

  const onSubmit = async (data: ListingFormData) =>
  {
    if (isSubmitting) return
    try {
      setIsSubmitting(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error(t('errors.loginReq'), {
          action: { label: t('actions.login'), onClick: () => openAuthModal('login') }
        })
        return
      }

      // 1. Upload Images
      const uploadPromises = photos.map(async (photo, index) =>
      {
        const fileExt = photo.file.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}-${index}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('listings').upload(fileName, photo.file)
        if (uploadError) throw new Error(`${t('errors.uploadFailed')}: ${uploadError.message}`)

        const { data: { publicUrl } } = supabase.storage.from('listings').getPublicUrl(fileName)
        return { url: publicUrl, category: photo.category, order: index, caption: null }
      })
      const uploadedImages = await Promise.all(uploadPromises)

      // 2. Create Listing
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .insert({
          user_id: user.id,
          property_type_id: data.property_type_id,
          title: data.title,
          description: data.description,
          location: data.location,
          country_id: data.country_id,
          city_id: data.city_id,
          state_id: data.state_id || null,
          location_geo: `POINT(${data.longitude} ${data.latitude})`,
          price_per_night: data.price_per_night,
          max_guests: data.max_guests,
          bedrooms: data.bedrooms,
          beds: data.beds,
          bathrooms: data.bathrooms,
          min_nights: data.min_nights,

          // Removed house_rules, special_conditions, is_pets_allowed
          cleaning_fee: data.cleaning_fee,
          currency: data.currency,
          translations: { ar: { title: data.title_ar, description: data.description_ar } } as any,
          is_published: false,
          review_status: 'pending_review',
          google_maps_link: data.google_maps_link || null
        })
        .select()
        .single()

      if (listingError) throw new Error(`${t('errors.creationFailed')}: ${listingError.message}`)

      // 3. Insert Images
      const imageInserts = uploadedImages.map(img => ({
        listing_id: listing.id,
        url: img.url,
        category: img.category,
        order: img.order,
        caption: img.caption
      }))
      const { error: imagesError } = await supabase.from('listing_images').insert(imageInserts)
      if (imagesError) throw imagesError

      // 4. Insert Lifestyle Tags (M2M)
      const lifestyleInserts = data.lifestyle_category_ids.map((id, index) => ({
        listing_id: listing.id,
        lifestyle_category_id: id,
        is_primary: index === 0
      }))
      const { error: tagsError } = await supabase.from('listing_lifestyles').insert(lifestyleInserts)
      if (tagsError) throw tagsError

      // 5. Insert Conditions
      if (data.listing_conditions && data.listing_conditions.length > 0) {
        for (const conditionIdOrName of data.listing_conditions) {
          let finalConditionId = conditionIdOrName;

          // Handle new custom conditions
          if (conditionIdOrName.startsWith('new:')) {
            const name = conditionIdOrName.replace('new:', '');
            // Check if already exists (race condition possible but low risk here)
            // Insert new condition
            const { data: newCond, error: newCondError } = await supabase
              .from('listing_conditions')
              .insert({ name, created_by: user.id, is_system: false })
              .select()
              .single()

            if (newCondError) {
              console.error("Failed to create custom condition:", newCondError)
              // Try to find if it existed
              const { data: existing } = await supabase.from('listing_conditions').select('id').eq('name', name).single()
              if (existing) finalConditionId = existing.id
              else continue; // Skip if failed
            } else {
              finalConditionId = newCond.id
            }
          }

          // Link to listing
          await supabase.from('listing_condition_assignments').insert({
            listing_id: listing.id,
            condition_id: finalConditionId
          })
        }
      }

      toast.success(t('stepReview.success'), {
        description: 'Your listing is now in review by the admin team.',
        action: { label: t('actions.viewListing'), onClick: () => router.push(`/listings/${listing.id}`) }
      })
      router.push(`/listings/${listing.id}`)

    } catch (error: any) {
      console.error('Submission Failed:', error)
      toast.error(error.message || t('errors.creationFailed'), {
        action: { label: t('actions.retry'), onClick: () => form.handleSubmit(onSubmit as any)() }
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- Helpers ---

  /* Reverse Geocoding Logic */
  const reverseGeocode = async (lat: number, lng: number) =>
  {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=en`,
        { headers: { 'User-Agent': 'AirbnbPrototype/1.0' } }
      )
      const data = await response.json()
      if (data && data.address) {
        // const addr = data.address
        if (data.display_name) form.setValue('location', data.display_name)
      }
    } catch (error) {
      console.error("Reverse geocoding failed:", error)
    }
  }

  /* Parse Google Maps Link */
  const handlePasteGoogleLink = (e: React.ChangeEvent<HTMLInputElement>) =>
  {
    const url = e.target.value
    if (!url) return
    form.setValue('google_maps_link', url)
    let lat: number | null = null
    let lng: number | null = null
    const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (atMatch) { lat = parseFloat(atMatch[1]); lng = parseFloat(atMatch[2]) }
    else if (qMatch) { lat = parseFloat(qMatch[1]); lng = parseFloat(qMatch[2]) }

    if (lat !== null && lng !== null) {
      form.setValue('latitude', lat)
      form.setValue('longitude', lng)
      reverseGeocode(lat, lng)
      toast.success(t('stepLocation.extracted'))
    }
  }

  // Render Steps
  const renderStep = () =>
  {
    switch (step) {
      case 0: // Property Type
        const filteredTypes = propertyTypes.filter(pt => pt.type === selectedClass)
        return (
          <div className="space-y-6">
            {!selectedClass ? (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold">{t('stepType.question')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div
                    className="p-6 border rounded-xl cursor-pointer hover:shadow-lg transition-all animate-in fade-in zoom-in duration-300 shadow-sm flex flex-col items-center gap-4 text-center"
                    onClick={() => setSelectedClass('home')}
                  >
                    <div className="p-4 shadow-sm border rounded-full">🏠</div>
                    <div><h3 className="font-semibold text-lg">{t('stepType.homeTitle')}</h3><p className="text-muted-foreground text-sm">{t('stepType.homeDesc')}</p></div>
                  </div>
                  <div
                    className="p-6 border rounded-xl cursor-pointer hover:shadow-lg transition-all animate-in fade-in zoom-in duration-300 shadow-sm flex flex-col items-center gap-4 text-center"
                    onClick={() => setSelectedClass('service')}
                  >
                    <div className="p-4 shadow-sm border rounded-full">⛵</div>
                    <div><h3 className="font-semibold text-lg">{t('stepType.serviceTitle')}</h3><p className="text-muted-foreground text-sm">{t('stepType.serviceDesc')}</p></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">{t('stepType.describeQuestion', { type: selectedClass === 'home' ? t('stepType.homeTitle').toLowerCase() : t('stepType.serviceTitle').toLowerCase() })}</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredTypes.map(pt =>
                  {
                    // Dynamic Icon Logic
                    const IconComponent = (IconMap as any)[pt.icon || 'Home'] || IconMap.Home
                    
                    const ptTrans = ((pt as any).translations as any)?.[locale]
                    const ptName = typeof ptTrans === 'string' ? ptTrans : ptTrans?.name || pt.name
                    const ptDesc = typeof ptTrans === 'string' ? pt.description : ptTrans?.description || pt.description

                    return (
                      <div
                        key={pt.id}
                        className={`p-4 border rounded-xl cursor-pointer transition-all hover:shadow-lg animate-in fade-in zoom-in duration-300 shadow-sm flex flex-col items-center gap-2 text-center h-32 justify-center ${form.watch('property_type_id') === pt.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''}`}
                        onClick={() => form.setValue('property_type_id', pt.id)}
                      >
                        <IconComponent className="w-8 h-8 mb-2" />
                        <span className="font-medium">{ptName}</span>
                        <span className="text-xs text-muted-foreground">{ptDesc}</span>
                      </div>
                    )
                  })}
                </div>
                {form.formState.errors.property_type_id && <p className="text-red-500 text-sm">{form.formState.errors.property_type_id.message}</p>}
              </div>
            )}
          </div>
        )
      case 1: // Lifestyle Tags
        const selectedTags = form.watch('lifestyle_category_ids')
        const toggleTag = (id: string) =>
        {
          if (selectedTags.includes(id)) {
            form.setValue('lifestyle_category_ids', selectedTags.filter(t => t !== id))
          } else {
            console.log(id)
            if (selectedTags.length >= 2) return // Max 2
            form.setValue('lifestyle_category_ids', [...selectedTags, id])
          }
        }
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">{t('stepVibe.title')}</h2>
              <p className="text-muted-foreground">{t('stepVibe.subtitle')}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {lifestyleCategories.map(cat => (
                <div
                  key={cat.id}
                  onClick={() => toggleTag(cat.id)}
                  className={`px-4 py-2 rounded-full border cursor-pointer transition-all hover:shadow-lg animate-in fade-in zoom-out duration-300 shadow-sm ${selectedTags.includes(cat.id)
                    ? 'bg-black text-white border-black'
                    : 'hover:border-black bg-white'
                    } ${selectedTags.length >= 2 && !selectedTags.includes(cat.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {((cat as any).translations as any)?.[locale] || cat.name}
                </div>
              ))}
            </div>
            {form.formState.errors.lifestyle_category_ids && <p className="text-red-500 text-sm">{form.formState.errors.lifestyle_category_ids.message}</p>}
            <p className="text-sm text-muted-foreground mt-4">{t('stepVibe.selected', { count: selectedTags.length })}</p>
          </div>
        )
      case 2: // Basics
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">{t('stepBasics.title')}</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('stepBasics.titleEn')}</Label>
                <Input {...form.register('title')} placeholder={t('stepBasics.titleEnPlaceholder')} />
                {form.formState.errors.title && <p className="text-red-500 text-sm">{form.formState.errors.title.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('stepBasics.titleAr')}</Label>
                <Input dir="rtl" {...form.register('title_ar')} placeholder={t('stepBasics.titleArPlaceholder')} />
                {form.formState.errors.title_ar && <p className="text-red-500 text-sm">{form.formState.errors.title_ar.message}</p>}
              </div>

              <div className="space-y-2 mt-4">
                <Label>{t('stepBasics.descEn')}</Label>
                <Textarea {...form.register('description')} rows={4} placeholder={t('stepBasics.descEnPlaceholder')} />
                {form.formState.errors.description && <p className="text-red-500 text-sm">{form.formState.errors.description.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('stepBasics.descAr')}</Label>
                <Textarea dir="rtl" {...form.register('description_ar')} rows={4} placeholder={t('stepBasics.descArPlaceholder')} />
                {form.formState.errors.description_ar && <p className="text-red-500 text-sm">{form.formState.errors.description_ar.message}</p>}
              </div>

              <div className="space-y-2 mt-4">
                <Label>{t('stepBasics.conditionsTitle')}</Label>
                <ComboboxMulti
                  options={conditionsOptions}
                  selected={form.watch('listing_conditions') || []}
                  onChange={(val) => form.setValue('listing_conditions', val)}
                  onCreate={handleCreateCondition}
                  placeholder={t('stepBasics.conditionsPlaceholder')}
                  emptyText={t('stepBasics.conditionsEmpty')}
                />
                <p className="text-xs text-muted-foreground">{t('stepBasics.conditionsHelp')}</p>
              </div>
            </div>
          </div>
        )
      case 3: // Location
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">{t('stepLocation.title')}</h2>
            <div className="flex flex-col gap-6 h-full">
              <div className="space-y-4 order-2 md:order-1">
                <LocationSelector
                  countryValue={form.watch('country') || ''}
                  stateValue={form.watch('state') || ''}
                  cityValue={form.watch('city') || ''}
                  onCountryChange={(name, iso, id, lat, lng) =>
                  {
                    form.setValue('country', name);
                    if (id) form.setValue('country_id', id);
                    form.setValue('state', '');
                    form.setValue('state_id', '');
                    form.setValue('city', '');
                    form.setValue('city_id', '');
                    if (lat && lng) {
                      form.setValue('latitude', lat);
                      form.setValue('longitude', lng);
                    }
                  }}
                  onStateChange={(name, iso, id, lat, lng) =>
                  {
                    form.setValue('state', name);
                    if (id) form.setValue('state_id', id);
                    form.setValue('city', '');
                    form.setValue('city_id', '');
                    if (lat && lng) {
                      form.setValue('latitude', lat);
                      form.setValue('longitude', lng);
                    }
                  }}
                  onCityChange={(name, id, lat, lng) =>
                  {
                    form.setValue('city', name);
                    if (id) form.setValue('city_id', id);
                    if (lat && lng) {
                      form.setValue('latitude', lat);
                      form.setValue('longitude', lng);
                    }
                  }}
                />
                <div className="space-y-2">
                  <Label>{t('stepLocation.pasteGoogle')}</Label>
                  <Input onChange={handlePasteGoogleLink} placeholder={t('stepLocation.pastePlaceholder')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('stepLocation.lat')}</Label>
                    <Input {...form.register('latitude', { valueAsNumber: true })} />
                    {form.formState.errors.latitude && <p className="text-red-500 text-sm">{form.formState.errors.latitude.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>{t('stepLocation.lng')}</Label>
                    <Input {...form.register('longitude', { valueAsNumber: true })} />
                    {form.formState.errors.longitude && <p className="text-red-500 text-sm">{form.formState.errors.longitude.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('stepLocation.address')}</Label>
                  <Textarea {...form.register('location')} />
                  {form.formState.errors.location && <p className="text-red-500 text-sm">{form.formState.errors.location.message}</p>}
                </div>
              </div>
              <div className="h-[300px] border rounded-xl overflow-hidden order-1 md:order-2">
                <LocationPicker value={{ lat: form.watch('latitude'), lng: form.watch('longitude') }} onChange={(p) => { form.setValue('latitude', p.lat); form.setValue('longitude', p.lng); reverseGeocode(p.lat, p.lng) }} />
              </div>
            </div>
          </div>
        )
      case 4: // Photos
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">{t('stepPhotos.title')}</h2>
            <PhotoUploader value={photos} onChange={setPhotos} />
          </div>
        )
      case 5: // Details
        const currentPt = propertyTypes.find(p => p.id === form.watch('property_type_id'))
        const isServices = currentPt?.type === 'service'
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">{t('stepDetails.title', { type: isServices ? t('stepType.serviceTitle').toLowerCase() : t('stepType.homeTitle').toLowerCase() })}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('stepDetails.guests')}</Label>
                <Input type="number" {...form.register('max_guests')} />
                {form.formState.errors.max_guests && <p className="text-red-500 text-sm">{form.formState.errors.max_guests.message}</p>}
              </div>
              {!isServices && (
                <>
                  <div>
                    <Label>{t('stepDetails.bedrooms')}</Label>
                    <Input type="number" {...form.register('bedrooms')} />
                    {form.formState.errors.bedrooms && <p className="text-red-500 text-sm">{form.formState.errors.bedrooms.message}</p>}
                  </div>
                  <div>
                    <Label>{t('stepDetails.beds')}</Label>
                    <Input type="number" {...form.register('beds')} />
                    {form.formState.errors.beds && <p className="text-red-500 text-sm">{form.formState.errors.beds.message}</p>}
                  </div>
                  <div>
                    <Label>{t('stepDetails.bathrooms')}</Label>
                    <Input type="number" {...form.register('bathrooms')} />
                    {form.formState.errors.bathrooms && <p className="text-red-500 text-sm">{form.formState.errors.bathrooms.message}</p>}
                  </div>
                </>
              )}
              <div>
                <Label>{t('stepDetails.minDuration')}</Label>
                <Input type="number" {...form.register('min_nights')} />
                {form.formState.errors.min_nights && <p className="text-red-500 text-sm">{form.formState.errors.min_nights.message}</p>}
              </div>
            </div>
          </div>
        )
      case 6: // Pricing
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">{t('stepPricing.title')}</h2>
            <div className="space-y-4 max-w-sm">
              <div>
                <Label>{t('stepPricing.currency')}</Label>
                <Select value={form.watch('currency')} onValueChange={(v) => form.setValue('currency', v as any)}>
                  <SelectTrigger><SelectValue placeholder={t('stepPricing.currencyPlaceholder')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EGP">EGP (E£)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="AED">AED (د.إ)</SelectItem>
                    <SelectItem value="SAR">SAR (ر.س)</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.currency && <p className="text-red-500 text-sm">{form.formState.errors.currency.message}</p>}
              </div>
              <div>
                <Label>{t('stepPricing.pricePerNight')}</Label>
                <Input type="number" {...form.register('price_per_night')} />
                {form.formState.errors.price_per_night && <p className="text-red-500 text-sm">{form.formState.errors.price_per_night.message}</p>}
              </div>
              <div>
                <Label>{t('stepPricing.cleaningFee')}</Label>
                <Input type="number" {...form.register('cleaning_fee')} />
                {form.formState.errors.cleaning_fee && <p className="text-red-500 text-sm">{form.formState.errors.cleaning_fee.message}</p>}
              </div>
            </div>
          </div>
        )
      case 7: // Review
        const d = form.getValues()
        // Get Condition Labels
        const selectedConds = d.listing_conditions || []
        const condLabels = selectedConds.map(id =>
        {
          if (id.startsWith('new:')) return id.replace('new:', '')
          return conditionsOptions.find(o => o.value === id)?.label || id
        })

        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">{t('stepReview.title')}</h2>
            <div className="p-4 border rounded bg-slate-50 space-y-2">
              <p><strong>{t('stepReview.listingTitle')}</strong> {d.title}</p>
              <p><strong>{t('stepReview.location')}</strong> {d.city}, {d.country}</p>
              <p><strong>{t('stepReview.price')}</strong> {d.price_per_night} {d.currency}</p>
              {condLabels.length > 0 && (
                <p><strong>{t('stepReview.conditions')}</strong> {condLabels.join(', ')}</p>
              )}
            </div>
          </div>
        )
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="mb-8">
        <div className="h-2 bg-accent rounded-full" >
          <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-sm text-accent-foreground"><span>{t('actions.stepXofY', { step: step + 1, total: STEPS.length })}</span><span>{STEPS[step]}</span></div>
      </div>
      <div className="min-h-[400px] mb-10" onKeyDown={handleKeyDown}>{renderStep()}</div>
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-between md:static md:bg-transparent md:border-0 md:p-0">
        <Button variant="outline" onClick={handleBack} disabled={step === 0 || isSubmitting}>{t('actions.back')}</Button>
        {step === STEPS.length - 1 ? (
          <Button onClick={form.handleSubmit(onSubmit as any)} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : t('actions.publish')}</Button>
        ) : (
          <Button onClick={handleNext}>{t('actions.next')}</Button>
        )}
      </div>
    </div>
  )
}