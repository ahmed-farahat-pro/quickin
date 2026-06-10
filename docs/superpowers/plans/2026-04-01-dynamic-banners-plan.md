# Dynamic Banners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a dynamic Banners management system allowing admins to create, reorder, style, and toggle stacked banners.

**Architecture:** Add a `banners_config` JSONB column to `site_settings`. Build an admin UI in `/admin/settings/site` using `@dnd-kit` for reordering and `react-hook-form`. Replace the static `PromoBanner` component with a `BannersStack` component that renders the configured banners dynamically and handles the 'close' state using session storage.

**Tech Stack:** Next.js (App Router), Supabase (PostgreSQL, JSONB), Shadcn UI, `@dnd-kit`, Tailwind CSS, Zod, React Hook Form, `tailwind-merge`.

---

### Task 1: Database Schema and Types Update

**Files:**
- Create: `supabase/migrations/<timestamp>_dynamic_banners.sql`
- Modify: `src/types/site-settings.ts`

- [ ] **Step 1: Write the migration script**
Create a new migration file to add the `banners_config` column to `site_settings`.

```sql
-- Add banners_config to site_settings
ALTER TABLE public.site_settings
ADD COLUMN banners_config JSONB DEFAULT '[]'::jsonb NOT NULL;

-- Insert the default "Best Offers" banner to migrate the existing static behavior
UPDATE public.site_settings
SET banners_config = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid(),
    'text', jsonb_build_object(
      'en', 'Best Offers of the Week — Explore curated deals on handpicked stays',
      'ar', 'أفضل عروض الأسبوع — استكشف صفقات مختارة لإقامات منتقاة بعناية'
    ),
    'preset', 'primary',
    'advanced_classes', '',
    'icon', 'Tag',
    'link', '/?bestOffer=true',
    'is_closable', false,
    'is_active', true
  )
)
WHERE id = 1;
```

- [ ] **Step 2: Run the migration**
Run: `npm run supabase migration up` (or `npx supabase db push` depending on local setup) to update the database.

- [ ] **Step 3: Update Supabase Types**
Run: `npx supabase gen types typescript --local > src/types/supabase.ts` (or equivalent linked command)

- [ ] **Step 4: Update internal `SiteSettings` type**
Update `src/types/site-settings.ts` to include the new `banners_config` structure.

```typescript
// Add near other interfaces
export interface BannerConfig {
  id: string;
  text: LocalizedString;
  preset: 'primary' | 'destructive' | 'muted' | 'custom';
  advanced_classes?: string;
  icon?: string;
  link?: string;
  is_closable: boolean;
  is_active: boolean;
}

// In SiteSettings interface:
export interface SiteSettings {
  // ... existing fields ...
  banners_config: BannerConfig[];
}
```

- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/ src/types/
git commit -m "feat: add banners_config to site_settings schema and types"
```

---

### Task 2: Build the Frontend `BannersStack` Component

**Files:**
- Modify: `src/components/layout/index.ts`
- Modify: `src/app/(main)/layout.tsx`
- Modify: `src/components/layout/promo-banner.tsx` (Rename to `banners-stack.tsx` or update inside)

- [ ] **Step 1: Implement `BannersStack`**
Rename `src/components/layout/promo-banner.tsx` to `src/components/layout/banners-stack.tsx` (or just rewrite its contents). 

```tsx
'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import * as Icons from 'lucide-react'
import { useLocale } from 'next-intl'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n/config'
import type { BannerConfig } from '@/types/site-settings'

interface BannersStackProps {
  banners: BannerConfig[]
}

export function BannersStack({ banners }: BannersStackProps) {
  const locale = useLocale() as Locale
  const [closedBanners, setClosedBanners] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = sessionStorage.getItem('closed_banners')
    if (stored) {
      setClosedBanners(JSON.parse(stored))
    }
  }, [])

  if (!mounted) return null // Prevent hydration mismatch with sessionStorage

  const activeBanners = banners.filter(b => b.is_active && !closedBanners.includes(b.id))

  const handleClose = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const updated = [...closedBanners, id]
    setClosedBanners(updated)
    sessionStorage.setItem('closed_banners', JSON.stringify(updated))
  }

  const getPresetClasses = (preset: string) => {
    switch (preset) {
      case 'primary': return 'bg-primary text-primary-foreground hover:bg-primary/90'
      case 'destructive': return 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
      case 'muted': return 'bg-muted text-muted-foreground hover:bg-muted/90'
      default: return 'bg-background text-foreground border-b'
    }
  }

  return (
    <div className="w-full flex flex-col z-40 relative">
      {activeBanners.map((banner) => {
        const IconComponent = banner.icon && (Icons as any)[banner.icon] 
          ? (Icons as any)[banner.icon] 
          : null

        const innerContent = (
          <div className="container mx-auto flex items-center justify-center gap-3 relative py-2.5 px-4 min-h-[40px]">
            {IconComponent && <IconComponent className="h-4 w-4 shrink-0" />}
            <span className="text-sm font-medium tracking-wide text-center">
              {banner.text[locale] || banner.text.en || banner.text.ar}
            </span>
            {banner.is_closable && (
              <button 
                onClick={(e) => handleClose(banner.id, e)}
                className="absolute right-4 rtl:right-auto rtl:left-4 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                aria-label="Close banner"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )

        const containerClasses = cn(
          'w-full transition-all duration-300 relative group',
          getPresetClasses(banner.preset),
          banner.advanced_classes
        )

        if (banner.link) {
          return (
            <Link key={banner.id} href={banner.link} className={containerClasses}>
              {innerContent}
            </Link>
          )
        }

        return (
          <div key={banner.id} className={containerClasses}>
            {innerContent}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Update Layout and Exports**
In `src/components/layout/index.ts`, change `PromoBanner` to `BannersStack`.
In `src/app/(main)/layout.tsx`, pass `siteSettings?.banners_config` to `<BannersStack />`.

```tsx
// in layout.tsx
import { Navbar, Footer, BannersStack } from "@/components/layout";
// ...
<BannersStack banners={siteSettings?.banners_config || []} />
```

- [ ] **Step 3: Commit**
```bash
git add src/components/layout/ src/app/(main)/layout.tsx
git commit -m "feat: implement dynamic BannersStack component"
```

---

### Task 3: Build Admin UI for Banners Management

**Files:**
- Create: `src/app/admin/settings/site/_components/banners-manager.tsx`
- Modify: `src/app/admin/settings/site/_components/site-settings-tabs.tsx`

- [ ] **Step 1: Create BannersManager Component**
Create `banners-manager.tsx`. Use `react-hook-form` and `@dnd-kit` (similar to the PageEditor widget array).

```tsx
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { toast } from 'sonner'
import { GripVertical, Trash, Plus, Loader2, Save } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const bannerSchema = z.object({
  id: z.string(),
  text: z.object({ en: z.string().min(1), ar: z.string().min(1) }),
  preset: z.enum(['primary', 'destructive', 'muted', 'custom']),
  advanced_classes: z.string().optional(),
  icon: z.string().optional(),
  link: z.string().optional(),
  is_closable: z.boolean(),
  is_active: z.boolean()
})

export function BannersManager({ initialData }: { initialData: any[] }) {
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()
  
  const form = useForm({
    resolver: zodResolver(z.object({ banners: z.array(bannerSchema) })),
    defaultValues: { banners: initialData || [] }
  })
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: 'banners' })

  // Setup sensors and handleDragEnd (same as PageEditor)
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (over && active.id !== over.id) {
      move(fields.findIndex(f => f.id === active.id), fields.findIndex(f => f.id === over.id))
    }
  }

  async function onSubmit(data: any) {
    setIsLoading(true)
    try {
      const { error } = await supabase.from('site_settings').update({ banners_config: data.banners }).eq('id', 1)
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
          <Button type="button" variant="outline" onClick={() => append({ id: uuidv4(), text: { en: '', ar: '' }, preset: 'primary', is_closable: true, is_active: true, advanced_classes: '', icon: '', link: '' })}>
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

function SortableBannerItem({ field, index, form, remove }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="border rounded-md p-4 mb-4 bg-card relative">
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <Button variant="ghost" size="icon" type="button" {...attributes} {...listeners} className="cursor-grab"><GripVertical className="h-4 w-4" /></Button>
        <Button variant="destructive" size="icon" type="button" onClick={() => remove(index)}><Trash className="h-4 w-4" /></Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
        <FormField control={form.control} name={`banners.${index}.text.en`} render={({ field }) => (
          <FormItem><FormLabel>Text (EN)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>
        )} />
        <FormField control={form.control} name={`banners.${index}.text.ar`} render={({ field }) => (
          <FormItem><FormLabel className="text-right block">Text (AR)</FormLabel><FormControl><Input dir="rtl" className="text-right" {...field} /></FormControl><FormMessage/></FormItem>
        )} />
        
        <FormField control={form.control} name={`banners.${index}.preset`} render={({ field }) => (
          <FormItem>
            <FormLabel>Preset Style</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
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
        <FormField control={form.control} name={`banners.${index}.advanced_classes`} render={({ field }) => (
          <FormItem><FormLabel>Advanced Tailwind Classes</FormLabel><FormControl><Input placeholder="e.g., animate-pulse" {...field} /></FormControl></FormItem>
        )} />
        
        <FormField control={form.control} name={`banners.${index}.link`} render={({ field }) => (
          <FormItem><FormLabel>Link (Optional)</FormLabel><FormControl><Input placeholder="/offers" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name={`banners.${index}.icon`} render={({ field }) => (
          <FormItem><FormLabel>Lucide Icon Name (Optional)</FormLabel><FormControl><Input placeholder="Tag, AlertCircle..." {...field} /></FormControl></FormItem>
        )} />
        
        <div className="flex gap-8 items-center">
          <FormField control={form.control} name={`banners.${index}.is_active`} render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Active</FormLabel></FormItem>
          )} />
          <FormField control={form.control} name={`banners.${index}.is_closable`} render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Closable</FormLabel></FormItem>
          )} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add Tab to Settings**
In `src/app/admin/settings/site/_components/site-settings-tabs.tsx`, add a new `<TabsTrigger value="banners">Banners</TabsTrigger>` and `<TabsContent value="banners"> <BannersManager initialData={initialSettings.banners_config || []} /> </TabsContent>`.

- [ ] **Step 3: Commit**
```bash
git add src/app/admin/settings/site/_components/
git commit -m "feat: add admin ui for managing dynamic banners"
```
