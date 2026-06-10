'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

interface CancellationPolicy {
  code: string
  label: string
  description: string | null
  translations: Record<string, { label?: string; description?: string }> | null
}

interface CancellationPolicyCardProps {
  policyCode: string
  onAcceptChange: (accepted: boolean) => void
}

export function CancellationPolicyCard({
  policyCode,
  onAcceptChange,
}: CancellationPolicyCardProps) {
  const t = useTranslations('bookingConfirm')
  const locale = useLocale()
  const [policy, setPolicy] = useState<CancellationPolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    loadPolicy()
  }, [policyCode])

  useEffect(() => {
    onAcceptChange(accepted)
  }, [accepted, onAcceptChange])

  async function loadPolicy() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('cancellation_policies')
      .select('code, label, description, translations')
      .eq('code', policyCode)
      .single()

    if (error) {
      console.error('Error fetching cancellation policy:', error)
    } else {
      setPolicy(data)
    }
    setLoading(false)
  }

  function getLocalized(field: 'label' | 'description'): string | null {
    if (!policy) return null
    
    // Normalize locale to base (e.g. 'ar-EG' -> 'ar')
    const baseLocale = locale.split('-')[0]
    
    // Try full locale first, then base locale
    const translations = policy.translations as any
    const translated = translations?.[locale]?.[field] || translations?.[baseLocale]?.[field]
    
    if (translated) return translated
    return (policy as any)[field]
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('loadingCancellationPolicy')}
      </div>
    )
  }

  if (!policy) return null

  const label = getLocalized('label') || policy.code
  const description = getLocalized('description')

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="h-4 w-4 text-blue-500" />
        <span>{t('cancellationPolicy')}</span>
      </div>
      <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
        <p className="font-medium text-sm">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-start gap-3 p-2 rounded border hover:bg-muted/50">
        <Checkbox
          id="cancellation-policy-accept"
          checked={accepted}
          onCheckedChange={(checked) => setAccepted(checked === true)}
        />
        <Label
          htmlFor="cancellation-policy-accept"
          className="cursor-pointer text-sm leading-tight"
        >
          {t('acceptCancellationPolicy')}
        </Label>
      </div>
    </div>
  )
}
