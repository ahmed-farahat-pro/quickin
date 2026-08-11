import Foundation
import SwiftUI

/// The authenticated user returned by the local Next.js auth API.
///
/// Under the **unified account contract** there's one account per person: a
/// normal user signs in and *applies to become a host*, which an admin reviews
/// before `isHost` flips on the same account. `role` is a derived convenience
/// the backend still sends (`"host"` when `isHost`, else `"guest"`) — `isHost`
/// is the source of truth the UI branches on, and it only ever comes from the
/// server (see `AuthStore.refreshSession`).
struct AuthUser: Codable, Equatable {
    let id: String
    let email: String
    let fullName: String?
    let provider: String?
    let avatarURL: String?
    let role: String?
    /// Whether this account is a host. Defaults to `false` when the backend
    /// omits it; also inferred from `role == "host"` for older responses.
    let isHost: Bool
    /// What the account applied (or was approved) as — `individual` / `company`
    /// / `brokerage`; nil when there's no application on file.
    let hostType: String?
    /// Where the account sits in the become-a-host flow. Server-derived; an
    /// account the backend calls a host always reads as `.approved`, even when
    /// it predates the applications table (legacy rule in the contract).
    let hostStatus: HostStatus
    /// The admin's reason, set only when `hostStatus == .rejected`.
    let hostReviewNote: String?

    enum CodingKeys: String, CodingKey {
        case id, email, provider, role
        case fullName = "full_name"
        case avatarURL = "avatar_url"
        case isHost = "is_host"
        case hostType = "host_type"
        case hostStatus = "host_status"
        case hostReviewNote = "host_review_note"
    }

    init(
        id: String,
        email: String,
        fullName: String?,
        provider: String?,
        avatarURL: String?,
        role: String?,
        isHost: Bool = false,
        hostType: String? = nil,
        hostStatus: HostStatus = .none,
        hostReviewNote: String? = nil
    ) {
        self.id = id
        self.email = email
        self.fullName = fullName
        self.provider = provider
        self.avatarURL = avatarURL
        self.role = role
        self.isHost = isHost
        self.hostType = hostType
        // Keep the invariant the contract demands: a host is always `approved`.
        self.hostStatus = isHost ? .approved : hostStatus
        self.hostReviewNote = hostReviewNote
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        email = try c.decode(String.self, forKey: .email)
        fullName = try c.decodeIfPresent(String.self, forKey: .fullName)
        provider = try c.decodeIfPresent(String.self, forKey: .provider)
        avatarURL = try c.decodeIfPresent(String.self, forKey: .avatarURL)
        let decodedRole = try c.decodeIfPresent(String.self, forKey: .role)
        role = decodedRole
        // Prefer the explicit boolean; fall back to the derived role string so a
        // backend that only sends `role: "host"` still reads as a host.
        let flag = try c.decodeIfPresent(Bool.self, forKey: .isHost)
        let resolvedIsHost = flag ?? (decodedRole?.lowercased() == "host")
        isHost = resolvedIsHost
        hostType = try c.decodeIfPresent(String.self, forKey: .hostType)
        // Legacy rule: `is_host == true` ⇒ approved, whatever the application
        // row says (pre-existing hosts have no row at all).
        let decodedStatus = HostStatus(raw: try c.decodeIfPresent(String.self, forKey: .hostStatus))
        hostStatus = resolvedIsHost ? .approved : decodedStatus
        hostReviewNote = try c.decodeIfPresent(String.self, forKey: .hostReviewNote)
    }

    /// A copy of this account carrying a new application state. Never touches
    /// `isHost` — only an admin approval (reflected by the server) does that.
    func withHostStatus(_ status: HostStatus, hostType: String? = nil, reviewNote: String? = nil) -> AuthUser {
        AuthUser(
            id: id,
            email: email,
            fullName: fullName,
            provider: provider,
            avatarURL: avatarURL,
            role: role,
            isHost: isHost,
            hostType: hostType ?? self.hostType,
            hostStatus: status,
            hostReviewNote: reviewNote
        )
    }
}

/// Shape of a successful auth response: `{ token, user }`.
struct AuthSuccess: Decodable {
    let token: String
    let user: AuthUser
}

/// Shape of an error response: `{ error }`, optionally carrying
/// `needsVerification` (login of an unverified email) so the UI can route the
/// user to the OTP screen.
private struct AuthErrorBody: Decodable {
    let error: String
    let needsVerification: Bool?
    let email: String?
}

/// Shape of a `{ pending: true, email, devCode? }` response from `/signup` and
/// `/resend-otp`. No token is issued until the email is verified.
private struct PendingBody: Decodable {
    let pending: Bool
    let email: String?
    let devCode: String?
}

/// Shape of `GET /api/auth/me` → `{ user }`. This is the authoritative account
/// state the client re-reads on every launch (see `refreshSession`).
///
/// The backend answers 200 with `user: null` for a token it can't resolve, and
/// 200 with `user: null` **plus** an `error` when the lookup itself blew up — so
/// both are decoded to tell "signed out" apart from "server hiccup".
private struct MeResponse: Decodable {
    let user: AuthUser?
    let error: String?
}

/// The outcome of a signup or login attempt, so the view can decide whether to
/// present the OTP verification screen.
enum AuthOutcome: Equatable {
    /// Session established (token stored, user signed in).
    case authenticated
    /// The email needs OTP verification — present the OTP screen for `email`.
    case needsVerification(email: String, devCode: String? = nil)
    /// The request failed; the message is already set on `errorMessage`.
    case failed
}

/// Holds the signed-in session and talks to the local auth endpoints.
///
/// Persists the bearer token in `UserDefaults` under `qk_token` and restores
/// the session on launch. No Supabase, no third-party SDKs — pure URLSession.
@MainActor
final class AuthStore: ObservableObject {
    @Published var isAuthenticated = false
    @Published var user: AuthUser?
    @Published var errorMessage: String?
    @Published var isLoading = false

    static let tokenKey = "qk_token"
    private static let userKey = "qk_user"

    private let defaults: UserDefaults
    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 15
        cfg.waitsForConnectivity = true
        return URLSession(configuration: cfg)
    }()

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        restoreSession()
    }

    // MARK: - Session restore / persistence

    /// Restore the session on launch. The cached `qk_user` is used for the FIRST
    /// PAINT ONLY — it's a cache, never the truth — and is immediately followed
    /// by a `GET /api/auth/me` whose answer replaces it (`refreshSession`).
    /// Trusting the cache alone is what used to make host surfaces flicker in
    /// (or linger) after a relaunch.
    private func restoreSession() {
        guard let token = defaults.string(forKey: Self.tokenKey), !token.isEmpty else {
            return
        }
        isAuthenticated = true
        if let data = defaults.data(forKey: Self.userKey),
           let saved = try? JSONDecoder().decode(AuthUser.self, from: data) {
            user = saved
        }
        Task { await refreshSession() }
    }

    /// Re-read the authoritative account from `GET /api/auth/me` and adopt it.
    ///
    /// **The server always wins.** Whatever it returns replaces the cached
    /// account — including overwriting a cached `is_host: true` with `false`, so
    /// host surfaces can never persist on an account the backend no longer
    /// considers a host. Host state (`is_host` / `host_status`) is therefore
    /// only ever as fresh as this call.
    ///
    /// A dead token (401, or the 200 `{ user: null }` this backend answers with)
    /// clears the session rather than leaving a phantom one behind. A transport
    /// failure or a server-side error leaves the cached session alone so the app
    /// still opens offline. Runs quietly: it never touches `isLoading` or
    /// `errorMessage`.
    @discardableResult
    func refreshSession() async -> Bool {
        guard let token = currentToken else { return false }
        guard let url = URL(string: Config.apiBaseURL + "/api/auth/me") else { return false }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { return false }
            if http.statusCode == 401 {
                logout()
                return false
            }
            guard (200...299).contains(http.statusCode),
                  let decoded = try? JSONDecoder().decode(MeResponse.self, from: data) else {
                return false
            }
            guard let serverUser = decoded.user else {
                // No user and no server error → the token no longer resolves.
                // With an error the lookup just failed; keep the session.
                if decoded.error == nil { logout() }
                return false
            }
            applyUser(serverUser)
            return true
        } catch {
            // Offline / transient — keep the cached session so the app opens.
            return false
        }
    }

    private func persist(token: String, user: AuthUser) {
        defaults.set(token, forKey: Self.tokenKey)
        if let data = try? JSONEncoder().encode(user) {
            defaults.set(data, forKey: Self.userKey)
        }
        self.user = user
        self.isAuthenticated = true
    }

    /// The token of the just-persisted session, if any. Lets the sign-in view
    /// grab the bearer token to stash in the Keychain when the user opts into
    /// Face ID, without re-reading UserDefaults.
    var currentToken: String? {
        let value = defaults.string(forKey: Self.tokenKey)
        return (value?.isEmpty == false) ? value : nil
    }

    // MARK: - Deferred login (for the Face ID opt-in prompt)

    /// Like `login`, but holds the session **without** publishing
    /// `isAuthenticated`, so the sign-in screen can show an "Enable Face ID?"
    /// prompt before the presenting sheet auto-dismisses on the authenticated
    /// flip. The token + user are returned to the caller; the session is NOT
    /// persisted until `commitDeferredSession` is called.
    ///
    /// Mirrors `login`'s error handling: `.needsVerification` / `.failed` are
    /// surfaced exactly as in the normal path (and in those cases nothing is
    /// staged). On `.authenticated` the caller MUST eventually call
    /// `commitDeferredSession` to finish signing in.
    func loginDeferred(email: String, password: String) async -> (AuthOutcome, AuthSuccess?) {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let result = await send(path: "/api/auth/login", body: [
            "email": email,
            "password": password,
        ])

        switch result {
        case .success(let data):
            guard let session = try? JSONDecoder().decode(AuthSuccess.self, from: data) else {
                errorMessage = "Unexpected response from the server."
                return (.failed, nil)
            }
            return (.authenticated, session)
        case .failure(let http, let data):
            if http.statusCode == 403,
               let body = try? JSONDecoder().decode(AuthErrorBody.self, from: data),
               body.needsVerification == true {
                return (.needsVerification(email: body.email ?? email), nil)
            }
            setErrorFromResponse(data, status: http.statusCode)
            return (.failed, nil)
        case .transport(let message):
            errorMessage = message
            return (.failed, nil)
        }
    }

    /// Commit a session previously obtained from `loginDeferred`, persisting it
    /// and publishing `isAuthenticated` (which drives the app into the signed-in
    /// experience). Call after the Face ID opt-in prompt is answered.
    func commitDeferredSession(_ session: AuthSuccess) {
        persist(token: session.token, user: session.user)
    }

    // MARK: - Public actions

    /// Sign in with email + password. There's a single unified account — no
    /// guest/host choice at sign-in; the account's `is_host` flag (returned in
    /// the user payload) decides what host surfaces appear in-app.
    ///
    /// - Returns `.authenticated` on success (session stored).
    /// - Returns `.needsVerification(email:)` when the backend replies 403 with
    ///   `needsVerification: true` (email not yet verified). The caller should
    ///   route to the OTP screen; a fresh code is requested via `resendOTP`
    ///   before showing it.
    /// - Returns `.failed` on any other error (message set on `errorMessage`).
    @discardableResult
    func login(email: String, password: String) async -> AuthOutcome {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let result = await send(path: "/api/auth/login", body: [
            "email": email,
            "password": password,
        ])

        switch result {
        case .success(let data):
            return decodeSession(data)
        case .failure(let http, let data):
            if http.statusCode == 403,
               let body = try? JSONDecoder().decode(AuthErrorBody.self, from: data),
               body.needsVerification == true {
                return .needsVerification(email: body.email ?? email)
            }
            setErrorFromResponse(data, status: http.statusCode)
            return .failed
        case .transport(let message):
            errorMessage = message
            return .failed
        }
    }

    /// Register a new account. Everyone signs up as one unified account (no
    /// host registration — an account becomes a host in-app later). On success
    /// the backend emails a one-time code and returns `{ pending: true }` with
    /// **no** token, so this returns `.needsVerification(email:)` to drive the
    /// OTP screen.
    @discardableResult
    func signup(name: String, email: String, password: String) async -> AuthOutcome {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let body = [
            "email": email,
            "password": password,
            "full_name": name,
        ]
        let result = await send(path: "/api/auth/signup", body: body)

        switch result {
        case .success(let data):
            // Expected: { pending: true, email, devCode? } (no token).
            if let body = try? JSONDecoder().decode(PendingBody.self, from: data), body.pending {
                return .needsVerification(email: body.email ?? email, devCode: body.devCode)
            }
            // Tolerate a backend that returns a session directly.
            return decodeSession(data)
        case .failure(let http, let data):
            setErrorFromResponse(data, status: http.statusCode)
            return .failed
        case .transport(let message):
            errorMessage = message
            return .failed
        }
    }

    /// Verify the 6-digit code emailed after signup. On success stores the
    /// returned `{ token, user }` and completes login.
    ///
    /// `referralCode` (optional) is forwarded as `referral_code` so a new account
    /// is credited to the friend who referred them.
    @discardableResult
    func verifyOTP(email: String, code: String, referralCode: String? = nil) async -> AuthOutcome {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        var body = ["email": email, "code": code]
        if let referral = referralCode?.trimmingCharacters(in: .whitespacesAndNewlines), !referral.isEmpty {
            body["referral_code"] = referral
        }
        let result = await send(path: "/api/auth/verify-otp", body: body)

        switch result {
        case .success(let data):
            return decodeSession(data)
        case .failure(let http, let data):
            setErrorFromResponse(data, status: http.statusCode)
            return .failed
        case .transport(let message):
            errorMessage = message
            return .failed
        }
    }

    /// Request a password-reset code for `email`. The backend emails a 6-digit
    /// code (`POST /api/auth/forgot-password` → `{ sent: true }`). Returns `true`
    /// on success; on failure the message is set on `errorMessage`.
    @discardableResult
    func forgotPassword(email: String) async -> Bool {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let result = await send(path: "/api/auth/forgot-password", body: ["email": email])

        switch result {
        case .success:
            return true
        case .failure(let http, let data):
            setErrorFromResponse(data, status: http.statusCode)
            return false
        case .transport(let message):
            errorMessage = message
            return false
        }
    }

    /// Complete a password reset with the emailed code and a new password
    /// (`POST /api/auth/reset-password` → `{ token, user }`). On success the
    /// returned session is persisted (the user is signed in), mirroring the
    /// login path. Returns `.authenticated` on success, otherwise `.failed`
    /// with the server error set on `errorMessage`.
    @discardableResult
    func resetPassword(email: String, code: String, password: String) async -> AuthOutcome {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let result = await send(path: "/api/auth/reset-password", body: [
            "email": email,
            "code": code,
            "password": password,
        ])

        switch result {
        case .success(let data):
            return decodeSession(data)
        case .failure(let http, let data):
            setErrorFromResponse(data, status: http.statusCode)
            return .failed
        case .transport(let message):
            errorMessage = message
            return .failed
        }
    }

    /// Re-send a fresh OTP to `email`. Returns `true` on success; on failure the
    /// message is set on `errorMessage`.
    @discardableResult
    func resendOTP(email: String) async -> Bool {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let result = await send(path: "/api/auth/resend-otp", body: ["email": email])

        switch result {
        case .success:
            return true
        case .failure(let http, let data):
            setErrorFromResponse(data, status: http.statusCode)
            return false
        case .transport(let message):
            errorMessage = message
            return false
        }
    }

    /// Reflect a just-submitted host application on the cached account so the
    /// Profile flips to "under review" immediately, without waiting for the next
    /// `/api/auth/me`. Clears any previous rejection note (a reapply replaces it).
    ///
    /// **Never touches `isHost`** — becoming a host is an admin decision that
    /// only reaches the app through `refreshSession`.
    func applyHostApplicationSubmitted(hostType: HostType) {
        guard let current = user else { return }
        applyUser(current.withHostStatus(.pending, hostType: hostType.rawValue, reviewNote: nil))
    }

    /// Permanently delete the signed-in account and all its data (App Store
    /// Guideline 5.1.1(v) — in-app account deletion). Sends an authenticated
    /// `POST /api/local/account` (with a `{}` body) and the stored Bearer token;
    /// the backend removes the account + data and clears the server session,
    /// replying `{ ok: true, deleted: true }`. On success this clears the local
    /// session (same as `logout()`), dropping the app back to the auth screen.
    /// Returns `true` on success; on failure the message is set on `errorMessage`
    /// and the session is left intact. Mirrors `refreshSession`'s authed-request
    /// pattern.
    ///
    /// The endpoint accepts both POST and DELETE; we use **POST** because
    /// `HttpURLConnection` on Android cannot send a request body with DELETE
    /// (it throws), so POST is the reliable cross-platform method.
    @discardableResult
    func deleteAccount() async -> Bool {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        guard let token = currentToken else {
            errorMessage = "Sign in to delete your account."
            return false
        }
        guard let url = URL(string: Config.apiBaseURL + "/api/local/account") else {
            errorMessage = "Invalid server URL."
            return false
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = "{}".data(using: .utf8)

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                errorMessage = "Invalid response from the server."
                return false
            }
            guard (200...299).contains(http.statusCode) else {
                setErrorFromResponse(data, status: http.statusCode)
                return false
            }
            // Account + data gone server-side and the session cleared. Drop the
            // local session too — also clears any stored Face ID session so the
            // deleted account can't be restored biometrically.
            BiometricAuth.shared.clearStoredSession()
            logout()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    /// Adopt `updated` as the cached account (published `user` + the `qk_user`
    /// UserDefaults cache), keeping the existing token. Used by `refreshSession`
    /// (server truth) and the local post-apply status flip.
    private func applyUser(_ updated: AuthUser) {
        // No change → don't churn published state / UserDefaults.
        guard updated != user else { return }
        user = updated
        if let data = try? JSONEncoder().encode(updated) {
            defaults.set(data, forKey: Self.userKey)
        }
        // Keep any biometric copy in sync so a later Face ID sign-in restores the
        // host flag (no-op when no biometric session is stored).
        if let token = defaults.string(forKey: Self.tokenKey), !token.isEmpty {
            BiometricAuth.shared.updateStoredUserIfPresent(updated, token: token)
        }
    }

    /// Persist a `{token, user}` obtained outside the email flow (e.g. the
    /// native Apple / Google sign-in flows in `AuthView`). Mirrors the email
    /// path so the session restores on next launch.
    ///
    /// The Face ID path hands us the account as it looked when the biometric
    /// session was stored, which can be arbitrarily stale — so we paint it and
    /// immediately re-read `/api/auth/me`. Without this a keychain copy with
    /// `is_host: true` would restore host surfaces on an account the server no
    /// longer considers a host (the same bug `restoreSession` fixes for the
    /// UserDefaults cache, and what Android does on its `isAuthenticated` flip).
    func adopt(token: String, user: AuthUser) {
        errorMessage = nil
        persist(token: token, user: user)
        Task { await refreshSession() }
    }

    /// Surface an error from a view-driven social flow.
    func setError(_ message: String?) {
        errorMessage = message
    }

    /// Merge freshly-saved profile fields into the cached `AuthUser` so the
    /// Profile tab (and any greeting) reflect an edit IMMEDIATELY, without a
    /// re-login. Rebuilds the immutable `AuthUser` with the new values, keeps the
    /// existing ones for anything not passed, re-persists `qk_user` to
    /// UserDefaults, and publishes the change.
    ///
    /// Call from `ProfileSettingsView.save()` right after a successful
    /// `ProfileService.updateProfile`.
    func applyProfile(fullName: String? = nil, avatarURL: String? = nil, role: String? = nil) {
        guard let current = user else { return }
        let merged = AuthUser(
            id: current.id,
            email: current.email,
            fullName: fullName ?? current.fullName,
            provider: current.provider,
            avatarURL: avatarURL ?? current.avatarURL,
            role: role ?? current.role,
            isHost: current.isHost,
            // Host state is server-owned — carry it through a profile edit
            // untouched rather than resetting it to the defaults.
            hostType: current.hostType,
            hostStatus: current.hostStatus,
            hostReviewNote: current.hostReviewNote
        )
        applyUser(merged)
    }

    /// POST a JSON body to a social endpoint and, on success, adopt the
    /// returned session. Returns `true` on success. Used by `AuthView`'s
    /// Apple / Google handlers. Decodes `{ error }` on failure.
    @discardableResult
    func exchangeSocial(path: String, body: [String: String]) async -> Bool {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        guard let url = URL(string: Config.apiBaseURL + path) else {
            errorMessage = "Invalid server URL."
            return false
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                errorMessage = "Invalid response from the server."
                return false
            }
            if (200...299).contains(http.statusCode) {
                let result = try JSONDecoder().decode(AuthSuccess.self, from: data)
                persist(token: result.token, user: result.user)
                return true
            }
            if let decoded = try? JSONDecoder().decode(AuthErrorBody.self, from: data) {
                errorMessage = decoded.error
            } else {
                errorMessage = "Something went wrong (\(http.statusCode)). Please try again."
            }
            return false
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func logout() {
        defaults.removeObject(forKey: Self.tokenKey)
        defaults.removeObject(forKey: Self.userKey)
        // Intentionally KEEP the stored biometric (Face ID / Touch ID) session
        // across logout, so the sign-in screen keeps offering "Sign in with
        // Face ID" for a fast return — that's the whole point of enabling it.
        // It's gated by the device owner's biometrics and stored
        // WhenUnlockedThisDeviceOnly. The user removes it explicitly by turning
        // Face ID off in Profile → Edit profile (Security), and a fresh password
        // login replaces it via the enable prompt.
        user = nil
        errorMessage = nil
        isAuthenticated = false
        // Reset any in-memory per-user caches that don't live on this store.
        // The wishlist ids are also reset reactively in QuickInApp's
        // `.task(id: auth.isAuthenticated)`, but clearing here guarantees a
        // logout never leaves a previous account's saved hearts behind even if
        // that observation is skipped.
        NotificationCenter.default.post(name: .qkAuthDidLogout, object: nil)
    }

    // MARK: - Networking

    /// Low-level outcome of an HTTP POST, before any endpoint-specific decoding.
    private enum SendResult {
        case success(Data)                       // 2xx
        case failure(HTTPURLResponse, Data)      // non-2xx (caller inspects body/status)
        case transport(String)                   // URL / network / encoding error
    }

    /// POST a JSON body to `path` and classify the response. Does not mutate
    /// any published state beyond what the caller manages — endpoint methods
    /// own `isLoading` / `errorMessage`.
    private func send(path: String, body: [String: String]) async -> SendResult {
        guard let url = URL(string: Config.apiBaseURL + path) else {
            return .transport("Invalid server URL.")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                return .transport("Invalid response from the server.")
            }
            if (200...299).contains(http.statusCode) {
                return .success(data)
            }
            return .failure(http, data)
        } catch {
            return .transport(error.localizedDescription)
        }
    }

    /// Decode a `{ token, user }` body and persist the session. Returns
    /// `.authenticated` on success, `.failed` (with a generic message) if the
    /// body is malformed.
    private func decodeSession(_ data: Data) -> AuthOutcome {
        guard let result = try? JSONDecoder().decode(AuthSuccess.self, from: data) else {
            errorMessage = "Unexpected response from the server."
            return .failed
        }
        persist(token: result.token, user: result.user)
        return .authenticated
    }

    /// Set `errorMessage` from an `{ error }` body, falling back to a generic
    /// status-coded message.
    private func setErrorFromResponse(_ data: Data, status: Int) {
        if let decoded = try? JSONDecoder().decode(AuthErrorBody.self, from: data) {
            errorMessage = decoded.error
        } else {
            errorMessage = "Something went wrong (\(status)). Please try again."
        }
    }
}

extension Notification.Name {
    /// Broadcast when the user signs out so any in-memory per-user store (e.g.
    /// `WishlistStore`) can flush state it holds outside `AuthStore`.
    static let qkAuthDidLogout = Notification.Name("qk.auth.didLogout")
}
