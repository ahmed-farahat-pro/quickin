'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Info, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTranslations, useLocale } from 'next-intl'

interface CancellationPolicy {
  code: string
  label: string
  description: string | null
  display_order: number
  translations: Record<string, { label?: string; description?: string }> | null
}

interface CancellationPolicyManagerProps {
  listingId: string
  initialPolicyCode: string | null
}

export function CancellationPolicyManager({
  listingId,
  initialPolicyCode,
}: CancellationPolicyManagerProps) {
  const t = useTranslations('dashboardListingManage.cancellation')
  const tc = useTranslations('dashboardListingManage.common')
  const locale = useLocale()
  const [policies, setPolicies] = useState<CancellationPolicy[]>([])
  const [selectedCode, setSelectedCode] = useState<string | null>(initialPolicyCode)
  const [savedCode, setSavedCode] = useState<string | null>(initialPolicyCode)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const hasChanges = selectedCode !== savedCode

  useEffect(() => {
    loadPolicies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadPolicies() {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('cancellation_policies')
      .select('*')
      .eq('is_enabled', true)
      .order('display_order')

    if (error) {
      console.error('Error fetching cancellation policies:', error)
      toast.error(t('messages.loadError'))
    } else {
      setPolicies(data || [])
    }

    setLoading(false)
  }

  function getLocalizedField(
    policy: CancellationPolicy,
    field: 'label' | 'description',
    currentLocale = 'en'
  ): string | null {
    const translated = policy.translations?.[currentLocale]?.[field]
    if (translated) return translated
    return policy[field]
  }

  async function savePolicy() {
    setIsSaving(true)
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('listings')
        .update({ cancellation_policy: selectedCode })
        .eq('id', listingId)

      if (error) throw error

      toast.success(t('messages.saveSuccess'))
      setSavedCode(selectedCode)
    } catch (error: any) {
      console.error('Error saving cancellation policy:', error)
      toast.error(error.message || t('messages.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  function discardChanges() {
    setSelectedCode(savedCode)
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t('messages.loadError')}</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {t('title')}
          </CardTitle>
          <CardDescription>
            {t('description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <TooltipProvider>
            {policies.map((policy) => {
              const label = getLocalizedField(policy, 'label', locale) || policy.code
              const description = getLocalizedField(policy, 'description', locale)
              const isSelected = selectedCode === policy.code

              return (
                <button
                  key={policy.code}
                  type="button"
                  onClick={() => setSelectedCode(policy.code)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    isSelected
                      ? 'border-black bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium">{label}</p>
                      {description && (
                        <p className="text-sm text-muted-foreground mt-1">{description}</p>
                      )}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        <p>{description || label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </button>
              )
            })}
          </TooltipProvider>

          {policies.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          )}
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-sm">{tc('unsavedChanges')}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={discardChanges}
            >
              {tc('discard')}
            </Button>
            <Button
              size="sm"
              onClick={savePolicy}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {tc('saving')}
                </>
              ) : (
                t('messages.saveSuccess')
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

