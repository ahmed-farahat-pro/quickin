'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  User, 
  Calendar, 
  Heart, 
  Home, 
  Settings,
  CreditCard,
  Shield,
  Bell,
  ClipboardList
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  {
    title: 'Account',
    items: [
      { label: 'Personal info', href: '/dashboard', icon: User },
      { label: 'Login & security', href: '/dashboard/security', icon: Shield },
      { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    ],
  },
  {
    title: 'Trips & Favorites',
    items: [
      { label: 'Your trips', href: '/dashboard/trips', icon: Calendar },
      { label: 'Wishlists', href: '/dashboard/wishlists', icon: Heart },
    ],
  },
  {
    title: 'Hosting',
    items: [
      { label: 'Manage listings', href: '/dashboard/listings', icon: Home },
      { label: 'Booking requests', href: '/dashboard/bookings', icon: ClipboardList },
      { label: 'Payments', href: '/dashboard/payments', icon: CreditCard },
    ],
  },
]

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="space-y-6">
      <h2 className="text-2xl font-semibold">Account</h2>
      
      {navItems.map((section) => (
        <div key={section.title}>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            {section.title}
          </h3>
          <ul className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
