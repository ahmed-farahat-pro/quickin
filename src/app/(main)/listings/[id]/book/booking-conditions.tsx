'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { AlertCircle } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

interface Condition {
  id: string
  name: string
  description: string | null
  icon_url: string | null
  translations?: Record<string, any>
}

interface BookingConditionsProps {
  listingId: string
  onValidityChange: (allChecked: boolean) => void
}

export function BookingConditions({ listingId, onValidityChange }: BookingConditionsProps) {
  const t = useTranslations('bookingConfirm')
  const locale = useLocale()
  const [conditions, setConditions] = useState<Condition[]>([])
  const [checkedConditions, setCheckedConditions] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConditions()
  }, [listingId])

  useEffect(() => {
    // Check if all conditions are checked
    const allChecked = conditions.length === 0 || 
      conditions.every(c => checkedConditions.has(c.id))
    onValidityChange(allChecked)
  }, [checkedConditions, conditions, onValidityChange])

  async function loadConditions() {
    const supabase = createClient()
    
    // Fetch conditions assigned to this listing
    const { data, error } = await supabase
      .from('listing_condition_assignments')
      .select(`
        condition_id,
        is_required,
        condition:listing_conditions(id, name, description, icon_url, translations)
      `)
      .eq('listing_id', listingId)
      .eq('is_required', true)
    
    if (error) {
      console.error('Error fetching listing conditions:', error)
    } else {
      const processedConditions = (data || [])
        .filter(d => d.condition)
        .map(d => {
          // Supabase returns single object for singular relation name
          const cond = Array.isArray(d.condition) ? d.condition[0] : d.condition
          return cond as Condition
        })
        .filter((c): c is Condition => c !== undefined && c !== null)
      setConditions(processedConditions)
    }
    
    setLoading(false)
  }

  function getLocalized(condition: Condition, field: 'name' | 'description') {
    // Normalize locale to base (e.g. 'ar-EG' -> 'ar')
    const baseLocale = locale.split('-')[0]
    
    // Try full locale first, then base locale
    const translations = condition.translations as any
    const translated = translations?.[locale]?.[field] || translations?.[baseLocale]?.[field]
    
    return translated || condition[field]
  }

  function toggleCondition(conditionId: string) {
    setCheckedConditions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(conditionId)) {
        newSet.delete(conditionId)
      } else {
        newSet.add(conditionId)
      }
      return newSet
    })
  }

  if (loading) {
    return null
  }

  if (conditions.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertCircle className="h-4 w-4 text-amber-500" />
        <span>{t('hostRequirements')}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('hostRequirementsDesc')}
      </p>
      <div className="space-y-2">
        {conditions.map((condition) => {
          const name = getLocalized(condition, 'name')
          const description = getLocalized(condition, 'description')
          
          return (
            <div 
              key={condition.id} 
              className="flex items-start gap-3 p-2 rounded border hover:bg-muted/50"
            >
              <Checkbox
                id={`cond-${condition.id}`}
                checked={checkedConditions.has(condition.id)}
                onCheckedChange={() => toggleCondition(condition.id)}
              />
              <div className="flex-1">
                <Label htmlFor={`cond-${condition.id}`} className="cursor-pointer text-sm">
                  {name}
                </Label>
                {description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {description}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
