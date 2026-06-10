import { NextResponse } from 'next/server';
import { adminMessaging } from '@/lib/firebase/admin';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    // Security: Only allow in development environment
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    try {
        // Step 1: Check Firebase Admin is initialized
        console.log('=== FCM TEST: Starting ===');

        // Step 2: Fetch tokens directly
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: staffMembers, error: dbError } = await supabase
            .from('staff_profiles')
            .select('id, display_name, fcm_token')
            .not('fcm_token', 'is', null);

        if (dbError) {
            console.error('=== FCM TEST: DB Error ===', dbError);
            return NextResponse.json({ error: 'DB Error' }, { status: 500 });
        }

        console.log('=== FCM TEST: Staff with tokens ===', staffMembers);

        if (!staffMembers || staffMembers.length === 0) {
            return NextResponse.json({ error: 'No staff members with FCM tokens found' }, { status: 404 });
        }

        const tokens = staffMembers.map(s => s.fcm_token).filter(Boolean) as string[];
        console.log('=== FCM TEST: Tokens ===', tokens);

        // Step 3: Try sending
        const message = {
            notification: {
                title: '🔔 FCM Test',
                body: 'If you see this, push notifications are working!',
            },
            data: {
                type: 'test',
                timestamp: new Date().toISOString(),
            },
            tokens,
        };

        console.log('=== FCM TEST: Sending message ===', JSON.stringify(message));

        if (!adminMessaging) {
            return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
        }
        const response = await adminMessaging.sendEachForMulticast(message);
        console.log('=== FCM TEST: Response ===', JSON.stringify(response));

        return NextResponse.json({
            success: true,
            successCount: response.successCount,
            failureCount: response.failureCount,
            responses: response.responses.map((r: any, i: number) => ({
                success: r.success,
                error: r.error ? { code: r.error.code, message: r.error.message } : null,
                token: tokens[i]?.substring(0, 20) + '...',
            })),
        });
    } catch (error: any) {
        console.error('=== FCM TEST: Caught Error ===', error);
        return NextResponse.json(
            { error: 'An internal server error occurred' },
            { status: 500 }
        );
    }
}
