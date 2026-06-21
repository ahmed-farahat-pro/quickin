import Foundation

/// Networking for reservations against the local Next.js API (no Supabase).
///
///   POST {base}/api/local/bookings  (Bearer qk_token) → 201 Booking | { error }
///   GET  {base}/api/local/bookings  (Bearer qk_token) → [Booking]
///
/// The bearer token lives in `UserDefaults` under `AuthStore.tokenKey`
/// ("qk_token"), written by `AuthStore` when the user signs in. We read it
/// straight from there so the service stays decoupled from the store.
struct BookingService {
    static let shared = BookingService()

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

    // MARK: - Create

    /// Reserve a stay. Throws `BookingError.notSignedIn` when there is no token,
    /// `BookingError.message` carrying the server's `{ error }` for 4xx
    /// responses (e.g. "Those dates are not available").
    @discardableResult
    func reserve(listingID: String, checkIn: String, checkOut: String, guests: Int,
                 adults: Int = 1, children: Int = 0, infants: Int = 0, pets: Int = 0) async throws -> Booking {
        guard let token else { throw BookingError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/bookings")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "listing_id": listingID,
            "check_in": checkIn,
            "check_out": checkOut,
            "guests": guests,
            "adults": adults,
            "children": children,
            "infants": infants,
            "pets": pets,
        ])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BookingError.message("Invalid response from the server.")
        }

        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(Booking.self, from: data)
        }
        if http.statusCode == 401 {
            throw BookingError.notSignedIn
        }
        // 400 (and other 4xx/5xx): surface the server's { error } when present.
        throw BookingError.message(Self.decodeError(data) ?? "Reservation failed (\(http.statusCode)).")
    }

    // MARK: - Pay (mock)

    /// Pay for a booking via the backend's **mock** payment endpoint. Always
    /// succeeds for the booking's owner — there's no real gateway yet. Returns
    /// the server's `receipt` (amount breakdown + reference). The booking is
    /// flipped to `payment_status: "paid"`, `status: "confirmed"` server-side.
    ///
    /// Throws `BookingError.notSignedIn` when there is no token (or the server
    /// returns 401), and `BookingError.message` carrying the server's `{ error }`
    /// for other non-2xx responses (e.g. 403 not your booking).
    ///
    /// `method` is `"card"` (adds a +5% surcharge) or `"bank_transfer"`
    /// (applies a −5% discount). The returned receipt carries the signed
    /// `methodFee` and the chosen `method`.
    ///
    /// `promoCode` (optional) is forwarded as `promo_code`; when valid the backend
    /// nets the discount out of `total` and echoes `promoCode` / `promoDiscount`
    /// on the receipt.
    @discardableResult
    func pay(bookingId: String, method: String, promoCode: String? = nil) async throws -> PaymentReceipt {
        guard let token else { throw BookingError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/bookings/\(bookingId)/pay")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        // The backend prices the chosen method (card +5% / bank_transfer −5%) and
        // applies any valid promo code.
        var body: [String: Any] = ["method": method]
        if let promo = promoCode?.trimmingCharacters(in: .whitespacesAndNewlines), !promo.isEmpty {
            body["promo_code"] = promo
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BookingError.message("Invalid response from the server.")
        }

        if (200...299).contains(http.statusCode) {
            struct PayResponse: Decodable { let receipt: PaymentReceipt }
            return try JSONDecoder().decode(PayResponse.self, from: data).receipt
        }
        if http.statusCode == 401 {
            throw BookingError.notSignedIn
        }
        // 403 (not your booking) and other 4xx/5xx: surface the server's { error }.
        throw BookingError.message(Self.decodeError(data) ?? "Payment failed (\(http.statusCode)).")
    }

    // MARK: - Promo codes

    /// Preview a promo code against a subtotal via
    /// `POST /api/local/promo/validate` `{ code, subtotal }` → `PromoQuote`.
    /// Read-only: nothing is mutated. The returned quote's `valid` flag says
    /// whether the code applies; `discount` is the EGP it would knock off.
    ///
    /// Does not require sign-in (the preview is public). Throws
    /// `BookingError.message` carrying the server's `{ error }` for non-2xx.
    func validatePromo(code: String, subtotal: Int) async throws -> PromoQuote {
        let url = URL(string: "\(Config.apiBaseURL)/api/local/promo/validate")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "code": code.trimmingCharacters(in: .whitespacesAndNewlines),
            "subtotal": subtotal,
        ])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BookingError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(PromoQuote.self, from: data)
        }
        // A 400/422 may still carry a `{ valid: false, message }` body — surface
        // it as a quote so the UI can show the reason inline.
        if let quote = try? JSONDecoder().decode(PromoQuote.self, from: data) {
            return quote
        }
        throw BookingError.message(Self.decodeError(data) ?? "Couldn't check that code (\(http.statusCode)).")
    }

    // MARK: - Referrals

    /// The signed-in user's referral summary via `GET /api/local/referrals`
    /// (Bearer) → `ReferralSummary`. Throws `BookingError.notSignedIn` when there
    /// is no token or the server returns 401.
    func fetchReferrals() async throws -> ReferralSummary {
        guard let token else { throw BookingError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/referrals")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BookingError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw BookingError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw BookingError.message(Self.decodeError(data) ?? "Couldn't load your referrals (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(ReferralSummary.self, from: data)
    }

    // MARK: - Host notes

    /// Attach (or update) the host's notes for a booking via
    /// `PATCH /api/local/bookings/:id` with `{ "host_notes": notes }`. Host-only:
    /// the backend returns 403 for anyone who isn't the listing's host. Returns
    /// the updated `Booking` so the caller can refresh the displayed notes.
    ///
    /// Throws `BookingError.notSignedIn` (no token / 401) or
    /// `BookingError.message` carrying the server's `{ error }` for other non-2xx.
    @discardableResult
    func setHostNotes(bookingId: String, notes: String) async throws -> Booking {
        guard let token else { throw BookingError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/bookings/\(bookingId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["host_notes": notes])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BookingError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(Booking.self, from: data)
        }
        if http.statusCode == 401 { throw BookingError.notSignedIn }
        // 403 (not the host) and other 4xx/5xx: surface the server's { error }.
        throw BookingError.message(Self.decodeError(data) ?? "Couldn't save notes (\(http.statusCode)).")
    }

    // MARK: - Cancellation (guest)

    /// Fetch the cancellation **quote** for a booking via
    /// `GET /api/local/bookings/:id/cancel` (Bearer guest). Read-only: nothing is
    /// mutated. Returns the policy, days-until-check-in, and the refund the guest
    /// would receive — shown in the confirm sheet before they cancel.
    ///
    /// Throws `BookingError.notSignedIn` (no token / 401) or `BookingError.message`
    /// carrying the server's `{ error }` for other non-2xx.
    func cancellationQuote(bookingId: String) async throws -> CancellationQuote {
        guard let token else { throw BookingError.notSignedIn }

        let encoded = bookingId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? bookingId
        let url = URL(string: "\(Config.apiBaseURL)/api/local/bookings/\(encoded)/cancel")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BookingError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(CancellationQuote.self, from: data)
        }
        if http.statusCode == 401 { throw BookingError.notSignedIn }
        throw BookingError.message(Self.decodeError(data) ?? "Couldn't load the refund quote (\(http.statusCode)).")
    }

    /// Cancel a booking via `POST /api/local/bookings/:id/cancel` (Bearer guest).
    /// The server flips `status` to `cancelled` and records the refund. Returns
    /// the updated `Booking` (with `cancelled_at` / `refund_percent` set).
    ///
    /// Throws `BookingError.notSignedIn` (no token / 401) or `BookingError.message`
    /// carrying the server's `{ error }` for other non-2xx (e.g. 400 not cancellable).
    @discardableResult
    func cancelReservation(bookingId: String) async throws -> Booking {
        guard let token else { throw BookingError.notSignedIn }

        let encoded = bookingId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? bookingId
        let url = URL(string: "\(Config.apiBaseURL)/api/local/bookings/\(encoded)/cancel")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BookingError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            // Response is `{ booking, refund }`; we only need the updated booking.
            struct CancelResponse: Decodable { let booking: Booking }
            return try JSONDecoder().decode(CancelResponse.self, from: data).booking
        }
        if http.statusCode == 401 { throw BookingError.notSignedIn }
        // 400 (not cancellable) and other 4xx/5xx: surface the server's { error }.
        throw BookingError.message(Self.decodeError(data) ?? "Couldn't cancel this reservation (\(http.statusCode)).")
    }

    // MARK: - Cancellation policy (host)

    /// Update a listing's cancellation policy via `PATCH /api/local/listings/:id`
    /// with `{ cancellation_policy }` (Bearer host). Returns the updated `Listing`.
    /// `policy` is `.flexible` / `.moderate` / `.strict`.
    ///
    /// Throws `BookingError.notSignedIn` (no token / 401) or `BookingError.message`
    /// carrying the server's `{ error }` for other non-2xx (e.g. 403 not the host).
    @discardableResult
    func setCancellationPolicy(listingID: String, policy: CancellationPolicy) async throws -> Listing {
        guard let token else { throw BookingError.notSignedIn }

        let encoded = listingID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? listingID
        let url = URL(string: "\(Config.apiBaseURL)/api/local/listings/\(encoded)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["cancellation_policy": policy.rawValue])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BookingError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(Listing.self, from: data)
        }
        if http.statusCode == 401 { throw BookingError.notSignedIn }
        // 403 (not the host) and other 4xx/5xx: surface the server's { error }.
        throw BookingError.message(Self.decodeError(data) ?? "Couldn't update the cancellation policy (\(http.statusCode)).")
    }

    // MARK: - Length-of-stay discounts (host)

    /// Update a listing's length-of-stay discounts via
    /// `PATCH /api/local/listings/:id` with `{ weekly_discount, monthly_discount }`
    /// (Bearer host). Both are whole percentages (0–100); `0` clears a discount.
    /// Returns the updated `Listing`.
    ///
    /// Throws `BookingError.notSignedIn` (no token / 401) or `BookingError.message`
    /// carrying the server's `{ error }` for other non-2xx (e.g. 403 not the host).
    @discardableResult
    func setLengthOfStayDiscounts(listingID: String, weekly: Int, monthly: Int) async throws -> Listing {
        guard let token else { throw BookingError.notSignedIn }

        let encoded = listingID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? listingID
        let url = URL(string: "\(Config.apiBaseURL)/api/local/listings/\(encoded)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "weekly_discount": max(0, min(weekly, 100)),
            "monthly_discount": max(0, min(monthly, 100)),
        ])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BookingError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(Listing.self, from: data)
        }
        if http.statusCode == 401 { throw BookingError.notSignedIn }
        // 403 (not the host) and other 4xx/5xx: surface the server's { error }.
        throw BookingError.message(Self.decodeError(data) ?? "Couldn't update the discounts (\(http.statusCode)).")
    }

    // MARK: - Seasonal pricing (host)

    /// Update a listing's seasonal/variable pricing via
    /// `PATCH /api/local/listings/:id` with `{ weekend_price, monthly_prices }`
    /// (Bearer host). `weekendPrice` is the nightly EGP rate for Fri + Sat, or
    /// `nil` to clear it; `monthlyPrices` maps month "1".."12" → nightly EGP
    /// (only the months the host set). Returns the updated `Listing`.
    ///
    /// Throws `BookingError.notSignedIn` (no token / 401) or `BookingError.message`
    /// carrying the server's `{ error }` for other non-2xx (e.g. 403 not the host).
    @discardableResult
    func setSeasonalPricing(listingID: String, weekendPrice: Double?, monthlyPrices: [String: Double]) async throws -> Listing {
        guard let token else { throw BookingError.notSignedIn }

        let encoded = listingID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? listingID
        let url = URL(string: "\(Config.apiBaseURL)/api/local/listings/\(encoded)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        var body: [String: Any] = [
            // Keep only positive per-month rates; an empty object clears them all.
            "monthly_prices": monthlyPrices.filter { $0.value > 0 },
        ]
        if let weekendPrice, weekendPrice > 0 {
            body["weekend_price"] = weekendPrice
        } else {
            body["weekend_price"] = NSNull()
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BookingError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(Listing.self, from: data)
        }
        if http.statusCode == 401 { throw BookingError.notSignedIn }
        throw BookingError.message(Self.decodeError(data) ?? "Couldn't update the pricing (\(http.statusCode)).")
    }

    // MARK: - Stay quote (public)

    /// Fetch the authoritative price quote for a stay via
    /// `POST /api/local/listings/:id/quote` `{ checkIn, checkOut }`. Public — no
    /// auth. The quote honors the weekend + per-month seasonal rates and the
    /// length-of-stay discount, so the detail screen uses its `total` directly.
    /// `checkIn`/`checkOut` are `yyyy-MM-dd`. Throws `BookingError.message` on a
    /// non-2xx (the caller falls back to the naive client-side estimate).
    func fetchStayQuote(listingID: String, checkIn: String, checkOut: String) async throws -> StayQuote {
        let encoded = listingID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? listingID
        let url = URL(string: "\(Config.apiBaseURL)/api/local/listings/\(encoded)/quote")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "checkIn": checkIn,
            "checkOut": checkOut,
        ])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BookingError.message("Invalid response from the server.")
        }
        guard (200...299).contains(http.statusCode) else {
            throw BookingError.message(Self.decodeError(data) ?? "Couldn't load the quote (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(StayQuote.self, from: data)
    }

    // MARK: - Availability (host)

    /// Block a date range on a listing the signed-in user hosts, via
    /// `POST /api/local/listings/:id/availability` with `{ start, end, note? }`.
    /// `start`/`end` are `yyyy-MM-dd`; the span is half-open `[start, end)`.
    /// Returns the created block. Host-only: 401 (no/invalid token) →
    /// `.notSignedIn`, 403/400 → `.message` carrying the server's `{ error }`.
    @discardableResult
    func blockDates(listingID: String, start: String, end: String, note: String?) async throws -> AvailabilityRange {
        guard let token else { throw BookingError.notSignedIn }

        let encoded = listingID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? listingID
        let url = URL(string: "\(Config.apiBaseURL)/api/local/listings/\(encoded)/availability")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        var body: [String: Any] = ["start": start, "end": end]
        if let note = note?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty {
            body["note"] = note
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BookingError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(AvailabilityRange.self, from: data)
        }
        if http.statusCode == 401 { throw BookingError.notSignedIn }
        // 403 (not the host) / 400 (bad range): surface the server's { error }.
        throw BookingError.message(Self.decodeError(data) ?? "Couldn't block those dates (\(http.statusCode)).")
    }

    /// Remove a host block via
    /// `DELETE /api/local/listings/:id/availability?blockId=ID`. Host-only.
    /// Throws `BookingError.notSignedIn` (no token / 401) or `BookingError.message`
    /// carrying the server's `{ error }` for other non-2xx.
    func unblockDates(listingID: String, blockID: String) async throws {
        guard let token else { throw BookingError.notSignedIn }

        let encoded = listingID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? listingID
        var components = URLComponents(string: "\(Config.apiBaseURL)/api/local/listings/\(encoded)/availability")!
        components.queryItems = [URLQueryItem(name: "blockId", value: blockID)]
        let url = components.url!

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BookingError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) { return }
        if http.statusCode == 401 { throw BookingError.notSignedIn }
        throw BookingError.message(Self.decodeError(data) ?? "Couldn't remove the block (\(http.statusCode)).")
    }

    // MARK: - List

    /// The signed-in user's reservations. Throws `BookingError.notSignedIn`
    /// when there is no token or the server returns 401.
    func fetchReservations() async throws -> [Booking] {
        guard let token else { throw BookingError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/bookings")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BookingError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw BookingError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw BookingError.message(Self.decodeError(data) ?? "Failed to load reservations (\(http.statusCode)).")
        }
        return try JSONDecoder().decode([Booking].self, from: data)
    }

    // MARK: - Helpers

    private static func decodeError(_ data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String }
        return (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
    }
}

/// Errors surfaced to the reserve / reservations UI.
enum BookingError: LocalizedError {
    case notSignedIn
    case message(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "Sign in to reserve"
        case let .message(text): return text
        }
    }
}

/// The receipt returned by the mock pay endpoint
/// (`POST /api/local/bookings/:id/pay` → `{ receipt: {…} }`). All amounts are
/// in EGP. `reference` is the "QK-…" confirmation code; `paidAt` is ISO-8601.
struct PaymentReceipt: Codable, Hashable {
    let currency: String
    let nights: Int
    let nightly: Int
    let subtotal: Int
    let serviceFee: Int
    /// Signed payment-method adjustment in EGP: positive for the card surcharge
    /// (+5% of subtotal), negative for the bank-transfer discount (−5%).
    let methodFee: Int
    let total: Int
    let reference: String
    let paidAt: String
    /// The chosen method, "card" or "bank_transfer".
    let method: String
    /// The promo code applied at checkout, echoed by the backend. `nil` when the
    /// guest didn't apply one.
    let promoCode: String?
    /// The discount the applied promo code knocked off the total, in EGP.
    /// `nil`/`0` when no promo was applied. `total` already nets this out.
    let promoDiscount: Int?
    // Property names match the backend's JSON keys exactly (currency, nights,
    // nightly, subtotal, serviceFee, methodFee, total, reference, paidAt, method,
    // promoCode, promoDiscount), so the synthesized Codable keys are correct.

    /// `true` when a promo code was applied and knocked at least 1 EGP off.
    var hasPromo: Bool {
        let trimmed = promoCode?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (trimmed?.isEmpty == false) && (promoDiscount ?? 0) > 0
    }
}

/// The preview returned by `POST /api/local/promo/validate` `{ code, subtotal }`
/// → `{ valid, code, kind, value, discount, message }`. No mutation happens; the
/// guest sees the discount before applying it at pay time. `discount` is in EGP.
struct PromoQuote: Decodable, Hashable {
    /// Whether the code is valid for this subtotal.
    let valid: Bool
    /// The normalized promo code (echoed back, may be upper-cased by the server).
    let code: String?
    /// "percent" | "fixed" — how `value` should be read. Optional; the UI relies
    /// on `discount` for the actual amount.
    let kind: String?
    /// The raw discount value (a percentage when `kind == "percent"`, otherwise a
    /// flat EGP amount). Optional.
    let value: Double?
    /// The computed discount for the supplied subtotal, in EGP.
    let discount: Int
    /// A human message from the server (e.g. "Code expired" / "10% off applied").
    let message: String?

    enum CodingKeys: String, CodingKey {
        case valid, code, kind, value, discount, message
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        valid = try c.decodeIfPresent(Bool.self, forKey: .valid) ?? false
        code = try c.decodeIfPresent(String.self, forKey: .code)
        kind = try c.decodeIfPresent(String.self, forKey: .kind)
        value = try c.decodeIfPresent(Double.self, forKey: .value)
        // Tolerate a Double discount from the server; round to whole EGP.
        if let intDiscount = try? c.decodeIfPresent(Int.self, forKey: .discount) {
            discount = intDiscount ?? 0
        } else {
            discount = Int((try c.decodeIfPresent(Double.self, forKey: .discount) ?? 0).rounded())
        }
        message = try c.decodeIfPresent(String.self, forKey: .message)
    }

    /// "−EGP 110" style discount line.
    var discountText: String { "−EGP \(discount)" }
}

/// The referral summary returned by `GET /api/local/referrals` (Bearer) →
/// `{ code, count, rewardTotal, referred:[{ name, created_at, reward_amount }] }`.
/// Drives the "Refer friends" surface (the user's code + stats + invitee list).
struct ReferralSummary: Decodable, Hashable {
    /// The signed-in user's shareable referral code.
    let code: String
    /// How many friends have signed up with this code.
    let count: Int
    /// The total reward earned so far, in EGP.
    let rewardTotal: Int
    /// The people who signed up via this code (most-recent first, server order).
    let referred: [ReferredFriend]

    enum CodingKeys: String, CodingKey {
        case code, count, rewardTotal, referred
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        code = (try c.decodeIfPresent(String.self, forKey: .code)) ?? ""
        count = try c.decodeIfPresent(Int.self, forKey: .count) ?? 0
        if let intTotal = try? c.decodeIfPresent(Int.self, forKey: .rewardTotal) {
            rewardTotal = intTotal ?? 0
        } else {
            rewardTotal = Int((try c.decodeIfPresent(Double.self, forKey: .rewardTotal) ?? 0).rounded())
        }
        referred = try c.decodeIfPresent([ReferredFriend].self, forKey: .referred) ?? []
    }

    /// "EGP 250" style total reward.
    var rewardTotalText: String { "EGP \(rewardTotal)" }
}

/// One friend who signed up via the user's referral code, inside `ReferralSummary`.
struct ReferredFriend: Decodable, Hashable, Identifiable {
    /// Display name of the invited friend (may be blank → "A friend").
    let name: String?
    /// ISO-8601 timestamp they joined, from `created_at`. `nil` when absent.
    let createdAt: String?
    /// The reward this referral earned, in EGP, from `reward_amount`.
    let rewardAmount: Int

    enum CodingKeys: String, CodingKey {
        case name
        case createdAt = "created_at"
        case rewardAmount = "reward_amount"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        if let intReward = try? c.decodeIfPresent(Int.self, forKey: .rewardAmount) {
            rewardAmount = intReward ?? 0
        } else {
            rewardAmount = Int((try c.decodeIfPresent(Double.self, forKey: .rewardAmount) ?? 0).rounded())
        }
    }

    /// `Identifiable` by name + timestamp (stable enough for the list).
    var id: String { "\(name ?? "friend")-\(createdAt ?? UUID().uuidString)" }

    /// Display name, falling back to a generic "A friend".
    @MainActor
    var displayName: String {
        let trimmed = name?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (trimmed?.isEmpty == false) ? trimmed! : L.t("referral.aFriend")
    }

    /// "EGP 50" style reward, or "—" when zero.
    var rewardText: String { rewardAmount > 0 ? "EGP \(rewardAmount)" : "—" }

    /// "Jul 2026" style month label parsed from `created_at` (empty if absent).
    var monthText: String {
        guard let createdAt, let date = ReferredFriend.parseDate(createdAt) else { return "" }
        return ReferredFriend.monthFormatter.string(from: date)
    }

    private static func parseDate(_ raw: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFraction.date(from: raw) { return d }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        if let d = plain.date(from: raw) { return d }
        let dateOnly = DateFormatter()
        dateOnly.locale = Locale(identifier: "en_US_POSIX")
        dateOnly.dateFormat = "yyyy-MM-dd"
        return dateOnly.date(from: raw)
    }

    private static let monthFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = .current
        f.dateFormat = "MMM yyyy"
        return f
    }()
}
