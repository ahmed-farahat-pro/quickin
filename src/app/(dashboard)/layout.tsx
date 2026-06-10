import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { UserSidebar, type StaffRole } from '@/components/user-sidebar'
import { Separator } from '@/components/ui/separator'
import { DashboardFooter } from '@/components/layout/dashboard-footer'
import { getRequestLocale } from '@/i18n/request-locale'
import { getDirection } from '@/i18n/config'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from '@/components/ui/breadcrumb'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  if (!supabase) {
    redirect('/login')
  }

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?redirect=/dashboard')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .single()

  // Check if user is staff (to show Admin link in sidebar)
  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', user.id)
    .eq('is_active', true)
    .single()

  const staffRole: StaffRole = staffProfile?.role as StaffRole || null

  const locale = await getRequestLocale()
  const dir = getDirection(locale)

  const sidebarUser = {
    name: profile?.full_name || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    avatar: profile?.avatar_url || undefined,
  }

  return (
    <SidebarProvider>
      <UserSidebar user={sidebarUser} staffRole={staffRole} />
      <SidebarInset className="flex flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard">
                    {locale === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <main className="flex-1 p-6">
          {children}
        </main>
        <DashboardFooter />
      </SidebarInset>
    </SidebarProvider>
  )
}
