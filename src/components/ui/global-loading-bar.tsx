'use client'

import { useUIStore } from '@/stores/ui-store'

export function GlobalLoadingBar() {
  const loadingKeys = useUIStore((s) => s.loadingKeys)
  const isLoading = loadingKeys.size > 0

  if (!isLoading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-0.5 overflow-hidden bg-primary/20">
      <div className="h-full w-1/3 bg-primary animate-[loading-bar_1.5s_ease-in-out_infinite] rounded-full" />
    </div>
  )
}
