'use client'

import { useState } from 'react'
import { Trash2, Plus, Percent, DollarSign, Pencil, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useTranslations, useLocale } from 'next-intl'

export interface PriceAdjustment {
  id: string
  name: string
  adjustmentType: 'percentage' | 'fixed'
  adjustmentValue: number
  appliesToDays: string[]
  startDate: string | null
  endDate: string | null
  isActive: boolean
}

interface PriceAdjustmentsProps {
  adjustments: PriceAdjustment[]
  basePrice: number
  currency?: string
  onAdjustmentsChange: (adjustments: PriceAdjustment[]) => void
  className?: string
}

const WEEKDAYS = [
  { value: 'sunday', labelKey: 'sunday_short', defaultLabel: 'Sun' },
  { value: 'monday', labelKey: 'monday_short', defaultLabel: 'Mon' },
  { value: 'tuesday', labelKey: 'tuesday_short', defaultLabel: 'Tue' },
  { value: 'wednesday', labelKey: 'wednesday_short', defaultLabel: 'Wed' },
  { value: 'thursday', labelKey: 'thursday_short', defaultLabel: 'Thu' },
  { value: 'friday', labelKey: 'friday_short', defaultLabel: 'Fri' },
  { value: 'saturday', labelKey: 'saturday_short', defaultLabel: 'Sat' },
]

const emptyAdjustment: Partial<PriceAdjustment> = {
  name: '',
  adjustmentType: 'percentage',
  adjustmentValue: 0,
  appliesToDays: [],
  isActive: true
}

export function PriceAdjustments({
  adjustments,
  basePrice,
  currency = 'EGP',
  onAdjustmentsChange,
  className
}: PriceAdjustmentsProps) {
  const t = useTranslations('dashboardListingManage.pricing')
  const ta = useTranslations('dashboardListingManage.availability.actions')
  const locale = useLocale()
  const isRtl = locale === 'ar'
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<PriceAdjustment>>(emptyAdjustment)

  // Preset adjustments for quick setup
  const PRESETS = [
    {
      name: t('presets.weekend'),
      adjustmentType: 'percentage' as const,
      adjustmentValue: 15,
      appliesToDays: ['friday', 'saturday'],
    },
    {
      name: t('presets.weekday'),
      adjustmentType: 'percentage' as const,
      adjustmentValue: -10,
      appliesToDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
    },
  ]

  const startEditing = (adjustment: PriceAdjustment) => {
    setEditingId(adjustment.id)
    setFormData({
      name: adjustment.name,
      adjustmentType: adjustment.adjustmentType,
      adjustmentValue: adjustment.adjustmentValue,
      appliesToDays: [...adjustment.appliesToDays],
      isActive: adjustment.isActive
    })
    setShowAddForm(false)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setFormData(emptyAdjustment)
  }

  const saveEdit = () => {
    if (!editingId || !formData.name) return

    onAdjustmentsChange(adjustments.map(a => 
      a.id === editingId 
        ? {
            ...a,
            name: formData.name!,
            adjustmentType: formData.adjustmentType || 'percentage',
            adjustmentValue: formData.adjustmentValue || 0,
            appliesToDays: formData.appliesToDays || []
          }
        : a
    ))
    cancelEditing()
  }

  const addAdjustment = () => {
    if (!formData.name || formData.adjustmentValue === undefined) return

    const adjustment: PriceAdjustment = {
      id: crypto.randomUUID(),
      name: formData.name,
      adjustmentType: formData.adjustmentType || 'percentage',
      adjustmentValue: formData.adjustmentValue,
      appliesToDays: formData.appliesToDays || [],
      startDate: null,
      endDate: null,
      isActive: true
    }

    onAdjustmentsChange([...adjustments, adjustment])
    setFormData(emptyAdjustment)
    setShowAddForm(false)
  }

  const addPreset = (preset: any) => {
    const adjustment: PriceAdjustment = {
      id: crypto.randomUUID(),
      ...preset,
      startDate: null,
      endDate: null,
      isActive: true
    }
    onAdjustmentsChange([...adjustments, adjustment])
  }

  const removeAdjustment = (id: string) => {
    onAdjustmentsChange(adjustments.filter(a => a.id !== id))
  }

  const toggleAdjustment = (id: string) => {
    onAdjustmentsChange(adjustments.map(a => 
      a.id === id ? { ...a, isActive: !a.isActive } : a
    ))
  }

  const toggleDay = (day: string) => {
    const current = formData.appliesToDays || []
    if (current.includes(day)) {
      setFormData({ ...formData, appliesToDays: current.filter(d => d !== day) })
    } else {
      setFormData({ ...formData, appliesToDays: [...current, day] })
    }
  }

  // Calculate example price for a day
  const calculateExample = (day: string): number => {
    let price = basePrice
    adjustments
      .filter(a => a.isActive && a.appliesToDays.includes(day))
      .forEach(a => {
        if (a.adjustmentType === 'percentage') {
          price = price * (1 + a.adjustmentValue / 100)
        } else {
          price = price + a.adjustmentValue
        }
      })
    return Math.round(price * 100) / 100
  }

  // Render the form (reused for add and edit)
  const renderForm = (isEdit: boolean, key?: string) => (
    <Card key={key} className={cn(isEdit ? 'ring-2 ring-primary' : '', isRtl && 'text-right')} dir={isRtl ? 'rtl' : 'ltr'}>
      <CardHeader>
        <CardTitle className="text-base">{isEdit ? t('editAdjustment') : t('newAdjustment')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('name')}</Label>
            <Input
              placeholder={t('placeholderName')}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>{t('type')}</Label>
              <Select
                value={formData.adjustmentType}
                onValueChange={v => setFormData({ ...formData, adjustmentType: v as 'percentage' | 'fixed' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">{t('percentage')}</SelectItem>
                  <SelectItem value="fixed">{t('fixed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('value')}</Label>
              <Input
                type="number"
                placeholder={formData.adjustmentType === 'percentage' ? '10' : '50'}
                value={formData.adjustmentValue || ''}
                onChange={e => setFormData({ ...formData, adjustmentValue: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('applyToDays')}</Label>
          <div className="flex gap-2 flex-wrap">
            {WEEKDAYS.map(day => (
              <Button
                key={day.value}
                type="button"
                variant={formData.appliesToDays?.includes(day.value) ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleDay(day.value)}
              >
                {ta(day.labelKey as any, { defaultValue: day.defaultLabel })}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={isEdit ? cancelEditing : () => setShowAddForm(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={isEdit ? saveEdit : addAdjustment} disabled={!formData.name}>
            {isEdit ? t('save') : t('add')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className={cn('space-y-4', className, isRtl && 'text-right')} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Quick presets */}
      {adjustments.length === 0 && (
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground mb-3">{t('quickSetup')}</p>
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map((preset, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                onClick={() => addPreset(preset)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {preset.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Existing adjustments */}
      {adjustments.map(adjustment => (
        editingId === adjustment.id ? (
          renderForm(true, adjustment.id)
        ) : (
          <Card key={adjustment.id} className={cn(!adjustment.isActive && 'opacity-60')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={adjustment.isActive}
                    onCheckedChange={() => toggleAdjustment(adjustment.id)}
                    dir={isRtl ? 'rtl' : 'ltr'}
                  />
                  <div>
                    <div className="font-medium">{adjustment.name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      {adjustment.adjustmentType === 'percentage' ? (
                        <>
                          <Percent className="h-3 w-3" />
                          {adjustment.adjustmentValue > 0 ? '+' : ''}{adjustment.adjustmentValue}%
                        </>
                      ) : (
                        <>
                          <DollarSign className="h-3 w-3" />
                          {adjustment.adjustmentValue > 0 ? '+' : ''}{adjustment.adjustmentValue} {currency}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 flex-wrap max-w-[150px]">
                    {adjustment.appliesToDays.map(day => {
                      const dayObj = WEEKDAYS.find(d => d.value === day)
                      return (
                        <Badge key={day} variant="secondary" className="text-xs">
                          {ta(dayObj?.labelKey as any, { defaultValue: day.slice(0, 3) })}
                        </Badge>
                      )
                    })}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEditing(adjustment)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAdjustment(adjustment.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      ))}

      {/* Add new adjustment form */}
      {showAddForm ? (
        renderForm(false, 'new-form')
      ) : !editingId && (
        <Button variant="outline" onClick={() => { setShowAddForm(true); setFormData(emptyAdjustment) }} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          {t('addAdjustment')}
        </Button>
      )}

      {/* Price preview */}
      {adjustments.length > 0 && (
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium mb-2">{t('preview', { price: basePrice, currency })}</p>
          <div className="flex gap-2 flex-wrap">
            {WEEKDAYS.map(day => {
              const price = calculateExample(day.value)
              const hasAdjustment = price !== basePrice
              return (
                <div 
                  key={day.value}
                  className={cn(
                    'px-3 py-1 rounded text-sm',
                    hasAdjustment ? 'bg-primary/10 text-primary' : 'bg-background'
                  )}
                >
                  <span className="font-medium">{ta(day.labelKey as any, { defaultValue: day.defaultLabel })}:</span> {price}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default PriceAdjustments
