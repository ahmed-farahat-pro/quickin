'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save, GripVertical, Trash, Plus } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import { Textarea } from '@/components/ui/textarea'
import { Database } from '@/types/supabase'

type CustomPage = Database['public']['Tables']['custom_pages']['Row']

const widgetSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    type: z.literal('markdown'),
    content: z.object({ en: z.string(), ar: z.string() })
  }),
  z.object({
    id: z.string(),
    type: z.literal('faq'),
    items: z.array(z.object({
      question: z.object({ en: z.string(), ar: z.string() }),
      answer: z.object({ en: z.string(), ar: z.string() })
    }))
  }),
  z.object({
    id: z.string(),
    type: z.literal('ai_chatbot'),
    config: z.object({
      prompt: z.string().optional(),
      title: z.object({ en: z.string(), ar: z.string() }).optional()
    })
  }),
  z.object({
    id: z.string(),
    type: z.literal('support_tickets'),
    config: z.object({
      title: z.object({ en: z.string(), ar: z.string() }).optional()
    })
  })
])

export type Widget = 
  | { id: string; type: 'markdown'; content: { en: string; ar: string } }
  | { id: string; type: 'faq'; items: { question: { en: string; ar: string }; answer: { en: string; ar: string } }[] }
  | { id: string; type: 'ai_chatbot'; config: { prompt?: string; title?: { en: string; ar: string } } }
  | { id: string; type: 'support_tickets'; config: { title?: { en: string; ar: string } } }

export interface PageFormValues {
  slug: string
  title: { en: string; ar: string }
  content: Widget[]
  is_published: boolean
}

const pageSchema = z.object({
  slug: z.string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  title: z.object({
    en: z.string().min(1, 'English title is required'),
    ar: z.string().min(1, 'Arabic title is required'),
  }),
  content: z.array(widgetSchema),
  is_published: z.boolean(),
})

interface PageEditorProps {
  initialData: CustomPage | null
}

export function PageEditor({ initialData }: PageEditorProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const isNew = !initialData

  const form = useForm<PageFormValues>({
    resolver: zodResolver(pageSchema),
    defaultValues: {
      slug: initialData?.slug || '',
      title: {
        en: (initialData?.title as any)?.en || '',
        ar: (initialData?.title as any)?.ar || '',
      },
      content: (initialData?.content as any) || [],
      is_published: initialData?.is_published ?? false,
    },
  })

  const supabase = createClient()

  async function onSubmit(data: PageFormValues) {
    setIsLoading(true)

    try {
      if (isNew) {
        const { error } = await supabase
          .from('custom_pages')
          .insert({
            slug: data.slug,
            title: data.title as any,
            content: data.content as any,
            is_published: data.is_published,
          })

        if (error) {
          if (error.code === '23505') throw new Error('Slug already exists. Please choose a different slug.')
          throw error
        }
        toast.success('Page created successfully')
      } else {
        const { error } = await supabase
          .from('custom_pages')
          .update({
            slug: data.slug,
            title: data.title as any,
            content: data.content as any,
            is_published: data.is_published,
            updated_at: new Date().toISOString(),
          })
          .eq('id', initialData.id)

        if (error) {
          if (error.code === '23505') throw new Error('Slug already exists. Please choose a different slug.')
          throw error
        }
        toast.success('Page updated successfully')
      }

      router.push('/admin/settings/site')
      router.refresh()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to save page')
    } finally {
      setIsLoading(false)
    }
  }

  const { fields, append, move, remove } = useFieldArray({
    control: form.control,
    name: 'content',
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id)
      const newIndex = fields.findIndex((f) => f.id === over.id)
      move(oldIndex, newIndex)
    }
  }

  function addWidget(type: string) {
    if (type === 'markdown') {
      append({ id: uuidv4(), type: 'markdown', content: { en: '', ar: '' } })
    } else if (type === 'faq') {
      append({ id: uuidv4(), type: 'faq', items: [] })
    } else if (type === 'ai_chatbot') {
      append({ id: uuidv4(), type: 'ai_chatbot', config: { prompt: '', title: { en: '', ar: '' } } })
    } else if (type === 'support_tickets') {
      append({ id: uuidv4(), type: 'support_tickets', config: { title: { en: '', ar: '' } } })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-24">
        <div className="flex items-center gap-4">
          <Link href="/admin/settings/site">
            <Button variant="outline" size="icon" type="button">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1" />
          <FormField
            control={form.control}
            name="is_published"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0 bg-muted px-4 py-2 rounded-md">
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="cursor-pointer">Published</FormLabel>
              </FormItem>
            )}
          />
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL Slug</FormLabel>
                  <FormControl>
                    <div className="flex items-center">
                      <span className="bg-muted px-3 py-2 border border-r-0 rounded-l-md text-muted-foreground">
                        /
                      </span>
                      <Input 
                        placeholder="terms-and-conditions" 
                        className="rounded-l-none" 
                        {...field} 
                        onChange={(e) => {
                          field.onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    The path where this page will be accessible. E.g., "about-us" becomes "/about-us".
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <FormField
                control={form.control}
                name="title.en"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title (English)</FormLabel>
                    <FormControl>
                      <Input placeholder="Terms and Conditions" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="title.ar"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-right block">Title (Arabic)</FormLabel>
                    <FormControl>
                      <Input placeholder="الشروط والأحكام" dir="rtl" className="text-right" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Content Widgets */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Page Content</h3>
              <p className="text-sm text-muted-foreground">
                Add and arrange widgets to build your page.
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline">
                  <Plus className="mr-2 h-4 w-4" /> Add Widget
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => addWidget('markdown')}>Markdown Block</DropdownMenuItem>
                <DropdownMenuItem onClick={() => addWidget('faq')}>FAQ Accordion</DropdownMenuItem>
                <DropdownMenuItem onClick={() => addWidget('ai_chatbot')}>AI Chatbot</DropdownMenuItem>
                <DropdownMenuItem onClick={() => addWidget('support_tickets')}>Support Tickets</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              {fields.map((field, index) => (
                <SortableWidget key={field.id} field={field} index={index} form={form} remove={remove} />
              ))}
            </SortableContext>
          </DndContext>

          {fields.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
              No widgets added yet. Click "Add Widget" to start building your page.
            </div>
          )}
        </div>

        {/* FLOATING ACTION BAR */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t flex justify-end z-50">
          <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isNew ? 'Create Page' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function SortableWidget({ field, index, form, remove }: { field: any; index: number; form: any; remove: (i: number) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="border rounded-md p-4 mb-4 bg-card relative group">
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <Button variant="ghost" size="icon" type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </Button>
        <Button variant="destructive" size="icon" type="button" onClick={() => remove(index)}>
          <Trash className="h-4 w-4" />
        </Button>
      </div>
      <h4 className="font-semibold mb-4 capitalize">{field.type.replace('_', ' ')} Widget</h4>
      
      {field.type === 'markdown' && <MarkdownWidgetEditor index={index} form={form} />}
      {field.type === 'faq' && <FaqWidgetEditor index={index} form={form} />}
      {field.type === 'ai_chatbot' && <AiChatbotWidgetEditor index={index} form={form} />}
      {field.type === 'support_tickets' && <SupportTicketsWidgetEditor index={index} form={form} />}
    </div>
  )
}

function MarkdownWidgetEditor({ index, form }: { index: number; form: any }) {
  return (
    <Tabs defaultValue="en" className="w-full mt-4">
      <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0">
        <TabsTrigger value="en" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">English</TabsTrigger>
        <TabsTrigger value="ar" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Arabic</TabsTrigger>
      </TabsList>
      <TabsContent value="en" className="pt-4 outline-none">
        <ContentEditor form={form} index={index} language="en" />
      </TabsContent>
      <TabsContent value="ar" className="pt-4 outline-none">
        <ContentEditor form={form} index={index} language="ar" />
      </TabsContent>
    </Tabs>
  )
}

function ContentEditor({ form, index, language }: { form: any; index: number; language: 'en' | 'ar' }) {
  return (
    <Tabs defaultValue="edit" className="w-full border rounded-md overflow-hidden">
      <div className="bg-muted/50 border-b flex items-center justify-between px-4">
        <TabsList className="h-10 bg-transparent p-0 gap-4">
          <TabsTrigger value="edit" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-full">
            Edit
          </TabsTrigger>
          <TabsTrigger value="preview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-full">
            Preview
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="edit" className="m-0 border-none outline-none">
        <FormField
          control={form.control}
          name={`content.${index}.content.${language}`}
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormControl>
                <Textarea 
                  placeholder={language === 'en' ? "Write your content here..." : "اكتب المحتوى هنا..."} 
                  className="min-h-[200px] rounded-none border-0 focus-visible:ring-0 resize-y p-6 font-mono text-sm"
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                  {...field} 
                />
              </FormControl>
              <FormMessage className="px-4 pb-2" />
            </FormItem>
          )}
        />
      </TabsContent>

      <TabsContent value="preview" className="m-0 border-none outline-none bg-card">
        <div 
          className="min-h-[200px] p-8 prose dark:prose-invert max-w-none"
          dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
          {form.watch(`content.${index}.content.${language}`) ? (
            <ReactMarkdown>
              {form.watch(`content.${index}.content.${language}`)}
            </ReactMarkdown>
          ) : (
            <p className="text-muted-foreground italic">Nothing to preview...</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}

function FaqWidgetEditor({ index, form }: { index: number; form: any }) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `content.${index}.items`,
  })

  return (
    <div className="space-y-4 mt-4">
      {fields.map((field, i) => (
        <div key={field.id} className="p-4 border rounded-md relative bg-muted/20">
          <Button variant="ghost" size="icon" type="button" onClick={() => remove(i)} className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive">
            <Trash className="h-4 w-4" />
          </Button>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name={`content.${index}.items.${i}.question.en`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Question (EN)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`content.${index}.items.${i}.answer.en`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Answer (EN)</FormLabel>
                    <FormControl><Textarea {...field} /></FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name={`content.${index}.items.${i}.question.ar`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-right block">Question (AR)</FormLabel>
                    <FormControl><Input dir="rtl" className="text-right" {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`content.${index}.items.${i}.answer.ar`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-right block">Answer (AR)</FormLabel>
                    <FormControl><Textarea dir="rtl" className="text-right" {...field} /></FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => append({ question: { en: '', ar: '' }, answer: { en: '', ar: '' } })}>
        <Plus className="mr-2 h-4 w-4" /> Add FAQ Item
      </Button>
    </div>
  )
}

function AiChatbotWidgetEditor({ index, form }: { index: number; form: any }) {
  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name={`content.${index}.config.title.en`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Chatbot Title (EN) - Optional</FormLabel>
              <FormControl><Input placeholder="How can we help?" {...field} /></FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`content.${index}.config.title.ar`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-right block">Chatbot Title (AR) - Optional</FormLabel>
              <FormControl><Input placeholder="كيف يمكننا مساعدتك؟" dir="rtl" className="text-right" {...field} /></FormControl>
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name={`content.${index}.config.prompt`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>System Prompt / Knowledge Base</FormLabel>
            <FormControl>
              <Textarea 
                placeholder="You are a helpful support assistant..." 
                className="h-32 font-mono text-sm"
                {...field} 
              />
            </FormControl>
            <FormDescription>
              Configure the AI's behavior and provide it with specific context/rules.
            </FormDescription>
          </FormItem>
        )}
      />
    </div>
  )
}

function SupportTicketsWidgetEditor({ index, form }: { index: number; form: any }) {
  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">
        This widget will display the authenticated user's support tickets and allow them to create new ones.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name={`content.${index}.config.title.en`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Section Title (EN) - Optional</FormLabel>
              <FormControl><Input placeholder="Support Tickets" {...field} /></FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`content.${index}.config.title.ar`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-right block">Section Title (AR) - Optional</FormLabel>
              <FormControl><Input placeholder="تذاكر الدعم" dir="rtl" className="text-right" {...field} /></FormControl>
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}