'use client'

import { useRef, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useDirection } from '@radix-ui/react-direction'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MapPin, Loader2 } from 'lucide-react'
import type { Locale } from '@/i18n/config'
import { localizePathname } from '@/lib/i18n/pathname'

import { DESTINATIONS } from './destinations-data'

interface DestinationBarProps
{
  isSticky?: boolean
  isLoading?: boolean // parent can pass generic loading or we handle it internally
}

export function DestinationBar({ isSticky = false }: DestinationBarProps)
{
  const locale = useLocale() as Locale
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeLocation = searchParams.get('location')
  const [isPending, setIsPending] = useState(false)
  const direction = useDirection()

  // Ref for drag-to-scroll
  const scrollRef = useRef<HTMLDivElement>(null)
  const isDown = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)

  // Auto-scroll management (Mouse Drag)
  useEffect(() =>
  {
    const slider = scrollRef.current
    if (!slider) return

    const mouseDown = (e: MouseEvent) =>
    {
      isDown.current = true
      slider.classList.add('cursor-grabbing')
      slider.classList.remove('cursor-grab')
      startX.current = e.pageX - slider.offsetLeft
      scrollLeft.current = slider.scrollLeft
    }
    const mouseLeave = () =>
    {
      isDown.current = false
      slider.classList.remove('cursor-grabbing')
      slider.classList.add('cursor-grab')
    }
    const mouseUp = () =>
    {
      isDown.current = false
      slider.classList.remove('cursor-grabbing')
      slider.classList.add('cursor-grab')
    }
    const mouseMove = (e: MouseEvent) =>
    {
      if (!isDown.current) return
      e.preventDefault()
      const x = e.pageX - slider.offsetLeft
      const walk = (x - startX.current) * 2 // Scroll-fast
      const multiplier = direction === 'rtl' ? -1 : 1
      slider.scrollLeft = scrollLeft.current - (walk * multiplier)
    }

    slider.addEventListener('mousedown', mouseDown)
    slider.addEventListener('mouseleave', mouseLeave)
    slider.addEventListener('mouseup', mouseUp)
    slider.addEventListener('mousemove', mouseMove)

    return () =>
    {
      slider.removeEventListener('mousedown', mouseDown)
      slider.removeEventListener('mouseleave', mouseLeave)
      slider.removeEventListener('mouseup', mouseUp)
      slider.removeEventListener('mousemove', mouseMove)
    }
  }, [isSticky]) // Re-bind if view changes, though typically elements unmount

  const handleSelect = (destination: typeof DESTINATIONS[0]) =>
  {
    setIsPending(true)
    const params = new URLSearchParams(searchParams.toString())

    if (activeLocation === destination.label) {
      params.delete('location')
    } else {
      params.set('location', destination.label)
    }

    params.delete('page')

    // Smooth transition
    router.push(`${localizePathname('/', locale)}?${params.toString()}`, { scroll: false })

    // Artificial timeout to mimic loading if transition is too fast, 
    // or just reset when next params match (useEffect could handle this)
    setTimeout(() => setIsPending(false), 1000)
  }

  // --- RENDERING ---

  // 1. STICKY / COMPACT VIEW (Pill Buttons)
  // Copies styling from original CategoryBar
  if (isSticky) {
    return (
      <div className='bg-[#F6F1E6] border-b border-[#E2D8C8] relative transition-all duration-300'>
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <ScrollArea className='w-full whitespace-nowrap'>
            <div className='flex items-center gap-3 py-3'>
              {DESTINATIONS.map((dest) =>
              {
                const isActive = activeLocation === dest.label
                return (
                  <Button
                    key={dest.id}
                    variant={isActive ? 'default' : 'outline'}
                    size='sm'
                    className={cn(
                      "flex items-center gap-2 rounded-full px-4 py-2 h-auto transition-all shrink-0",
                      isActive
                        ? "bg-[#5B0F16] text-[#F6F1E6] shadow-md hover:bg-[#5B0F16]/90"
                        : "bg-white text-[#7A746A] border-[#E2D8C8] hover:text-[#2B2B2B] hover:bg-[#EFE6D8] hover:border-[#2B2B2B]/20"
                    )}
                    onClick={() => handleSelect(dest)}
                    disabled={isPending}
                  >
                    {isPending && isActive && <Loader2 className="h-3 w-3 animate-spin" />}
                    <span className='text-sm font-medium'>{dest.label}</span>
                  </Button>
                )
              })}
            </div>
            <ScrollBar orientation='horizontal' className='invisible' />
          </ScrollArea>
        </div>
      </div>
    )
  }

  // 2. HERO / EXPANDED VIEW (Cards Carousel)
  // 4 Cards per screen on desktop
  return (
    <div className="w-full bg-[#F6F1E6] py-6 border-b border-[#E2D8C8] transition-all duration-500">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 cursor-grab scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {DESTINATIONS.map((dest) =>
          {
            const isActive = activeLocation === dest.label
            return (
              <div
                key={dest.id}
                onClick={() => handleSelect(dest)}
                className={cn(
                  "relative flex-shrink-0 snap-start transition-all duration-300 rounded-xl overflow-hidden cursor-pointer group select-none",
                  // 4 per row on lg screens (approx 25% width minus gap)
                  "w-[280px] h-[320px] lg:w-[calc(25%-12px)]",
                  isActive ? "ring-4 ring-[#5B0F16] ring-offset-2" : "hover:shadow-xl hover:-translate-y-1"
                )}
              >
                <Image
                  src={dest.image}
                  alt={dest.label}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />

                <div className="absolute bottom-0 start-0 p-6 w-full">
                  <h3 className="text-white text-2xl font-bold font-serif mb-1">{dest.label}</h3>
                  <div className="flex items-center text-white/90 text-sm">
                    {isActive ? (
                      <span className="flex items-center gap-1 text-amber-400 font-medium">
                        <MapPin className="w-4 h-4" /> Selected
                      </span>
                    ) : (
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Explore properties &rarr;
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
