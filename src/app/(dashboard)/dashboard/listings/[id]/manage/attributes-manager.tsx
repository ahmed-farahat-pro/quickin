'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Save, X, Plus, Clock, Package, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import
{
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { toSnakeCase, generateUniqueCode } from '@/lib/utils/string-utils'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useTranslations, useLocale } from 'next-intl'

const MAX_HIGHLIGHTS = 4

interface AttributeCategory
{
  id: string
  code: string
  label: string
  icon_class: string | null
  translations?: Record<string, string> | null
}

interface AttributeOption
{
  id: string
  code: string
  label: string
  tier: number
  translations?: Record<string, string> | null
}

interface Attribute
{
  id: string
  code: string
  label: string
  description: string | null
  category_id: string
  type_code: string
  icon_class: string | null
  options?: AttributeOption[]
  is_approved?: boolean
  created_by?: string | null
  translations?: Record<string, string> | null
}

interface ListingAttributeValue
{
  attribute_id: string
  value_option_id: string | null
  value_number: number | null
  notes: string | null
  is_highlighted: boolean | null
}

interface AttributesManagerProps
{
  listingId: string
  initialValues: ListingAttributeValue[]
}

export function AttributesManager({ listingId, initialValues }: AttributesManagerProps)
{
  const t = useTranslations('dashboardListingManage.amenities')
  const tc = useTranslations('dashboardListingManage.common')
  const locale = useLocale()
  const [categories, setCategories] = useState<AttributeCategory[]>([])
  const [attributes, setAttributes] = useState<Record<string, Attribute[]>>({})
  const [pendingAttributes, setPendingAttributes] = useState<Attribute[]>([])
  const [existingCodes, setExistingCodes] = useState<string[]>([])
  const [values, setValues] = useState<Record<string, ListingAttributeValue>>({})
  const [originalValues, setOriginalValues] = useState<Record<string, ListingAttributeValue>>({})
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Suggest new attribute form
  const [showSuggestForm, setShowSuggestForm] = useState(false)
  const [newAttrLabel, setNewAttrLabel] = useState('')
  const [newAttrLabelAr, setNewAttrLabelAr] = useState('')
  const [newAttrDescription, setNewAttrDescription] = useState('')
  const [newAttrDescriptionAr, setNewAttrDescriptionAr] = useState('')
  const [newAttrCategory, setNewAttrCategory] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() =>
  {
    loadData()
  }, [])

  useEffect(() =>
  {
    // Convert initial values to lookup
    const lookup: Record<string, ListingAttributeValue> = {}
    initialValues.forEach(v =>
    {
      lookup[v.attribute_id] = v
    })
    setValues(lookup)
    setOriginalValues(lookup)
  }, [initialValues])

  useEffect(() =>
  {
    // Check for changes
    const hasChanged = !areAttributeValuesEqual(values, originalValues)
    setHasChanges(hasChanged)
  }, [values, originalValues])

  async function loadData()
  {
    const supabase = createClient()

    // Fetch categories
    const { data: cats } = await supabase
      .from('attribute_categories')
      .select('*')
      .order('display_order')

    setCategories(cats || [])

    // Fetch approved attributes with options
    const { data: attrs } = await supabase
      .from('attributes')
      .select(`
        *,
        type:attribute_types(code),
        options:attribute_options(id, code, label, tier, display_order, translations)
      `)
      .eq('is_approved', true)
      .eq('is_enabled', true)
      .order('label')

    // Collect existing codes for uniqueness check
    const codes = (attrs || []).map(a => a.code)
    setExistingCodes(codes)

    // Group by category
    const grouped: Record<string, Attribute[]> = {}
    for (const attr of attrs || []) {
      const catId = attr.category_id
      if (!grouped[catId]) grouped[catId] = []
      grouped[catId].push({
        ...attr,
        type_code: attr.type?.code || 'number',
        options: attr.options?.sort((a: any, b: any) => a.display_order - b.display_order)
      })
    }
    setAttributes(grouped)

    // Fetch user's pending attributes
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: pending } = await supabase
        .from('attributes')
        .select('*')
        .eq('created_by', user.id)
        .eq('is_approved', false)

      setPendingAttributes(pending || [])
      // Add pending codes to existing codes
      setExistingCodes(prev => [...prev, ...(pending || []).map(p => p.code)])
    }

    setLoading(false)
  }

  function updateValue(attrId: string, field: 'value_option_id' | 'value_number' | 'notes' | 'is_highlighted', value: any)
  {
    setValues(prev => ({
      ...prev,
      [attrId]: {
        ...prev[attrId],
        attribute_id: attrId,
        value_option_id: prev[attrId]?.value_option_id ?? null,
        value_number: prev[attrId]?.value_number ?? null,
        notes: prev[attrId]?.notes ?? null,
        is_highlighted: prev[attrId]?.is_highlighted ?? null,
        [field]: value
      }
    }))
  }

  const activeHighlightsCount = Object.values(values).filter(v => v.is_highlighted === true).length

  function clearValue(attrId: string)
  {
    setValues(prev =>
    {
      const newValues = { ...prev }
      delete newValues[attrId]
      return newValues
    })
  }

  async function saveChanges()
  {
    setIsSaving(true)
    const supabase = createClient()

    try {
      // Delete existing
      await supabase
        .from('listing_attributes')
        .delete()
        .eq('listing_id', listingId)

      // Insert new values (only non-empty)
      const toInsert = Object.values(values).filter(v =>
        v.value_option_id !== null || (v.value_number !== null && v.value_number > 0)
      ).map(v => ({
        listing_id: listingId,
        attribute_id: v.attribute_id,
        value_option_id: v.value_option_id,
        value_number: v.value_number,
        notes: v.notes,
        is_highlighted: v.is_highlighted
      }))

      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('listing_attributes')
          .insert(toInsert)

        if (error) throw error
      }

      setOriginalValues({ ...values })
      toast.success(t('messages.saveSuccess'))
      setHasChanges(false)
    } catch (error: any) {
      console.error('Error saving attributes:', error)
      toast.error(error.message || t('messages.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  function discardChanges()
  {
    setValues({ ...originalValues })
    setHasChanges(false)
  }

  async function handleSuggestAttribute()
  {
    if (!newAttrLabel.trim()) {
      toast.error(t('messages.nameError'))
      return
    }
    if (!newAttrCategory) {
      toast.error(t('messages.categoryError'))
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error(t('messages.authError'))
      setIsSubmitting(false)
      return
    }

    // Generate unique code from label
    const code = generateUniqueCode(newAttrLabel, existingCodes)

    // Get number type (default for suggestions)
    const { data: numType } = await supabase
      .from('attribute_types')
      .select('id')
      .eq('code', 'number')
      .single()

    if (!numType) {
      toast.error(t('messages.typeError'))
      setIsSubmitting(false)
      return
    }

    const { data, error } = await supabase
      .from('attributes')
      .insert({
        code,
        label: newAttrLabel.trim(),
        description: newAttrDescription.trim() || null,
        category_id: newAttrCategory,
        type_id: numType.id,
        created_by: user.id,
        is_approved: false,
        is_enabled: true,
        translations: {
          ar: newAttrLabelAr.trim() || undefined
        }
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        toast.error(t('messages.existsError'))
      } else {
        console.error('Error suggesting attribute:', error)
        toast.error(t('messages.addError'))
      }
    } else {
      toast.success(t('messages.addSuccess'))
      setPendingAttributes(prev => [...prev, data])
      setExistingCodes(prev => [...prev, code])
      setNewAttrLabel('')
      setNewAttrLabelAr('')
      setNewAttrDescription('')
      setNewAttrDescriptionAr('')
      setNewAttrCategory('')
      setShowSuggestForm(false)
    }

    setIsSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('title')}
          </CardTitle>
          <CardDescription>
            {t('description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={categories.map(c => c.id)} className="space-y-2">
            {categories.map(category =>
            {
              const categoryAttrs = attributes[category.id] || []
              if (categoryAttrs.length === 0) return null

              return (
                <AccordionItem key={category.id} value={category.id} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      {category.icon_class && (
                        <DynamicIcon name={category.icon_class} className="h-4 w-4" />
                      )}
                      <span className="font-medium">
                        {category.translations?.[locale] || category.label}
                      </span>
                      <Badge variant="secondary" className="ml-2">
                        {categoryAttrs.filter(a => values[a.id]).length}/{categoryAttrs.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {categoryAttrs.map(attr => (
                        <AttributeInput
                          key={attr.id}
                          attribute={attr}
                          value={values[attr.id]}
                          onChange={(field, val) => updateValue(attr.id, field, val)}
                          onClear={() => clearValue(attr.id)}
                          highlightCount={activeHighlightsCount}
                          maxHighlights={MAX_HIGHLIGHTS}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>

          {activeHighlightsCount >= MAX_HIGHLIGHTS && (
            <Alert className="mt-4 bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 text-xs font-bold uppercase tracking-wider">{t('highlightLimitTitle')}</AlertTitle>
              <AlertDescription className="text-amber-700 text-sm">
                {t('highlightLimitDesc', { max: MAX_HIGHLIGHTS })}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Pending Suggestions */}
      {pendingAttributes.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              {t('pendingTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {pendingAttributes.map(attr => (
                <Badge key={attr.id} variant="outline" className="opacity-60">
                  {attr.label} <span className="text-xs ml-1">{t('awaiting')}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggest New Attribute */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            {t('missingTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!showSuggestForm ? (
            <Button variant="outline" size="sm" onClick={() => setShowSuggestForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {t('suggest')}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{t('name')}</Label>
                  <Input
                    value={newAttrLabel}
                    onChange={(e) => setNewAttrLabel(e.target.value)}
                    placeholder={t('placeholderName')}
                  />
                  {newAttrLabel && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Code: <code className="bg-muted px-1 rounded">{toSnakeCase(newAttrLabel)}</code>
                    </p>
                  )}
                </div>
                <div>
                  <Label>{t('nameAr')}</Label>
                  <Input
                    value={newAttrLabelAr}
                    onChange={(e) => setNewAttrLabelAr(e.target.value)}
                    placeholder={t('placeholderNameAr')}
                    dir="rtl"
                  />
                </div>
              </div>
              <div>
                <Label>{t('category')}</Label>
                <Select value={newAttrCategory} onValueChange={setNewAttrCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{t('desc')}</Label>
                  <Textarea
                    value={newAttrDescription}
                    onChange={(e) => setNewAttrDescription(e.target.value)}
                    placeholder={t('placeholderDesc')}
                    rows={2}
                  />
                </div>
                <div>
                  <Label>{t('descAr')}</Label>
                  <Textarea
                    value={newAttrDescriptionAr}
                    onChange={(e) => setNewAttrDescriptionAr(e.target.value)}
                    placeholder={t('placeholderDescAr')}
                    rows={2}
                    dir="rtl"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSuggestAttribute} disabled={isSubmitting}>
                  {isSubmitting ? t('submitting') : t('submit')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() =>
                {
                  setShowSuggestForm(false)
                  setNewAttrLabel('')
                  setNewAttrDescription('')
                  setNewAttrCategory('')
                }}>
                  {t('cancel')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg sticky bottom-4">
          <p className="text-sm">{tc('unsavedChanges')}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={discardChanges}>
              <X className="h-4 w-4 mr-1" />
              {tc('discard')}
            </Button>
            <Button size="sm" onClick={saveChanges} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              {tc('save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function areAttributeValuesEqual(
  a: Record<string, ListingAttributeValue>,
  b: Record<string, ListingAttributeValue>
): boolean
{
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) return false

  for (const key of keysA) {
    const valA = a[key]
    const valB = b[key]

    if (!valB) return false

    if (valA.attribute_id !== valB.attribute_id) return false
    if (valA.value_option_id !== valB.value_option_id) return false
    if (valA.value_number !== valB.value_number) return false
    if (valA.notes !== valB.notes) return false
    if (valA.is_highlighted !== valB.is_highlighted) return false
  }

  return true
}

// Individual attribute input component
function AttributeInput({
  attribute,
  value,
  onChange,
  onClear,
  highlightCount,
  maxHighlights
}: {
  attribute: Attribute
  value?: ListingAttributeValue
  onChange: (field: 'value_option_id' | 'value_number' | 'notes' | 'is_highlighted', value: any) => void
  onClear: () => void
  highlightCount: number
  maxHighlights: number
})
{
  const t = useTranslations('dashboardListingManage.amenities')
  const locale = useLocale()
  const hasValue = value?.value_option_id !== null || (value?.value_number !== null && value?.value_number > 0)

  return (
    <div className={`p-3 border rounded-lg space-y-2 transition-all duration-300 ease-in-out ${hasValue ? 'shadow-sm hover:shadow-md border-muted-foreground/30' : 'border-destructive/20'}`}>
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          {attribute.icon_class && (
            <DynamicIcon name={attribute.icon_class} className="h-4 w-4 text-primary" />
          )}
          {attribute.translations?.[locale] || attribute.label}
        </Label>
        <div className="flex items-center gap-1">
          {hasValue && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
              {
                if (!value?.is_highlighted && highlightCount >= maxHighlights) {
                  toast.error(t('messages.limitError', { max: maxHighlights }))
                  return
                }
                onChange('is_highlighted', value?.is_highlighted ? null : true)
              }}
              className={`h-8 px-2 flex items-center gap-1 ${value?.is_highlighted ? 'text-amber-500 bg-amber-50' : 'text-muted-foreground'}`}
              title={value?.is_highlighted ? t('pinnedTitle') : t('pinTitle')}
              disabled={!value?.is_highlighted && highlightCount >= maxHighlights}
            >
              <Lightbulb className={`h-4 w-4 ${value?.is_highlighted ? 'fill-amber-500' : ''}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{t('pin')}</span>
            </Button>
          )}
          {hasValue && (
            <Button variant="ghost" size="sm" onClick={onClear} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {attribute.type_code === 'option' && attribute.options && (
        <Select
          value={value?.value_option_id || ''}
          onValueChange={(val) => onChange('value_option_id', val || null)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('placeholderSelect')} />
          </SelectTrigger>
          <SelectContent>
            {attribute.options.map(opt => (
              <SelectItem key={opt.id} value={opt.id}>
                <div className="flex items-center justify-between w-full gap-4">
                  <span>{opt.translations?.[locale] || opt.label}</span>
                  {opt.tier > 1 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-amber-100 text-amber-700 border-amber-200">
                      {t('tier', { tier: opt.tier })}
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {attribute.type_code === 'number' && (
        <Input
          type="number"
          min="0"
          value={value?.value_number ?? ''}
          onChange={(e) => onChange('value_number', e.target.value ? parseFloat(e.target.value) : null)}
          placeholder={t('placeholderNumber')}
        />
      )}

      {hasValue && (
        <Textarea
          placeholder={t('placeholderNotes')}
          value={value?.notes || ''}
          onChange={(e) => onChange('notes', e.target.value || null)}
          rows={2}
          className="text-sm"
        />
      )}
    </div>
  )
}
