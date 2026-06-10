'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { X, Tag, AlertCircle, Info, Megaphone, Bell } from 'lucide-react'
import { useLocale } from 'next-intl'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n/config'
import type { BannerConfig } from '@/types/site-settings'

interface BannersStackProps {
  banners: BannerConfig[]
}

const IconMap: Record<string, React.ElementType> = {
  Tag,
  AlertCircle,
  Info,
  Megaphone,
  Bell
}

export function BannersStack({ banners }: BannersStackProps) {
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const [closedBanners, setClosedBanners] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('closed_banners')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setClosedBanners(parsed)
      } catch {
        // ignore
      }
    }
     
    setMounted(true)
  }, [])

  if (!mounted || !banners || !Array.isArray(banners)) return null // Prevent hydration mismatch with sessionStorage

  const activeBanners = banners.filter(b => {
    if (!b.is_active || closedBanners.includes(b.id)) return false
    
    if (b.display_rule && b.display_rule.type !== 'all') {
      const paths = b.display_rule.paths.split(',').map(p => p.trim()).filter(Boolean)
      const isMatch = paths.some(p => {
        if (p === '/') return pathname === '/' || pathname === `/${locale}`
        return pathname.includes(p)
      })
      
      if (b.display_rule.type === 'include' && !isMatch) return false
      if (b.display_rule.type === 'exclude' && isMatch) return false
    }

    return true
  })

  const handleClose = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const updated = [...closedBanners, id]
    setClosedBanners(updated)
    sessionStorage.setItem('closed_banners', JSON.stringify(updated))
  }

  const getPresetClasses = (preset: string) => {
    switch (preset) {
      case 'primary': return 'bg-primary text-primary-foreground hover:bg-primary/90'
      case 'destructive': return 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
      case 'muted': return 'bg-muted text-muted-foreground hover:bg-muted/90'
      default: return 'bg-background text-foreground border-b hover:bg-muted/50'
    }
  }

  if (activeBanners.length === 0) return null

  return (
    <div className="w-full flex flex-col z-40 relative">
      {activeBanners.map((banner) => {
        const IconComponent = banner.icon && IconMap[banner.icon] 
          ? IconMap[banner.icon] 
          : null

        const innerContent = (
          <div className="container mx-auto flex items-center justify-center gap-3 relative py-2.5 px-4 min-h-[40px]">
            {IconComponent && <IconComponent className="h-4 w-4 shrink-0" />}
            <span className="text-sm font-medium tracking-wide text-center">
              {banner.text[locale] || banner.text.en || banner.text.ar}
            </span>
            {banner.is_closable && (
              <button 
                onClick={(e) => handleClose(banner.id, e)}
                className="absolute right-4 rtl:right-auto rtl:left-4 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                aria-label="Close banner"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )

        const containerClasses = cn(
          'w-full transition-all duration-300 relative group block',
          getPresetClasses(banner.preset),
          banner.advanced_classes
        )

        if (banner.link) {
          return (
            <Link key={banner.id} href={banner.link} className={containerClasses}>
              {innerContent}
            </Link>
          )
        }

        return (
          <div key={banner.id} className={containerClasses}>
            {innerContent}
          </div>
        )
      })}
    </div>
  )
}
