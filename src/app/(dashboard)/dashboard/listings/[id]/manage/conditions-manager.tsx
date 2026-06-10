'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, AlertCircle, Plus, Clock, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslations, useLocale } from 'next-intl'

interface Condition {
  id: string
  name: string
  description: string | null
  icon_url: string | null
  is_approved: boolean
  is_system: boolean
  created_by: string | null
  translations?: Record<string, { name?: string; description?: string }> | null
}

interface ConditionsManagerProps {
  listingId: string
  initialConditionIds: string[]
}

export function ConditionsManager({ 
  listingId, 
  initialConditionIds 
}: ConditionsManagerProps) {
  const t = useTranslations('dashboardListingManage.conditions')
  const tc = useTranslations('dashboardListingManage.common')
  const locale = useLocale()
  const [conditions, setConditions] = useState<Condition[]>([])
  const [myPendingConditions, setMyPendingConditions] = useState<Condition[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>(initialConditionIds)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  
  // Add custom condition form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newConditionName, setNewConditionName] = useState('')
  const [newConditionNameAr, setNewConditionNameAr] = useState('')
  const [newConditionDescription, setNewConditionDescription] = useState('')
  const [newConditionDescriptionAr, setNewConditionDescriptionAr] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    loadConditions()
  }, [])

  useEffect(() => {
    // Check for changes
    const changed = selectedIds.length !== initialConditionIds.length ||
      !selectedIds.every(id => initialConditionIds.includes(id))
    setHasChanges(changed)
  }, [selectedIds, initialConditionIds])

  async function loadConditions() {
    const supabase = createClient()
    
    // Fetch approved conditions
    const { data: approvedData, error: approvedError } = await supabase
      .from('listing_conditions')
      .select('*')
      .or('is_approved.eq.true,is_system.eq.true')
      .order('is_system', { ascending: false })
      .order('name')
    
    if (approvedError) {
      console.error('Error fetching conditions:', approvedError)
    } else {
      setConditions(approvedData || [])
    }

    // Fetch user's pending conditions
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: pendingData } = await supabase
        .from('listing_conditions')
        .select('*')
        .eq('created_by', user.id)
        .eq('is_approved', false)
      
      setMyPendingConditions(pendingData || [])
    }

    setLoading(false)
  }

  async function saveConditions() {
    setIsSaving(true)
    const supabase = createClient()

    try {
      // Delete existing assignments
      await supabase
        .from('listing_condition_assignments')
        .delete()
        .eq('listing_id', listingId)

      // Insert new assignments
      if (selectedIds.length > 0) {
        const { error } = await supabase
          .from('listing_condition_assignments')
          .insert(
            selectedIds.map(conditionId => ({
              listing_id: listingId,
              condition_id: conditionId,
              is_required: true
            }))
          )

        if (error) throw error
      }

      toast.success(t('messages.saveSuccess'))
      setHasChanges(false)
    } catch (error: any) {
      console.error('Error saving conditions:', error)
      toast.error(error.message || t('messages.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddCondition() {
    if (!newConditionName.trim()) {
      toast.error(t('messages.nameError'))
      return
    }

    setIsAdding(true)
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error(t('messages.authError'))
      setIsAdding(false)
      return
    }

    const { data, error } = await supabase
      .from('listing_conditions')
      .insert({
        name: newConditionName.trim(),
        description: newConditionDescription.trim() || null,
        created_by: user.id,
        is_approved: false,
        is_system: false,
        translations: {
          ar: {
            name: newConditionNameAr.trim() || undefined,
            description: newConditionDescriptionAr.trim() || undefined
          }
        }
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding condition:', error)
      toast.error(t('messages.addError'))
    } else {
      toast.success(t('messages.addSuccess'))
      setNewConditionName('')
      setNewConditionNameAr('')
      setNewConditionDescription('')
      setNewConditionDescriptionAr('')
      setShowAddForm(false)
      setMyPendingConditions(prev => [...prev, data])
    }

    setIsAdding(false)
  }

  function toggleCondition(conditionId: string) {
    if (selectedIds.includes(conditionId)) {
      setSelectedIds(selectedIds.filter(id => id !== conditionId))
    } else {
      setSelectedIds([...selectedIds, conditionId])
    }
  }

  function discardChanges() {
    setSelectedIds(initialConditionIds)
    setHasChanges(false)
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t('messages.loadError')}</div>
  }

  return (
    <div className="space-y-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {t('title')}
          </CardTitle>
          <CardDescription>
            {t('description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Approved/System Conditions */}
          <div className="space-y-2">
            {conditions.map((condition) => {
              const localizedName = condition.translations?.[locale]?.name || condition.name
              const localizedDesc = condition.translations?.[locale]?.description || condition.description

              return (
                <div key={condition.id} className="flex items-start gap-3 p-2 rounded hover:bg-muted/50">
                  <Checkbox
                    id={condition.id}
                    checked={selectedIds.includes(condition.id)}
                    onCheckedChange={() => toggleCondition(condition.id)}
                  />
                  <div className="flex-1">
                    <Label htmlFor={condition.id} className="cursor-pointer flex items-center gap-2">
                      {localizedName}
                      {condition.is_system && (
                        <Badge variant="secondary" className="text-xs">{t('system')}</Badge>
                      )}
                    </Label>
                    {localizedDesc && (
                      <p className="text-xs text-muted-foreground mt-0.5">{localizedDesc}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* User's Pending Conditions */}
          {myPendingConditions.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                {t('pending')}
              </p>
              <div className="space-y-2">
                {myPendingConditions.map((condition) => {
                  const localizedName = condition.translations?.[locale]?.name || condition.name
                  const localizedDesc = condition.translations?.[locale]?.description || condition.description

                  return (
                    <div key={condition.id} className="flex items-start gap-3 p-2 rounded bg-muted/30 opacity-60">
                      <Checkbox disabled checked={false} />
                      <div className="flex-1">
                        <Label className="text-muted-foreground">
                          {localizedName}
                          <Badge variant="outline" className="text-xs ml-2">{t('awaiting')}</Badge>
                        </Label>
                        {localizedDesc && (
                          <p className="text-xs text-muted-foreground mt-0.5">{localizedDesc}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Add Custom Condition */}
          <div className="pt-2 border-t">
            {!showAddForm ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {t('addCustom')}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="conditionName">{t('name')}</Label>
                    <Input
                      id="conditionName"
                      value={newConditionName}
                      onChange={(e) => setNewConditionName(e.target.value)}
                      placeholder={t('placeholderName')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="conditionNameAr">{t('nameAr')}</Label>
                    <Input
                      id="conditionNameAr"
                      value={newConditionNameAr}
                      onChange={(e) => setNewConditionNameAr(e.target.value)}
                      placeholder={t('placeholderNameAr')}
                      dir="rtl"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="conditionDesc">{t('desc')}</Label>
                    <Input
                      id="conditionDesc"
                      value={newConditionDescription}
                      onChange={(e) => setNewConditionDescription(e.target.value)}
                      placeholder={t('placeholderDesc')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="conditionDescAr">{t('descAr')}</Label>
                    <Input
                      id="conditionDescAr"
                      value={newConditionDescriptionAr}
                      onChange={(e) => setNewConditionDescriptionAr(e.target.value)}
                      placeholder={t('placeholderDescAr')}
                      dir="rtl"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddCondition}
                    disabled={isAdding}
                  >
                    {isAdding ? t('submitting') : t('submit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAddForm(false)
                      setNewConditionName('')
                      setNewConditionNameAr('')
                      setNewConditionDescription('')
                      setNewConditionDescriptionAr('')
                    }}
                  >
                    {t('cancel')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('note')}
                </p>
              </div>
            )}
          </div>
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
              onClick={saveConditions}
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
