'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Send, Wallet, Banknote, Smartphone, Upload, X, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BookingConditions } from './booking-conditions'
import { CancellationPolicyCard } from './cancellation-policy-card'
import { createBooking, uploadReceiptAndUpdateBooking } from '@/lib/supabase/bookings'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { QrCode } from 'lucide-react'
import { getBaseUrl } from '@/lib/utils'

interface BookingConfirmFormProps {
  listingId: string
  checkIn: string
  checkOut: string
  guests: number
  totalPrice: number
  availableBalance?: number
  cancellationPolicyCode: string | null
  mobileWallets: WalletProvider[]
}

export type WalletProvider = { 
  id?: string; 
  provider_id: string; 
  name: string; 
  logo_url: string; 
  qr_code?: string | null; 
  phone_number?: string | null; 
}

function WalletPaymentTab({
  provider,
  totalPrice,
  receiptImage,
  onImageUpload,
  onClearImage,
  onCompleteOnMobile,
  isHandoffPolling,
  isSubmitting,
  conditionsValid,
}: {
  provider: WalletProvider
  totalPrice: number
  receiptImage: string | null
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClearImage: () => void
  onCompleteOnMobile: () => void
  isHandoffPolling: boolean
  isSubmitting: boolean
  conditionsValid: boolean
}) {
  const t = useTranslations('bookingConfirm')
  
  return (
    <AccordionItem
      value={provider.provider_id}
      className="border rounded-md px-3 bg-card data-[state=open]:rounded-b-none mt-2 first:mt-0 last:border-b!"
    >
      <AccordionTrigger className="hover:no-underline py-3 h-[72px]">
        <div className="flex items-center gap-3 text-left">
          <div className="flex items-center justify-center rounded-md text-primary-foreground origin-left scale-75 sm:scale-100 overflow-hidden w-12 h-12">
            <Image
              src={provider.logo_url}
              alt={provider.name}
              width={48}
              height={48}
              className="object-contain w-full h-full rounded-[inherit] first:rounded-none"
            />
          </div>
          <span className="font-medium whitespace-nowrap">{provider.name}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="text-muted-foreground pb-4 pt-2">
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 p-5 border rounded-lg bg-muted/10 mx-1">
          <div className="flex flex-col items-center gap-4 shrink-0">
            <div className="flex flex-col items-center gap-3 w-full">
              {provider.qr_code && (
                <div className="p-2 bg-white rounded-md shadow-sm mx-auto">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${provider.qr_code}`}
                    alt={`${provider.name} QR Code`}
                    className="w-32 h-32 object-contain"
                  />
                </div>
              )}
              {provider.phone_number && (
                <div className="flex items-center gap-2 p-2.5 px-4 w-full bg-background border rounded-md text-base font-bold font-mono tracking-wider justify-center shadow-sm">
                  <Smartphone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground">{provider.phone_number}</span>
                </div>
              )}
            </div>
            <div className="text-center space-y-1 max-w-[200px]">
              <p className="font-medium text-foreground">
                {provider.qr_code && provider.phone_number
                  ? t('scanOrSend')
                  : provider.qr_code
                    ? t('scanOnly')
                    : t('sendOnly')}
              </p>
              <p className="text-xs">
                {provider.qr_code && provider.phone_number
                  ? t('scanOrSendDesc')
                  : provider.qr_code
                    ? t('scanOnlyDesc')
                    : t('sendOnlyDesc')}{" "}
                <strong className="text-foreground">{totalPrice.toLocaleString()} EGP</strong>.
              </p>
            </div>
          </div>
          <div className="w-full h-px md:w-px md:h-32 bg-border"></div>
          <div className="flex-1 w-full space-y-4">
            <div className="space-y-1">
              <h4 className="font-medium text-foreground text-sm">{t('uploadReceipt')}</h4>
              <p className="text-xs">
                {t('uploadReceiptDesc')}
              </p>
            </div>

            {receiptImage ? (
              <div className="flex items-center gap-3 p-4 w-full border rounded-lg bg-green-50/50 border-green-200">
                <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-green-700">{t('receiptAttached')}</p>
                  <p className="text-xs text-green-600/80">{t('receiptReady')}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100/50"
                  onClick={onClearImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                <div className="grid w-full max-w-sm items-center gap-1.5 flex-1">
                  <Label htmlFor={`${provider.provider_id}-receipt`} className="sr-only">
                    Receipt Image
                  </Label>
                  <Input
                    id={`${provider.provider_id}-receipt`}
                    type="file"
                    accept="image/*"
                    className="cursor-pointer file:cursor-pointer"
                    onChange={onImageUpload}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden sm:block w-px h-8 bg-border"></div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 text-xs px-4 gap-2 border-primary text-primary hover:bg-primary/5 shrink-0"
                    onClick={onCompleteOnMobile}
                    disabled={isSubmitting || isHandoffPolling}
                  >
                    {isHandoffPolling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <QrCode className="h-3.5 w-3.5" />
                    )}
                    {t('uploadViaMobile')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

export function BookingConfirmForm({
  listingId,
  checkIn,
  checkOut,
  guests,
  totalPrice,
  availableBalance = 0,
  cancellationPolicyCode,
  mobileWallets,
}: BookingConfirmFormProps) {
  const t = useTranslations('bookingConfirm')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [conditionsValid, setConditionsValid] = useState(true) // Default to true if no conditions
  const [policyAccepted, setPolicyAccepted] = useState(!cancellationPolicyCode) // Default to true if no policy
  const [paymentOption, setPaymentOption] = useState(availableBalance >= totalPrice ? 'balance' : 'wallet')
  const [walletProvider, setWalletProvider] = useState('instapay')
  const [receiptImage, setReceiptImage] = useState<string | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  // Mobile Handoff States
  const [showMobileHandoff, setShowMobileHandoff] = useState(false)
  const [handoffSessionId, setHandoffSessionId] = useState<string | null>(null)
  const [isHandoffPolling, setIsHandoffPolling] = useState(false)

  // Realtime Listener for Mobile Upload via Broadcast (No database row needed yet)
  useEffect(() => {
    if (!showMobileHandoff || !handoffSessionId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`handoff-${handoffSessionId}`)
      .on(
        'broadcast',
        { event: 'upload-success' },
        (payload) => {
          if (payload.payload && payload.payload.url) {
            setReceiptImage(payload.payload.url)
            setShowMobileHandoff(false)
            setHandoffSessionId(null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [showMobileHandoff, handoffSessionId])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const imageUrl = URL.createObjectURL(file)
      setReceiptImage(imageUrl)
      setReceiptFile(file)
    }
  }

  const clearReceiptImage = () => {
    setReceiptImage(null)
    setReceiptFile(null)
  }

  const handleConditionsValidityChange = useCallback((allChecked: boolean) => {
    setConditionsValid(allChecked)
  }, [])

  const handlePolicyAcceptChange = useCallback((accepted: boolean) => {
    setPolicyAccepted(accepted)
  }, [])

  const handleSubmit = async () => {
    if (!conditionsValid || !policyAccepted) {
      toast.error(t('agreeConditions'))
      return
    }

    setIsSubmitting(true)

    try {
      const result = await createBooking({
        listingId,
        checkIn,
        checkOut,
        guests,
        totalPrice,
        receiptUrl: paymentOption === 'wallet' && receiptImage && !receiptFile ? receiptImage : undefined,
        payWithBalance: paymentOption === 'balance'
      })

      if (result.error || !result.bookingId) {
        toast.error(result.error || 'Failed to create booking', {
          action: { label: "Retry", onClick: () => handleSubmit() }
        })
        return
      }

      // If a receipt file is provided, upload it now
      if (paymentOption === 'wallet' && receiptFile) {
        const formData = new FormData()
        formData.append('bookingId', result.bookingId)
        formData.append('file', receiptFile)

        const uploadResult = await uploadReceiptAndUpdateBooking(formData)
        if (uploadResult.error) {
          toast.error(uploadResult.error)
          // We don't abort the booking if image upload fails, but warn the user.
        }
      }

      toast.success(t('success'), {
        action: { label: t('viewTrips'), onClick: () => router.push('/dashboard/trips') }
      })
      router.push('/dashboard/trips')
    } catch (error: unknown) {
      console.error('Error creating booking:', error)
      const message = error instanceof Error ? error.message : 'Failed to submit booking request'
      toast.error(message, {
        action: { label: "Retry", onClick: () => handleSubmit() }
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCompleteOnMobile = () => {
    // Generate a secure random session ID for the handoff
    const sessionId = crypto.randomUUID()
    setHandoffSessionId(sessionId)
    setShowMobileHandoff(true)
  }

  const canUseBalance = availableBalance >= totalPrice

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-medium">{t('paymentOptions')}</h3>
          <Tabs defaultValue="wallet" value={paymentOption} onValueChange={setPaymentOption} className="w-full">
            <TabsList className={`grid w-full ${canUseBalance ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {canUseBalance && (
                <TabsTrigger value="balance" className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('platformBalance')}</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="wallet" className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                <span className="hidden sm:inline">{t('mobileWallet')}</span>
              </TabsTrigger>
              <TabsTrigger value="cash" disabled className="flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                <span className="hidden sm:inline">{t('cashDisabled')}</span>
              </TabsTrigger>
            </TabsList>

            {canUseBalance && (
              <TabsContent value="balance" className="p-4 border rounded-md mt-2 shadow-sm">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">{t('payWithBalance')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('walletInfoDesc1')} <strong className="text-foreground">{availableBalance.toLocaleString()} EGP</strong>.
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('walletInfoDesc2')} <strong className="text-foreground">{totalPrice.toLocaleString()} EGP</strong> {t('walletInfoDesc3')}
                  </p>
                </div>
              </TabsContent>
            )}

            <TabsContent value="wallet" className="p-0 border rounded-md mt-2 shadow-sm overflow-hidden">
              <div className="p-4 bg-muted/20 border-b">
                <p className="text-sm text-muted-foreground">{t('walletInstructions')}</p>
              </div>
              <div className="p-4">
                <Accordion type="single" collapsible value={walletProvider} onValueChange={(val) => val && setWalletProvider(val)} className="w-full space-y-2">
                  {mobileWallets.map((provider) => (
                    <WalletPaymentTab
                      key={provider.provider_id}
                      provider={provider}
                      totalPrice={totalPrice}
                      receiptImage={walletProvider === provider.provider_id ? receiptImage : null}
                      onImageUpload={handleImageUpload}
                      onClearImage={clearReceiptImage}
                      onCompleteOnMobile={handleCompleteOnMobile}
                      isHandoffPolling={isHandoffPolling}
                      isSubmitting={isSubmitting}
                      conditionsValid={conditionsValid}
                    />
                  ))}
                </Accordion>
              </div>
            </TabsContent>

            <TabsContent value="cash" className="p-4 border rounded-md mt-2 shadow-sm">
              <p className="text-sm text-muted-foreground">{t('cashDisabledDesc')}</p>
            </TabsContent>
          </Tabs>
        </div>

        {/* Conditions checkboxes */}
        <BookingConditions
          listingId={listingId}
          onValidityChange={handleConditionsValidityChange}
        />

        {/* Cancellation policy display and acceptance */}
        {cancellationPolicyCode && (
          <CancellationPolicyCard
            policyCode={cancellationPolicyCode}
            onAcceptChange={handlePolicyAcceptChange}
          />
        )}

        <div className="pt-2">
          <Button
            className="w-full h-12 text-base gap-2 disabled:opacity-50"
            onClick={handleSubmit}
            disabled={isSubmitting || isHandoffPolling || !conditionsValid || !policyAccepted || (paymentOption === 'wallet' && !receiptImage)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {t('sending')}
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                {t('requestToBook')}
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          {t('termsNotice')}
        </p>
      </CardContent>

      {/* Mobile Handoff Modal */}
      <Dialog open={showMobileHandoff} onOpenChange={setShowMobileHandoff}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">{t('handoffTitle')}</DialogTitle>
            <DialogDescription className="text-center pt-2">
              {t('handoffDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border">
              {handoffSessionId && (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    `${getBaseUrl()}/pay/${handoffSessionId}`
                  )}`}
                  alt="Handoff QR Code"
                  className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                />
              )}
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-primary flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('waitingForUpload')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('leavePageOpen')}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
