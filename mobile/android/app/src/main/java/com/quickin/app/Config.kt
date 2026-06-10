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
     * Google OAuth **server/web** client ID (the "Web application" OAuth 2.0 client
     * created in the Google Cloud Console — the same one the backend verifies against
     * in GOOGLE_CLIENT_ID). Leave blank to disable Google sign-in: the button then
     * shows an inline note instead of attempting a (guaranteed-to-fail) OAuth flow.
     *
     * To enable: paste the web client id here, e.g.
     *   const val GOOGLE_CLIENT_ID = "1234567890-abc123.apps.googleusercontent.com"
     */
    const val GOOGLE_CLIENT_ID = ""

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
    const val MAPS_API_KEY = ""
}
