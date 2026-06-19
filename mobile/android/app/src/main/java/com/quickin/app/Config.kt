package com.quickin.app

/**
 * Backend configuration for the Next.js API.
 *
 * The API base URL is supplied per build type via BuildConfig.API_BASE_URL
 * (see app/build.gradle.kts):
 *   - debug   -> http://10.0.2.2:3000  (local Next.js dev server; 10.0.2.2 is the
 *                host machine as seen from the Android emulator)
 *   - release -> the production Vercel URL
 */
object Config {
    val API_BASE_URL: String = BuildConfig.API_BASE_URL

    /**
     * Base URL of the local Egyptian National ID OCR server (the Python/EasyOCR service
     * on port 8000). Used by [IDScanService].
     *
     * **Update the IP in this one place when your dev Mac's address changes**
     * (`ipconfig getifaddr en0`), and keep it in sync with the cleartext allowlist in
     * res/xml/network_security_config.xml:
     *   - Real device on the same Wi-Fi -> http://<Mac-LAN-IP>:8000  (e.g. 192.168.8.24)
     *   - Android emulator              -> http://10.0.2.2:8000      (host machine alias)
     */
    const val ID_OCR_BASE_URL = "http://192.168.8.24:8000"

    /**
     * Google OAuth **server/web** client ID (the "Web application" OAuth 2.0 client
     * created in the Google Cloud Console — the same one the backend verifies against
     * in GOOGLE_CLIENT_ID). Leave blank to disable Google sign-in: the button then
     * shows an inline note instead of attempting a (guaranteed-to-fail) OAuth flow.
     *
     * To enable: paste the web client id here, e.g.
     *   const val GOOGLE_CLIENT_ID = "1234567890-abc123.apps.googleusercontent.com"
     */
    const val GOOGLE_CLIENT_ID = "293984451588-t58dlg9hss3qjk9qmikdu3tv7qln11sb.apps.googleusercontent.com"

    /**
     * Google Maps SDK API key. Leave blank to use the bundled osmdroid map (which still renders
     * the Airbnb-style burgundy price pills). When set to a real, Maps-SDK-enabled key, the
     * Explore "Map" tab switches to a native Google Maps view with the same price pills.
     *
     * Two things must line up for Google Maps to work:
     *   1. This constant must be non-empty (it selects the Google Maps code path at runtime).
     *   2. The manifest meta-data `com.google.android.geo.API_KEY` must carry the same key —
     *      supply it at build time via `-PMAPS_API_KEY=...` or a `MAPS_API_KEY=...` gradle
     *      property (see app/build.gradle.kts), which the SDK reads to authorize tile loads.
     *
     * To enable, set both, e.g.
     *   const val MAPS_API_KEY = "AIzaSyABC123..."   // + -PMAPS_API_KEY=AIzaSyABC123...
     */
    const val MAPS_API_KEY = "AIzaSyBigDJt5v66YrCqY-kd-V7AdU8fJl3N5_I"

    /**
     * Public **web** origin used to build shareable links. Shared URLs point at the website so a
     * recipient without the app installed lands on the site; with the app installed, the App Links
     * intent-filters in AndroidManifest.xml (autoVerify, host [SHARE_WEB_HOST]) open the app
     * straight to the matching detail screen.
     *
     * This is deliberately the public site domain, NOT [API_BASE_URL] (the backend API origin).
     * The path scheme mirrors the website's routes (see [ShareLinks]):
     *   /explore/{id}  ·  /services/{id}  ·  /reservation/{id}
     */
    const val SHARE_WEB_BASE_URL = "https://quickin-frontend.vercel.app"

    /** Host of [SHARE_WEB_BASE_URL]; mirrored by the App Links intent-filters in the manifest. */
    const val SHARE_WEB_HOST = "quickin-frontend.vercel.app"

    /** Custom URL scheme used by the no-verification deep-link fallback, e.g. `quickin://explore/{id}`. */
    const val DEEP_LINK_SCHEME = "quickin"
}
