'use client'

import { useState, Suspense } from 'react'
import { SearchBar } from '@/components/features/search/search-bar'
import { DestinationBar } from '@/components/features/search/destination-bar'
import { useScroll } from '@/hooks/use-scroll'
import type { FilterableAttribute } from '@/types'

interface StickySearchSectionProps {
  showHero: boolean
  attributes?: FilterableAttribute[]
}

export function StickySearchSection({ showHero, attributes }: StickySearchSectionProps) {
  const [isSticky, setIsSticky] = useState(false)

  useScroll(() => {
    const scrollY = window.scrollY
    // If hero is shown, wait for hero height. If not, sticky almost immediately.
    const threshold = showHero ? (window.innerHeight * 0.9 - 160) : 50
    setIsSticky(scrollY > threshold)
  })

  return (
    <div className='sticky top-20 z-30'>
      {/* Category Bar */}
      <div 
        style={{
          background: 'rgba(246, 241, 230, 0.98)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        }}
      >
        <div 
        className="py-2 px-4 hidden md:block transition-transform duration-300 ease-in-out relative z-40"
        style={{
          transform: showHero && !isSticky ? 'translateY(-50%)' : 'translateY(0)',
        }}
      >
        <Suspense fallback={<div className='h-16 bg-white/50 rounded-full max-w-4xl mx-auto animate-pulse' />}>
          <SearchBar variant='hero' attributes={attributes} />
        </Suspense>
      </div>
        <Suspense fallback={<div className='h-16 bg-background border-b' />}>
          {/* DestinationBar handles its own transform (Carousel -> Pills) based on isSticky */}
          <DestinationBar isSticky={isSticky} />
        </Suspense>
      </div>
    </div>
  )
}
