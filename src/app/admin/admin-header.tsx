'use client'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { usePathname } from 'next/navigation'

interface StaffProfile {
  id: string
  role: string
  display_name: string
}

interface AdminHeaderProps {
  staff: StaffProfile
}

const routeTitles: Record<string, string> = {
  '/admin': 'Overview',
  '/admin/approvals': 'Pending Approvals',
  '/admin/listings': 'Listings',
  '/admin/users': 'Users',
  '/admin/staff': 'Staff Management',
}

export function AdminHeader({ staff }: AdminHeaderProps) {
  const pathname = usePathname()
  const title = routeTitles[pathname] || 'Admin'

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
          </BreadcrumbItem>
          {pathname !== '/admin' && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  )
}
