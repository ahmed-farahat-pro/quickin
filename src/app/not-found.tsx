// =============================================================================
// CUSTOM 404 NOT FOUND PAGE
// =============================================================================
// Description: Styled 404 page matching brand design
// =============================================================================

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Home, ArrowLeft } from 'lucide-react'

// No next-intl here: not-found is bundled into Next's /_global-error route, which
// prerenders outside the locale provider — using next-intl breaks the production build.
export default function NotFound() {
  const router = useRouter()

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      {/* Large 404 with gradient */}
      <div className="relative mb-8">
        <h1 className="text-[150px] md:text-[200px] font-bold text-transparent bg-clip-text bg-gradient-to-br from-primary/20 to-primary/5 leading-none select-none">
          404
        </h1>
        <div className="absolute inset-0 flex items-center justify-center">
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
        <Button 
          variant="outline" 
          size="lg" 
          className="gap-2"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          Go back
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
