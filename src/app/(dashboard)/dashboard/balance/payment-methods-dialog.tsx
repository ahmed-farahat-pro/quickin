'use client'

import { useState, useEffect, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { HostPaymentMethod, saveHostPaymentMethod, getMobileWallets } from '@/lib/actions/payment-methods'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface PaymentMethodDialogProps {
  isOpen: boolean
  onClose: () => void
  initialData: HostPaymentMethod | null
}

export function PaymentMethodDialog({ isOpen, onClose, initialData }: PaymentMethodDialogProps) {
  const t = useTranslations('dashboardPaymentMethods')
  const [isPending, startTransition] = useTransition()
  const [wallets, setWallets] = useState<any[]>([])
  
  const [formData, setFormData] = useState<Partial<HostPaymentMethod>>({
    type: 'mobile_wallet',
    provider_name: '',
    account_number: '',
    account_holder_name: '',
    bank_name: '',
    iban: '',
    swift_code: '',
    is_default: false
  })

  useEffect(() => {
    if (isOpen) {
      getMobileWallets().then(setWallets)
    }
  }, [isOpen])

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    } else {
      setFormData({
        type: 'mobile_wallet',
        provider_name: '',
        account_number: '',
        account_holder_name: '',
        bank_name: '',
        iban: '',
        swift_code: '',
        is_default: false
      })
    }
  }, [initialData, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate provider_name for wallets
    if (formData.type === 'mobile_wallet' && !formData.provider_name) {
      toast.error('Please select a wallet provider')
      return
    }

    startTransition(async () => {
      try {
        const result = await saveHostPaymentMethod(formData)
        if (result.success) {
          toast.success(t('form.success'))
          onClose()
        } else {
          toast.error(result.error || t('form.error'))
        }
      } catch (err) {
        toast.error(t('form.error'))
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{initialData ? t('form.submit') : t('addMethod')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="type">{t('form.type')}</Label>
            <Select 
              value={formData.type} 
              onValueChange={(val: any) => {
                const newData = { ...formData, type: val };
                if (val !== 'mobile_wallet') newData.provider_name = val === 'instapay' ? 'InstaPay' : '';
                setFormData(newData);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('form.type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mobile_wallet">{t('types.mobile_wallet')}</SelectItem>
                <SelectItem value="instapay">{t('types.instapay')}</SelectItem>
                <SelectItem value="bank_account">{t('types.bank_account')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.type === 'mobile_wallet' && (
            <div className="space-y-2">
              <Label htmlFor="provider_name">{t('form.providerName')}</Label>
              <Select 
                value={formData.provider_name || ''} 
                onValueChange={(val) => setFormData({ ...formData, provider_name: val })}
              >
                <SelectTrigger id="provider_name">
                  <SelectValue placeholder="Select Provider" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.length > 0 ? (
                    wallets.map(w => (
                      <SelectItem key={w.provider_id} value={w.name}>
                        {w.name}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="Vodafone Cash">Vodafone Cash</SelectItem>
                      <SelectItem value="Orange Cash">Orange Cash</SelectItem>
                      <SelectItem value="Etisalat Cash">Etisalat Cash</SelectItem>
                      <SelectItem value="WE Pay">WE Pay</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.type === 'bank_account' && (
            <div className="space-y-2">
              <Label htmlFor="provider_name">{t('form.bankName')}</Label>
              <Input 
                id="provider_name"
                value={formData.provider_name || ''}
                onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                placeholder={t('form.bankPlaceholder')}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="account_number">
              {formData.type === 'mobile_wallet' ? t('form.accountNumber') : 
               formData.type === 'instapay' ? 'InstaPay Address' : t('form.accountNumber')}
            </Label>
            <Input 
              id="account_number"
              value={formData.account_number || ''}
              onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
              placeholder={t('form.accountNumberPlaceholder')}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_holder_name">{t('form.accountHolderName')}</Label>
            <Input 
              id="account_holder_name"
              value={formData.account_holder_name || ''}
              onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
              placeholder={t('form.accountHolderPlaceholder')}
              required
            />
          </div>

          {formData.type === 'bank_account' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="iban">{t('form.iban')}</Label>
                <Input 
                  id="iban"
                  value={formData.iban || ''}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  placeholder={t('form.ibanPlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="swift_code">{t('form.swiftCode')}</Label>
                <Input 
                  id="swift_code"
                  value={formData.swift_code || ''}
                  onChange={(e) => setFormData({ ...formData, swift_code: e.target.value })}
                  placeholder={t('form.swiftPlaceholder')}
                />
              </div>
            </>
          )}

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox 
              id="is_default" 
              checked={formData.is_default}
              onCheckedChange={(checked) => setFormData({ ...formData, is_default: !!checked })}
            />
            <Label htmlFor="is_default" className="text-sm font-normal cursor-pointer">
              {t('form.isDefault')}
            </Label>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {t('form.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('form.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
