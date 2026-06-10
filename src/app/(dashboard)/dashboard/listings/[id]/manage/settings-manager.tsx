'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PhotoUploader, type ListingImageFile } from '@/components/features/host/photo-uploader'
import { updateHostListingSettings } from './actions'
import { useTranslations } from 'next-intl'

interface ListingSettingsManagerProps
{
  listing: any
}

export function ListingSettingsManager({ listing }: ListingSettingsManagerProps)
{
  const t = useTranslations('dashboardListingManage.settings')
  const tc = useTranslations('dashboardListingManage.common')
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  
  // Data for selects
  const [lifestyleCategories, setLifestyleCategories] = useState<{id: string, name: string}[]>([])

  // State
  const initialData = {
    description: listing.description || '',
    description_ar: listing.translations?.ar?.description || '',
    location: listing.location || '',
    google_maps_link: listing.google_maps_link || '',
    max_guests: listing.max_guests || 1,
    beds: listing.beds || 1,
    price_per_night: listing.price_per_night || 0,
    cleaning_fee: listing.cleaning_fee || 0,
    currency: listing.currency || 'EGP',
    min_nights: listing.min_nights || 1,
    lifestyle_category_ids: listing.listing_lifestyles?.map((l: any) => l.lifestyle_category_id) || []
  }

  const [formData, setFormData] = useState(initialData)

  const [photos, setPhotos] = useState<ListingImageFile[]>(() => 
    (listing.listing_images || [])
      .sort((a: any, b: any) => a.order - b.order)
      .map((img: any) => ({
        file: new File([], img.id),
        preview: img.url,
        category: img.category,
        id: img.id,
        isExisting: true
      }))
  )
  const [initialPhotos] = useState(photos)

  useEffect(() => {
    const fetchCats = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('lifestyle_categories').select('id, name').order('display_order')
      if (data) setLifestyleCategories(data)
    }
    fetchCats()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }))
    setHasChanges(true)
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    setHasChanges(true)
  }

  const handlePhotosChange = (newPhotos: ListingImageFile[]) => {
    setPhotos(newPhotos)
    setHasChanges(true)
  }

  const toggleLifestyle = (id: string) => {
    setFormData(prev => {
      const current = prev.lifestyle_category_ids
      if (current.includes(id)) {
        return { ...prev, lifestyle_category_ids: current.filter((c: string) => c !== id) }
      }
      if (current.length >= 2) return prev
      return { ...prev, lifestyle_category_ids: [...current, id] }
    })
    setHasChanges(true)
  }

  const saveSettings = async () =>
  {
    setIsSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t('messages.authError'))

      // Upload new images to storage
      const uploadedImages = await Promise.all(
        photos.map(async (photo, index) => {
          if ((photo as any).isExisting) {
            return { url: photo.preview, category: photo.category, order: index }
          }
          const fileExt = photo.file.name.split('.').pop()
          const fileName = `${user.id}/${Date.now()}-${index}.${fileExt}`
          const { error: uploadError } = await supabase.storage.from('listings').upload(fileName, photo.file)
          if (uploadError) throw new Error(t('messages.uploadError', { message: uploadError.message }))

          const { data: { publicUrl } } = supabase.storage.from('listings').getPublicUrl(fileName)
          return { url: publicUrl, category: photo.category, order: index }
        })
      )

      const payload = {
        ...formData,
        images: uploadedImages
      }

      const res = await updateHostListingSettings(listing.id, payload)
      if (res.error) throw new Error(res.error)

      toast.success(t('messages.saveSuccess'))
      setHasChanges(false)
    } catch (error: any) {
      console.error('Error saving settings:', error)
      toast.error(error.message || t('messages.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  const discardChanges = () =>
  {
    setFormData(initialData)
    setPhotos(initialPhotos)
    setHasChanges(false)
  }

  return (
    <div className="space-y-8 pb-16">
      
      {/* Read-only details section to show them what they cannot change without admin */}
      <div className="p-4 bg-muted/50 rounded-lg space-y-4 border border-muted">
        <div className="flex items-center gap-2 mb-2">
          <Label className="text-muted-foreground font-semibold">{t('lockedTitle')}</Label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
          <div>
            <Label>{t('labels.title')}</Label>
            <Input disabled value={listing.title} />
          </div>
          <div>
            <Label>{t('labels.titleAr')}</Label>
            <Input disabled dir="rtl" value={listing.translations?.ar?.title || ''} />
          </div>
          <div>
            <Label>{t('labels.propertyType')}</Label>
            <Input disabled value={listing.property_type?.name || ''} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>{t('labels.bedrooms')}</Label>
              <Input disabled value={listing.bedrooms || 0} />
            </div>
            <div>
              <Label>{t('labels.bathrooms')}</Label>
              <Input disabled value={listing.bathrooms || 0} />
            </div>
          </div>
          <div className="md:col-span-2 grid grid-cols-3 gap-2">
            <div>
              <Label>{t('labels.country')}</Label>
              <Input disabled value={listing.country_ref?.name || ''} />
            </div>
            <div>
              <Label>{t('labels.state')}</Label>
              <Input disabled value={listing.state_ref?.name || ''} />
            </div>
            <div>
              <Label>{t('labels.city')}</Label>
              <Input disabled value={listing.city_ref?.name || ''} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="description">{t('labels.descriptionEn')}</Label>
          <Textarea id="description" name="description" rows={4} value={formData.description} onChange={handleChange} />
        </div>
        
        <div className="space-y-2 col-span-2">
          <Label htmlFor="description_ar">{t('labels.descriptionAr')}</Label>
          <Textarea id="description_ar" name="description_ar" rows={4} dir="rtl" value={formData.description_ar} onChange={handleChange} />
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="location">{t('labels.location')}</Label>
          <Input id="location" name="location" value={formData.location} onChange={handleChange} />
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="google_maps_link">{t('labels.mapsLink')}</Label>
          <Input id="google_maps_link" name="google_maps_link" value={formData.google_maps_link} onChange={handleChange} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="max_guests">{t('labels.maxGuests')}</Label>
          <Input id="max_guests" name="max_guests" type="number" min={1} value={formData.max_guests} onChange={handleChange} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="beds">{t('labels.beds')}</Label>
          <Input id="beds" name="beds" type="number" min={0} value={formData.beds} onChange={handleChange} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="price_per_night">{t('labels.price')}</Label>
          <Input id="price_per_night" name="price_per_night" type="number" min={0} value={formData.price_per_night} onChange={handleChange} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cleaning_fee">{t('labels.cleaningFee')}</Label>
          <Input id="cleaning_fee" name="cleaning_fee" type="number" min={0} value={formData.cleaning_fee} onChange={handleChange} />
        </div>

        <div className="space-y-2">
          <Label>{t('labels.currency')}</Label>
          <Select value={formData.currency} onValueChange={(v) => handleSelectChange('currency', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EGP">EGP</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="min_nights">{t('labels.minNights')}</Label>
          <Input id="min_nights" name="min_nights" type="number" min={1} value={formData.min_nights} onChange={handleChange} />
        </div>

        <div className="space-y-2 col-span-2 pt-4">
          <Label>{t('labels.lifestyles')}</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {lifestyleCategories.map(cat => (
              <div
                key={cat.id}
                onClick={() => toggleLifestyle(cat.id)}
                className={`px-3 py-1 rounded-full border text-sm cursor-pointer transition-colors ${
                  formData.lifestyle_category_ids.includes(cat.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
                }`}
              >
                {cat.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <Label className="text-base font-semibold">{t('labels.photos')}</Label>
        <PhotoUploader value={photos} onChange={handlePhotosChange} />
      </div>

      {hasChanges && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md z-50 px-4">
          <div className="flex items-center justify-between p-4 bg-primary/95 text-primary-foreground shadow-lg backdrop-blur-md border border-primary/20 rounded-xl">
            <p className="text-sm font-medium">{tc('unsavedChanges')}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={discardChanges}>
                {tc('discard')}
              </Button>
              <Button size="sm" className="bg-white text-black hover:bg-white/90" onClick={saveSettings} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : tc('save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

