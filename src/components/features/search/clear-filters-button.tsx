'use client'

import { useTransition, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUIStore } from '@/stores/ui-store'

interface ClearFiltersButtonProps {
  label: string
  href: string
}

export function ClearFiltersButton({ label, href }: ClearFiltersButtonProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const { startLoading, stopLoading } = useUIStore()

  // Reset loading state if navigation completes
  useEffect(() => {
    stopLoading('clear-filters')
  }, [searchParams, stopLoading])

  // Fallback cleanup on unmount
  useEffect(() => {
    return () => stopLoading('clear-filters')
  }, [stopLoading])

  const handleClear = () => {
    startTransition(() => {
      startLoading('clear-filters')
      router.push(href)
    })
  }

  return (
    <button
      onClick={handleClear}
      disabled={isPending}
      className="text-sm text-primary hover:underline font-medium whitespace-nowrap disabled:opacity-50"
    >
      {label}
    </button>
  )
}
