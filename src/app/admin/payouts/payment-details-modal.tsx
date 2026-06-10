'use client'

import { useState } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Wallet, 
  Landmark, 
  CreditCard, 
  ExternalLink, 
  Info,
  CheckCircle2,
  Clock
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface PaymentDetailsModalProps {
  payoutId: string
  hostId: string
  requestedDetails: any
  requestedMethod: string
}

export function PaymentDetailsModal({ 
  payoutId, 
  hostId, 
  requestedDetails, 
  requestedMethod 
}: PaymentDetailsModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [allMethods, setAllMethods] = useState<any[]>([])

  const fetchHostMethods = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('host_payment_methods')
      .select('*')
      .eq('user_id', hostId)
      .order('is_default', { ascending: false })

    if (error) {
      toast.error('Failed to load host payment methods')
    } else {
      setAllMethods(data || [])
    }
    setLoading(false)
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'mobile_wallet': return <Wallet className="h-4 w-4" />
      case 'bank_account': return <Landmark className="h-4 w-4" />
      case 'instapay': return <CreditCard className="h-4 w-4" />
      default: return <Info className="h-4 w-4" />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (open) fetchHostMethods()
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 px-2">
          <Info className="h-3.5 w-3.5 text-primary" />
          Details
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payout Destination Details</DialogTitle>
          <DialogDescription>
            Verify host payment information before processing the payout.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Requested Method Snapshot */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-4 w-4" />
              Snapshot (Requested at time of withdrawal)
            </h4>
            <div className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
              {requestedDetails ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-base flex items-center gap-2">
                        {getIcon(requestedDetails.type)}
                        {requestedDetails.provider_name || requestedDetails.type.replace('_', ' ')}
                      </div>
                      <div className="text-sm font-mono mt-1 select-all bg-background/50 px-1.5 py-0.5 rounded border border-primary/10">
                        {requestedDetails.account_number}
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 border-primary/20">Requested</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-2 border-t border-primary/10">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground font-bold">Holder Name</p>
                      <p className="text-sm font-medium">{requestedDetails.account_holder_name}</p>
                    </div>
                    {requestedDetails.bank_name && (
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground font-bold">Bank</p>
                        <p className="text-sm font-medium">{requestedDetails.bank_name}</p>
                      </div>
                    )}
                    {requestedDetails.iban && (
                      <div className="col-span-2">
                        <p className="text-[10px] uppercase text-muted-foreground font-bold">IBAN</p>
                        <p className="text-sm font-mono select-all break-all">{requestedDetails.iban}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm italic text-muted-foreground">
                  No snapshot details available. Use legacy method: {requestedMethod}
                </div>
              )}
            </div>
          </section>

          {/* Current Methods */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Host's Current Saved Methods
            </h4>
            <div className="grid gap-3">
              {loading ? (
                <div className="text-center py-4 text-sm text-muted-foreground italic">Loading methods...</div>
              ) : allMethods.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground italic border rounded-lg">No other methods found</div>
              ) : (
                allMethods.map((m) => (
                  <div 
                    key={m.id} 
                    className={cn(
                      "p-3 rounded-lg border text-sm transition-colors",
                      m.id === requestedDetails?.id ? "bg-muted/50 border-primary/30" : "hover:bg-muted/30"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="font-medium flex items-center gap-2">
                          {getIcon(m.type)}
                          {m.provider_name || m.type.replace('_', ' ')}
                          {m.is_default && <Badge variant="secondary" className="text-[9px] h-4 py-0">Default</Badge>}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground select-all">
                          {m.account_number}
                        </div>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase">{m.account_holder_name}</p>
                      </div>
                      {m.id === requestedDetails?.id && (
                        <span className="text-[10px] text-primary font-bold italic">Current Target</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <p className="text-[11px] text-muted-foreground italic px-1">
              Note: The "Snapshot" at the top is what the host officially requested. If they changed their mind, use the "Current Saved Methods" section to find alternative payout destinations.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
