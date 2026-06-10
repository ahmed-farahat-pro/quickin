'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import
{
  LayoutDashboard,
  Users,
  Home,
  CheckSquare,
  UserCog,
  ChevronDown,
  UserCheck,
  DollarSign,
  Wallet,
  Smartphone,
  CreditCard,
  AlertTriangle,
  FileText,
  ShieldCheck,
  ArrowLeftRight,
  ChevronRight,
  Package,
  Tag,
  FileSignature,
  MessageSquare,
  Ban,
  Settings,
  CalendarCheck,
} from 'lucide-react'
import
{
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar'
import
{
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface StaffProfile
{
  id: string
  role: string
  display_name: string
}

interface AdminSidebarProps
{
  staff: StaffProfile
}

const overviewNavItems = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
]

const contentNavItems = [
  {
    title: 'Listings',
    href: '/admin/listings',
    icon: Home,
  },
  {
    title: 'Attributes',
    href: '/admin/attributes',
    icon: Package,
  },
  {
    title: 'Conditions',
    href: '/admin/conditions',
    icon: FileSignature,
  },
  {
    title: 'Cancellation Policies',
    href: '/admin/cancellation-policies',
    icon: FileText,
  },
  {
    title: 'Best Offers',
    href: '/admin/offers',
    icon: Tag,
  },
  {
    title: 'Destinations',
    href: '/admin/destinations',
    icon: Home, // Using Home icon temporarily or MapPin if available
  },
  {
    title: 'Locations',
    href: '/admin/locations',
    icon: Home, // Using Home icon temporarily
  },
  {
    title: 'Hosts',
    href: '/admin/hosts',
    icon: UserCheck,
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: Users,
  },
]

const financeNavItems = [
  {
    title: 'Financials',
    href: '/admin/financials',
    icon: DollarSign,
  },
  {
    title: 'Payouts',
    href: '/admin/payouts',
    icon: Wallet,
  },
  {
    title: 'Payments',
    href: '/admin/payments',
    icon: CreditCard,
  },
  {
    title: 'Mobile Wallets',
    href: '/admin/wallets',
    icon: Smartphone,
  },
]

const supportNavItems = [
  {
    title: 'Bookings',
    href: '/admin/bookings',
    icon: CalendarCheck,
  },
  {
    title: 'Approvals',
    href: '/admin/approvals',
    icon: CheckSquare,
  },
  {
    title: 'Verifications',
    href: '/admin/verifications',
    icon: ShieldCheck,
  },
  {
    title: 'Disputes',
    href: '/admin/disputes',
    icon: AlertTriangle,
  },
  {
    title: 'Reviews',
    href: '/admin/reviews',
    icon: MessageSquare,
  },
  {
    title: 'Comments',
    href: '/admin/comments',
    icon: MessageSquare,
  },
  {
    title: 'Bans',
    href: '/admin/bans',
    icon: Ban,
  },
  {
    title: 'Refunds',
    href: '/admin/refunds',
    icon: AlertTriangle,
  },
]

const systemNavItems = [
  {
    title: 'Site Settings',
    href: '/admin/settings/site',
    icon: Settings,
    adminOnly: true,
  },
  {
    title: 'Audit Logs',
    href: '/admin/audit',
    icon: FileText,
  },
  {
    title: 'Commissions',
    href: '/admin/settings/commissions',
    icon: DollarSign, // use existing imported icon
    adminOnly: true,
  },
  {
    title: 'Booking Times',
    href: '/admin/settings/bookings',
    icon: CheckSquare, // use existing imported icon
    adminOnly: true,
  },
  {
    title: 'Staff',
    href: '/admin/staff',
    icon: UserCog,
    adminOnly: true,
  },
]

export function AdminSidebar({ staff }: AdminSidebarProps)
{
  const pathname = usePathname()
  const isAdmin = staff.role === 'admin'
  const initials = staff.display_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <span className="font-semibold">Admin Dashboard</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between cursor-pointer">
                Overview
                <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {overviewNavItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={pathname === item.href || pathname.startsWith(item.href + '/')}>
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between cursor-pointer">
                Content
                <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {contentNavItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={pathname === item.href || pathname.startsWith(item.href + '/')}>
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between cursor-pointer">
                Finance
                <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {financeNavItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={pathname === item.href || pathname.startsWith(item.href + '/')}>
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between cursor-pointer">
                Support
                <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {supportNavItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={pathname === item.href || pathname.startsWith(item.href + '/')}>
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between cursor-pointer">
                System
                <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {systemNavItems
                    .filter((item) => !item.adminOnly || isAdmin)
                    .map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={pathname === item.href || pathname.startsWith(item.href + '/')}>
                          <Link href={item.href}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <SidebarGroup>
          <SidebarGroupLabel>User View</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard">
                    <ArrowLeftRight className="h-4 w-4" />
                    <span>Switch to User Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button suppressHydrationWarning className="flex w-full items-center gap-2 rounded-lg p-2 hover:bg-accent">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col items-start text-sm">
                <span className="font-medium">{staff.display_name}</span>
                <span className="text-xs text-muted-foreground capitalize">{staff.role}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/">Back to Site</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
