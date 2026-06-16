package com.quickin.app

import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Resolves this device's push (FCM) registration token for backend registration.
 *
 * Firebase Cloud Messaging is a real compile-time dependency now (see app/build.gradle.kts:
 * `firebase-messaging` + the `google-services` plugin + app/google-services.json for project
 * `quickin-4baea`), so we call [FirebaseMessaging.getInstance] directly — no reflection. The
 * token is what the backend stores and targets when it sends a push via FCM HTTP v1.
 *
 * Everything here is best-effort: the fetch returns null (never throws) when Google Play services
 * is unavailable, the device is offline, or no token has been minted yet. A real token only
 * appears on a physical device / a Play-services-equipped emulator image — a bare AVD won't mint
 * one. Callers (the after-login path in [NotificationsViewModel] and [QuickInMessagingService]'s
 * onNewToken) wrap registration so a null token simply means "nothing to send yet".
 */
object PushTokenManager {

    /**
     * Returns the current device FCM token, or null when none is available (Play services missing,
     * offline, not yet minted, or the fetch failed). Suspends until the underlying Task completes.
     * Never throws.
     */
    suspend fun currentToken(): String? = suspendCancellableCoroutine { cont ->
        try {
            FirebaseMessaging.getInstance().token
                .addOnCompleteListener { task ->
                    val token = if (task.isSuccessful) task.result?.takeIf { it.isNotBlank() } else null
                    if (cont.isActive) cont.resume(token)
                }
        } catch (_: Throwable) {
            // Defensive: any unexpected failure (e.g. Firebase not initialized) → no token.
            if (cont.isActive) cont.resume(null)
        }
    }
}
