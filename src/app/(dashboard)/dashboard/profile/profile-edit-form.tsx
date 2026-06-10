'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { useTranslations } from 'next-intl'

interface ProfileEditFormProps
{
  userId: string
  initialData: {
    fullName: string
    email: string
    phone: string
    address: string
    bio: string
  }
}

import { z } from 'zod'
import { EG_MOBILE_REGEX, EG_LANDLINE_REGEX } from '@/lib/constants'

const profileSchema = z.object({
  phone: z.string().optional().nullable().refine(
    (val) =>
    {
      if (!val) return true;
      const cleanNumber = val.replace(/\s+/g, '');
      return EG_MOBILE_REGEX.test(cleanNumber) || EG_LANDLINE_REGEX.test(cleanNumber);
    },
    {
      message: "Invalid Egyptian phone number format"
    }
  ),
  address: z.string().max(200, "Address is too long").optional().nullable(),
  bio: z.string().max(500, "Bio is too long").optional().nullable(),
})

export function ProfileEditForm({ userId, initialData }: ProfileEditFormProps)
{
  const [phone, setPhone] = useState<string | undefined>(initialData.phone || undefined)
  const [address, setAddress] = useState(initialData.address)
  const [bio, setBio] = useState(initialData.bio)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [errors, setErrors] = useState<{ phone?: string; address?: string; bio?: string }>({})

  const supabase = createClient()
  const t = useTranslations('dashboardProfile.personal.contactInfo')

  const handlePhoneChange = (value: string | undefined) =>
  {
    setPhone(value)
    setErrors((prev) => ({ ...prev, phone: undefined }))
    setHasChanges((value || '') !== initialData.phone || address !== initialData.address || bio !== initialData.bio)
  }

  const handleAddressChange = (value: string) =>
  {
    setAddress(value)
    setErrors((prev) => ({ ...prev, address: undefined }))
    setHasChanges((phone || '') !== initialData.phone || value !== initialData.address || bio !== initialData.bio)
  }

  const handleBioChange = (value: string) =>
  {
    setBio(value)
    setErrors((prev) => ({ ...prev, bio: undefined }))
    setHasChanges((phone || '') !== initialData.phone || address !== initialData.address || value !== initialData.bio)
  }

  const validateField = (name: keyof typeof errors, value: any) =>
  {
    // Validate the specific field using the whole schema
    const result = profileSchema.safeParse({ phone, address, bio, [name]: value })
    if (!result.success) {
      const fieldError = result.error.issues.find(issue => issue.path[0] === name)
      setErrors((prev) => ({ ...prev, [name]: fieldError?.message }))
    } else {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const handlePhoneBlur = () => validateField('phone', phone)
  const handleAddressBlur = () => validateField('address', address)
  const handleBioBlur = () => validateField('bio', bio)

  const handleSubmit = async () =>
  {
    setErrors({})
    const result = profileSchema.safeParse({ phone, address, bio })

    if (!result.success) {
      const fieldErrors: any = {}
      result.error.issues.forEach((issue) =>
      {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message
        }
      })
      setErrors(fieldErrors)
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          phone: phone || null,
          address: address || null,
          bio: bio || null,
        })
        .eq('id', userId)

      if (error) throw error

      toast.success(t('success'))
      setHasChanges(false)
    } catch (error: any) {
      console.error('Error updating profile:', error)
      const message = error?.message || error?.details || t('error')
      toast.error(message, {
        action: { label: t('retry'), onClick: () => handleSubmit() }
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>
          {t('description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">{t('phone')}</Label>
            <div dir="ltr">
              <PhoneInput
                id="phone"
                international
                countryCallingCodeEditable={false}
                defaultCountry="EG"
                value={phone}
                onChange={handlePhoneChange}
                onBlur={handlePhoneBlur}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 [&>input]:bg-transparent [&>input]:border-none [&>input]:focus:outline-none [&>input]:w-full"
              />
            </div>
            {errors.phone ? (
              <p className="text-[0.8rem] font-medium text-destructive">
                {errors.phone}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('phoneHelp')}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="address" className="flex items-center gap-2">
              <MapPin className="h-4 w-4 rtl:ml-2" />
              {t('address')}
            </Label>
            <Input
              id="address"
              type="text"
              placeholder={t('addressPlaceholder')}
              value={address}
              onChange={(e) => handleAddressChange(e.target.value)}
              onBlur={handleAddressBlur}
            />
            {errors.address && (
              <p className="text-[0.8rem] font-medium text-destructive">
                {errors.address}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <textarea
            id="bio"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Tell us a little bit about yourself"
            value={bio || ''}
            onChange={(e) => handleBioChange(e.target.value)}
            onBlur={handleBioBlur}
            rows={4}
          />
          {errors.bio && (
            <p className="text-[0.8rem] font-medium text-destructive">
              {errors.bio}
            </p>
          )}
        </div>

        {hasChanges && (
          <div className="flex justify-end pt-2">
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin rtl:ml-2 rtl:mr-0" />
                  {t('saving')}
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                  {t('saveChanges')}
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
