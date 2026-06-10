'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: any
}

export function CategoryFormDialog({ open, onOpenChange, initialData }: CategoryFormDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formData, setFormData] = React.useState({
    code: '',
    label: '',
    icon_class: '',
    display_order: 0,
  })

  React.useEffect(() => {
    if (initialData && open) {
      setFormData({
        code: initialData.code || '',
        label: initialData.label || '',
        icon_class: initialData.icon_class || '',
        display_order: initialData.display_order || 0,
      })
    } else if (!initialData && open) {
      setFormData({
        code: '',
        label: '',
        icon_class: '',
        display_order: 0,
      })
    }
  }, [initialData, open])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const supabase = createClient()

    try {
      if (initialData?.id) {
        const { error } = await supabase
          .from('attribute_categories')
          .update(formData)
          .eq('id', initialData.id)
        if (error) throw error
        toast.success('Category updated')
      } else {
        const { error } = await supabase
          .from('attribute_categories')
          .insert([formData])
        if (error) throw error
        toast.success('Category created')
      }
      onOpenChange(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save category')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Category' : 'New Category'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input id="label" name="label" value={formData.label} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Code (Unique)</Label>
            <Input id="code" name="code" value={formData.code} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="icon_class">Icon Class (optional)</Label>
            <Input id="icon_class" name="icon_class" value={formData.icon_class} onChange={handleChange} placeholder="e.g. Wifi, Coffee" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="display_order">Display Order</Label>
            <Input id="display_order" name="display_order" type="number" value={formData.display_order} onChange={handleChange} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
