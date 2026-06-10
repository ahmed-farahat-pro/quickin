'use client'

import React, { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ListingSubNavProps {}

export function ListingSubNav({}: ListingSubNavProps) {
  const t = useTranslations('listingSubNav')
  const [activeSection, setActiveSection] = useState<string>('photos')
  const [isVisible, setIsVisible] = useState(false)

  const sections = React.useMemo(() => [
    { id: 'photos', label: t('photos') },
    { id: 'overview', label: t('overview') },
    { id: 'about', label: t('about') },
    { id: 'amenities', label: t('amenities') },
    { id: 'location', label: t('location') },
    { id: 'reviews', label: t('reviews') },
  ], [t])

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY

      // Show subnav only when we scroll past a certain threshold (e.g., 400px)
      setIsVisible(scrollPosition > 400)

      // Find active section
      const offset = 160 // height offset to trigger active state before the section hits absolute top
      let currentSection = sections[0].id

      for (const section of sections) {
        const el = document.getElementById(section.id)
        if (el && el.offsetTop - offset <= scrollPosition) {
          currentSection = section.id
        }
      }

      setActiveSection(currentSection)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    // Call once to set initial state
    handleScroll()
    
    return () => window.removeEventListener('scroll', handleScroll)
  }, [sections])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const top = el.offsetTop - 150 // adjust for sticky header + subnav height
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  return (
    <div 
      className={cn(
        "fixed top-20 left-0 right-0 z-40 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shadow-sm transform transition-all duration-300",
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <nav className="flex space-x-6 overflow-x-auto no-scrollbar scroll-smooth flex-1 min-w-0">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollTo(section.id)}
              className={cn(
                "whitespace-nowrap px-1 py-5 text-sm font-medium transition-colors border-b-2 hover:text-foreground",
                activeSection === section.id 
                  ? "border-primary text-foreground" 
                  : "border-transparent text-muted-foreground"
              )}
            >
              {section.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-4 ml-6 shrink-0">
          <Button onClick={() => scrollTo('book')}>{t('book')}</Button>
        </div>
      </div>
    </div>
  )
}
