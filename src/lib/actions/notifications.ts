'use server'

import { adminMessaging } from '../firebase/admin';
import { createAdminClient } from '@/lib/supabase/admin';

export async function sendFCMNotification(
    tokens: string[],
    title: string,
    body: string,
    data?: { [key: string]: string }
) {
    if (!tokens || tokens.length === 0) return;

    const message = {
        notification: {
            title,
            body,
        },
        data,
        tokens, // Multicast message
    };

    try {
        if (!adminMessaging) {
            console.warn('Firebase Admin not initialized, skipping notification');
            return;
        }
        const response = await adminMessaging.sendEachForMulticast(message);
        console.log(`${response.successCount} messages were sent successfully`);
        if (response.failureCount > 0) {
            const failedTokens: string[] = [];
            response.responses.forEach((resp: any, idx: number) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                }
            });
            console.log('List of tokens that caused failures: ' + failedTokens);
        }
    } catch (error) {
        console.error('Error sending FCM notification:', error);
    }
}

export async function notifyNewChatMessage(bookingId: string, senderId: string, messageText: string) {
    const adminClient = createAdminClient();
    if (!adminClient) return;

    // Fetch booking to find guest and host
    const { data: booking, error: bookingError } = await adminClient
        .from('bookings')
        .select('user_id, listing:listings(user_id, title)')
        .eq('id', bookingId)
        .single();

    if (bookingError || !booking) {
        console.error('Failed to fetch booking for notification:', bookingError);
        return;
    }

    const listing = Array.isArray(booking.listing) ? booking.listing[0] : booking.listing;
    const guestId = booking.user_id;
    const hostId = listing?.user_id;
    const listingTitle = listing?.title || 'a booking';

    // Determine recipients
    const recipientIds: string[] = [];
    let senderName = 'Someone';

    if (senderId === guestId) {
        // Sender is guest, notify host
        recipientIds.push(hostId);
        
        // Try to get guest name
        const { data: profile } = await adminClient.from('profiles').select('display_name, first_name').eq('id', guestId).single();
        senderName = profile?.display_name || profile?.first_name || 'A guest';
    } else if (senderId === hostId) {
        // Sender is host, notify guest
        recipientIds.push(guestId);

        // Try to get host name
        const { data: profile } = await adminClient.from('profiles').select('display_name, first_name').eq('id', hostId).single();
        senderName = profile?.display_name || profile?.first_name || 'Your host';
    } else {
        // Sender is admin, notify both
        recipientIds.push(guestId, hostId);
        senderName = 'QuickIn Support';
    }

    if (recipientIds.length === 0) return;

    // Fetch tokens for recipients
    const { data: profiles } = await adminClient
        .from('profiles')
        .select('fcm_token')
        .in('id', recipientIds)
        .not('fcm_token', 'is', null);

    if (!profiles || profiles.length === 0) return;

    const tokens = profiles.map(p => p.fcm_token).filter(Boolean) as string[];

    if (tokens.length > 0) {
        const title = `New message from ${senderName}`;
        const body = messageText.length > 50 ? messageText.substring(0, 47) + '...' : messageText;
        
        await sendFCMNotification(tokens, title, body, {
            type: 'chat_message',
            bookingId
        });
    }
}

