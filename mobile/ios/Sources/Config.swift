import Foundation

/// Backend configuration for the Next.js API.
///
/// `apiBaseURL` is build-configuration aware:
///   • DEBUG builds (Simulator / local dev) point at the local Next.js dev
///     server. The iOS Simulator shares the host's network, so `127.0.0.1`
///     reaches the dev server running at port 3000.
///   • RELEASE builds point at the deployed production API.
///
/// After deploying the web app to Vercel, replace the production URL below
/// with your real Vercel domain (e.g. "https://quickin.vercel.app") — no
/// trailing slash.
enum Config {
    // Live Vercel backend — the app fetches real data from production by default, so it
    // works on the Simulator/device with no local server. For local dev against
    // `npm run dev`, switch the DEBUG value back to "http://127.0.0.1:3000".
    #if DEBUG
    static let apiBaseURL = "https://quickin-backend.vercel.app"
    #else
    static let apiBaseURL = "https://quickin-backend.vercel.app"
    #endif

    /// Google **iOS OAuth client id** (from Google Cloud Console →
    /// Credentials → "OAuth 2.0 Client IDs" → iOS).
    ///
    /// Leave empty to disable the "Continue with Google" button (AuthView
    /// shows an inline note instead). When set, AuthView runs an
    /// `ASWebAuthenticationSession` OAuth flow and POSTs the resulting
    /// `id_token` to `/api/auth/google`.
    ///
    /// Example: "1234567890-abcdefg.apps.googleusercontent.com"
    static let googleClientID = "293984451588-u9c2d10ecjq5qpfvm96kcda09iqr9iqs.apps.googleusercontent.com"

    /// Google Maps iOS SDK key.
    // Set to switch the map to the Google Maps iOS SDK (needs the SDK added via SPM + this key).
    //
    // The Explore map currently uses Apple MapKit (Sources/ListingsMapView.swift),
    // which renders the same Airbnb-style burgundy price pins natively with no
    // key and no dependency download. Swapping to the Google Maps iOS SDK is a
    // documented follow-up: add the `GoogleMaps` package via SPM, set this key,
    // then replace the MapKit `Map` in ListingsMapView with a `GMSMapView`
    // wrapped in a `UIViewRepresentable` (using `GMSMarker` + a custom price-pin
    // icon view). Until then this stays empty and MapKit is the live map.
    static let googleMapsAPIKey = "AIzaSyBigDJt5v66YrCqY-kd-V7AdU8fJl3N5_I"

    /// Reversed-client-id URL scheme that Google redirects back to after the
    /// OAuth flow. For an iOS client id this is the client id with the two
    /// dotted halves swapped, e.g.
    /// "com.googleusercontent.apps.1234567890-abcdefg". Derived automatically
    /// from `googleClientID` when possible.
    static var googleRedirectScheme: String? {
        guard !googleClientID.isEmpty else { return nil }
        // iOS client ids look like "<num>-<hash>.apps.googleusercontent.com".
        // The redirect scheme reverses host components:
        // "com.googleusercontent.apps.<num>-<hash>".
        let parts = googleClientID.components(separatedBy: ".")
        guard let prefix = parts.first, parts.contains("apps") else { return nil }
        return "com.googleusercontent.apps.\(prefix)"
    }
}
