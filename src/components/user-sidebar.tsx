"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import
  {
    Home,
    Building2,
    CalendarCheck,
    Heart,
    Plane,
    User,
    LayoutDashboard,
    Shield,
    Wallet,
    type LucideIcon,
  } from "lucide-react"

import { cn } from "@/lib/utils"
import { localizePathname } from "@/lib/i18n/pathname"
import type { Locale } from "@/i18n/config"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import
  {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    useSidebar,
  } from "@/components/ui/sidebar"

// Types matching those in app-sidebar or layout
export interface SidebarUser
{
  name: string
  email: string
  avatar?: string
}

export interface NavItem
{
  title: string
  url: string
  icon: LucideIcon
  isActive?: boolean
  items?: { title: string; url: string }[]
}

export interface NavGroup
{
  label: string
  items: NavItem[]
}

export type StaffRole = 'admin' | 'moderator' | null

interface UserSidebarProps extends React.ComponentProps<typeof Sidebar>
{
  user: SidebarUser
  staffRole?: StaffRole
}

export function UserSidebar({ user, staffRole, ...props }: UserSidebarProps)
{
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const t = useTranslations('dashboard')

  const getLocalizedUrl = (url: string) => localizePathname(url, locale)

  // User dashboard - organized by Dashboard, Account, Guest, Host
  const navGroups: NavGroup[] = [
    {
      label: t('groups.dashboard'),
      items: [
        {
          title: t('items.overview'),
          url: getLocalizedUrl("/dashboard"),
          icon: LayoutDashboard,
          isActive: pathname === getLocalizedUrl('/dashboard'),
        },
      ],
    },
    {
      label: t('groups.account'),
      items: [
        {
          title: t('items.personalInfo'),
          url: getLocalizedUrl("/dashboard/profile"),
          icon: User,
          isActive: pathname === getLocalizedUrl('/dashboard/profile'),
        },
      ],
    },
    {
      label: t('groups.guest'),
      items: [
        {
          title: t('items.trips'),
          url: getLocalizedUrl("/dashboard/trips"),
          icon: Plane,
          isActive: pathname === getLocalizedUrl('/dashboard/trips'),
        },
        {
          title: t('items.wishlists'),
          url: getLocalizedUrl("/dashboard/wishlists"),
          icon: Heart,
          isActive: pathname === getLocalizedUrl('/dashboard/wishlists'),
        },
      ],
    },
    {
      label: t('groups.host'),
      items: [
        {
          title: t('items.myListings'),
          url: getLocalizedUrl("/dashboard/listings"),
          icon: Building2,
          isActive: pathname.startsWith(getLocalizedUrl('/dashboard/listings')),
          items: [
            { title: t('items.allListings'), url: getLocalizedUrl("/dashboard/listings") },
            { title: t('items.createNew'), url: getLocalizedUrl("/dashboard/listings/create") },
          ],
        },
        {
          title: t('items.bookings'),
          url: getLocalizedUrl("/dashboard/bookings"),
          icon: CalendarCheck,
          isActive: pathname === getLocalizedUrl('/dashboard/bookings'),
        },
        {
          title: t('items.balance'),
          url: getLocalizedUrl("/dashboard/balance"),
          icon: Wallet,
          isActive: pathname === getLocalizedUrl('/dashboard/balance'),
        },
      ],
    },
  ]

  // Add Admin group if user is staff
  if (staffRole) {
    navGroups.push({
      label: t(staffRole === 'admin' ? 'groups.admin' : 'groups.staff'),
      items: [
        {
          title: t(staffRole === 'admin' ? 'items.adminDashboard' : 'items.moderatorPanel'),
          url: getLocalizedUrl("/admin"),
          icon: Shield,
          isActive: pathname.startsWith(getLocalizedUrl('/admin')),
        },
      ],
    })
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Home className="size-4" />
                </div>
                <div className="grid flex-1 text-sm leading-tight text-left rtl:text-right">
                  <span className="truncate font-medium">QuickIn</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t('yourDashboard')}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <NavMain key={group.label} items={group.items} label={group.label} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
