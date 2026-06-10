// =============================================================================
// SERVICES MANAGEMENT PAGE
// =============================================================================
// Description: Platform service locations for pick-up and drop-off
// Status: Placeholder awaiting further requirements from platform owners
// =============================================================================

import { MapPin, Package, Clock, Phone } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = {
  title: 'Services Management | QuickIn',
  description: 'Pick-up and drop-off locations for QuickIn services',
}

export default function ServicesPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-hero text-3xl md:text-4xl font-bold text-foreground mb-4">
          Services Management
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Pick-up & Drop-off Locations — Places where we can deliver and receive
        </p>
      </div>

      {/* Coming Soon Notice */}
      <Card className="max-w-2xl mx-auto mb-12 border-amber-200 bg-amber-50/50">
        <CardHeader className="text-center">
          <CardTitle className="text-amber-800 flex items-center justify-center gap-2">
            <Package className="h-5 w-5" />
            Coming Soon
          </CardTitle>
          <CardDescription className="text-amber-700">
            We're setting up our service locations network. Check back soon for available pick-up and drop-off points.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Placeholder Service Locations */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
        {/* Example Location Card 1 */}
        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-primary" />
              Main Office
            </CardTitle>
            <CardDescription>Downtown Service Center</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Mon-Fri: 9AM - 6PM</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span>Contact support for details</span>
            </div>
          </CardContent>
        </Card>

        {/* Example Location Card 2 */}
        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-primary" />
              Airport Hub
            </CardTitle>
            <CardDescription>International Terminal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>24/7 Available</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span>Contact support for details</span>
            </div>
          </CardContent>
        </Card>

        {/* Example Location Card 3 */}
        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-primary" />
              Mall Kiosk
            </CardTitle>
            <CardDescription>City Mall, Ground Floor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Daily: 10AM - 10PM</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span>Contact support for details</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder Developer Note */}
      <div className="mt-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground text-sm">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>This page is a placeholder — content will be updated when service locations are confirmed</span>
        </div>
      </div>
    </div>
  )
}
