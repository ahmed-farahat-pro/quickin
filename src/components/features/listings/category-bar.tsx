// =============================================================================
// CATEGORY BAR COMPONENT
// =============================================================================
// Description: Horizontal scrollable category filter with pill-style buttons
// Features: URL-based filtering with loading indicator during transitions
// =============================================================================

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useTransition, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import
{
  Waves,
  Mountain,
  Building2,
  TreePine,
  Palmtree,
  Anchor,
  Snowflake,
  Tent,
  Sun,
  Wind,
  Castle,
  Gem,
  Flame,
  Home,
  Sparkles,
  Ship,
  PartyPopper,
  Car
} from 'lucide-react'
import type { Locale } from '@/i18n/config'
import { localizePathname } from '@/lib/i18n/pathname'

// Icon mapping from DB string to Component
const iconMap: Record<string, React.ElementType> = {
  'Waves': Waves,
  'Mountain': Mountain,
  'Building2': Building2,
  'TreePine': TreePine,
  'Palmtree': Palmtree,
  'Anchor': Anchor,
  'Snowflake': Snowflake,
  'Tent': Tent,
  'Sun': Sun,
  'Wind': Wind,
  'Castle': Castle,
  'Gem': Gem,
  'Flame': Flame,
  'Home': Home,
  'Sparkles': Sparkles,
  'Ship': Ship,
  'PartyPopper': PartyPopper,
  'Car': Car
}

interface LifestyleCategory
{
  id: string
  name: string
  slug: string
  icon: string
  is_special: boolean
  display_order: number
}

interface CategoryBarProps
{
  showOffersButton?: boolean // Kept for compatibility, but ignored
}

export function CategoryBar({ showOffersButton: _ignored }: CategoryBarProps)
{
  const locale = useLocale() as Locale
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeCategory = searchParams.get('category')
  const [isPending, startTransition] = useTransition()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const [categories, setCategories] = useState<LifestyleCategory[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch categories from DB
  useEffect(() =>
  {
    const fetchCategories = async () =>
    {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('lifestyle_categories')
        .select('id, name, slug, icon, is_special, display_order')
        .order('display_order', { ascending: true })

      if (data) {
        setCategories(data.map(c => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          icon: c.icon,
          is_special: c.is_special,
          display_order: c.display_order
        })))
      }
      setLoading(false)
    }

    fetchCategories()
  }, [])

  /**
   * Enable mouse wheel horizontal scrolling on desktop
   */
  useEffect(() =>
  {
    const scrollContainer = scrollContainerRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (!scrollContainer) return

    const handleWheel = (e: Event) =>
    {
      const wheelEvent = e as WheelEvent
      // Only convert vertical scroll to horizontal if not already scrolling horizontally
      if (Math.abs(wheelEvent.deltaX) > Math.abs(wheelEvent.deltaY)) return

      e.preventDefault()
      scrollContainer.scrollLeft += wheelEvent.deltaY
    }

    scrollContainer.addEventListener('wheel', handleWheel, { passive: false })
    return () => scrollContainer.removeEventListener('wheel', handleWheel)
  }, [loading]) // Re-bind if loading changes (content rendered)

  /**
   * Handle category click - updates URL params with loading state
   */
  const handleCategoryClick = (categorySlug: string) =>
  {
    const params = new URLSearchParams(searchParams.toString())

    if (activeCategory === categorySlug) {
      params.delete('category')
    } else {
      params.set('category', categorySlug)
    }

    params.delete('page')

    startTransition(() =>
    {
      router.push(`${localizePathname('/', locale)}?${params.toString()}`)
    })
  }

  /**
   * Expose isPending for parent components
   */
  const isLoading = isPending

  if (loading) {
    return <div className="h-16 bg-[#F6F1E6] border-b border-[#E2D8C8] animate-pulse" />
  }

  return (
    <div className='bg-[#F6F1E6] border-b border-[#E2D8C8] relative'>
      {/* isPending state exposed for parent via data attribute */}
      <div data-loading={isPending ? 'true' : 'false'} className='hidden' />

      <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
        <ScrollArea ref={scrollContainerRef} className='w-full whitespace-nowrap'>
          <div className='flex items-center gap-3 py-2'>
            {categories.map((cat) =>
            {
              const Icon = iconMap[cat.icon] || Home // Fallback icon
              const isActive = activeCategory === cat.slug
              const isSpecial = cat.is_special

              return (
                <Button
                  key={cat.id}
                  variant={isActive ? 'default' : 'outline'}
                  size='sm'
                  className={`flex items-center gap-2 rounded-full px-4 py-2 h-auto transition-all shrink-0 ${isActive && isSpecial
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md hover:from-amber-600 hover:to-orange-600 border-0'
                    : isActive
                      ? 'bg-[#5B0F16] text-[#F6F1E6] shadow-md hover:bg-[#5B0F16]/90'
                      : isSpecial
                        ? 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-300 hover:from-amber-100 hover:to-orange-100 hover:border-amber-400'
                        : 'bg-white text-[#7A746A] border-[#E2D8C8] hover:text-[#2B2B2B] hover:bg-[#EFE6D8] hover:border-[#2B2B2B]/20'
                    }`}
                  onClick={() => handleCategoryClick(cat.slug)}
                  disabled={isPending}
                >
                  <Icon className={`h-4 w-4 ${isSpecial && !isActive ? 'text-amber-500' : ''}`} />
                  <span className='text-sm font-medium'>{cat.name}</span>
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

// Export isPending hook for use by parent components
export { useTransition }
