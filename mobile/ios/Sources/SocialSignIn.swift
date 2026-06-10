import Foundation
import AuthenticationServices
import CryptoKit

/// Real Google OAuth via `ASWebAuthenticationSession`.
///
/// Runs the Authorization Code + PKCE flow against Google's endpoints using
/// the iOS OAuth client id in `Config.googleClientID`, then exchanges the code
/// for an `id_token` at Google's token endpoint. The id_token is what the
/// backend (`/api/auth/google`) verifies.
///
/// iOS OAuth clients are "public" clients (no secret), so the token exchange
/// uses PKCE and no client secret — exactly what Google expects for the iOS
/// application type.
enum GoogleSignIn {
    struct Result {
        let idToken: String
    }

    enum SignInError: LocalizedError {
        case notConfigured
        case cancelled
        case missingCode
        case tokenExchangeFailed(String)

        var errorDescription: String? {
            switch self {
            case .notConfigured:
                return "Add your Google iOS client id in Config.swift to enable Google sign-in."
            case .cancelled:
                return "Google sign-in was cancelled."
            case .missingCode:
                return "Google did not return an authorization code."
            case .tokenExchangeFailed(let detail):
                return "Google token exchange failed: \(detail)"
            }
        }
    }

    /// Presentation context provider that anchors the auth sheet to the app's
    /// key window.
    private final class PresentationAnchor: NSObject, ASWebAuthenticationPresentationContextProviding {
        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
            ASPresentationAnchor()
        }
    }

    @MainActor
    static func signIn() async throws -> Result {
        let clientID = Config.googleClientID
        guard !clientID.isEmpty,
              let redirectScheme = Config.googleRedirectScheme else {
            throw SignInError.notConfigured
        }

        // PKCE pair.
        let verifier = randomURLSafeString(count: 64)
        let challenge = codeChallenge(for: verifier)

        let redirectURI = "\(redirectScheme):/oauth2redirect"
        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
        ]
        guard let authURL = components.url else { throw SignInError.missingCode }

        let anchor = PresentationAnchor()
        let callbackURL: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: redirectScheme
            ) { url, error in
                if let error = error {
                    let code = (error as NSError).code
                    if code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                        continuation.resume(throwing: SignInError.cancelled)
                    } else {
                        continuation.resume(throwing: error)
                    }
                    return
                }
                guard let url = url else {
                    continuation.resume(throwing: SignInError.missingCode)
                    return
                }
                continuation.resume(returning: url)
            }
            session.presentationContextProvider = anchor
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }

        guard
            let comps = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
            let code = comps.queryItems?.first(where: { $0.name == "code" })?.value
        else {
            throw SignInError.missingCode
        }

        return try await exchangeCode(
            code,
            verifier: verifier,
            redirectURI: redirectURI,
            clientID: clientID
        )
    }

    private static func exchangeCode(
        _ code: String,
        verifier: String,
        redirectURI: String,
        clientID: String
    ) async throws -> Result {
        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let form = [
            "client_id": clientID,
            "code": code,
            "code_verifier": verifier,
            "grant_type": "authorization_code",
            "redirect_uri": redirectURI,
        ]
        request.httpBody = form
            .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? $0.value)" }
            .joined(separator: "&")
            .data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? "unknown error"
            throw SignInError.tokenExchangeFailed(body)
        }
        struct TokenResponse: Decodable { let id_token: String? }
        let decoded = try JSONDecoder().decode(TokenResponse.self, from: data)
        guard let idToken = decoded.id_token else {
            throw SignInError.tokenExchangeFailed("response had no id_token")
        }
        return Result(idToken: idToken)
    }

    // MARK: - PKCE helpers

    private static func randomURLSafeString(count: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: count)
        _ = SecRandomCopyBytes(kSecRandomDefault, count, &bytes)
        return Data(bytes).base64URLEncodedString()
    }

    private static func codeChallenge(for verifier: String) -> String {
        let digest = SHA256.hash(data: Data(verifier.utf8))
        return Data(digest).base64URLEncodedString()
    }
}

private extension Data {
    /// Base64-URL encoding (no padding) as required by PKCE.
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
