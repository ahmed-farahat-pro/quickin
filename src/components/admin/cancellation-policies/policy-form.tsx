'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createPolicy, updatePolicy } from '@/app/admin/cancellation-policies/actions'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface PolicyFormProps {
  initialData?: any
  isEditing?: boolean
}

export function PolicyForm({ initialData, isEditing = false }: PolicyFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const initialTranslations = initialData?.translations || {}
  const initialAr = initialTranslations.ar || {}

  const [formData, setFormData] = React.useState({
    code: initialData?.code || '',
    label: initialData?.label || '',
    description: initialData?.description || '',
    label_ar: initialAr.label || '',
    description_ar: initialAr.description || '',
    full_refund_days_before: initialData?.full_refund_days_before ?? '',
    partial_refund_days_before: initialData?.partial_refund_days_before ?? '',
    partial_refund_pct: initialData?.partial_refund_pct ?? '',
    no_refund_days_before: initialData?.no_refund_days_before ?? '',
    is_enabled: initialData?.is_enabled ?? true,
    display_order: initialData?.display_order ?? 0,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckedChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const payload = {
        code: formData.code,
        label: formData.label,
        description: formData.description || null,
        full_refund_days_before: formData.full_refund_days_before !== '' ? Number(formData.full_refund_days_before) : null,
        partial_refund_days_before: formData.partial_refund_days_before !== '' ? Number(formData.partial_refund_days_before) : null,
        partial_refund_pct: formData.partial_refund_pct !== '' ? Number(formData.partial_refund_pct) : null,
        no_refund_days_before: formData.no_refund_days_before !== '' ? Number(formData.no_refund_days_before) : null,
        is_enabled: formData.is_enabled,
        display_order: Number(formData.display_order),
        translations: {
          ar: {
            label: formData.label_ar,
            description: formData.description_ar
          }
        }
      }

      if (isEditing && initialData?.code) {
        const { code, ...updatePayload } = payload
        const result = await updatePolicy(initialData.code, updatePayload)
        if (result.error) throw new Error(result.error)
        toast.success('Policy updated successfully')
      } else {
        const result = await createPolicy(payload)
        if (result.error) throw new Error(result.error)
        toast.success('Policy created successfully')
      }
      router.push('/admin/cancellation-policies')
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Policy Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" value={formData.code} onChange={handleChange} required disabled={isEditing} placeholder="e.g. flexible" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Label (English)</Label>
            <Input id="label" name="label" value={formData.label} onChange={handleChange} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="label_ar">Label (Arabic)</Label>
            <Input id="label_ar" name="label_ar" dir="rtl" value={formData.label_ar} onChange={handleChange} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (English)</Label>
            <Textarea id="description" name="description" value={formData.description} onChange={handleChange} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description_ar">Description (Arabic)</Label>
            <Textarea id="description_ar" name="description_ar" dir="rtl" value={formData.description_ar} onChange={handleChange} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Refund Rules</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="full_refund_days_before">Full Refund (days before check-in)</Label>
            <Input id="full_refund_days_before" name="full_refund_days_before" type="number" min="0" value={formData.full_refund_days_before} onChange={handleChange} placeholder="e.g. 7" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="partial_refund_days_before">Partial Refund (days before check-in)</Label>
            <Input id="partial_refund_days_before" name="partial_refund_days_before" type="number" min="0" value={formData.partial_refund_days_before} onChange={handleChange} placeholder="e.g. 3" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="partial_refund_pct">Partial Refund Percentage</Label>
            <Input id="partial_refund_pct" name="partial_refund_pct" type="number" min="0" max="100" value={formData.partial_refund_pct} onChange={handleChange} placeholder="e.g. 50" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="no_refund_days_before">No Refund (days before check-in)</Label>
            <Input id="no_refund_days_before" name="no_refund_days_before" type="number" min="0" value={formData.no_refund_days_before} onChange={handleChange} placeholder="e.g. 1" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="is_enabled" checked={formData.is_enabled} onCheckedChange={(c) => handleCheckedChange('is_enabled', !!c)} />
            <Label htmlFor="is_enabled">Enabled</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="display_order">Display Order</Label>
            <Input id="display_order" name="display_order" type="number" value={formData.display_order} onChange={handleChange} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Save Changes' : 'Create Policy'}
        </Button>
      </div>
    </form>
  )
}
