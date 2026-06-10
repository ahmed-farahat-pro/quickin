"use client"

import * as React from "react"
import Link from "next/link"
import {
  Home,
  type LucideIcon,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

// Types
export interface SidebarUser {
  name: string
  email: string
  avatar?: string
}

export interface NavItem {
  title: string
  url: string
  icon: LucideIcon
  isActive?: boolean
  items?: { title: string; url: string }[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export type SidebarRole = 'admin' | 'user'
export type StaffRole = 'admin' | 'moderator' | null

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: SidebarUser
  groups: NavGroup[]
  brand?: {
    name: string
    url: string
    subtitle?: string
  }
}

export function AppSidebar({ user, groups, brand, ...props }: AppSidebarProps) {
  const defaultBrand = {
    name: 'QuickIn',
    url: '/',
    subtitle: 'Dashboard'
  }
  
  const currentBrand = brand || defaultBrand

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={currentBrand.url}>
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Home className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{currentBrand.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {currentBrand.subtitle}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
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
