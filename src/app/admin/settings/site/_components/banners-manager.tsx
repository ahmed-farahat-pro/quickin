'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { toast } from 'sonner'
import { GripVertical, Trash, Plus, Loader2, Save } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { BannerConfig } from '@/types/site-settings'

const bannerSchema = z.object({
  id: z.string(),
  text: z.object({ en: z.string().min(1), ar: z.string().min(1) }),
  preset: z.enum(['primary', 'destructive', 'muted', 'custom']),
  advanced_classes: z.string().optional(),
  icon: z.string().optional(),
  link: z.string().optional(),
  is_closable: z.boolean(),
  is_active: z.boolean(),
  display_rule: z.object({
    type: z.enum(['all', 'include', 'exclude']),
    paths: z.string(),
  }).optional().default({ type: 'all', paths: '' }),
})

type BannersFormValues = {
  banners: BannerConfig[]
}

export function BannersManager({ initialData }: { initialData: BannerConfig[] }) {
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()
  
  const form = useForm<BannersFormValues>({
    resolver: zodResolver(z.object({ banners: z.array(bannerSchema) })),
    defaultValues: { banners: initialData || [] }
  })
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: 'banners' })

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (over && active.id !== over.id) {
      move(fields.findIndex(f => f.id === active.id), fields.findIndex(f => f.id === over.id))
    }
  }

  async function onSubmit(data: BannersFormValues) {
    setIsLoading(true)
    try {
      const { error } = await supabase.from('site_settings').update({ banners_config: data.banners as any }).eq('id', 1)
      if (error) throw error
      toast.success('Banners updated successfully')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-24">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Banners</h3>
          <Button type="button" variant="outline" onClick={() => append({ id: uuidv4(), text: { en: '', ar: '' }, preset: 'primary', is_closable: true, is_active: true, advanced_classes: '', icon: '', link: '', display_rule: { type: 'all', paths: '' } })}>
            <Plus className="mr-2 h-4 w-4" /> Add Banner
          </Button>
        </div>
        
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
            {fields.map((field, index) => (
              <SortableBannerItem key={field.id} field={field} index={index} form={form} remove={remove} />
            ))}
          </SortableContext>
        </DndContext>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t flex justify-end z-50">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Banners
          </Button>
        </div>
      </form>
    </Form>
  )
}

function SortableBannerItem({ field, index, form, remove }: { field: any, index: number, form: any, remove: (index: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="border rounded-md p-4 mb-4 bg-card relative">
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <Button variant="ghost" size="icon" type="button" {...attributes} {...listeners} className="cursor-grab"><GripVertical className="h-4 w-4" /></Button>
        <Button variant="destructive" size="icon" type="button" onClick={() => remove(index)}><Trash className="h-4 w-4" /></Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
        <FormField control={form.control} name={`banners.${index}.text.en`} render={({ field: formField }) => (
          <FormItem><FormLabel>Text (EN)</FormLabel><FormControl><Input {...formField} value={formField.value || ''} /></FormControl><FormMessage/></FormItem>
        )} />
        <FormField control={form.control} name={`banners.${index}.text.ar`} render={({ field: formField }) => (
          <FormItem><FormLabel className="text-right block">Text (AR)</FormLabel><FormControl><Input dir="rtl" className="text-right" {...formField} value={formField.value || ''} /></FormControl><FormMessage/></FormItem>
        )} />
        
        <FormField control={form.control} name={`banners.${index}.preset`} render={({ field: formField }) => (
          <FormItem>
            <FormLabel>Preset Style</FormLabel>
            <Select onValueChange={formField.onChange} defaultValue={formField.value}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select preset" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="destructive">Destructive (Red)</SelectItem>
                <SelectItem value="muted">Muted (Gray)</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        )} />
        <FormField control={form.control} name={`banners.${index}.advanced_classes`} render={({ field: formField }) => (
          <FormItem><FormLabel>Advanced Tailwind Classes</FormLabel><FormControl><Input placeholder="e.g., animate-pulse" {...formField} value={formField.value || ''} /></FormControl></FormItem>
        )} />
        
        <FormField control={form.control} name={`banners.${index}.link`} render={({ field: formField }) => (
          <FormItem><FormLabel>Link (Optional)</FormLabel><FormControl><Input placeholder="/offers" {...formField} value={formField.value || ''} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name={`banners.${index}.icon`} render={({ field: formField }) => (
          <FormItem><FormLabel>Lucide Icon Name (Optional)</FormLabel><FormControl><Input placeholder="Tag, AlertCircle..." {...formField} value={formField.value || ''} /></FormControl></FormItem>
        )} />
        
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 mt-2">
          <FormField control={form.control} name={`banners.${index}.display_rule.type`} render={({ field: formField }) => (
            <FormItem>
              <FormLabel>Display Rule</FormLabel>
              <Select onValueChange={formField.onChange} defaultValue={formField.value || 'all'}>
                <FormControl><SelectTrigger><SelectValue placeholder="Where to show" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="all">Show on all pages</SelectItem>
                  <SelectItem value="include">Show only on specific paths</SelectItem>
                  <SelectItem value="exclude">Hide on specific paths</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )} />
          
          {form.watch(`banners.${index}.display_rule.type`) !== 'all' && (
            <FormField control={form.control} name={`banners.${index}.display_rule.paths`} render={({ field: formField }) => (
              <FormItem>
                <FormLabel>Paths (comma separated)</FormLabel>
                <FormControl><Input placeholder="e.g. /help, /contact" {...formField} value={formField.value || ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          )}
        </div>

        <div className="flex gap-8 items-center md:col-span-2 pt-2">
          <FormField control={form.control} name={`banners.${index}.is_active`} render={({ field: formField }) => (
            <FormItem className="flex items-center gap-2 space-y-0"><FormControl><Switch checked={formField.value} onCheckedChange={formField.onChange} /></FormControl><FormLabel>Active</FormLabel></FormItem>
          )} />
          <FormField control={form.control} name={`banners.${index}.is_closable`} render={({ field: formField }) => (
            <FormItem className="flex items-center gap-2 space-y-0"><FormControl><Switch checked={formField.value} onCheckedChange={formField.onChange} /></FormControl><FormLabel>Closable</FormLabel></FormItem>
          )} />
        </div>
      </div>
    </div>
  )
}
