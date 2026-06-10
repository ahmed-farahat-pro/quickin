// =============================================================================
// SEARCH MODAL COMPONENT
// =============================================================================
// Description: Full search dialog for location, dates, and guests
// Features: Location search, date picker, guest counter
// =============================================================================

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Search, MapPin, Calendar, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Locale } from '@/i18n/config'
import { localizePathname } from '@/lib/i18n/pathname'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const locale = useLocale() as Locale
  const router = useRouter()
  const [location, setLocation] = useState('')
  const [guests, setGuests] = useState(1)

  /**
   * Handle search form submission
   * Navigates to homepage with search params
   */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    
    const params = new URLSearchParams()
    if (location.trim()) {
      params.set('search', location.trim())
    }
    
    router.push(`${localizePathname('/', locale)}?${params.toString()}`)
    onClose()
    setLocation('')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>Search stays</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSearch} className='space-y-6 pt-4'>
          {/* Location */}
          <div className='space-y-2'>
            <Label htmlFor='location' className='flex items-center gap-2'>
              <MapPin className='h-4 w-4' />
              Where
            </Label>
            <Input
              id='location'
              placeholder='Search destinations'
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className='h-12'
            />
          </div>

          {/* Dates - placeholder for now */}
          <div className='space-y-2'>
            <Label className='flex items-center gap-2'>
              <Calendar className='h-4 w-4' />
              When
            </Label>
            <Button
              type='button'
              variant='outline'
              className='w-full h-12 justify-start text-muted-foreground'
            >
              Add dates
            </Button>
          </div>

          {/* Guests */}
          <div className='space-y-2'>
            <Label className='flex items-center gap-2'>
              <Users className='h-4 w-4' />
              Who
            </Label>
            <div className='flex items-center gap-4 h-12 px-3 border rounded-xl'>
              <span className='flex-1 text-sm'>
                {guests} guest{guests > 1 ? 's' : ''}
              </span>
              <div className='flex items-center gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  className='h-8 w-8 rounded-full'
                  onClick={() => setGuests(Math.max(1, guests - 1))}
                >
                  -
                </Button>
                <span className='w-6 text-center'>{guests}</span>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  className='h-8 w-8 rounded-full'
                  onClick={() => setGuests(guests + 1)}
                >
                  +
                </Button>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className='flex gap-3'>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                setLocation('')
                setGuests(1)
              }}
              className='flex-1'
            >
              <X className='h-4 w-4 mr-2' />
              Clear
            </Button>
            <Button type='submit' className='flex-1'>
              <Search className='h-4 w-4 mr-2' />
              Search
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
