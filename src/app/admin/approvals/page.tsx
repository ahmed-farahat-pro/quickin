/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CodeBadge } from '@/components/ui/code-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import
{
  Check,
  X,
  Clock,
  Tag,
  Coffee,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Users,
  Home,
  FileText
} from 'lucide-react'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// Types
interface PendingAttribute
{
  id: string
  code: string
  label: string
  description: string | null
  created_at: string
  category: { label: string } | null
}

interface PendingCondition
{
  id: string
  name: string
  description: string | null
  icon_url: string | null
  created_at: string
}

interface PendingVerification
{
  id: string
  full_name: string | null
  email: string | null
  verification_submitted_at: string | null
}

interface PendingListing
{
  id: string
  title: string
  user_id: string
  created_at: string
  user: { full_name: string | null, email: string | null } | null
}

interface OpenDispute
{
  id: string
  title: string
  status: string
  created_at: string
  user: { full_name: string } | null
}

// Data fetching
async function getPendingListings(): Promise<PendingListing[]>
{
  const supabase = await createClient()
  if (!supabase) return []

  try {
    const { data } = await supabase
      .from('listings')
      .select(`id, title, user_id, created_at`)
      .eq('review_status', 'pending_review')
      .order('created_at', { ascending: false })
      .limit(10)

    if (!data || data.length === 0) return []

    const userIds = [...new Set(data.map((d: any) => d.user_id))]
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
    const profileMap: Record<string, any> = {}
    profiles?.forEach(p => profileMap[p.id] = p)

    return data.map((d: any) => ({
      ...d,
      user: profileMap[d.user_id] || null
    })) as PendingListing[]
  } catch {
    return []
  }
}

async function getPendingAttributes(): Promise<PendingAttribute[]>
{
  const supabase = await createClient()
  if (!supabase) return []

  const { data } = await supabase
    .from('attributes')
    .select(`id, code, label, description, created_at, category:attribute_categories(label)`)
    .eq('is_approved', false)
    .order('created_at', { ascending: false })
    .limit(10)

  return (data as unknown as PendingAttribute[]) || []
}

async function getPendingConditions(): Promise<PendingCondition[]>
{
  const supabase = await createClient()
  if (!supabase) return []

  try {
    const { data } = await supabase
      .from('listing_conditions')
      .select(`id, name, description, icon_url, created_at`)
      .eq('is_approved', false)
      .order('created_at', { ascending: false })
      .limit(10)

    return (data as unknown as PendingCondition[]) || []
  } catch {
    return []
  }
}

async function getPendingVerifications(): Promise<PendingVerification[]>
{
  const supabase = await createClient()
  if (!supabase) return []

  try {
    const { data } = await supabase
      .from('profiles')
      .select(`id, full_name, email, verification_submitted_at, verification_status:verification_statuses(code)`)
      .not('verification_submitted_at', 'is', null)
      .limit(10)

    const filtered = (data || []).filter((p: any) => p.verification_status?.code === 'pending')
    return filtered as unknown as PendingVerification[]
  } catch {
    return []
  }
}

async function getOpenDisputes(): Promise<OpenDispute[]>
{
  const supabase = await createClient()
  if (!supabase) return []

  try {
    const { data } = await supabase
      .from('disputes')
      .select(`id, title, status, created_at, user:profiles!user_id(full_name)`)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(10)

    return (data as unknown as OpenDispute[]) || []
  } catch {
    return []
  }
}

async function getCounts()
{
  const supabase = await createClient()
  if (!supabase) return { attributes: 0, conditions: 0, verifications: 0, disputes: 0, bestOffers: 0, listings: 0 }

  let attributes = 0
  let conditions = 0
  let verifications = 0
  let disputes = 0
  let bestOffers = 0
  let listings = 0

  try {
    const attrRes = await supabase.from('attributes').select('*', { count: 'exact', head: true }).eq('is_approved', false)
    attributes = attrRes.count || 0
  } catch { /* ignore */ }

  try {
    const condRes = await supabase.from('listing_conditions').select('*', { count: 'exact', head: true }).eq('is_approved', false)
    conditions = condRes.count || 0
  } catch { /* ignore */ }

  try {
    const verifRes = await supabase.from('profiles').select(`verification_status:verification_statuses(code)`).not('verification_submitted_at', 'is', null)
    verifications = (verifRes.data || []).filter((p: any) => p.verification_status?.code === 'pending').length
  } catch { /* ignore */ }

  try {
    const dispRes = await supabase.from('disputes').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress'])
    disputes = dispRes.count || 0
  } catch { /* ignore */ }

  try {
    const boRes = await supabase.from('listing_best_offers').select('*', { count: 'exact', head: true }).eq('status', 'requested')
    bestOffers = boRes.count || 0
  } catch { /* ignore */ }

  try {
    const listingsRes = await supabase.from('listings').select('*', { count: 'exact', head: true }).eq('review_status', 'pending_review')
    listings = listingsRes.count || 0
  } catch { /* ignore */ }

  return { attributes, conditions, verifications, disputes, bestOffers, listings }
}

// Server actions
async function approveAttribute(formData: FormData)
{
  'use server'
  const id = formData.get('id') as string
  const supabase = await createClient()
  if (!supabase) return
  await supabase.from('attributes').update({ is_approved: true }).eq('id', id)
  revalidatePath('/admin/approvals')
}

async function rejectAttribute(formData: FormData)
{
  'use server'
  const id = formData.get('id') as string
  const supabase = await createClient()
  if (!supabase) return
  await supabase.from('attributes').delete().eq('id', id)
  revalidatePath('/admin/approvals')
}

async function approveCondition(formData: FormData)
{
  'use server'
  const id = formData.get('id') as string
  const supabase = await createClient()
  if (!supabase) return
  await supabase.from('listing_conditions').update({ is_approved: true }).eq('id', id)
  revalidatePath('/admin/approvals')
}

async function rejectCondition(formData: FormData)
{
  'use server'
  const id = formData.get('id') as string
  const supabase = await createClient()
  if (!supabase) return
  await supabase.from('listing_conditions').delete().eq('id', id)
  revalidatePath('/admin/approvals')
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
})
{
  const resolvedParams = await searchParams;
  const tab = (resolvedParams?.tab as string) || 'listings';

  const [attributes, conditions, verifications, disputes, pendingListings, counts] = await Promise.all([
    getPendingAttributes(),
    getPendingConditions(),
    getPendingVerifications(),
    getOpenDisputes(),
    getPendingListings(),
    getCounts(),
  ])

  const totalPending = counts.attributes + counts.conditions + counts.verifications + counts.disputes + counts.listings

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Approvals Hub</h1>
        <p className="text-muted-foreground">
          Review and manage all pending items across the platform.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <SummaryCard
          title="Listings"
          count={counts.listings}
          icon={Home}
          href="?tab=listings"
          color="orange"
          isLink
        />
        <SummaryCard
          title="Amenities & Attrs"
          count={counts.attributes}
          icon={Tag}
          href="?tab=attributes"
          color="blue"
          isLink
        />
        <SummaryCard
          title="Conditions"
          count={counts.conditions}
          icon={FileText}
          href="?tab=conditions"
          color="purple"
          isLink
        />
        <SummaryCard
          title="Verifications"
          count={counts.verifications}
          icon={ShieldCheck}
          href="/admin/verifications"
          color="green"
          isLink
        />
        <SummaryCard
          title="Disputes"
          count={counts.disputes}
          icon={AlertTriangle}
          href="/admin/disputes"
          color="red"
          isLink
        />
        <SummaryCard
          title="Best Offers"
          count={counts.bestOffers}
          icon={Tag}
          href="/admin/approvals/best-offers"
          color="blue"
          isLink
        />
      </div>

      {totalPending === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Check className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-medium">All caught up!</h3>
            <p className="text-muted-foreground">No pending items to review.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={tab} key={tab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="listings" className="gap-2">
              <Home className="h-4 w-4" />
              Listings
              {counts.listings > 0 && (
                <Badge variant="secondary" className="ml-1">{counts.listings}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="attributes" className="gap-2">
              <Tag className="h-4 w-4" />
              Attributes
              {counts.attributes > 0 && (
                <Badge variant="secondary" className="ml-1">{counts.attributes}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="conditions" className="gap-2">
              <FileText className="h-4 w-4" />
              Conditions
              {counts.conditions > 0 && (
                <Badge variant="secondary" className="ml-1">{counts.conditions}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="verifications" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              Verifications
              {counts.verifications > 0 && (
                <Badge variant="secondary" className="ml-1">{counts.verifications}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="disputes" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Disputes
              {counts.disputes > 0 && (
                <Badge variant="secondary" className="ml-1">{counts.disputes}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Listings Tab */}
          <TabsContent value="listings">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pending Listings</CardTitle>
                <CardDescription>
                  Review new or edited listings before they go live
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingListings.length === 0 ? (
                  <EmptyState message="No pending listings" />
                ) : (
                  <div className="space-y-3">
                    {pendingListings.map((l) => (
                      <div key={l.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <Home className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{l.title}</p>
                            <p className="text-xs text-muted-foreground">Host: {l.user?.full_name || l.user?.email || 'Unknown'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(l.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button asChild variant="outline" className="w-full mt-4">
                  <Link href="/admin/listings">
                    Manage All Listings
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attributes Tab */}
          <TabsContent value="attributes" id="attributes">
            {attributes.length === 0 ? (
              <EmptyState message="No pending attributes and amenities" />
            ) : (
              <div className="grid gap-4">
                {attributes.map((attr) => (
                  <Card key={attr.id}>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                      <div>
                        <CardTitle className="text-base">{attr.label}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{attr.category?.label || 'Uncategorized'}</Badge>
                          <span className="text-xs text-muted-foreground">
                            <CodeBadge code={attr.code} variant="outline" className="h-5 px-1.5 text-[10px]" label="#" />
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" className="h-8 w-8 rounded-xl bg-[#5e181c] hover:bg-[#5e181c]/90">
                              <Check className="h-4 w-4 text-white" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Approve {attr.label}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to approve this attribute? It will become available for all users to select.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <form action={approveAttribute}>
                                <input type="hidden" name="id" value={attr.id} />
                                <AlertDialogAction type="submit" className="bg-[#5e181c] hover:bg-[#5e181c]/90 text-white">Approve</AlertDialogAction>
                              </form>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" className="h-8 w-8 rounded-xl bg-[#db2c2c] hover:bg-[#db2c2c]/90">
                              <X className="h-4 w-4 text-white" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Reject {attr.label}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to reject this attribute suggestion? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <form action={rejectAttribute}>
                                <input type="hidden" name="id" value={attr.id} />
                                <AlertDialogAction type="submit" className="bg-[#db2c2c] hover:bg-[#db2c2c]/90 text-white">Reject</AlertDialogAction>
                              </form>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardHeader>
                    {attr.description && (
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground">{attr.description}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Conditions Tab */}
          <TabsContent value="conditions" id="conditions">
            {conditions.length === 0 ? (
              <EmptyState message="No pending conditions" />
            ) : (
              <div className="grid gap-4">
                {conditions.map((condition) => (
                  <Card key={condition.id}>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {condition.name}
                        </CardTitle>
                      </div>
                      <div className="flex gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" className="h-8 w-8 rounded-xl bg-[#5e181c] hover:bg-[#5e181c]/90">
                              <Check className="h-4 w-4 text-white" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Approve {condition.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to approve this condition? It will become available for all hosts to select.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <form action={approveCondition}>
                                <input type="hidden" name="id" value={condition.id} />
                                <AlertDialogAction type="submit" className="bg-[#5e181c] hover:bg-[#5e181c]/90 text-white">Approve</AlertDialogAction>
                              </form>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" className="h-8 w-8 rounded-xl bg-[#db2c2c] hover:bg-[#db2c2c]/90">
                              <X className="h-4 w-4 text-white" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Reject {condition.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to reject this condition suggestion? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <form action={rejectCondition}>
                                <input type="hidden" name="id" value={condition.id} />
                                <AlertDialogAction type="submit" className="bg-[#db2c2c] hover:bg-[#db2c2c]/90 text-white">Reject</AlertDialogAction>
                              </form>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardHeader>
                    {condition.description && (
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground">{condition.description}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Verifications Tab */}
          <TabsContent value="verifications">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identity Verifications</CardTitle>
                <CardDescription>
                  Review submitted identity documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                {verifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending verifications</p>
                ) : (
                  <div className="space-y-3">
                    {verifications.slice(0, 5).map((v) => (
                      <div key={v.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{v.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{v.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {v.verification_submitted_at ? new Date(v.verification_submitted_at).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button asChild variant="outline" className="w-full mt-4">
                  <Link href="/admin/verifications">
                    View All Verifications
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Disputes Tab */}
          <TabsContent value="disputes">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Open Disputes</CardTitle>
                <CardDescription>
                  Active disputes requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                {disputes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open disputes</p>
                ) : (
                  <div className="space-y-3">
                    {disputes.slice(0, 5).map((d) => (
                      <div key={d.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{d.title}</p>
                          <p className="text-xs text-muted-foreground">
                            By {(d.user as any)?.full_name || 'Unknown'}
                          </p>
                        </div>
                        <Badge variant={d.status === 'open' ? 'destructive' : 'secondary'}>
                          {d.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                <Button asChild variant="outline" className="w-full mt-4">
                  <Link href="/admin/disputes">
                    View All Disputes
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

// Helper Components
function SummaryCard({
  title,
  count,
  icon: Icon,
  href,
  color,
  isLink = false
}: {
  title: string
  count: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any
  href: string
  color: 'blue' | 'purple' | 'green' | 'red' | 'yellow' | 'orange'
  isLink?: boolean
})
{
  const colorClasses: Record<string, string> = {
    blue: 'text-blue-500',
    purple: 'text-purple-500',
    green: 'text-green-500',
    red: 'text-red-500',
    yellow: 'text-yellow-500',
    orange: 'text-orange-500',
  }

  const borderClasses: Record<string, string> = {
    blue: 'border-l-blue-500',
    purple: 'border-l-purple-500',
    green: 'border-l-green-500',
    red: 'border-l-red-500',
    yellow: 'border-l-yellow-500',
    orange: 'border-l-orange-500',
  }

  const content = (
    <Card className={`h-full flex flex-col border-l-4 ${count > 0 ? borderClasses[color] : 'border-transparent'} ${isLink ? 'hover:bg-muted/50 cursor-pointer transition-colors' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${colorClasses[color]}`} />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-end">
        <div className="text-2xl font-bold">{count}</div>
        {isLink ? (
          <p className={`text-xs text-muted-foreground mt-1 ${count === 0 ? 'invisible' : ''}`}>Click to view &rarr;</p>
        ) : (
          <p className="text-xs mt-1 invisible">Placeholder</p>
        )}
      </CardContent>
    </Card>
  )

  if (isLink) {
    return <Link href={href} className="block h-full">{content}</Link>
  }

  return content
}

function EmptyState({ message }: { message: string })
{
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-8">
        <Check className="h-8 w-8 text-green-500 mb-2" />
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}
