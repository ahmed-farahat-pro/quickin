import { createClient } from '@/lib/supabase/server'
import { getUserBalance, getBalanceTransactions } from '@/lib/actions/balances'
import { getHostPaymentMethods } from '@/lib/actions/payment-methods'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { WithdrawalForm } from './withdrawal-form'
import { TransactionsTable } from './transactions-table'
import { PaymentMethodsManager } from './payment-methods-manager'
import { Transaction } from './columns'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

function formatCurrency(amount: number)
{
    return new Intl.NumberFormat('en-EG', {
        style: 'currency',
        currency: 'EGP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)
}

export default async function BalancePage()
{
    const supabase = await createClient()
    if (!supabase) return null

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    const t = await getTranslations('dashboardBalance')

    const [balance, transactions, paymentMethods] = await Promise.all([
        getUserBalance(user.id),
        getBalanceTransactions(user.id),
        getHostPaymentMethods()
    ])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
                <p className="text-muted-foreground">
                    {t('description')}
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {/* ... existing balance cards ... */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t('availableBalance')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(balance.available_balance)}</div>
                        <p className="text-xs text-muted-foreground mt-1">{t('readyForWithdrawal')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t('onHold')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{formatCurrency(balance.on_hold_balance)}</div>
                        <p className="text-xs text-muted-foreground mt-1">{t('pendingCheckIn')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t('totalInflows')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(balance.total_earned)}</div>
                        <p className="text-xs text-muted-foreground mt-1">{t('lifetimeTotal')}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('transactionHistory')}</CardTitle>
                            <CardDescription>{t('recentTransactionsDesc')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TransactionsTable data={transactions as Transaction[]} />
                        </CardContent>
                    </Card>

                    <PaymentMethodsManager methods={paymentMethods} />
                </div>

                <div>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle>{t('requestWithdrawal')}</CardTitle>
                            <CardDescription>{t('withdrawFundsDesc')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <WithdrawalForm 
                                maxAmount={balance.available_balance} 
                                paymentMethods={paymentMethods}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
