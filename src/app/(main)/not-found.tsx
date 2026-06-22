// =============================================================================
// CUSTOM 404 NOT FOUND PAGE
// =============================================================================
// Description: Styled 404 page matching brand design
// =============================================================================

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home, Search } from 'lucide-react'

// No next-intl here — not-found is bundled into /_global-error which prerenders
// outside the locale context.
export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      {/* Large 404 with gradient */}
      <div className="relative mb-8">
        <h1 className="text-[150px] md:text-[200px] font-bold text-transparent bg-clip-text bg-gradient-to-br from-primary/20 to-primary/5 leading-none select-none">
          404
        </h1>
        <div className="absolute inset-0 flex items-center justify-center">
          {/* <svg
            viewBox="0 0 32 32"
            xmlns="http://www.w3.org/2000/svg"
            className="h-20 w-20 text-primary opacity-80"
            fill="currentColor"
          >
            <path d="M16 1C7.716 1 1 7.716 1 16s6.716 15 15 15 15-6.716 15-15S24.284 1 16 1zm0 27.5c-6.893 0-12.5-5.607-12.5-12.5S9.107 3.5 16 3.5 28.5 9.107 28.5 16 22.893 28.5 16 28.5zM16 8a8 8 0 100 16 8 8 0 000-16z" />
          </svg> */}
        </div>
      </div>

      {/* Message */}
      <h2 className="text-2xl md:text-3xl font-semibold mb-3 text-center">
        Oops! Page not found
      </h2>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
        Let&apos;s get you back on track.
      </p>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild variant="default" size="lg" className="gap-2">
          <Link href="/">
            <Home className="h-4 w-4" />
            Go home
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="gap-2">
          <Link href="/">
            <Search className="h-4 w-4" />
            Search stays
          </Link>
        </Button>
      </div>

      {/* Decorative background elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
      </div>
    </div>
  )
}
