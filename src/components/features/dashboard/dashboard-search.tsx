'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

export function DashboardSearch({ placeholder = 'Search...' }: { placeholder?: string }) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const [value, setValue] = useState(searchParams.get('search') || '')
  const isUserTyping = useRef(false)

  // Only trigger URL updates when the user actually types, not on searchParams changes
  useEffect(() => {
    if (!isUserTyping.current) return
    isUserTyping.current = false

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('search', value.toUpperCase())
      } else {
        params.delete('search')
      }
      router.replace(`${pathname}?${params.toString()}`)
    }, 300)

    return () => clearTimeout(timer)
  }, [value, router, pathname, searchParams])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isUserTyping.current = true
    setValue(e.target.value)
  }

  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        className="pl-9"
        value={value}
        onChange={handleChange}
      />
    </div>
  )
}
