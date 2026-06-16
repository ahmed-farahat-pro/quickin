package com.quickin.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Firebase Cloud Messaging entry point. Two responsibilities, both crash-safe (every body is
 * wrapped so a malformed payload or a transient failure can never crash the app):
 *
 *  - [onNewToken]: the device's FCM registration token rotated (or was first issued). If the user
 *    is signed in we register it with the backend immediately (`POST /api/local/notifications/device`,
 *    via [NotificationService.registerDeviceToken] — the same contract [NotificationsViewModel] uses
 *    after login). Either way we stash it in SharedPreferences so the post-login path can re-register
 *    it (and so [PushTokenManager] callers have a cached value).
 *
 *  - [onMessageReceived]: a push arrived while the app was in the foreground (background/ notification
 *    messages are drawn by the system using the manifest's default channel/icon). We post a
 *    notification on the "quickin_default" channel using the message's notification title/body, and
 *    attach the `data.link` (if present) as a deep link so tapping opens the right screen via
 *    [MainActivity]'s existing VIEW-intent handling.
 */
class QuickInMessagingService : FirebaseMessagingService() {

    // Own scope for the best-effort backend registration in onNewToken (the service may be torn
    // down right after the callback, so we don't rely on a caller's lifecycle).
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        runCatching {
            // Cache the latest token so the after-login registration path can resend it even if
            // the user wasn't signed in when it rotated.
            val prefs = getSharedPreferences(AuthViewModel.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_PENDING_PUSH_TOKEN, token).apply()

            val bearer = prefs.getString(AuthViewModel.KEY_TOKEN, null)
            if (!bearer.isNullOrBlank()) {
                scope.launch {
                    runCatching { NotificationService.registerDeviceToken(bearer, token) }
                }
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        runCatching {
            val notif = message.notification
            // Prefer the notification block; fall back to data keys so data-only pushes still show.
            val title = notif?.title
                ?: message.data["title"]
                ?: getString(R.string.app_name)
            val body = notif?.body
                ?: message.data["body"]
                ?: message.data["message"]
                ?: return
            val link = message.data["link"]
            showNotification(title, body, link)
        }
    }

    private fun showNotification(title: String, body: String, link: String?) {
        ensureChannel()

        // Tapping the notification opens MainActivity. When a deep link is present we set it as the
        // intent data with ACTION_VIEW so MainActivity.handleIntent routes it (App Link / quickin://);
        // otherwise we just bring the app to the front.
        val intent = if (!link.isNullOrBlank()) {
            Intent(Intent.ACTION_VIEW, Uri.parse(link)).setPackage(packageName)
        } else {
            Intent(this, MainActivity::class.java)
        }.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        val contentIntent = PendingIntent.getActivity(
            this,
            link.hashCode(),
            intent,
            flags
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            // Launcher icon as the small icon — always resolvable, so this never throws.
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(contentIntent)

        // POST_NOTIFICATIONS may be denied on Android 13+; NotificationManagerCompat.notify then
        // no-ops, but guard explicitly to avoid any surprise. A unique id lets multiple stack.
        runCatching {
            NotificationManagerCompat.from(this)
                .notify(System.currentTimeMillis().toInt(), builder.build())
        }
    }

    /** Creates the "quickin_default" channel on API 26+ (no-op below, and idempotent above). */
    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notif_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = getString(R.string.notif_channel_desc)
        }
        manager.createNotificationChannel(channel)
    }

    companion object {
        /** Default notification channel id; mirrored by the manifest's FCM channel meta-data. */
        const val CHANNEL_ID = "quickin_default"

        /**
         * SharedPreferences key (in the shared "qk_auth" store) holding the latest FCM token,
         * cached so the after-login registration path can resend it. Read opportunistically; the
         * primary source remains [PushTokenManager.currentToken].
         */
        const val KEY_PENDING_PUSH_TOKEN = "pending_push_token"
    }
}
