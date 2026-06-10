'use client'

import { Suspense, useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Lock, Unlock, Tag } from 'lucide-react'
import { SearchBar } from '@/components/features/search/search-bar'
import { useIntersectionSticky } from '@/hooks/use-intersection-sticky'
import type { FilterableAttribute } from '@/types'
import { SearchDestination } from '@/types/database'
import { cn } from '@/lib/utils'
import
{
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import type { Locale } from '@/i18n/config'
import { localizePathname } from '@/lib/i18n/pathname'
import { useUIStore } from '@/stores/ui-store'

interface StickySearchSectionV2Props
{
  showHero: boolean
  attributes?: FilterableAttribute[]
  destinations?: SearchDestination[]
}

export function StickySearchSectionV2({ showHero, attributes, destinations = [] }: StickySearchSectionV2Props)
{
  const locale = useLocale() as Locale
  const t = useTranslations('stickySearch')
  // Use Intersection Observer instead of scroll-based detection
  const [sentinelRef, isSticky] = useIntersectionSticky({
    rootMargin: showHero ? '-10% 0px 0px 0px' : '-80px 0px 0px 0px',
    threshold: 0,
    debounceMs: 100,
    throttleMs: 500,
  })

  // Lock logic to prevent "annoying" auto-expansion
  const [isLocked, setIsLocked] = useState(false)
  const [hasAutomaticallyLocked, setHasAutomaticallyLocked] = useState(false)

  // Auto-lock the first time it collapses
  useEffect(() =>
  {
    if (isSticky && !hasAutomaticallyLocked) {
      setIsLocked(true)
      setHasAutomaticallyLocked(true)
    }
  }, [isSticky, hasAutomaticallyLocked])

  const router = useRouter()
  const searchParams = useSearchParams()
  const currentLocation = searchParams.get('location')
  const isBestOfferActive = searchParams.get('bestOffer') === 'true'

  // ── Loading state ──────────────────────────────────────────────────────────
  // Set to true immediately before any router.push to show the overlay.
  // Cleared when searchParams change (i.e. the new page has resolved).
  const [isNavigating, setIsNavigating] = useState(false)
  const isGlobalLoading = useUIStore((state) => state.isAnyLoading())

  useEffect(() =>
  {
    // New search params means navigation completed — hide overlay
    setIsNavigating(false)
  }, [searchParams])

  /** Wraps every router.push to show the branded loading overlay */
  const navigate = (url: string) =>
  {
    setIsNavigating(true)
    if (url.startsWith('/')) {
      const [pathname, query = ''] = url.split('?')
      const localizedPath = localizePathname(pathname, locale)
      router.push(query ? `${localizedPath}?${query}` : localizedPath)
      return
    }
    router.push(url)
  }
  // ──────────────────────────────────────────────────────────────────────────

  const handleSelect = (dest: SearchDestination) =>
  {
    // Always use the english label for URL parameters to keep searches stable
    const locationValue = dest.en_label || dest.label
    const params = new URLSearchParams(searchParams.toString())
    if (currentLocation === locationValue) {
      params.delete('location')
      params.delete('view')
      navigate('/?' + params.toString())
    } else {
      params.set('location', locationValue)
      params.set('view', 'map')
      navigate('/?' + params.toString() + "#listings")
    }
  }

  // Expanded State: Large Cards / Collapsed State: Pills
  const isExpanded = showHero && !isSticky && !isLocked

  return (
    <>
      {/* Sentinel element for Intersection Observer - MUST be outside sticky container */}
      <div
        ref={sentinelRef}
        className="w-full h-0 pointer-events-none"
        aria-hidden="true"
      />

      <div className={cn(
        "sticky md:top-0 top-16 z-30 w-full transition-all duration-500 ease-in-out font-sans border-b border-[#E2D8C8]",
        isSticky ? "pt-2 pb-2 bg-[#F6F1E6]/98 backdrop-blur-md shadow-sm" : "pt-0 pb-12"
      )}>
        <div className="container mx-auto max-w-7xl px-4 flex flex-col items-center relative">

          {/* 1. Search Bar */}
          <div
            className="w-full hidden md:block z-50 flex justify-center transition-transform duration-500 ease-in-out relative group/search"
            style={{
              transform: isExpanded || isLocked ? 'translateY(-50%)' : 'translateY(0)',
            }}
          >
            <div className="w-full relative">
              <Suspense fallback={<div className='h-16 w-full max-w-4xl bg-white/50 rounded-full' />}>
                <SearchBar
                  variant='hero'
                  attributes={attributes}
                  destinations={destinations}
                  disableBoxShadow={isSticky}
                  onNavigate={() => setIsNavigating(true)}
                />
              </Suspense>
            </div>
          </div>

          {/* 3. Unified Destinations Carousel */}
          <div className={cn(
            "w-full transition-all duration-700 ease-spring relative",
            isExpanded ? "opacity-100 translate-y-0" : ""
          )}>
            <Carousel
              opts={{ align: "start", dragFree: true }}
              className="w-full"
            >
              <CarouselContent className={cn("pt-4", isExpanded ? "-ms-4" : "-ms-2")}>

                {/* Best Offers Pill — always first */}
                <CarouselItem className={cn(
                  "transition-all duration-500 ease-in-out",
                  isExpanded ? "ps-4 basis-[85%] md:basis-1/3 lg:basis-1/4" : "ps-2 basis-auto"
                )}>
                  <div
                    onClick={() =>
                    {
                      const params = new URLSearchParams(searchParams.toString())
                      if (isBestOfferActive) {
                        params.delete('bestOffer')
                      } else {
                        params.set('bestOffer', 'true')
                      }
                      params.delete('page')
                      navigate('/?' + params.toString())
                    }}
                    className={cn(
                      "cursor-pointer group relative overflow-hidden transition-all duration-500 ease-in-out",
                      isExpanded
                        ? "h-[300px] md:h-[420px] rounded-2xl border-0 bg-primary flex flex-col items-center justify-center"
                        : cn(
                          "h-10 rounded-full border px-5 flex items-center justify-center gap-2",
                          isBestOfferActive
                            ? "bg-primary text-primary-foreground border-primary shadow-lg"
                            : "bg-white/50 border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300"
                        )
                    )}
                  >
                    {isExpanded ? (
                      <div className="relative z-20 flex flex-col items-center justify-center h-full p-6 text-center">
                        <Tag className="h-10 w-10 text-primary-foreground/80 mb-4" />
                        <h3 className="text-2xl font-bold text-primary-foreground font-serif mb-2">{t('bestOffers')}</h3>
                        <p className="text-primary-foreground/80 text-sm">{t('bestOffersTagline')}</p>
                      </div>
                    ) : (
                      <>
                        <Tag className={cn("h-3.5 w-3.5", isBestOfferActive ? "text-primary-foreground" : "text-foreground")} />
                        <span className={cn(
                          "text-sm font-medium whitespace-nowrap",
                          isBestOfferActive ? "text-primary-foreground" : "text-foreground"
                        )}>
                          {t('bestOffers')}
                        </span>
                      </>
                    )}
                  </div>
                </CarouselItem>

                {destinations.map((dest) =>
                {
                  const locationValue = dest.en_label || dest.label
                  const isSelected = currentLocation === locationValue
                  return (
                    <CarouselItem
                      key={dest.id}
                      className={cn(
                        "transition-all duration-500 ease-in-out",
                        isExpanded ? "ps-4 basis-[85%] md:basis-1/3 lg:basis-1/4" : "ps-2 basis-auto"
                      )}
                    >
                      <div
                        onClick={() => handleSelect(dest)}
                        className={cn(
                          "cursor-pointer group relative overflow-hidden transition-all duration-500 ease-in-out",
                          isExpanded ? "h-[300px] md:h-[420px] rounded-2xl border-0" :
                            "h-10 rounded-full border px-5 flex items-center justify-center bg-white hover:bg-gray-50",
                          isSelected && !isExpanded ? "bg-[#2B2B2B] text-white hover:bg-black/90 border-[#2B2B2B]" : "bg-white/50 border-gray-200 shadow-sm"
                        )}
                      >
                        {/* Image Background (Expanded Only) */}
                        <div className={cn(
                          "absolute inset-0 transition-opacity duration-500",
                          isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
                        )}>
                          {dest.image_url && (
                            <Image
                              src={dest.image_url}
                              alt={dest.label}
                              fill
                              className="object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                          )}
                          <div className={cn("absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent", isSelected ? "ring-4 ring-[#E51D53] inset-0 z-10" : "")} />
                        </div>

                        {/* Content (Title) */}
                        <div className={cn(
                          "relative z-20 transition-all duration-500",
                          isExpanded ? "h-full flex flex-col justify-end p-6" : "p-0"
                        )}>
                          <h3 className={cn(
                            "font-bold transition-all duration-500",
                            isExpanded ? "text-2xl text-white mb-2 font-serif" :
                              isSelected ? "text-sm text-white font-medium" : "text-sm text-[#7A746A] font-medium"
                          )}>
                            {dest.label}
                          </h3>
                          <div className={cn(
                            "text-white/90 text-sm transform transition-all duration-500 flex items-center gap-2",
                            isExpanded ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 hidden"
                          )}>
                            <span className="flex items-center gap-1" />
                          </div>
                        </div>
                      </div>
                    </CarouselItem>
                  )
                })}
              </CarouselContent>

              {isExpanded && <CarouselPrevious className="start-6 !bg-white/90 !text-black border-0 shadow-lg h-12 w-12" />}
              {isExpanded && <CarouselNext className="end-6 !bg-white/90 !text-black border-0 shadow-lg h-12 w-12" />}
            </Carousel>

            {/* Lock Button */}
            <Button
              onClick={(e) => { e.stopPropagation(); setIsLocked(!isLocked) }}
              variant="outline"
              title={isLocked ? t('unlock') : t('lock')}
              className={cn(
                "absolute bottom-0 end-2 z-50",
                "rounded-full px-4 py-3 h-auto text-sm font-medium",
                "transition-all duration-300 active:scale-95",
                "hidden md:flex items-center gap-2",
              )}
            >
              {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </Button>
          </div>

          {/* 2. Header Text (Expanded Only) */}
          <div className={cn(
            "text-center transition-all duration-500 overflow-hidden flex flex-col items-center gap-2",
            isExpanded ? "opacity-100 max-h-[200px] mt-4 mb-2" : "opacity-0 hidden"
          )}>
            <h2 className="text-3xl md:text-4xl font-medium text-[#2B2B2B] tracking-tight font-serif">
              {t('discoverTitle')}
            </h2>
            <p className="text-[#7A746A] max-w-2xl text-sm md:text-base">
              {t('discoverDescription')}
            </p>
          </div>

        </div>
      </div>

      {/* ── Branded Loading Overlay — shown during search / filter navigation ── */}
      {(isNavigating || isGlobalLoading) && (
        <div
          aria-live="polite"
          aria-label="Loading search results"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        >
          {/* Animated brand logo */}
          <div className="relative mb-6">
            <svg
              viewBox="0 0 32 32"
              xmlns="http://www.w3.org/2000/svg"
              className="h-14 w-14 text-primary animate-pulse"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M16 1C7.716 1 1 7.716 1 16s6.716 15 15 15 15-6.716 15-15S24.284 1 16 1zm0 27.5c-6.893 0-12.5-5.607-12.5-12.5S9.107 3.5 16 3.5 28.5 9.107 28.5 16 22.893 28.5 16 28.5zM16 8a8 8 0 100 16 8 8 0 000-16z" />
            </svg>
            {/* Spinning ring */}
            <div className="absolute inset-0 -m-2">
              <LoadingSpinner size="lg" className="h-[4.5rem] w-[4.5rem]" />
            </div>
          </div>

          <p className="text-xl font-bold text-primary mb-1">QuickIn</p>
          <p className="text-background/90 text-sm animate-pulse">{t('loadingResults')}</p>

          {/* Bouncing dots */}
          <div className="flex gap-1.5 mt-5" aria-hidden="true">
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}
    </>
  )
}
