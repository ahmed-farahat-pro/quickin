import Foundation

/// Networking for the Services feature against the local Next.js API (no
/// Supabase). Mirrors `BookingService` / `HostService`: pure URLSession +
/// Codable, reading the bearer token straight from `UserDefaults` under
/// `AuthStore.tokenKey` ("qk_token") so it stays decoupled from the auth store.
///
///   GET   {base}/api/local/services                 → [Service]        (public browse)
///   GET   {base}/api/local/services/:id             → Service          (public detail)
///   POST  {base}/api/local/services                 → 201 Service      (host)
///   POST  {base}/api/local/service-requests         → 201 ServiceRequest (user subscribe)
///   GET   {base}/api/local/service-requests         → [ServiceRequest] (my subscriptions)
///   PATCH {base}/api/local/service-requests/:id     → ServiceRequest   (host confirm|reject)
///   GET   {base}/api/local/host/services            → [Service]        (host's services)
///   GET   {base}/api/local/host/service-requests    → [ServiceRequest] (host inbox)
struct ServiceService {
    static let shared = ServiceService()

    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 15
        cfg.waitsForConnectivity = true
        return URLSession(configuration: cfg)
    }()

    /// The persisted bearer token, or `nil` when browsing as a guest.
    var token: String? {
        let value = UserDefaults.standard.string(forKey: AuthStore.tokenKey)
        return (value?.isEmpty == false) ? value : nil
    }

    // MARK: - Browse (public)

    /// All published services. Public — no token required.
    func fetchServices() async throws -> [Service] {
        try await getPublic("\(Config.apiBaseURL)/api/local/services", as: [Service].self)
    }

    /// A single service's detail. Public — no token required.
    func fetchService(id: String) async throws -> Service {
        try await getPublic("\(Config.apiBaseURL)/api/local/services/\(id)", as: Service.self)
    }

    // MARK: - Create (host only)

    /// Fields the host "Add service" form collects. Sent as the POST body.
    struct NewService {
        var title: String
        var description: String
        var category: String
        var location: String
        var price: Double
        var imageURL: String
        var lat: Double?
        var lng: Double?
    }

    /// Create a service. Throws `ServiceError.forbidden` when the signed-in
    /// account isn't a host (backend 403), `ServiceError.message` for other 4xx/5xx.
    @discardableResult
    func createService(_ service: NewService) async throws -> Service {
        guard let token else { throw ServiceError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/services")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        var body: [String: Any] = [
            "title": service.title,
            "price": service.price,
        ]
        let description = service.description.trimmingCharacters(in: .whitespacesAndNewlines)
        let category = service.category.trimmingCharacters(in: .whitespacesAndNewlines)
        let location = service.location.trimmingCharacters(in: .whitespacesAndNewlines)
        let imageURL = service.imageURL.trimmingCharacters(in: .whitespacesAndNewlines)
        if !description.isEmpty { body["description"] = description }
        if !category.isEmpty { body["category"] = category }
        if !location.isEmpty { body["location"] = location }
        if !imageURL.isEmpty { body["image_url"] = imageURL }
        if let lat = service.lat, let lng = service.lng {
            body["lat"] = lat
            body["lng"] = lng
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ServiceError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(Service.self, from: data)
        }
        if http.statusCode == 401 { throw ServiceError.notSignedIn }
        if http.statusCode == 403 {
            throw ServiceError.forbidden(Self.decodeError(data) ?? "Only hosts can create services.")
        }
        throw ServiceError.message(Self.decodeError(data) ?? "Couldn't create the service (\(http.statusCode)).")
    }

    // MARK: - Subscribe (user)

    /// Subscribe to / request a service. Throws `ServiceError.notSignedIn` when
    /// there is no token, `ServiceError.message` carrying the server's `{ error }`.
    @discardableResult
    func subscribe(serviceID: String, preferredDate: String? = nil, note: String? = nil) async throws -> ServiceRequest {
        guard let token else { throw ServiceError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/service-requests")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        var body: [String: Any] = ["service_id": serviceID]
        if let preferredDate, !preferredDate.isEmpty { body["preferred_date"] = preferredDate }
        if let note = note?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty {
            body["note"] = note
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ServiceError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(ServiceRequest.self, from: data)
        }
        if http.statusCode == 401 { throw ServiceError.notSignedIn }
        throw ServiceError.message(Self.decodeError(data) ?? "Subscription failed (\(http.statusCode)).")
    }

    // MARK: - My subscriptions (user)

    /// The signed-in user's service subscriptions/requests.
    func myServiceRequests() async throws -> [ServiceRequest] {
        try await getAuthed("\(Config.apiBaseURL)/api/local/service-requests", as: [ServiceRequest].self)
    }

    // MARK: - Host

    /// The host's own services.
    func hostServices() async throws -> [Service] {
        try await getAuthed("\(Config.apiBaseURL)/api/local/host/services", as: [Service].self)
    }

    /// Incoming subscription requests across all of the host's services.
    func hostServiceRequests() async throws -> [ServiceRequest] {
        try await getAuthed("\(Config.apiBaseURL)/api/local/host/service-requests", as: [ServiceRequest].self)
    }

    /// Confirm or reject a pending subscription. `action` is `confirm` or `reject`.
    @discardableResult
    func setRequestStatus(id: String, action: HostBookingAction) async throws -> ServiceRequest? {
        guard let token else { throw ServiceError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/service-requests/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["status": action.rawValue])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ServiceError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            return try? JSONDecoder().decode(ServiceRequest.self, from: data)
        }
        if http.statusCode == 401 { throw ServiceError.notSignedIn }
        throw ServiceError.message(Self.decodeError(data) ?? "Couldn't update the request (\(http.statusCode)).")
    }

    // MARK: - Helpers

    /// Public GET (no auth) → decoded `T`.
    private func getPublic<T: Decodable>(_ urlString: String, as type: T.Type) async throws -> T {
        let url = URL(string: urlString)!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        // Send the token when present (harmless on public routes).
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ServiceError.message("Invalid response from the server.")
        }
        guard (200...299).contains(http.statusCode) else {
            throw ServiceError.message(Self.decodeError(data) ?? "Failed to load services (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    /// Authenticated GET → decoded `T`. Maps 401 to `.notSignedIn`, 403 to `.forbidden`.
    private func getAuthed<T: Decodable>(_ urlString: String, as type: T.Type) async throws -> T {
        guard let token else { throw ServiceError.notSignedIn }

        let url = URL(string: urlString)!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ServiceError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw ServiceError.notSignedIn }
        if http.statusCode == 403 {
            throw ServiceError.forbidden(Self.decodeError(data) ?? "You don't have access to that.")
        }
        guard (200...299).contains(http.statusCode) else {
            throw ServiceError.message(Self.decodeError(data) ?? "Request failed (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private static func decodeError(_ data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String }
        return (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
    }
}

/// Errors surfaced to the services UI. Mirrors `BookingError` / `HostError`.
enum ServiceError: LocalizedError {
    case notSignedIn
    case forbidden(String)
    case message(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn:         return "Sign in to continue"
        case let .forbidden(text): return text
        case let .message(text):   return text
        }
    }
}
