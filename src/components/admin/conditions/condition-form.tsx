'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createCondition, updateCondition } from '@/app/admin/conditions/actions'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface ConditionFormProps {
  initialData?: any
  isEditing?: boolean
}

export function ConditionForm({ initialData, isEditing = false }: ConditionFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const initialTranslations = initialData?.translations || {}
  const initialAr = initialTranslations.ar || {}

  const [formData, setFormData] = React.useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    name_ar: initialAr.name || '',
    description_ar: initialAr.description || '',
    icon_url: initialData?.icon_url || '',
    is_approved: initialData?.is_approved ?? true,
    is_system: initialData?.is_system ?? true,
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
        name: formData.name,
        description: formData.description || null,
        icon_url: formData.icon_url || null,
        is_approved: formData.is_approved,
        is_system: formData.is_system,
        translations: {
          ar: {
            name: formData.name_ar,
            description: formData.description_ar
          }
        }
      }

      if (isEditing && initialData?.id) {
        const result = await updateCondition(initialData.id, payload)
        if (result.error) throw new Error(result.error)
        toast.success('Condition updated successfully')
      } else {
        const result = await createCondition(payload)
        if (result.error) throw new Error(result.error)
        toast.success('Condition created successfully')
      }
      router.push('/admin/conditions')
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
          <CardTitle>Condition Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name (English)</Label>
            <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name_ar">Name (Arabic)</Label>
            <Input id="name_ar" name="name_ar" dir="rtl" value={formData.name_ar} onChange={handleChange} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (English)</Label>
            <Textarea id="description" name="description" value={formData.description} onChange={handleChange} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description_ar">Description (Arabic)</Label>
            <Textarea id="description_ar" name="description_ar" dir="rtl" value={formData.description_ar} onChange={handleChange} />
          </div>

          <div className="space-y-2 col-span-2">
            <Label htmlFor="icon_url">Icon URL</Label>
            <Input id="icon_url" name="icon_url" value={formData.icon_url} onChange={handleChange} placeholder="https://..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="is_system" checked={formData.is_system} onCheckedChange={(c) => handleCheckedChange('is_system', !!c)} />
            <Label htmlFor="is_system">System Condition (Global)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="is_approved" checked={formData.is_approved} onCheckedChange={(c) => handleCheckedChange('is_approved', !!c)} />
            <Label htmlFor="is_approved">Approved for Use</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Save Changes' : 'Create Condition'}
        </Button>
      </div>
    </form>
  )
}
