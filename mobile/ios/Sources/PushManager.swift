import SwiftUI
import UIKit
import UserNotifications
import FirebaseCore
import FirebaseMessaging

/// Coordinates push-notification registration for QuickIn.
///
/// Push is delivered through **Firebase Cloud Messaging (FCM)**: APNs hands the
/// app a device token, we forward it to Firebase, and Firebase mints an FCM
/// registration token. That FCM token — *not* the raw APNs token — is what the
/// backend stores and targets (it sends via FCM HTTP v1). So registration with
/// the backend (`NotificationService.registerDeviceToken`) happens from the
/// `MessagingDelegate` callback once the FCM token is available.
///
/// Everything here is best-effort: if the user declines notifications, or push
/// entitlements aren't provisioned, the FCM token simply never arrives —
/// it never blocks the app or surfaces an error.
@MainActor
final class PushManager: ObservableObject {
    static let shared = PushManager()

    /// The latest FCM registration token, cached so we can (re)register it with
    /// the backend the moment the user signs in — even if the token arrived
    /// before login.
    private(set) var fcmToken: String?

    /// Drives the in-app "Turn on notifications" prompt: true only when the OS
    /// status is `.notDetermined` (we've never asked) so we surface a clear,
    /// well-timed ask instead of a bare launch dialog the user may miss.
    @Published var shouldPromptForPermission = false
    /// True when the user previously denied — the in-app prompt then routes to Settings.
    @Published var permissionDenied = false

    private init() {}

    /// Refresh the published permission flags from the OS (call after login).
    func refreshPermissionState() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                self.shouldPromptForPermission = settings.authorizationStatus == .notDetermined
                self.permissionDenied = settings.authorizationStatus == .denied
            }
        }
    }

    /// Open the iOS Settings page for QuickIn (used when notifications were denied).
    func openSystemSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    /// Ask for notification permission and, if granted, register with APNs.
    /// Obtaining the APNs token lets Firebase produce the FCM token (delivered
    /// via `MessagingDelegate`). Safe to call repeatedly (e.g. on launch + login).
    func requestAuthorizationAndRegister() {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            guard granted else { return }
            DispatchQueue.main.async {
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
    }

    /// Register with APNs ONLY if the user already granted permission (no dialog).
    /// Used at launch so returning, opted-in users keep a fresh token without the
    /// notDetermined case showing a bare system prompt before our in-app primer.
    func registerIfAuthorized() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
                DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() }
            }
        }
    }

    /// Called by the `MessagingDelegate` whenever Firebase has a (new) FCM
    /// registration token. Caches it and forwards it to the backend if the user
    /// is already signed in.
    func didReceive(fcmToken token: String) {
        self.fcmToken = token
        Task { await NotificationService.shared.registerDeviceToken(token) }
    }

    /// Re-send the cached FCM token to the backend (call after a successful login
    /// so the freshly-authenticated user gets the token attached to their
    /// account). If no token has arrived yet, kick off registration so one does.
    func registerWithBackendIfAvailable() {
        // Register the cached token if we already have one.
        if let fcmToken {
            Task { await NotificationService.shared.registerDeviceToken(fcmToken) }
        }
        // Also fetch the current FCM token on demand — covers the common case where
        // the token was minted before the user signed in, so the delegate fired
        // while signed-out (no bearer) and we need to (re)send it now on login.
        // Returns an error (ignored) if APNs hasn't provided a token yet.
        Messaging.messaging().token { [weak self] token, _ in
            guard let token, !token.isEmpty else { return }
            self?.fcmToken = token
            Task { await NotificationService.shared.registerDeviceToken(token) }
        }
    }
}

/// `UIApplicationDelegate` bridged into the SwiftUI `App` via
/// `@UIApplicationDelegateAdaptor`. Owns the Firebase + push wiring that SwiftUI
/// has no native hook for: it configures Firebase at launch, forwards the APNs
/// token to FCM, receives the FCM registration token, and presents
/// notifications while the app is foregrounded.
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Initialize Firebase from the bundled GoogleService-Info.plist. Must run
        // before any Firebase API is touched.
        FirebaseApp.configure()

        // Route FCM token updates here and let this delegate present
        // notifications in the foreground.
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().delegate = self

        // At launch only re-register opted-in users (no dialog). The first-time
        // ask is surfaced as an explicit in-app primer after login (QuickInApp).
        Task { @MainActor in PushManager.shared.registerIfAuthorized() }

        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        // Hand the raw APNs token to Firebase; it pairs it with the FCM token and
        // delivers the result via `messaging(_:didReceiveRegistrationToken:)`.
        Messaging.messaging().apnsToken = deviceToken
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // Best-effort: a simulator without push entitlements lands here. Nothing
        // to surface to the user — the app works fine without push.
        #if DEBUG
        print("Push registration failed: \(error.localizedDescription)")
        #endif
    }
}

// MARK: - FCM registration token

extension AppDelegate: MessagingDelegate {
    /// Fires whenever Firebase mints or refreshes the FCM registration token.
    /// This is the token the backend targets, so we register it (best-effort).
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let fcmToken else { return }
        Task { @MainActor in PushManager.shared.didReceive(fcmToken: fcmToken) }
    }
}

// MARK: - Foreground presentation

extension AppDelegate: UNUserNotificationCenterDelegate {
    /// Show notifications (banner + sound, update the badge) even while the app
    /// is in the foreground — otherwise iOS suppresses them by default.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .sound, .badge])
    }
}
