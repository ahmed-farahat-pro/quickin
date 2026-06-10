'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useFieldArray } from 'react-hook-form'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { SiteSettings } from '@/types/site-settings'

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
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Trash2, GripVertical } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

const localizedStringSchema = z.object({
  en: z.string().min(1, 'English text is required'),
  ar: z.string().min(1, 'Arabic text is required'),
})

const optionalLocalizedStringSchema = z.object({
  en: z.string().optional().or(z.literal('')),
  ar: z.string().optional().or(z.literal('')),
})

const navLinkSchema = z.object({
  id: z.string(),
  label: localizedStringSchema,
  href: z.string().min(1, 'Link URL is required'),
  is_external: z.boolean().default(false).optional(),
})

const footerColumnSchema = z.object({
  id: z.string(),
  title: localizedStringSchema,
  links: z.array(navLinkSchema),
})

const socialLinkSchema = z.object({
  id: z.string().optional(),
  platform: z.enum(['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'other']),
  url: z.string().url('Must be a valid URL'),
  icon: z.string().optional().or(z.literal('')),
  image_url: z.string().optional().or(z.literal('')),
  className: z.string().optional().or(z.literal('')),
})

const settingsFormSchema = z.object({
  hero_config: z.object({
    background_type: z.enum(['image', 'video', 'slider', 'color']),
    media_url: z.string().url().optional().or(z.literal('')),
    title: localizedStringSchema,
    subtitle: localizedStringSchema,
  }),
  navbar_config: z.object({
    logo_url: z.string().url().optional().or(z.literal('')),
    links: z.array(navLinkSchema),
  }),
  footer_config: z.object({
    tagline: optionalLocalizedStringSchema.optional(),
    description: optionalLocalizedStringSchema.optional(),
    legal_company_name: optionalLocalizedStringSchema.optional(),
    columns: z.array(footerColumnSchema),
    social_links: z.array(socialLinkSchema).optional(),
    bottom_links: z.array(navLinkSchema).optional(),
    copyright_text: optionalLocalizedStringSchema.optional(),
  }),
})

type SettingsFormValues = z.infer<typeof settingsFormSchema>

interface SiteSettingsFormProps {
  initialData: SiteSettings
  pages?: any[]
}

export function SiteSettingsForm({ initialData, pages = [] }: SiteSettingsFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      hero_config: {
        background_type: initialData.hero_config?.background_type || 'image',
        media_url: initialData.hero_config?.media_url || '',
        title: initialData.hero_config?.title || { en: '', ar: '' },
        subtitle: initialData.hero_config?.subtitle || { en: '', ar: '' },
      },
      navbar_config: {
        logo_url: initialData.navbar_config?.logo_url || '',
        links: initialData.navbar_config?.links || [],
      },
      footer_config: {
        tagline: initialData.footer_config?.tagline || { en: '', ar: '' },
        description: initialData.footer_config?.description || { en: '', ar: '' },
        legal_company_name: initialData.footer_config?.legal_company_name || { en: '', ar: '' },
        columns: initialData.footer_config?.columns || [],
        social_links: (initialData.footer_config?.social_links || []).map((link: any) => ({
          platform: link.platform || 'other',
          url: link.url || '',
          icon: link.icon || '',
          image_url: link.image_url || '',
          className: link.className || '',
        })),
        bottom_links: initialData.footer_config?.bottom_links || [],
        copyright_text: initialData.footer_config?.copyright_text || { en: '', ar: '' },
      }
    },
  })

  const { fields: navLinks, append: appendNavLink, remove: removeNavLink } = useFieldArray({
    control: form.control,
    name: 'navbar_config.links',
  })

  const { fields: footerColumns, append: appendFooterColumn, remove: removeFooterColumn } = useFieldArray({
    control: form.control,
    name: 'footer_config.columns',
  })

  const { fields: bottomLinks, append: appendBottomLink, remove: removeBottomLink } = useFieldArray({
    control: form.control,
    name: 'footer_config.bottom_links',
  })

  const { fields: socialLinks, append: appendSocialLink, remove: removeSocialLink } = useFieldArray({
    control: form.control,
    name: 'footer_config.social_links',
  })

  const [uploadingIcons, setUploadingIcons] = useState<Record<number, boolean>>({})
  const supabase = createClient()

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingIcons(prev => ({ ...prev, [index]: true }))
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${crypto.randomUUID()}.${fileExt}`
      const filePath = `social/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('destinations') // Safely using destinations bucket
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('destinations')
        .getPublicUrl(filePath)

      form.setValue(`footer_config.social_links.${index}.image_url`, publicUrl)
      toast.success('Image uploaded')
    } catch (e) {
      console.error(e)
      toast.error('Failed to upload image')
    } finally {
      setUploadingIcons(prev => ({ ...prev, [index]: false }))
    }
  }

  async function onSubmit(data: SettingsFormValues) {
    setIsLoading(true)

    try {
      const { error } = await supabase
        .from('site_settings')
        .update({
          hero_config: data.hero_config,
          navbar_config: data.navbar_config,
          footer_config: data.footer_config,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1)

      if (error) throw error

      toast.success('Settings updated successfully')
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error('Failed to update settings')
    } finally {
      setIsLoading(false)
    }
  }

  // Helper to render localized fields side-by-side
  const renderLocalizedField = (
    name: string,
    label: string,
    description?: string,
    layout: 'card' | 'inline' = 'card',
    useMarkdown: boolean = false
  ) => {
    const InputComponent = useMarkdown ? Textarea : Input as any;
    const content = (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name={`${name}.en` as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground">English</FormLabel>
              <FormControl>
                <InputComponent placeholder="English text..." {...field} className={useMarkdown ? 'min-h-[100px]' : ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${name}.ar` as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground text-right block">Arabic (عربي)</FormLabel>
              <FormControl>
                <InputComponent placeholder="النص بالعربية..." {...field} dir="rtl" className={`text-right ${useMarkdown ? 'min-h-[100px]' : ''}`} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    );

    if (layout === 'inline') return content;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{label}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          {content}
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-20">
        
        {/* HERO SECTION */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Hero Section</h3>
            <p className="text-sm text-muted-foreground">
              Configure the main landing area of the homepage.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="hero_config.background_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Background Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a background type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="image">Static Image</SelectItem>
                          <SelectItem value="video">Video Loop</SelectItem>
                          <SelectItem value="color">Solid Color</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hero_config.media_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Media URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormDescription>
                        Provide the direct URL to the image or video (mp4).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {renderLocalizedField('hero_config.title', 'Hero Title', 'The main heading displayed on the homepage. Supports MD syntax.', 'card', true)}
          {renderLocalizedField('hero_config.subtitle', 'Hero Subtitle', 'The secondary text displayed under the main heading. Supports MD syntax.', 'card', true)}
        </div>

        {/* NAVIGATION SECTION */}
        <div className="space-y-4 pt-8 border-t">
          <div>
            <h3 className="text-lg font-medium">Main Navigation</h3>
            <p className="text-sm text-muted-foreground">
              Configure the header links displayed across the site.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Brand Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="navbar_config.logo_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo URL (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Leave blank to use default site logo..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-medium">Header Links</CardTitle>
                <CardDescription>Manage the links shown in the top navigation bar.</CardDescription>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => appendNavLink({
                  id: crypto.randomUUID(),
                  label: { en: '', ar: '' },
                  href: '/',
                  is_external: false
                })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Link
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {navLinks.length === 0 && (
                <div className="text-center p-8 border border-dashed rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">No navigation links added yet.</p>
                </div>
              )}
              
              {navLinks.map((field, index) => (
                <div key={field.id} className="p-4 border rounded-lg bg-card flex gap-4 items-start relative group">
                  <div className="mt-8 cursor-grab text-muted-foreground hover:text-foreground">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-8">
                        <FormLabel className="text-xs mb-2 block">Link Label</FormLabel>
                        {renderLocalizedField(`navbar_config.links.${index}.label`, '', '', 'inline')}
                      </div>
                      
                      <div className="md:col-span-4">
                        <FormField
                          control={form.control}
                          name={`navbar_config.links.${index}.href`}
                          render={({ field: hrefField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Destination URL</FormLabel>
                              <FormControl>
                                <Input placeholder="/about-us" {...hrefField} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name={`navbar_config.links.${index}.is_external`}
                      render={({ field: extField }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Switch
                              checked={extField.value}
                              onCheckedChange={extField.onChange}
                            />
                          </FormControl>
                          <FormLabel className="font-normal text-sm">Open in new tab (External Link)</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive mt-6"
                    onClick={() => removeNavLink(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* FOOTER SECTION */}
        <div className="space-y-4 pt-8 border-t">
          <div>
            <h3 className="text-lg font-medium">Footer Configuration</h3>
            <p className="text-sm text-muted-foreground">
              Configure the bottom navigation links and copyright text.
            </p>
          </div>

          {renderLocalizedField('footer_config.tagline', 'Tagline', 'Short brand slogan (e.g. "Find your next adventure"). Supports MD syntax.', 'card', true)}
          {renderLocalizedField('footer_config.description', 'Description', 'Longer description of your business shown in the footer. Supports MD syntax.', 'card', true)}
          {renderLocalizedField('footer_config.legal_company_name', 'Legal Company Name', 'Used in the copyright section (e.g. "QuickIn, Inc.").')}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-medium">Footer Columns</CardTitle>
                <CardDescription>Organize footer links into columns.</CardDescription>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => appendFooterColumn({
                  id: crypto.randomUUID(),
                  title: { en: '', ar: '' },
                  links: []
                })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Column
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {footerColumns.length === 0 && (
                <div className="text-center p-8 border border-dashed rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">No footer columns added yet.</p>
                </div>
              )}
              
              {footerColumns.map((col, colIndex) => (
                <div key={col.id} className="p-4 border rounded-lg bg-accent/30 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <FormLabel className="text-xs mb-2 block">Column Title</FormLabel>
                      {renderLocalizedField(`footer_config.columns.${colIndex}.title`, '', '', 'inline')}
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive mt-6"
                      onClick={() => removeFooterColumn(colIndex)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Nested FieldArray for Links inside Columns */}
                  <FooterColumnLinks 
                    form={form} 
                    colIndex={colIndex} 
                    renderLocalizedField={renderLocalizedField}
                    pages={pages}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-medium">Bottom Links (Copyright Section)</CardTitle>
                <CardDescription>Links shown at the very bottom next to the copyright.</CardDescription>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => appendBottomLink({
                  id: crypto.randomUUID(),
                  label: { en: '', ar: '' },
                  href: '/',
                  is_external: false
                })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Bottom Link
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {bottomLinks.length === 0 && (
                <div className="text-center p-8 border border-dashed rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">No bottom links added yet.</p>
                </div>
              )}
              
              {bottomLinks.map((field, index) => (
                <div key={field.id} className="p-4 border rounded-lg bg-card flex gap-4 items-start relative group">
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-8">
                        <FormLabel className="text-xs mb-2 block">Link Label</FormLabel>
                        {renderLocalizedField(`footer_config.bottom_links.${index}.label`, '', '', 'inline')}
                      </div>
                      
                      <div className="md:col-span-4">
                        <FormField
                          control={form.control}
                          name={`footer_config.bottom_links.${index}.href`}
                          render={({ field: hrefField }) => (
                            <FormItem>
                              <FormLabel className="text-xs flex justify-between">
                                <span>Destination URL</span>
                                {pages.length > 0 && (
                                  <div className="flex gap-1 overflow-x-auto max-w-[100px] hide-scrollbar">
                                    {pages.map((p: any) => (
                                      <button
                                        key={p.id}
                                        type="button"
                                        className="text-[9px] text-primary hover:underline whitespace-nowrap"
                                        onClick={() => {
                                          hrefField.onChange('/' + p.slug);
                                          const currentLabelEn = form.getValues(`footer_config.bottom_links.${index}.label.en`);
                                          if (!currentLabelEn) {
                                            form.setValue(`footer_config.bottom_links.${index}.label.en`, p.title?.en || '');
                                            form.setValue(`footer_config.bottom_links.${index}.label.ar`, p.title?.ar || '');
                                          }
                                        }}
                                      >
                                        {p.title?.en || p.slug}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="/about-us" {...hrefField} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive mt-6"
                    onClick={() => removeBottomLink(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-medium">Social Links</CardTitle>
                <CardDescription>Social media icons displayed in the footer middle.</CardDescription>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => appendSocialLink({
                  id: crypto.randomUUID(),
                  platform: 'facebook',
                  url: 'https://',
                  icon: '',
                  image_url: '',
                  className: ''
                })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Social
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {socialLinks.length === 0 && (
                <div className="text-center p-8 border border-dashed rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">No social links added yet.</p>
                </div>
              )}
              
              {socialLinks.map((field, index) => (
                <div key={field.id || index} className="p-4 border rounded-lg bg-card flex gap-4 items-start relative group">
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-4">
                        <FormField
                          control={form.control}
                          name={`footer_config.social_links.${index}.platform`}
                          render={({ field: pField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Platform</FormLabel>
                              <Select onValueChange={pField.onChange} defaultValue={pField.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select platform" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="facebook">Facebook</SelectItem>
                                  <SelectItem value="twitter">X (Twitter)</SelectItem>
                                  <SelectItem value="instagram">Instagram</SelectItem>
                                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                                  <SelectItem value="youtube">YouTube</SelectItem>
                                  <SelectItem value="tiktok">TikTok</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="md:col-span-8">
                        <FormField
                          control={form.control}
                          name={`footer_config.social_links.${index}.url`}
                          render={({ field: urlField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Profile URL</FormLabel>
                              <FormControl>
                                <Input placeholder="https://..." {...urlField} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-2">
                      <div className="md:col-span-3">
                        <FormField
                          control={form.control}
                          name={`footer_config.social_links.${index}.icon`}
                          render={({ field: iconField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Override 1: Lucide Icon</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. github" {...iconField} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="md:col-span-6">
                        <FormField
                          control={form.control}
                          name={`footer_config.social_links.${index}.image_url`}
                          render={({ field: imgField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Override 2: Custom Image URL</FormLabel>
                              <FormControl>
                                <div className="flex w-full items-center">
                                  <Input 
                                    placeholder="https://..." 
                                    className="rounded-e-none focus-visible:z-10" 
                                    {...imgField} 
                                  />
                                  <label className="flex h-9 items-center justify-center rounded-e-md border border-l-0 bg-muted px-3 text-xs font-medium hover:bg-muted/80 cursor-pointer transition-colors whitespace-nowrap">
                                    {uploadingIcons[index] ? <Loader2 className="h-4 w-4 animate-spin"/> : "Upload"}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => handleIconUpload(e, index)}
                                      disabled={uploadingIcons[index]}
                                    />
                                  </label>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="md:col-span-3">
                        <FormField
                          control={form.control}
                          name={`footer_config.social_links.${index}.className`}
                          render={({ field: clsField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Custom Styling</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. h-6 w-6 text-red-500" {...clsField} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive mt-6"
                    onClick={() => removeSocialLink(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {renderLocalizedField('footer_config.copyright_text', 'Copyright Text', 'Text displayed at the very bottom next to the year. Supports MD syntax.', 'card', true)}
        </div>

        {/* FLOATING ACTION BAR */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t flex justify-end z-50">
          <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save All Settings
          </Button>
        </div>
      </form>
    </Form>
  )
}

// Sub-component to handle nested links field array cleanly
function FooterColumnLinks({ form, colIndex, renderLocalizedField, pages = [] }: any) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `footer_config.columns.${colIndex}.links`,
  })

  return (
    <div className="space-y-2 mt-4 pl-4 border-l-2 border-primary/20">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-muted-foreground">Column Links</h4>
        <Button 
          type="button" 
          variant="secondary" 
          size="sm"
          className="h-7 text-xs"
          onClick={() => append({
            id: crypto.randomUUID(),
            label: { en: '', ar: '' },
            href: '/',
            is_external: false
          })}
        >
          <Plus className="h-3 w-3 mr-1" /> Add Link
        </Button>
      </div>

      {fields.map((link, linkIndex) => (
        <div key={link.id} className="p-3 border rounded-md bg-card flex gap-3 items-start">
          <div className="flex-1 space-y-3">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                   {renderLocalizedField(`footer_config.columns.${colIndex}.links.${linkIndex}.label`, '', '', 'inline')}
                </div>
                <FormField
                  control={form.control}
                  name={`footer_config.columns.${colIndex}.links.${linkIndex}.href`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] flex justify-between">
                        <span>URL</span>
                        {pages.length > 0 && (
                          <div className="flex gap-1 overflow-x-auto max-w-[150px] hide-scrollbar">
                            {pages.map((p: any) => (
                              <button
                                key={p.id}
                                type="button"
                                className="text-[9px] text-primary hover:underline whitespace-nowrap"
                                onClick={() => {
                                  field.onChange('/' + p.slug);
                                  // Auto-fill label if empty
                                  const currentLabelEn = form.getValues(`footer_config.columns.${colIndex}.links.${linkIndex}.label.en`);
                                  if (!currentLabelEn) {
                                    form.setValue(`footer_config.columns.${colIndex}.links.${linkIndex}.label.en`, p.title?.en || '');
                                    form.setValue(`footer_config.columns.${colIndex}.links.${linkIndex}.label.ar`, p.title?.ar || '');
                                  }
                                }}
                              >
                                {p.title?.en || p.slug}
                              </button>
                            ))}
                          </div>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input className="h-8 text-xs" placeholder="/page" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
             </div>
          </div>
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-destructive"
            onClick={() => remove(linkIndex)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  )
}
