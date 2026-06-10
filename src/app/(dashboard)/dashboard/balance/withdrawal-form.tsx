'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { requestWithdrawal } from '@/lib/actions/balances'
import { HostPaymentMethod } from '@/lib/actions/payment-methods'
import { toast } from 'sonner'
import { Loader2, PlusCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface WithdrawalFormProps
{
    maxAmount: number
    paymentMethods: HostPaymentMethod[]
}

export function WithdrawalForm({ maxAmount, paymentMethods }: WithdrawalFormProps)
{
    const [amount, setAmount] = useState('')
    const [methodId, setMethodId] = useState(paymentMethods.find(m => m.is_default)?.id || paymentMethods[0]?.id || '')
    const [isPending, startTransition] = useTransition()
    const t = useTranslations('dashboardBalanceForm')
    const pt = useTranslations('dashboardPaymentMethods')

    const handleSubmit = (e: React.FormEvent) =>
    {
        e.preventDefault()

        const amountVal = parseFloat(amount)
        if (isNaN(amountVal) || amountVal <= 0) {
            toast.error(t('errors.invalidAmount'))
            return
        }

        if (amountVal > maxAmount) {
            toast.error(t('errors.exceedsBalance'))
            return
        }

        if (!methodId) {
            toast.error('Please select or add a payment method')
            return
        }

        startTransition(async () =>
        {
            const result = await requestWithdrawal(amountVal, methodId)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(t('success'))
                setAmount('')
            }
        })
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="amount">{t('amountLabel')}</Label>
                <Input
                    id="amount"
                    type="number"
                    placeholder={t('amountPlaceholder')}
                    min="1"
                    max={maxAmount}
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                />
                <p className="text-xs text-muted-foreground">
                    {t('maximum')}: {new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(maxAmount)}
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="method">{t('methodLabel')}</Label>
                {paymentMethods.length > 0 ? (
                    <Select value={methodId} onValueChange={setMethodId}>
                        <SelectTrigger id="method">
                            <SelectValue placeholder={t('selectMethod')} />
                        </SelectTrigger>
                        <SelectContent>
                            {paymentMethods.map(m => (
                                <SelectItem key={m.id} value={m.id}>
                                    <div className="flex flex-col items-start">
                                        <span className="font-medium">
                                            {m.provider_name || pt(`types.${m.type}`)}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {m.account_number}
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <div className="text-xs text-destructive flex items-center gap-1.5 p-2 border border-destructive/20 bg-destructive/5 rounded-md">
                        <PlusCircle className="h-3.5 w-3.5" />
                        Please add a payment method first
                    </div>
                )}
            </div>

            <Button disabled={isPending || maxAmount <= 0 || paymentMethods.length === 0} className="w-full">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('submit')}
            </Button>
        </form>
    )
}
