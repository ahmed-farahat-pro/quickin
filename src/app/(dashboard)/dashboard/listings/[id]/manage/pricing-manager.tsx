'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { PriceAdjustments, type PriceAdjustment } from '@/components/features/host/price-adjustments'
import { useTranslations } from 'next-intl'

interface ListingPricingManagerProps {
  listingId: string
  basePrice: number
  currency: string
}

export function ListingPricingManager({ 
  listingId, 
  basePrice, 
  currency 
}: ListingPricingManagerProps) {
  const t = useTranslations('dashboardListingManage.pricing')
  const [adjustments, setAdjustments] = useState<PriceAdjustment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Fetch existing price adjustments
  useEffect(() => {
    const fetchAdjustments = async () => {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('listing_price_adjustments')
        .select('*')
        .eq('listing_id', listingId)

      if (error) {
        console.error('Error fetching price adjustments:', error)
        toast.error(t('messages.loadError'))
      } else if (data) {
        const mapped: PriceAdjustment[] = data.map(item => ({
          id: item.id,
          name: item.name,
          adjustmentType: item.adjustment_type as 'percentage' | 'fixed',
          adjustmentValue: parseFloat(item.adjustment_value),
          appliesToDays: item.applies_to_days || [],
          startDate: item.start_date,
          endDate: item.end_date,
          isActive: item.is_active
        }))
        setAdjustments(mapped)
      }
      setIsLoading(false)
    }

    fetchAdjustments()
  }, [listingId, t])

  // Handle adjustments change
  const handleAdjustmentsChange = async (newAdjustments: PriceAdjustment[]) => {
    setIsSaving(true)
    const supabase = createClient()

    try {
      // Find added, updated, and removed adjustments
      const existingIds = adjustments.map(a => a.id)
      const newIds = newAdjustments.map(a => a.id)

      // Delete removed adjustments
      const removedIds = existingIds.filter(id => !newIds.includes(id))
      if (removedIds.length > 0) {
        const { error } = await supabase
          .from('listing_price_adjustments')
          .delete()
          .in('id', removedIds)
        if (error) throw error
      }

      // Upsert all current adjustments
      const upsertData = newAdjustments.map(adj => ({
        id: adj.id,
        listing_id: listingId,
        name: adj.name,
        adjustment_type: adj.adjustmentType,
        adjustment_value: adj.adjustmentValue,
        applies_to_days: adj.appliesToDays,
        start_date: adj.startDate,
        end_date: adj.endDate,
        is_active: adj.isActive
      }))

      if (upsertData.length > 0) {
        const { error } = await supabase
          .from('listing_price_adjustments')
          .upsert(upsertData, { onConflict: 'id' })
        if (error) throw error
      }

      setAdjustments(newAdjustments)
      toast.success(t('messages.saveSuccess'))
    } catch (error: any) {
      console.error('Error saving adjustments:', error)
      toast.error(error.message || t('messages.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="relative">
      {isSaving && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
      <PriceAdjustments
        adjustments={adjustments}
        basePrice={basePrice}
        currency={currency}
        onAdjustmentsChange={handleAdjustmentsChange}
      />
    </div>
  )
}

