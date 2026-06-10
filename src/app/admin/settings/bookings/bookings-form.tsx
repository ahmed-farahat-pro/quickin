'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { updateBookingTimeouts, BookingTimeouts } from '@/lib/actions/booking-settings'
import { Loader2 } from 'lucide-react'

interface BookingTimeoutsFormProps
{
    initialTimeouts: BookingTimeouts
}

export function BookingTimeoutsForm({ initialTimeouts }: BookingTimeoutsFormProps)
{
    const [completeDays, setCompleteDays] = useState(initialTimeouts.autoCompleteDays.toString())
    const [cancelDays, setCancelDays] = useState(initialTimeouts.autoCancelDays.toString())
    const [isPending, startTransition] = useTransition()

    const handleSave = () =>
    {
        const completeNumeric = parseInt(completeDays, 10)
        const cancelNumeric = parseInt(cancelDays, 10)

        if (isNaN(completeNumeric) || isNaN(cancelNumeric)) {
            toast.error('Days must be valid numbers')
            return
        }

        if (completeNumeric < 1 || completeNumeric > 30 || cancelNumeric < 1 || cancelNumeric > 30) {
            toast.error('Timeout days must be between 1 and 30')
            return
        }

        startTransition(async () =>
        {
            const result = await updateBookingTimeouts(completeNumeric, cancelNumeric)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Booking timeouts updated successfully')
            }
        })
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Booking Timeouts</CardTitle>
                    <CardDescription>
                        Configure when the system automatically transitions bookings. Changes apply globally to the cron job.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-2">
                        <Label htmlFor="complete-days">Auto-Complete Wait Time (Days)</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="complete-days"
                                type="number"
                                min="1"
                                max="30"
                                step="1"
                                value={completeDays}
                                onChange={(e) => setCompleteDays(e.target.value)}
                            />
                            <span className="text-muted-foreground">days</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Number of days after check-out that a confirmed booking will automatically complete and release funds (default: 3).
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="cancel-days">Auto-Cancel Pending Requests (Days)</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="cancel-days"
                                type="number"
                                min="1"
                                max="30"
                                step="1"
                                value={cancelDays}
                                onChange={(e) => setCancelDays(e.target.value)}
                            />
                            <span className="text-muted-foreground">days</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Number of days after creation that an unconfirmed booking request will be automatically cancelled (default: 2).
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end border-t px-6 py-4">
                    <Button onClick={handleSave} disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
