import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AdminSidebar } from './admin-sidebar'
import { NotificationBell } from '@/components/admin/notification-bell'
import { Separator } from '@/components/ui/separator'
import { DashboardFooter } from '@/components/layout/dashboard-footer'
import { getRequestLocale } from '@/i18n/request-locale'
import { getDirection } from '@/i18n/config'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export default async function AdminLayout({
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
    redirect('/login')
  }

  // Check if user is staff
  const { data: staffProfile, error: staffError } = await supabase
    .from('staff_profiles')
    .select('id, role, display_name, is_active, email')
    .eq('id', user.id)
    .eq('is_active', true)
    .single()

  if (staffError) {
    console.error('Staff profile error:', staffError)
  }

  if (!staffProfile) {
    redirect('/')
  }

  const locale = await getRequestLocale()
  const dir = getDirection(locale)

  return (
    <SidebarProvider>
      <AdminSidebar staff={staffProfile} />
      <SidebarInset className="flex flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b pr-4">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/admin">
                    {locale === 'ar' ? 'الإدارة' : 'Admin'}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{locale === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
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
