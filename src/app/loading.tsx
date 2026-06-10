// =============================================================================
// GLOBAL LOADING PAGE
// =============================================================================
// Description: Loading UI shown during route transitions
// Uses Next.js loading.tsx convention for Suspense boundaries
// =============================================================================

import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
      {/* Animated Logo */}
      <div className="relative mb-8">
        <svg
          viewBox="0 0 32 32"
          xmlns="http://www.w3.org/2000/svg"
          className="h-16 w-16 text-primary animate-pulse"
          fill="currentColor"
        >
          <path d="M16 1C7.716 1 1 7.716 1 16s6.716 15 15 15 15-6.716 15-15S24.284 1 16 1zm0 27.5c-6.893 0-12.5-5.607-12.5-12.5S9.107 3.5 16 3.5 28.5 9.107 28.5 16 22.893 28.5 16 28.5zM16 8a8 8 0 100 16 8 8 0 000-16z" />
        </svg>
        
        {/* Spinning ring around logo */}
        <div className="absolute inset-0 -m-2">
          <LoadingSpinner size="lg" className="h-20 w-20" />
        </div>
      </div>

      {/* Brand name */}
      <h1 className="text-2xl font-bold text-primary mb-2">QuickIn</h1>
      
      {/* Loading text */}
      <p className="text-background animate-pulse">Loading amazing stays...</p>
      
      {/* Decorative dots */}
      <div className="flex gap-1 mt-6">
        <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}
