'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { updateCommissionRates, type CommissionRates } from '@/lib/actions/platform-settings'
import { notifyHostsOfCommissionChange } from '@/lib/actions/commission-notifications'
import { Loader2, BellRing, History, CheckCircle2, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import
{
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { format } from 'date-fns'

interface CommissionsFormProps
{
    currentRates: CommissionRates
    history: CommissionRates[]
}

export function CommissionsForm({ currentRates, history }: CommissionsFormProps)
{
    const [hostRate, setHostRate] = useState((currentRates.hostRate * 100).toString())
    const [guestRate, setGuestRate] = useState((currentRates.guestRate * 100).toString())
    const [bestOfferRate, setBestOfferRate] = useState((currentRates.bestOfferRate * 100).toString())
    const [isPending, startTransition] = useTransition()
    const [isNotifying, startNotifying] = useTransition()

    const handleSave = () =>
    {
        const hostNumeric = parseFloat(hostRate) / 100
        const guestNumeric = parseFloat(guestRate) / 100
        const bestOfferNumeric = parseFloat(bestOfferRate) / 100

        if (isNaN(hostNumeric) || isNaN(guestNumeric) || isNaN(bestOfferNumeric)) {
            toast.error('Rates must be valid numbers')
            return
        }

        if (hostNumeric < 0 || hostNumeric > 1 || guestNumeric < 0 || guestNumeric > 1 || bestOfferNumeric < 0 || bestOfferNumeric > 1) {
            toast.error('Rates must be between 0 and 100%')
            return
        }

        startTransition(async () =>
        {
            const result = await updateCommissionRates(hostNumeric, guestNumeric, bestOfferNumeric)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Commission rates updated successfully')
            }
        })
    }

    const handleNotify = () =>
    {
        if (!confirm('This will send an email and push notification to all hosts. Are you sure?')) {
            return
        }

        const hostNumeric = parseFloat(hostRate) / 100
        const guestNumeric = parseFloat(guestRate) / 100

        startNotifying(async () =>
        {
            const result = await notifyHostsOfCommissionChange(hostNumeric, guestNumeric)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(`Successfully notified ${result.notified} hosts`)
            }
        })
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
            <div className="lg:col-span-1 border-r pr-8 h-full">
                <div className="sticky top-8 space-y-6">
                    <div>
                        <h2 className="text-lg font-semibold mb-1">Update Rates</h2>
                        <p className="text-sm text-muted-foreground">
                            Set current platform fees.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="host-rate" className="text-sm">Host Commission (%)</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="host-rate"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={hostRate}
                                    onChange={(e) => setHostRate(e.target.value)}
                                    className="h-9"
                                />
                                <span className="text-muted-foreground text-sm">%</span>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="guest-rate" className="text-sm">Guest Fee (%)</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="guest-rate"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={guestRate}
                                    onChange={(e) => setGuestRate(e.target.value)}
                                    className="h-9"
                                />
                                <span className="text-muted-foreground text-sm">%</span>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="best-offer-rate" className="text-sm">Best Offer Additive (%)</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="best-offer-rate"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={bestOfferRate}
                                    onChange={(e) => setBestOfferRate(e.target.value)}
                                    className="h-9"
                                />
                                <span className="text-muted-foreground text-sm">%</span>
                            </div>
                        </div>

                        <div className="pt-4 space-y-3">
                            <Button
                                onClick={handleSave}
                                disabled={isPending || isNotifying}
                                className="w-full"
                            >
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>

                            <Button
                                variant="outline"
                                onClick={handleNotify}
                                disabled={isNotifying || isPending}
                                className="w-full"
                            >
                                {isNotifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
                                Notify Hosts
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-3">
                <Card className="border-none shadow-none bg-transparent">
                    <CardHeader className="px-0 pt-0">
                        <div className="flex items-center gap-2">
                            <History className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>Commission History</CardTitle>
                        </div>
                        <CardDescription>
                            Detailed record of all historical fee adjustments. Only one rate is active at a time.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-0">
                        <div className="rounded-md border bg-card shadow-sm overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-[180px]">Effective Date</TableHead>
                                        <TableHead>Host/Guest/Best</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Changed By</TableHead>
                                        <TableHead>Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.map((rate) => (
                                        <TableRow key={rate.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-medium">
                                                {format(new Date(rate.effective_from), 'MMM d, yyyy HH:mm')}
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-bold text-base">{(rate.hostRate * 100).toFixed(1)}%</span>
                                                <span className="text-muted-foreground mx-1">/</span>
                                                <span>{(rate.guestRate * 100).toFixed(1)}%</span>
                                                <span className="text-muted-foreground mx-1">/</span>
                                                <span>{(rate.bestOfferRate * 100).toFixed(1)}%</span>
                                            </TableCell>
                                            <TableCell>
                                                {!rate.effective_to ? (
                                                    <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                                        Active
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="opacity-70">
                                                        <Clock className="mr-1 h-3 w-3" />
                                                        Expired
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                {rate.created_by_name}
                                            </TableCell>
                                            <TableCell className="max-w-[400px] truncate text-muted-foreground text-sm" title={rate.notes || ''}>
                                                {rate.notes}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {history.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                                No changes recorded yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
