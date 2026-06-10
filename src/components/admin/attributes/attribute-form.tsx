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
import { createAttribute, updateAttribute } from '@/app/admin/attributes/actions'
import { toast } from 'sonner'
import { Loader2, Plus, Trash, GripVertical } from 'lucide-react'

interface AttributeFormProps {
  initialData?: any
  categories: any[]
  types: any[]
  isEditing?: boolean
}

export function AttributeForm({ initialData, categories, types, isEditing = false }: AttributeFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const [formData, setFormData] = React.useState({
    code: initialData?.code || '',
    label: initialData?.label || '',
    description: initialData?.description || '',
    category_id: initialData?.category_id || '',
    type_id: initialData?.type_id || '',
    icon_class: initialData?.icon_class || '',
    is_filterable: initialData?.is_filterable ?? true,
    is_highlighted: initialData?.is_highlighted ?? false,
    is_approved: initialData?.is_approved ?? true,
    is_enabled: initialData?.is_enabled ?? true,
  })

  // Attribute Options for 'option' type
  const [options, setOptions] = React.useState<any[]>(
    (initialData?.options || []).sort((a: any, b: any) => a.display_order - b.display_order)
  )

  const selectedType = types.find(t => t.id === formData.type_id)
  const isOptionType = selectedType?.code === 'option'

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }))
  }

  const handleCheckedChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }))
  }

  const handleAddOption = () => {
    setOptions(prev => [...prev, { id: `new-${Date.now()}`, code: '', label: '', tier: 1 }])
  }

  const handleOptionChange = (id: string, field: string, value: any) => {
    setOptions(prev => prev.map(opt => opt.id === id ? { ...opt, [field]: value } : opt))
  }

  const handleRemoveOption = (id: string) => {
    setOptions(prev => prev.filter(opt => opt.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const payloadOptions = isOptionType ? options : []

      if (isEditing && initialData?.id) {
        const result = await updateAttribute(initialData.id, formData, payloadOptions)
        if (result.error) throw new Error(result.error)
        toast.success('Attribute updated successfully')
      } else {
        const result = await createAttribute(formData, payloadOptions)
        if (result.error) throw new Error(result.error)
        toast.success('Attribute created successfully')
      }
      router.push('/admin/attributes')
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
          <CardTitle>Attribute Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input id="label" name="label" value={formData.label} onChange={handleChange} required />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="code">Code (Unique)</Label>
            <Input id="code" name="code" value={formData.code} onChange={handleChange} required />
          </div>

          <div className="space-y-2 col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" value={formData.description} onChange={handleChange} />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={formData.category_id} onValueChange={(v) => setFormData(p => ({...p, category_id: v}))} required>
              <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data Type</Label>
            <Select value={formData.type_id} onValueChange={(v) => setFormData(p => ({...p, type_id: v}))} required disabled={isEditing}>
              <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
              <SelectContent>
                {types.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.label} ({t.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEditing && <p className="text-xs text-muted-foreground">Type cannot be changed after creation.</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="icon_class">Icon Class (optional)</Label>
            <Input id="icon_class" name="icon_class" value={formData.icon_class} onChange={handleChange} placeholder="e.g. Wifi, Coffee" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="is_filterable" checked={formData.is_filterable} onCheckedChange={(c) => handleCheckedChange('is_filterable', !!c)} />
            <Label htmlFor="is_filterable">Filterable in Search</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="is_highlighted" checked={formData.is_highlighted} onCheckedChange={(c) => handleCheckedChange('is_highlighted', !!c)} />
            <Label htmlFor="is_highlighted">Highlighted/Featured</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="is_approved" checked={formData.is_approved} onCheckedChange={(c) => handleCheckedChange('is_approved', !!c)} />
            <Label htmlFor="is_approved">Approved for use</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="is_enabled" checked={formData.is_enabled} onCheckedChange={(c) => handleCheckedChange('is_enabled', !!c)} />
            <Label htmlFor="is_enabled">Status: Enabled</Label>
          </div>
        </CardContent>
      </Card>

      {isOptionType && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Attribute Options</CardTitle>
              <CardDescription>Define the selectable choices for this attribute.</CardDescription>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={handleAddOption}>
              <Plus className="h-4 w-4 mr-2" /> Add Option
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {options.map((opt, idx) => (
              <div key={opt.id} className="flex items-center gap-4 p-3 border rounded-lg bg-muted/20">
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                <div className="grid grid-cols-3 gap-4 flex-1">
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input value={opt.label} onChange={(e) => handleOptionChange(opt.id, 'label', e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Code</Label>
                    <Input value={opt.code} onChange={(e) => handleOptionChange(opt.id, 'code', e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tier</Label>
                    <Input type="number" min={1} value={opt.tier} onChange={(e) => handleOptionChange(opt.id, 'tier', Number(e.target.value))} required />
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveOption(opt.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {options.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No options defined yet. Click "Add Option" to create one.</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Save Changes' : 'Create Attribute'}
        </Button>
      </div>
    </form>
  )
}
