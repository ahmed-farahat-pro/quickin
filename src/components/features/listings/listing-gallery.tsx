'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { 
  Grid, 
  Tag, 
  X, 
  Home, 
  Armchair, 
  Bed, 
  Bath, 
  Tv, 
  Utensils 
} from 'lucide-react'
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"
import type { ListingImage, ImageCategory } from '@/types'

// Add thumbnails plugin (optional, but good for navigation)
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails"
import "yet-another-react-lightbox/plugins/thumbnails.css"
import Counter from "yet-another-react-lightbox/plugins/counter"
import "yet-another-react-lightbox/plugins/counter.css"
import Captions from "yet-another-react-lightbox/plugins/captions"
import "yet-another-react-lightbox/plugins/captions.css"

interface ListingGalleryProps {
  title: string
  images: string[] // Deprecated simple array
  listingImages?: ListingImage[] // New categorized array
}

// Map database icon strings to Lucide components
const ICON_MAP: Record<string, React.ElementType> = {
  Home,
  Armchair,
  Bed,
  Bath,
  Tv,
  Utensils,
  Grid
}

// Sort orders for categories (could also come from DB if added order column)
const CATEGORY_ORDER = ['exterior', 'living', 'bedroom', 'kitchen', 'bathroom', 'interior', 'other']

export function ListingGallery({ title, images, listingImages }: ListingGalleryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)

  // Use listingImages if available, falling back to mapping simple images array to 'other'
  const galleryImages = listingImages && listingImages.length > 0
    ? listingImages.map(img => ({
        src: img.url,
        category: img.category,
        label: img.category_details?.label || img.category,
        iconName: img.category_details?.icon || 'Grid',
        caption: img.caption
      }))
    : images.map(url => ({
        src: url,
        category: 'other',
        label: 'Other',
        iconName: 'Grid',
        caption: null
      }))

  // Sort images so categories are grouped
  const sortedImages = [...galleryImages].sort((a, b) => {
    const indexA = CATEGORY_ORDER.indexOf(a.category)
    const indexB = CATEGORY_ORDER.indexOf(b.category)
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
  })

  // Display first 5 images in the main grid
  const displayImages = sortedImages.slice(0, 5)

  // Special case: Single image layout
  if (displayImages.length === 1) {
    return (
      <>
        <div className="w-full h-[400px] md:h-[550px] relative rounded-xl overflow-hidden mb-8 cursor-pointer group" onClick={() => { setPhotoIndex(0); setIsOpen(true) }}>
          <Image
            src={displayImages[0]?.src || '/placeholder.png'}
            alt={`${title} - Main`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            priority
          />
          <Button 
            variant="secondary" 
            size="sm" 
            className="absolute bottom-4 right-4 gap-2 shadow-lg"
          >
            <Grid className="h-4 w-4" />
            Show photos
          </Button>
        </div>

        <Lightbox
          open={isOpen}
          close={() => setIsOpen(false)}
          index={photoIndex}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          slides={sortedImages.map(img => ({ 
            src: img.src, 
            title: img.label, 
            description: img.caption,
            iconName: img.iconName
          } as any))}
          plugins={[Thumbnails, Counter]}
          render={{
            slideFooter: ({ slide }) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const customSlide = slide as any
              const Icon = ICON_MAP[customSlide.iconName] || Grid
              
              return (
                <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center justify-center text-center pb-4 z-50 pointer-events-none">
                   <div className="bg-black/50 backdrop-blur-md px-6 py-3 rounded-full flex items-center gap-2 text-white font-semibold border border-white/10 shadow-xl">
                      <Icon className="w-5 h-5" />
                      <span>{customSlide.title}</span>
                   </div>
                   {customSlide.description && (
                     <p className="mt-2 text-white/80 text-sm max-w-md bg-black/40 px-3 py-1 rounded-md">
                       {customSlide.description}
                     </p>
                   )}
                </div>
              )
            }
          }}
        />
      </>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-xl overflow-hidden mb-8 relative">
        {/* Main large image */}
        <div className="md:col-span-2 md:row-span-2 relative aspect-square md:aspect-auto h-[400px] md:h-auto cursor-pointer" onClick={() => { setPhotoIndex(0); setIsOpen(true) }}>
          <Image
            src={displayImages[0]?.src || '/placeholder.png'}
            alt={`${title} - Main`}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
            priority
          />
        </div>

        {/* Small grid images */}
        <div className="hidden md:grid grid-cols-2 col-span-2 row-span-2 gap-2 h-full">
            {displayImages.slice(1).map((img, idx) => (
                <div key={idx} className="relative aspect-square cursor-pointer" onClick={() => { setPhotoIndex(idx + 1); setIsOpen(true) }}>
                    <Image
                        src={img.src}
                        alt={`${title} - ${img.category}`}
                        fill
                        className="object-cover hover:scale-105 transition-transform duration-300"
                    />
                </div>
            ))}
        </div>

        {/* Show all photos button */}
        <Button 
          variant="secondary" 
          size="sm" 
          className="absolute bottom-4 right-4 gap-2 shadow-lg"
          onClick={() => setIsOpen(true)}
        >
          <Grid className="h-4 w-4" />
          Show all photos
        </Button>
      </div>

      <Lightbox
        open={isOpen}
        close={() => setIsOpen(false)}
        index={photoIndex}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        slides={sortedImages.map(img => ({ 
          src: img.src, 
          title: img.label, 
          description: img.caption,
          iconName: img.iconName // Custom prop
        } as any))}
        plugins={[Thumbnails, Counter]}
        render={{
          slideFooter: ({ slide }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const customSlide = slide as any
            const Icon = ICON_MAP[customSlide.iconName] || Grid
            
            return (
              <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center justify-center text-center pb-4 z-50 pointer-events-none">
                 <div className="bg-black/50 backdrop-blur-md px-6 py-3 rounded-full flex items-center gap-2 text-white font-semibold border border-white/10 shadow-xl">
                    <Icon className="w-5 h-5" />
                    <span>{customSlide.title}</span>
                 </div>
                 {customSlide.description && (
                   <p className="mt-2 text-white/80 text-sm max-w-md bg-black/40 px-3 py-1 rounded-md">
                     {customSlide.description}
                   </p>
                 )}
              </div>
            )
          }
        }}
      />
    </>
  )
}
