import { getUser } from '@/lib/supabase/auth-actions'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Calendar, DollarSign, Settings, Eye, AlertCircle, Package, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { ListingAvailabilityManager } from './availability-manager'
import { ListingPricingManager } from './pricing-manager'
import { ListingSettingsManager } from './settings-manager'
import { ConditionsManager } from './conditions-manager'
import { AttributesManager } from './attributes-manager'
import { CancellationPolicyManager } from './cancellation-policy-manager'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

async function getListing(listingId: string, userId: string)
{
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      property_type:property_types(name),
      country_ref:countries(name),
      state_ref:states(name),
      city_ref:cities(name),
      listing_images (id, url, category, order),
      listing_lifestyles (lifestyle_category_id)
    `)
    .eq('id', listingId)
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return data
}

async function getListingConditionIds(listingId: string): Promise<string[]>
{
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('listing_condition_assignments')
    .select('condition_id')
    .eq('listing_id', listingId)

  if (error || !data) return []
  return data.map(d => d.condition_id)
}

async function getListingAttributeValues(listingId: string)
{
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('listing_attributes')
    .select('attribute_id, value_option_id, value_number, notes, is_highlighted')
    .eq('listing_id', listingId)

  if (error || !data) return []
  return data
}

export default async function ManageListingPage({
  params
}: {
  params: Promise<{ id: string }>
})
{
  const { id } = await params
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const [listing, conditionIds, attributeValues, t] = await Promise.all([
    getListing(id, user.id),
    getListingConditionIds(id),
    getListingAttributeValues(id),
    getTranslations('dashboardListingManage')
  ])

  if (!listing) {
    notFound()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/listings">
            <Button variant="ghost" size="icon" title={t('header.back')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{listing.title}</h1>
              {listing.listing_code && (
                <Badge variant="outline" className="font-mono">
                  #{listing.listing_code}
                </Badge>
              )}
              <Badge variant={listing.is_published ? 'default' : 'secondary'}>
                {listing.is_published ? t('header.published') : t('header.draft')}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('header.basePrice', { price: listing.price_per_night, currency: listing.currency })} • {t('header.minNights', { count: listing.min_nights })}
            </p>
          </div>
        </div>
        <Link href={`/listings/${listing.id}`}>
          <Button variant="outline" className="gap-2">
            <Eye className="h-4 w-4" />
            {t('header.viewListing')}
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="availability" className="space-y-4">
        <TabsList>
          <TabsTrigger value="availability" className="gap-2">
            <Calendar className="h-4 w-4" />
            {t('tabs.availability')}
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2">
            <DollarSign className="h-4 w-4" />
            {t('tabs.pricing')}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            {t('tabs.settings')}
          </TabsTrigger>
          <TabsTrigger value="conditions" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('tabs.conditions')}
          </TabsTrigger>
          <TabsTrigger value="amenities" className="gap-2">
            <Package className="h-4 w-4" />
            {t('tabs.amenities')}
          </TabsTrigger>
          <TabsTrigger value="cancellation" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            {t('tabs.cancellation')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="availability">
          <Card>
            <CardHeader>
              <CardTitle>{t('availability.title')}</CardTitle>
              <CardDescription>
                {t('availability.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ListingAvailabilityManager
                listingId={listing.id}
                basePrice={listing.price_per_night}
                currency={listing.currency}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <CardTitle>{t('pricing.title')}</CardTitle>
              <CardDescription>
                {t('pricing.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ListingPricingManager
                listingId={listing.id}
                basePrice={listing.price_per_night}
                currency={listing.currency}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.title')}</CardTitle>
              <CardDescription>
                {t('settings.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ListingSettingsManager
                listing={listing}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conditions">
          <ConditionsManager
            listingId={listing.id}
            initialConditionIds={conditionIds}
          />
        </TabsContent>

        <TabsContent value="amenities">
          <AttributesManager
            listingId={listing.id}
            initialValues={attributeValues}
          />
        </TabsContent>

        <TabsContent value="cancellation">
          <CancellationPolicyManager
            listingId={listing.id}
            initialPolicyCode={listing.cancellation_policy}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

