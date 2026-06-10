import { getBookingTimeouts } from '@/lib/actions/booking-settings'
import { BookingTimeoutsForm } from './bookings-form'
import { getTranslations } from 'next-intl/server'

export const metadata = {
    title: 'Booking Settings',
}

export default async function BookingSettingsPage()
{
    const timeouts = await getBookingTimeouts()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Booking Settings</h1>
                <p className="text-muted-foreground mt-2">
                    Manage automated system timeouts and booking lifecycles.
                </p>
            </div>

            <BookingTimeoutsForm initialTimeouts={timeouts} />
        </div>
    )
}
