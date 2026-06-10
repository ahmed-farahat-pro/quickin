'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ComboboxMulti } from '@/components/ui/combobox-multi'
import { LocationSelector } from '@/components/features/host/location-selector'
import { PhotoUploader, type ListingImageFile } from '@/components/features/host/photo-uploader'
import { adminCreateListing, adminUpdateListing } from '@/app/admin/listings/actions'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PropertyType, LifestyleCategory } from '@/types/database'

export interface AdminListingFormData {
  id?: string
  title: string
  title_ar: string
  description: string
  description_ar: string
  property_type_id: string
  location: string
  country: string
  country_id: string
  state?: string
  state_id?: string
  city: string
  city_id: string
  latitude: number
  longitude: number
  price_per_night: number
  cleaning_fee: number
  currency: string
  max_guests: number
  bedrooms: number
  beds: number
  bathrooms: number
  min_nights: number
  is_published: boolean
  google_maps_link?: string
  user_id?: string
  lifestyle_category_ids: string[]
  listing_conditions: string[]
}

interface ListingFormProps {
  initialData?: AdminListingFormData
  initialImages?: { url: string, category: string, order: number, id: string }[]
  isEditing?: boolean
}

export function ListingForm({ initialData, initialImages = [], isEditing = false }: ListingFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const [formData, setFormData] = React.useState<AdminListingFormData>(
    initialData || {
      title: '',
      title_ar: '',
      description: '',
      description_ar: '',
      property_type_id: '',
      location: '',
      country: '',
      country_id: '',
      state: '',
      state_id: '',
      city: '',
      city_id: '',
      latitude: 0,
      longitude: 0,
      price_per_night: 0,
      cleaning_fee: 0,
      currency: 'EGP',
      max_guests: 1,
      bedrooms: 1,
      beds: 1,
      bathrooms: 1,
      min_nights: 1,
      is_published: true,
      user_id: '',
      google_maps_link: '',
      lifestyle_category_ids: [],
      listing_conditions: [],
    }
  )

  const [photos, setPhotos] = React.useState<ListingImageFile[]>(() => 
    initialImages.map(img => ({
      file: new File([], img.id), // Dummy file for existing images
      preview: img.url,
      category: img.category,
      id: img.id,
      isExisting: true
    })) as any
  )

  const [propertyTypes, setPropertyTypes] = React.useState<PropertyType[]>([])
  const [lifestyleCategories, setLifestyleCategories] = React.useState<LifestyleCategory[]>([])
  const [conditionsOptions, setConditionsOptions] = React.useState<{label: string, value: string}[]>([])

  React.useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: ptData } = await supabase.from('property_types').select('*')
      if (ptData) setPropertyTypes(ptData)

      const { data: lcData } = await supabase.from('lifestyle_categories').select('*').order('display_order')
      if (lcData) setLifestyleCategories(lcData)

      const { data: cData } = await supabase.from('listing_conditions').select('id, name')
      if (cData) setConditionsOptions(cData.map((c: any) => ({ label: c.name, value: c.id })))
    }
    fetchData()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }))
  }

  const handleCreateCondition = async (value: string) => {
    const tempId = `new:${value}`
    setConditionsOptions(prev => [...prev, { label: value, value: tempId }])
    setFormData(prev => ({ ...prev, listing_conditions: [...prev.listing_conditions, tempId] }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Upload new images to storage
      const uploadedImages = await Promise.all(
        photos.map(async (photo, index) => {
          if ((photo as any).isExisting) {
            return { url: photo.preview, category: photo.category, order: index }
          }
          const fileExt = photo.file.name.split('.').pop()
          const fileName = `admin/${Date.now()}-${index}.${fileExt}`
          const { error: uploadError } = await supabase.storage.from('listings').upload(fileName, photo.file)
          if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

          const { data: { publicUrl } } = supabase.storage.from('listings').getPublicUrl(fileName)
          return { url: publicUrl, category: photo.category, order: index }
        })
      )

      const payload = {
        ...formData,
        images: uploadedImages
      }

      if (isEditing && formData.id) {
        const result = await adminUpdateListing(formData.id, payload)
        if (result.error) throw new Error(result.error)
        toast.success('Listing updated successfully')
      } else {
        const result = await adminCreateListing(payload)
        if (result.error) throw new Error(result.error)
        toast.success('Listing created successfully')
      }
      router.push('/admin/listings')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Core details about the listing including translations.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title (English)</Label>
            <Input id="title" name="title" value={formData.title} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="title_ar">Title (Arabic)</Label>
            <Input id="title_ar" name="title_ar" dir="rtl" value={formData.title_ar} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (English)</Label>
            <Textarea id="description" name="description" rows={5} value={formData.description} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description_ar">Description (Arabic)</Label>
            <Textarea id="description_ar" name="description_ar" rows={5} dir="rtl" value={formData.description_ar} onChange={handleChange} required />
          </div>
          <div className="space-y-2 col-span-2 md:col-span-1">
            <Label htmlFor="user_id">Host User ID (UUID)</Label>
            <Input id="user_id" name="user_id" value={formData.user_id} onChange={handleChange} placeholder="Required if adding on behalf of a host" />
          </div>
          <div className="space-y-2 col-span-2 md:col-span-1">
            <Label htmlFor="property_type_id">Property Type</Label>
            <Select value={formData.property_type_id} onValueChange={(v) => setFormData(prev => ({...prev, property_type_id: v}))} required>
              <SelectTrigger><SelectValue placeholder="Select Property Type" /></SelectTrigger>
              <SelectContent>
                {propertyTypes.map(pt => (
                  <SelectItem key={pt.id} value={pt.id}>{pt.name} ({pt.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Location & Geography</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <LocationSelector
            countryValue={formData.country}
            stateValue={formData.state || ''}
            cityValue={formData.city}
            onCountryChange={(name, iso, id, lat, lng) => {
              setFormData(p => ({...p, country: name, country_id: id || '', state: '', state_id: '', city: '', city_id: '', latitude: lat || p.latitude, longitude: lng || p.longitude}))
            }}
            onStateChange={(name, iso, id, lat, lng) => {
              setFormData(p => ({...p, state: name, state_id: id || '', city: '', city_id: '', latitude: lat || p.latitude, longitude: lng || p.longitude}))
            }}
            onCityChange={(name, id, lat, lng) => {
              setFormData(p => ({...p, city: name, city_id: id || '', latitude: lat || p.latitude, longitude: lng || p.longitude}))
            }}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="location">Street Address / Label</Label>
              <Input id="location" name="location" value={formData.location} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="google_maps_link">Google Maps Link</Label>
              <Input id="google_maps_link" name="google_maps_link" value={formData.google_maps_link || ''} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input id="latitude" name="latitude" type="number" step="0.000001" value={formData.latitude} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input id="longitude" name="longitude" type="number" step="0.000001" value={formData.longitude} onChange={handleChange} required />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details & Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Capacity, Details & Pricing</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="max_guests">Max Guests</Label>
            <Input id="max_guests" name="max_guests" type="number" min="1" value={formData.max_guests} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bedrooms">Bedrooms</Label>
            <Input id="bedrooms" name="bedrooms" type="number" min="0" value={formData.bedrooms} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="beds">Beds</Label>
            <Input id="beds" name="beds" type="number" min="0" value={formData.beds} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bathrooms">Bathrooms</Label>
            <Input id="bathrooms" name="bathrooms" type="number" min="0" value={formData.bathrooms} onChange={handleChange} required />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="price_per_night">Price / Night</Label>
            <Input id="price_per_night" name="price_per_night" type="number" min="0" value={formData.price_per_night} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cleaning_fee">Cleaning Fee</Label>
            <Input id="cleaning_fee" name="cleaning_fee" type="number" min="0" value={formData.cleaning_fee} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select value={formData.currency} onValueChange={(v) => setFormData(p => ({...p, currency: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EGP">EGP</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="min_nights">Min Nights</Label>
            <Input id="min_nights" name="min_nights" type="number" min="1" value={formData.min_nights} onChange={handleChange} required />
          </div>
        </CardContent>
      </Card>

      {/* Attributes */}
      <Card>
        <CardHeader>
          <CardTitle>Attributes</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Lifestyle Categories (Max 2)</Label>
            <div className="flex flex-wrap gap-2">
              {lifestyleCategories.map(cat => (
                <div
                  key={cat.id}
                  onClick={() => {
                    setFormData(prev => {
                      const tags = prev.lifestyle_category_ids
                      if (tags.includes(cat.id)) return { ...prev, lifestyle_category_ids: tags.filter(t => t !== cat.id) }
                      if (tags.length >= 2) return prev
                      return { ...prev, lifestyle_category_ids: [...tags, cat.id] }
                    })
                  }}
                  className={`px-3 py-1 rounded-full border text-sm cursor-pointer transition-colors ${
                    formData.lifestyle_category_ids.includes(cat.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
                  }`}
                >
                  {cat.name}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Conditions & Rules</Label>
            <ComboboxMulti
              options={conditionsOptions}
              selected={formData.listing_conditions}
              onChange={(val) => setFormData(p => ({...p, listing_conditions: val}))}
              onCreate={handleCreateCondition}
              placeholder="Select or create conditions..."
              emptyText="No conditions found."
            />
          </div>
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader>
          <CardTitle>Photos</CardTitle>
          <CardDescription>Upload listing images. First image will be the cover.</CardDescription>
        </CardHeader>
        <CardContent>
          <PhotoUploader value={photos} onChange={setPhotos} />
        </CardContent>
      </Card>

      {/* Footer / Submit */}
      <div className="flex items-center justify-between border-t pt-6 pb-12">
        <div className="flex items-center space-x-2">
          <Checkbox id="is_published" checked={formData.is_published} onCheckedChange={(c) => setFormData(p => ({...p, is_published: !!c}))} />
          <Label htmlFor="is_published">Publish Listing Immediately</Label>
        </div>
        <div className="flex items-center gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Listing'}
          </Button>
        </div>
      </div>
    </form>
  )
}
