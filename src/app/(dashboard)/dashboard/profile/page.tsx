import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import
{
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  CreditCard,
  Bell,
  Eye,
  Calendar,
  ShieldCheck,
  Clock,
  XCircle,
  ShieldAlert,
  CheckCircle
} from 'lucide-react'
import { IdentityVerificationForm } from '@/components/features/verification'
import { ProfileEditForm } from './profile-edit-form'
import { getTranslations } from 'next-intl/server'
import { getRequestLocale } from '@/i18n/request-locale'

interface ProfilePageProps
{
  searchParams: Promise<{ tab?: string }>
}

type VerificationStatusCode = 'unverified' | 'pending' | 'verified' | 'rejected'

interface VerificationStatus
{
  id: number
  code: VerificationStatusCode
  label: string
}

async function getProfileWithVerification(userId: string)
{
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      verification_status:verification_statuses(id, code, label)
    `)
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }

  return data
}

function getVerificationStatusConfig(status: VerificationStatus | null, t: any)
{
  const code = status?.code || 'unverified'

  switch (code) {
    case 'verified':
      return {
        icon: ShieldCheck,
        label: t('status.verified.label'),
        color: 'text-green-600',
        badgeVariant: 'default' as const,
        badgeClass: 'bg-green-500',
        description: t('status.verified.description')
      }
    case 'pending':
      return {
        icon: Clock,
        label: t('status.pending.label'),
        color: 'text-yellow-600',
        badgeVariant: 'secondary' as const,
        badgeClass: 'bg-yellow-500 text-white',
        description: t('status.pending.description')
      }
    case 'rejected':
      return {
        icon: XCircle,
        label: t('status.rejected.label'),
        color: 'text-red-600',
        badgeVariant: 'destructive' as const,
        badgeClass: '',
        description: t('status.rejected.description')
      }
    default:
      return {
        icon: ShieldAlert,
        label: t('status.unverified.label'),
        color: 'text-muted-foreground',
        badgeVariant: 'outline' as const,
        badgeClass: '',
        description: t('status.unverified.description')
      }
  }
}

export default async function ProfilePage({ searchParams }: ProfilePageProps)
{
  const supabase = await createClient()
  if (!supabase) {
    redirect('/login')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?redirect=/dashboard/profile')
  }

  const { tab } = await searchParams
  const defaultTab = tab === 'verification' ? 'verification' : 'personal'
  const t = await getTranslations('dashboardProfile')
  const locale = await getRequestLocale()

  // Get user profile
  const profile = await getProfileWithVerification(user.id)

  // Get staff profile
  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', user.id)
    .eq('is_active', true)
    .single()

  const isStaff = !!staffProfile

  const verificationStatus = profile?.verification_status as VerificationStatus | null
  const statusConfig = getVerificationStatusConfig(verificationStatus, t)
  const StatusIcon = statusConfig.icon

  const initials = profile?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || user.email?.[0].toUpperCase() || 'U'

  const memberSince = new Date(profile?.created_at || user.created_at || Date.now()).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  })

  // Check verification completeness (email + identity)
  const isEmailVerified = !!user.email_confirmed_at
  const isIdentityVerified = verificationStatus?.code === 'verified'
  const isFullyVerified = isEmailVerified && isIdentityVerified

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('description')}
        </p>
      </div>

      {/* Profile Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name} />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-xl">{profile?.full_name || 'Your Name'}</CardTitle>
                <CardDescription>{user.email}</CardDescription>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {isStaff ? (
                    <Badge className="bg-purple-600 gap-1 hover:bg-purple-700">
                      <Shield className="h-3 w-3" />
                      {staffProfile.role === 'admin' ? t('header.cannotBeVerified') : t('header.staff')}
                    </Badge>
                  ) : isFullyVerified ? (
                    <Badge className="bg-green-500 gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      {t('header.verified')}
                    </Badge>
                  ) : (
                    <>
                      {isEmailVerified && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <CheckCircle className="h-3 w-3" />
                          {t('header.email')}
                        </Badge>
                      )}
                      {isIdentityVerified && (
                        <Badge className="bg-green-500 text-xs gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          {t('header.identity')}
                        </Badge>
                      )}
                      {!isEmailVerified && !isIdentityVerified && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <ShieldAlert className="h-3 w-3" />
                          {t('header.notVerified')}
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div className="flex items-center gap-1 justify-end">
                <Calendar className="h-3 w-3" />
                {t('header.memberSince')}
              </div>
              <div className="font-medium text-foreground">{memberSince}</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="personal">{t('tabs.personal')}</TabsTrigger>
          <TabsTrigger value="verification" className="gap-1">
            {t('tabs.verification')}
            {!isFullyVerified && !isStaff && (
              <span className="ml-1 rtl:mr-1 rtl:ml-0 h-2 w-2 rounded-full bg-yellow-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="settings">{t('tabs.settings')}</TabsTrigger>
        </TabsList>

        {/* Personal Info Tab */}
        <TabsContent value="personal" className="space-y-6">
          {/* Editable Info */}
          <ProfileEditForm
            userId={user.id}
            initialData={{
              fullName: profile?.full_name || '',
              email: user.email || '',
              phone: profile?.phone || '',
              address: profile?.address || '',
              bio: profile?.bio || '',
            }}
          />

          {/* Non-editable Info (for reference) */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {t('personal.legalName.title')}
                </CardTitle>
                <CardDescription>
                  {t('personal.legalName.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{profile?.full_name || t('personal.legalName.notProvided')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {t('personal.emailAddress.title')}
                </CardTitle>
                <CardDescription>
                  {t('personal.emailAddress.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{user.email}</p>
                {isEmailVerified && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1 rtl:ml-1 rtl:mr-0" />
                    {t('header.verified')}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Verification Tab */}
        <TabsContent value="verification" className="space-y-6">
          {isStaff ? (
            <Card className="bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/40">
                    <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2 text-purple-900 dark:text-purple-100">
                      {t('verification.internalAccount.title')}
                      <Badge className="bg-purple-600 hover:bg-purple-700">
                        {staffProfile.role === 'admin' ? t('header.cannotBeVerified') : t('header.staff')}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-purple-700 dark:text-purple-300">
                      {t('verification.internalAccount.description')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium text-purple-900 dark:text-purple-100">{t('verification.internalAccount.bypassed')}</p>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      {t('verification.internalAccount.bypassedDesc')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Verification Status Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-full ${verificationStatus?.code === 'verified' ? 'bg-green-100' : verificationStatus?.code === 'rejected' ? 'bg-red-100' : 'bg-muted'}`}>
                      <StatusIcon className={`h-6 w-6 ${statusConfig.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {t('verification.identityVerification')}
                        <Badge className={statusConfig.badgeClass} variant={statusConfig.badgeVariant}>
                          {statusConfig.label}
                        </Badge>
                      </CardTitle>
                      <CardDescription>{statusConfig.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                {/* Show rejection reason if rejected */}
                {verificationStatus?.code === 'rejected' && profile?.verification_notes && (
                  <CardContent className="pt-0">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm font-medium text-red-800 mb-1">{t('verification.rejectionReason')}</p>
                      <p className="text-sm text-red-700">{profile.verification_notes}</p>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Verification Checklist */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('verification.requirements.title')}</CardTitle>
                  <CardDescription>{t('verification.requirements.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    {isEmailVerified ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">{t('verification.requirements.email')}</p>
                      <p className="text-sm text-muted-foreground">
                        {isEmailVerified ? t('verification.requirements.emailVerified') : t('verification.requirements.emailNotVerified')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isIdentityVerified ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : verificationStatus?.code === 'pending' ? (
                      <Clock className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">{t('verification.requirements.identity')}</p>
                      <p className="text-sm text-muted-foreground">
                        {isIdentityVerified
                          ? t('verification.requirements.identityVerified')
                          : verificationStatus?.code === 'pending'
                            ? t('verification.requirements.identityPending')
                            : t('verification.requirements.identityNotVerified')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Verification Form (only show if not verified or rejected) */}
              {(verificationStatus?.code !== 'verified' && verificationStatus?.code !== 'pending') && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <CardTitle className="text-base">{t('verification.submit.title')}</CardTitle>
                        <CardDescription>
                          {t('verification.submit.description')}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <IdentityVerificationForm userId={user.id} />
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Link href="/dashboard/profile/security">
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors h-full">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {t('settings.loginSecurity.title')}
                  </CardTitle>
                  <CardDescription>
                    {t('settings.loginSecurity.description')}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/dashboard/balance">
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors h-full">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    {t('settings.paymentsPayouts.title')}
                  </CardTitle>
                  <CardDescription>
                    {t('settings.paymentsPayouts.description')}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  {t('settings.notifications.title')}
                </CardTitle>
                <CardDescription>
                  {t('settings.notifications.description')}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
