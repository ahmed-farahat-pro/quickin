import Foundation
import LocalAuthentication
import SwiftUI

/// Face ID / Touch ID sign-in helper.
///
/// Bridges `LocalAuthentication` (the biometric prompt) with a tiny Keychain
/// store that holds the last session — the bearer token plus the signed-in
/// `AuthUser` JSON — so a returning visitor can unlock straight back into the
/// app without retyping their password.
///
/// The session is written to the Keychain with
/// `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`: it never leaves the device,
/// never syncs to iCloud, and is readable only while the device is unlocked.
/// It is cleared on logout (see `AuthStore.logout()`).
@MainActor
final class BiometricAuth {
    static let shared = BiometricAuth()

    /// What the device supports, so the UI can pick the right wording + glyph.
    enum Kind {
        case faceID
        case touchID
        case none

        /// SF Symbol for the sign-in button (`faceid` / `touchid`).
        var symbol: String {
            switch self {
            case .faceID: return "faceid"
            case .touchID: return "touchid"
            case .none:    return "lock.shield"
            }
        }

        /// Localized human name ("Face ID" / "Touch ID").
        @MainActor
        var displayName: String {
            switch self {
            case .faceID: return L.t("biometric.faceID")
            case .touchID: return L.t("biometric.touchID")
            case .none:    return L.t("biometric.generic")
            }
        }
    }

    // MARK: - Capability

    /// The biometry the device offers right now (enrolled + available).
    func availableKind() -> Kind {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return .none
        }
        switch context.biometryType {
        case .faceID:  return .faceID
        case .touchID: return .touchID
        default:       return .none
        }
    }

    /// Whether biometrics are usable on this device (enrolled + not locked out).
    var isAvailable: Bool { availableKind() != .none }

    // MARK: - Biometric prompt

    /// Present the system Face ID / Touch ID prompt. Returns `true` only on a
    /// successful match. Throws nothing — a cancel, fallback, or lockout all
    /// resolve to `false` so the caller can fall back to the password form.
    func authenticate(reason: String) async -> Bool {
        let context = LAContext()
        context.localizedFallbackTitle = "" // hide "Enter Password" — we fall back ourselves
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) else {
            return false
        }
        return await withCheckedContinuation { continuation in
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, _ in
                continuation.resume(returning: success)
            }
        }
    }

    // MARK: - Stored session (Keychain)

    /// Whether a biometric session is on file (drives the "Sign in with Face ID"
    /// button on the auth screen).
    var hasStoredSession: Bool {
        Keychain.read(account: Self.tokenAccount) != nil
    }

    /// The display name of the account behind the stored session, if any — used
    /// to label the Face ID button ("Sign in as Layla with Face ID").
    func storedUserDisplayName() -> String? {
        guard let user = storedUser() else { return nil }
        if let name = user.fullName?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty {
            return name
        }
        if let local = user.email.split(separator: "@").first { return String(local) }
        return nil
    }

    /// Persist the current session so it can be unlocked with biometrics later.
    /// Called when the user opts in via the "Enable Face ID" prompt after a
    /// successful password login.
    func storeSession(token: String, user: AuthUser) {
        guard let userData = try? JSONEncoder().encode(user) else { return }
        Keychain.save(token.data(using: .utf8) ?? Data(), account: Self.tokenAccount)
        Keychain.save(userData, account: Self.userAccount)
    }

    /// Refresh just the stored user JSON (keeping the same token) so a later
    /// Face ID sign-in restores up-to-date profile fields. No-op when nothing is
    /// stored. Called from `AuthStore.applyProfile`.
    func updateStoredUserIfPresent(_ user: AuthUser, token: String) {
        guard hasStoredSession else { return }
        storeSession(token: token, user: user)
    }

    /// Read back the stored `{ token, user }`, or `nil` if none / corrupt.
    func loadStoredSession() -> (token: String, user: AuthUser)? {
        guard
            let tokenData = Keychain.read(account: Self.tokenAccount),
            let token = String(data: tokenData, encoding: .utf8),
            !token.isEmpty,
            let user = storedUser()
        else { return nil }
        return (token, user)
    }

    /// Remove the stored session (logout, or after the token stops working).
    func clearStoredSession() {
        Keychain.delete(account: Self.tokenAccount)
        Keychain.delete(account: Self.userAccount)
    }

    // MARK: - Internals

    private func storedUser() -> AuthUser? {
        guard let data = Keychain.read(account: Self.userAccount) else { return nil }
        return try? JSONDecoder().decode(AuthUser.self, from: data)
    }

    private static let tokenAccount = "qk_biometric_token"
    private static let userAccount  = "qk_biometric_user"
}

/// Minimal Keychain wrapper (generic-password items) scoped to this app.
///
/// Items are stored `WhenUnlockedThisDeviceOnly`: present only while the device
/// is unlocked and never migrated to a new device or iCloud Keychain.
enum Keychain {
    private static let service = "com.quickin.ahmed.biometric"

    @discardableResult
    static func save(_ data: Data, account: String) -> Bool {
        // Replace any existing item for this account.
        delete(account: account)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }

    static func read(account: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess else { return nil }
        return item as? Data
    }

    @discardableResult
    static func delete(account: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
}
