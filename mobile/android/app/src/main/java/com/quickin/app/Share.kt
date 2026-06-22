package com.quickin.app

import android.content.Context
import android.content.Intent
import android.net.Uri

/**
 * Builds the public, shareable web URLs for QuickIn entities. Every URL is rooted at
 * [Config.SHARE_WEB_BASE_URL] (the website origin), so a recipient without the app installed
 * lands on the site; with the app installed, the App Links intent-filters in AndroidManifest.xml
 * open the app directly (see [DeepLink] for the inbound parse).
 *
 * The path scheme mirrors the website's routes and the manifest's `pathPrefix`es:
 *   /explore/{id}      → a listing
 *   /services/{id}     → a service / experience
 *   /reservation/{id}  → a reservation
 */
object ShareLinks {
    private val base: String get() = Config.SHARE_WEB_BASE_URL.trimEnd('/')

    fun listing(id: String): String = "$base/explore/${Uri.encode(id)}"
    fun service(id: String): String = "$base/services/${Uri.encode(id)}"
    fun reservation(id: String): String = "$base/reservation/${Uri.encode(id)}"

    /**
     * The public stay-pass page for a reservation, keyed by its human reservation CODE (not the
     * internal id), e.g. `https://quickin-frontend.vercel.app/stay/QK-AB12CD`. This is what the
     * in-app QR encodes so a scan (or a tap on the card) opens the deployed pass page.
     */
    fun stay(reservationCode: String): String = "$base/stay/${Uri.encode(reservationCode)}"
}

/**
 * Fires the system share sheet (chooser) to send [text] as `text/plain` from [context].
 * [subject] is carried as `EXTRA_SUBJECT` (used by email / some targets as a title); the
 * [chooserTitle] labels the chooser itself. Best-effort: a missing share target is swallowed
 * so a tap can never crash the app.
 */
fun shareText(
    context: Context,
    text: String,
    subject: String? = null,
    chooserTitle: String? = null
) {
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, text)
        if (!subject.isNullOrBlank()) putExtra(Intent.EXTRA_SUBJECT, subject)
    }
    runCatching { context.startActivity(Intent.createChooser(send, chooserTitle)) }
}

/**
 * An inbound deep link resolved from an incoming `VIEW` intent — either an App Link
 * (`https://quickin-frontend.vercel.app/explore/{id}`) or the custom-scheme fallback
 * (`quickin://explore/{id}`). Parsing is forgiving: anything we don't recognize yields `null`
 * so the caller can simply open the app normally (no crash on a garbage link).
 */
sealed interface DeepLink {
    val id: String

    data class Listing(override val id: String) : DeepLink
    data class Service(override val id: String) : DeepLink
    data class Reservation(override val id: String) : DeepLink
    /** A bare tab route with no entity id, used by app shortcuts / Assistant (e.g. quickin://profile). */
    data class Tab(val key: String) : DeepLink { override val id: String get() = key }

    companion object {
        /**
         * Parses [uri] into a [DeepLink], or returns null when it isn't one of ours. Accepts both
         * the verified https App Links (host must be [Config.SHARE_WEB_HOST]) and the custom
         * [Config.DEEP_LINK_SCHEME] scheme. The first path segment selects the kind; the second
         * is the entity id (e.g. `/explore/{id}`, or `quickin://explore/{id}` where "explore" is
         * the URI host).
         */
        fun parse(uri: Uri?): DeepLink? {
            if (uri == null) return null
            val scheme = uri.scheme?.lowercase()

            // Bare tab routes (no entity id) from app shortcuts / Google Assistant, e.g.
            // quickin://explore, quickin://reservations, quickin://profile.
            if (scheme == Config.DEEP_LINK_SCHEME) {
                val host = uri.host?.takeIf { it.isNotBlank() }?.lowercase()
                val segs = uri.pathSegments.orEmpty().filter { it.isNotBlank() }
                val bare = host ?: segs.firstOrNull()?.lowercase()
                val hasId = if (host != null) segs.isNotEmpty() else segs.size > 1
                if (bare != null && bare in TAB_KEYS && !hasId) return Tab(bare)
            }

            // Path segments after the leading "/". For the custom scheme the route key can arrive
            // as the URI authority (quickin://explore/{id}) rather than a path segment, so fold the
            // host in as a leading segment when it names a route.
            val segments = uri.pathSegments.orEmpty().filter { it.isNotBlank() }.toMutableList()

            val (kind, id) = when (scheme) {
                "https", "http" -> {
                    // Only our website host is honored; foreign https links aren't deep links.
                    if (!uri.host.equals(Config.SHARE_WEB_HOST, ignoreCase = true)) return null
                    val kind = segments.getOrNull(0)?.lowercase() ?: return null
                    val id = segments.getOrNull(1) ?: return null
                    kind to id
                }
                Config.DEEP_LINK_SCHEME -> {
                    // quickin://explore/{id}  → host="explore", segment[0]="{id}"
                    // (also tolerate quickin:///explore/{id} where host is empty and both are paths)
                    val host = uri.host?.takeIf { it.isNotBlank() }?.lowercase()
                    if (host != null && host in ROUTE_KEYS) {
                        val id = segments.getOrNull(0) ?: return null
                        host to id
                    } else {
                        val kind = segments.getOrNull(0)?.lowercase() ?: return null
                        val id = segments.getOrNull(1) ?: return null
                        kind to id
                    }
                }
                else -> return null
            }

            if (id.isBlank()) return null
            return when (kind) {
                "explore", "listing", "listings" -> Listing(id)
                "services", "service" -> Service(id)
                "reservation", "reservations" -> Reservation(id)
                else -> null
            }
        }

        private val ROUTE_KEYS = setOf(
            "explore", "listing", "listings",
            "services", "service",
            "reservation", "reservations"
        )

        /** Bare tab destinations (no id) addressable by app shortcuts / Assistant. */
        private val TAB_KEYS = setOf("explore", "services", "reservations", "trips", "profile")
    }
}
