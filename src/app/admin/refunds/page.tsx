import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { RefundsTable } from './refunds-table'
import { RefundWithDetails } from './columns'
import { Clock, CheckCircle, Banknote, ListFilter } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getRefunds(): Promise<RefundWithDetails[]>
{
    const supabase = await createAdminClient()
    if (!supabase) return []

    // Fetch refunds with booking, listing, guest, and policy details
    // Also include transactions if they exist (to get the actual refund amount)
    const { data, error } = await supabase
        .from('refunds')
        .select(`
            id,
            reason,
            refund_type,
            status,
            policy_applied,
            created_at,
            booking:bookings (
                id,
                subtotal,
                reservation_code,
                check_in,
                status,
                guest:profiles!bookings_user_id_fkey(
                    full_name,
                    email
                ),
                listing:listings(
                    title
                )
            ),
            policy:cancellation_policies(
                label
            ),
            transactions:transactions(
                amount,
                type
            )
        `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching refunds:', error)
        return []
    }

    // Compute refund amounts:
    // 1. If status is approved/processed, use the transaction amount (refund amount is recorded there)
    // 2. Otherwise, use the RPC to calculate the potential refund amount
    const refundsWithAmounts = await Promise.all(
        (data || []).map(async (refund: any) =>
        {
            // Try to find a 'refund' type transaction first
            const refundTx = refund.transactions?.find((t: any) => t.type === 'refund')
            let amount = refundTx ? parseFloat(refundTx.amount) : null

            if (!amount && refund.status === 'pending') {
                const { data: computed } = await supabase.rpc('calc_refund_amount', { p_refund_id: refund.id }).single()
                amount = computed as number | null
            }

            return {
                ...refund,
                computed_amount: amount,
            }
        })
    )

    return refundsWithAmounts as RefundWithDetails[]
}

export default async function AdminRefundsPage()
{
    const refunds = await getRefunds()

    const stats = {
        pending: refunds.filter(r => r.status === 'pending').length,
        approved: refunds.filter(r => r.status === 'approved').length,
        processed: refunds.filter(r => r.status === 'processed').length,
        total: refunds.length
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Refunds Management</h1>
                <p className="text-muted-foreground">
                    Review and process guest refund requests according to cancellation policies.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card className={stats.pending > 0 ? 'border-yellow-500' : ''}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pending}</div>
                        <p className="text-xs text-muted-foreground mt-1">Requires admin review</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Approved</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
                        <p className="text-xs text-muted-foreground mt-1">Validated & ledger updated</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Processed</CardTitle>
                        <Banknote className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{stats.processed}</div>
                        <p className="text-xs text-muted-foreground mt-1">Money transfer completed</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
                        <ListFilter className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                        <p className="text-xs text-muted-foreground mt-1">All requests to date</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Refund Operations</CardTitle>
                    <CardDescription>
                        A comprehensive list of all refund operations requested on the platform.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <RefundsTable refunds={refunds} />
                </CardContent>
            </Card>
        </div>
    )
}
