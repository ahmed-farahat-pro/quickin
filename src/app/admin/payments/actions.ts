'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendFCMNotification } from '@/lib/actions/notifications'
import { createEscrowHold } from '@/lib/actions/escrow'

export async function approveBookingPayment(bookingId: string, paidAmount: number) {
    const adminClient = await createAdminClient()
    if (!adminClient) return { error: 'Database admin not configured' }

    if (paidAmount < 0) {
        return { error: 'Paid amount cannot be negative' }
    }

    try {
        // Fetch booking info before updating to get user details for notification
        const { data: booking, error: fetchError } = await adminClient
            .from('bookings')
            .select(`
                status,
                user_id,
                listing_id,
                check_in,
                check_out,
                paid_amount,
                listings (title, user_id),
                profiles!bookings_user_id_fkey(full_name)
            `)
            .eq('id', bookingId)
            .single()

        if (fetchError || !booking) {
            console.error('Error fetching booking details:', fetchError)
            return { error: 'Failed to find booking' }
        }

        if (booking.status !== 'pending' && booking.status !== 'stalled') {
            return { error: `Cannot approve. Booking is already ${booking.status}.` }
        }

        // Get computed fee breakdown
        const { data: fees } = await adminClient.rpc('calc_booking_fees', { p_booking_id: bookingId }).single() as any
        if (!fees) return { error: 'Failed to compute booking fees' }

        // Fetch platform settings for stalls
        const { data: settings } = await adminClient.from('platform_settings').select('*')
        const enableStalls = settings?.find(s => s.key === 'enable_booking_stalls')?.value === 'true'
        
        const totalPaidSoFar = (booking.paid_amount || 0) + paidAmount
        const isUnderpayment = totalPaidSoFar < fees.total_with_fees

        if (isUnderpayment) {
            if (!enableStalls) {
                return { error: 'Underpayment received but booking stalls are disabled. Please reject the booking or wait for full payment.' }
            }

            // Stalled booking logic
            const { error: stalledError } = await adminClient
                .from('bookings')
                .update({ 
                    status: 'stalled',
                    paid_amount: totalPaidSoFar 
                })
                .eq('id', bookingId)

            if (stalledError) return { error: 'Failed to set booking to stalled' }

            // Notify guest of underpayment
            if (booking.user_id) {
                const title = 'Payment Incomplete'
                const listingData = booking.listings as any;
                const listingTitle = Array.isArray(listingData) ? listingData[0]?.title : listingData?.title;
                const remaining = fees.total_with_fees - totalPaidSoFar;
                const message = `Your payment for ${listingTitle || 'your booking'} was incomplete. You still owe ${remaining} EGP. Your booking is stalled. Please submit a follow-up payment to confirm your reservation.`

                await adminClient.from('user_notifications').insert({
                    user_id: booking.user_id,
                    type: 'payment_status_update',
                    title,
                    message,
                    related_entity_id: bookingId,
                    related_entity_type: 'booking'
                })
            }

            revalidatePath('/admin/payments')
            revalidatePath('/admin/financials')
            revalidatePath(`/dashboard/trips`)
            return { success: true, message: 'Booking stalled due to underpayment' }
        }

        // --- FULL PAYMENT OR OVERPAYMENT LOGIC ---
        const { error } = await adminClient
            .from('bookings')
            .update({ 
                status: 'confirmed',
                paid_amount: totalPaidSoFar
            })
            .eq('id', bookingId)

        if (error) {
            console.error('Error approving payment:', error)
            return { error: 'Failed to approve payment' }
        }

        // Create escrow hold for the booking funds (computes fees internally)
        // this only covers total_with_fees
        await createEscrowHold(bookingId)

        // Handle overpayment
        const overpayment = totalPaidSoFar - fees.total_with_fees
        if (overpayment > 0) {
            await adminClient.from('transactions').insert({
                user_id: booking.user_id,
                type: 'refund' as const,
                amount: overpayment,
                booking_id: bookingId,
                notes: `System automatic refund for overpayment on booking: ${overpayment} EGP`,
            })
        }

        // Trigger Guest Notifications
        if (booking.user_id) {
            const title = 'Payment Approved!'
            const listingData = booking.listings as any;
            const listingTitle = Array.isArray(listingData) ? listingData[0]?.title : listingData?.title;
            let message = `Your payment for ${listingTitle || 'your booking'} was approved. Your reservation is confirmed!`
            if (overpayment > 0) {
                message += ` An overpayment of ${overpayment} EGP has been added to your wallet balance.`
            }

            // 1. Insert DB Notification
            await adminClient.from('user_notifications').insert({
                user_id: booking.user_id,
                type: 'payment_approved',
                title,
                message,
                related_entity_id: bookingId,
                related_entity_type: 'booking'
            })

            // 2. Trigger FCM Push
            const { data: profile } = await adminClient
                .from('profiles')
                .select('fcm_token')
                .eq('id', booking.user_id)
                .single()

            if (profile?.fcm_token) {
                sendFCMNotification([profile.fcm_token], title, message, {
                    type: 'payment_status_update',
                    bookingId
                }).catch(console.error)
            }
        }

        // Trigger Host Notifications
        const bookingWithDetails = booking as any;
        const hostId = Array.isArray(bookingWithDetails?.listings) ? bookingWithDetails?.listings[0]?.user_id : bookingWithDetails?.listings?.user_id;

        if (hostId) {
            const guestData = bookingWithDetails.profiles;
            const guestName = Array.isArray(guestData) ? guestData[0]?.full_name : guestData?.full_name;
            const listingData = bookingWithDetails.listings;
            const listingTitle = Array.isArray(listingData) ? listingData[0]?.title : listingData?.title;

            // Format dates
            const checkInDate = new Date(bookingWithDetails.check_in).toLocaleDateString();
            const checkOutDate = new Date(bookingWithDetails.check_out).toLocaleDateString();

            const title = 'New Booking Confirmed!'
            const message = `${guestName || 'A guest'} has booked ${listingTitle || 'your listing'} from ${checkInDate} to ${checkOutDate}. Payment has been collected.`

            await adminClient.from('user_notifications').insert({
                user_id: hostId,
                type: 'booking_confirmed',
                title,
                message,
                related_entity_id: bookingId,
                related_entity_type: 'booking'
            })

            const { data: hostProfile } = await adminClient
                .from('profiles')
                .select('fcm_token')
                .eq('id', hostId)
                .single()

            if (hostProfile?.fcm_token) {
                sendFCMNotification([hostProfile.fcm_token], title, message, {
                    type: 'new_booking',
                    bookingId
                }).catch(console.error)
            }
        }

        revalidatePath('/admin/payments')
        revalidatePath('/admin/financials')
        revalidatePath('/admin/payouts')
        revalidatePath(`/dashboard/trips`)
        return { success: true }
    } catch (err) {
        console.error('Action error:', err)
        return { error: 'An unexpected error occurred' }
    }
}

export async function rejectBookingPayment(bookingId: string) {
    const adminClient = await createAdminClient()
    if (!adminClient) return { error: 'Database admin not configured' }

    try {
        // Fetch booking info before updating
        const { data: booking, error: fetchError } = await adminClient
            .from('bookings')
            .select('status, user_id, listing_id, listings (title)')
            .eq('id', bookingId)
            .single()

        if (fetchError || !booking) {
            console.error('Error fetching booking details:', fetchError)
            return { error: 'Failed to find booking' }
        }

        if (booking.status !== 'pending') {
            return { error: `Cannot reject. Booking is already ${booking.status}.` }
        }

        const { error } = await adminClient
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', bookingId)

        if (error) {
            console.error('Error rejecting payment:', error)
            return { error: 'Failed to reject payment' }
        }

        // Trigger Guest Notifications
        if (booking && booking.user_id) {
            const title = 'Payment Rejected'
            const listingData = booking.listings as unknown as { title?: string } | { title?: string }[];
            const listingTitle = Array.isArray(listingData) ? listingData[0]?.title : listingData?.title;
            const message = `There was an issue verifying your payment for ${listingTitle || 'your booking'}. The reservation has been cancelled.`

            // 1. Insert DB Notification
            await adminClient.from('user_notifications').insert({
                user_id: booking.user_id,
                type: 'payment_rejected',
                title,
                message,
                related_entity_id: booking.listing_id,
                related_entity_type: 'listing'
            })

            // 2. Trigger FCM Push
            const { data: profile } = await adminClient
                .from('profiles')
                .select('fcm_token')
                .eq('id', booking.user_id)
                .single()

            if (profile?.fcm_token) {
                sendFCMNotification([profile.fcm_token], title, message, {
                    type: 'payment_status_update',
                    bookingId
                }).catch(console.error)
            }
        }

        revalidatePath('/admin/payments')
        revalidatePath('/admin/financials')
        revalidatePath('/admin/payouts')
        revalidatePath(`/dashboard/trips`)
        return { success: true }
    } catch (err) {
        console.error('Action error:', err)
        return { error: 'An unexpected error occurred' }
    }
}
