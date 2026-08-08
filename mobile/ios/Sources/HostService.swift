import Foundation

/// Networking for the host area + reservation detail, against the local Next.js
/// API (no Supabase). Mirrors `BookingService`: pure URLSession + Codable, and
/// reads the bearer token straight from `UserDefaults` under
/// `AuthStore.tokenKey` ("qk_token") so it stays decoupled from the auth store.
///
///   POST  {base}/api/local/listings        → 201 Listing  (403 if role != host)
///   PATCH {base}/api/local/listings/:id     → Listing (host edits any field → back to review)
///   POST  {base}/api/local/listings/:id/images           → Listing (append photos)
///   PATCH {base}/api/local/listings/:id/images           → Listing ({ order: [imageId] })
///   DELETE {base}/api/local/listings/:id/images/:imageId → Listing (remove one photo)
///   GET   {base}/api/local/host/bookings    → [HostBooking]
///   GET   {base}/api/local/host/listings    → [Listing]
///   POST  {base}/api/local/host/apply        → { host_status } (become-a-host application)
///   GET   {base}/api/local/host/application  → HostApplicationState
///   PATCH {base}/api/local/bookings/:id      → updated booking  (confirm | reject)
///   GET   {base}/api/local/bookings/:id      → ReservationDetail
///   GET   {base}/api/local/bookings/:id/messages → [ChatMessage] (oldest-first)
///   POST  {base}/api/local/bookings/:id/messages → 201 ChatMessage  ({ body })
///   GET   {base}/api/local/bookings/:id/stay-guide           → [StayGuideItem] (host or guest)
///   POST  {base}/api/local/bookings/:id/stay-guide           → 201 StayGuideItem (host, confirmed only)
///   PATCH {base}/api/local/bookings/:id/stay-guide/:itemId   → StayGuideItem   (host only)
///   DELETE {base}/api/local/bookings/:id/stay-guide/:itemId  → 204             (host only)
struct HostService {
    static let shared = HostService()

    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        // Create + ownership-doc PATCH carry a base64 image, so allow extra time.
        cfg.timeoutIntervalForRequest = 20
        cfg.waitsForConnectivity = true
        return URLSession(configuration: cfg)
    }()

    /// The persisted bearer token, or `nil` when browsing as a guest.
    var token: String? {
        let value = UserDefaults.standard.string(forKey: AuthStore.tokenKey)
        return (value?.isEmpty == false) ? value : nil
    }

    /// Photos a single listing may carry. Enforced by the add-listing wizard and
    /// the host editor alike, and matched by the backend's `MAX_LISTING_PHOTOS`.
    static let maxListingPhotos = 10

    // MARK: - Create listing (host only)

    /// Fields the "Add listing" form collects. Sent as the POST body.
    struct NewListing {
        var title: String
        var description: String
        var location: String
        var country: String
        /// Curated area the host picked (e.g. "North Coast"). Sent as `region`;
        /// omitted from the body when nil.
        var region: String?
        var pricePerNight: Double
        var bedrooms: Int
        var beds: Int
        var bathrooms: Int
        var maxGuests: Int
        var propertyType: String
        /// Device photos the host picked, each a `data:image/*;base64,…` data URL
        /// (or an `http(s)` URL), in display order. The first is the listing
        /// cover. Sent as `images: [String]`; empty when the host added none.
        var images: [String] = []
        /// Amenity labels the host selected (e.g. "WiFi", "Pool"). Sent as
        /// `amenities: [String]`; empty when none chosen.
        var amenities: [String] = []
        /// The host-chosen cancellation policy. Sent as `cancellation_policy`;
        /// defaults to `.moderate`.
        var cancellationPolicy: CancellationPolicy = .moderate
        /// Length-of-stay weekly discount (% off ≥7-night stays). Sent as
        /// `weekly_discount`; `0` means no discount.
        var weeklyDiscount: Int = 0
        /// Length-of-stay monthly discount (% off ≥28-night stays). Sent as
        /// `monthly_discount`; `0` means no discount.
        var monthlyDiscount: Int = 0
        /// Optional seasonal weekend nightly rate (EGP, Fri + Sat). Sent as
        /// `weekend_price`; `nil` (or ≤0) means no weekend rate.
        var weekendPrice: Double? = nil
        /// Optional per-month seasonal nightly rates (EGP), keyed by month
        /// "1".."12". Sent as `monthly_prices`; only the months the host filled
        /// in are included (empty when none set).
        var monthlyPrices: [String: Double] = [:]
        /// The ownership / proof-of-ownership document the host uploaded, as a
        /// `data:image/*;base64,…` URL produced by `QKAvatarImage.makeDataURL`.
        /// Sent as `ownership_doc`; omitted from the body when empty. New
        /// listings are created pending + unpublished until an admin approves.
        var ownershipDoc: String = ""
        /// Map coordinate chosen via the host pin-picker (optional).
        var lat: Double?
        var lng: Double?
    }

    /// Create a listing. Throws `HostError.forbidden` when the signed-in account
    /// isn't a host (backend 403), `HostError.message` for other 4xx/5xx.
    @discardableResult
    func createListing(_ listing: NewListing) async throws -> Listing {
        guard let token else { throw HostError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/listings")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        var body: [String: Any] = [
            "title": listing.title,
            "description": listing.description,
            "location": listing.location,
            "country": listing.country,
            "price_per_night": listing.pricePerNight,
            "bedrooms": listing.bedrooms,
            "beds": listing.beds,
            "bathrooms": listing.bathrooms,
            "max_guests": listing.maxGuests,
            "property_type": listing.propertyType,
        ]
        // Device photos (each a data: URL or http(s) URL) in display order; `[]`
        // when the host added none. The first image is the listing cover.
        body["images"] = listing.images
        body["amenities"] = listing.amenities
        // Host-set cancellation policy (backend `cancellation_policy` column).
        body["cancellation_policy"] = listing.cancellationPolicy.rawValue
        // Length-of-stay discounts (backend `weekly_discount` / `monthly_discount`
        // columns). Always sent (0 = no discount) so the backend records them.
        body["weekly_discount"] = max(0, min(listing.weeklyDiscount, 100))
        body["monthly_discount"] = max(0, min(listing.monthlyDiscount, 100))
        // Seasonal pricing (backend `weekend_price` / `monthly_prices`). The
        // weekend rate is sent as a number when set, else null (no override).
        if let weekend = listing.weekendPrice, weekend > 0 {
            body["weekend_price"] = weekend
        } else {
            body["weekend_price"] = NSNull()
        }
        // Only forward the months the host actually filled with a positive rate.
        body["monthly_prices"] = listing.monthlyPrices.filter { $0.value > 0 }
        // Ownership / proof document (data: URL). When present the backend queues
        // the new listing for review; included only when the host attached one.
        let trimmedDoc = listing.ownershipDoc.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedDoc.isEmpty {
            body["ownership_doc"] = trimmedDoc
        }
        // Curated browse region the host selected (backend `region` column).
        if let region = listing.region?.trimmingCharacters(in: .whitespacesAndNewlines),
           !region.isEmpty {
            body["region"] = region
        }
        // Include the pin-picker coordinate when the host placed one. Sent as
        // top-level `lat`/`lng` so the listing shows up on the Explore map.
        if let lat = listing.lat, let lng = listing.lng {
            body["lat"] = lat
            body["lng"] = lng
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(Listing.self, from: data)
        }
        if http.statusCode == 401 { throw HostError.notSignedIn }
        if http.statusCode == 403 {
            throw HostError.forbidden(Self.decodeError(data) ?? "Only hosts can create listings.")
        }
        throw HostError.message(Self.decodeError(data) ?? "Couldn't create the listing (\(http.statusCode)).")
    }

    // MARK: - Re-submit ownership document (host only)

    /// (Re)submit a listing's ownership / proof document, re-queuing it for
    /// review (`PATCH /api/local/listings/:id` (Bearer) `{ ownership_doc }`).
    /// `doc` is a `data:image/*;base64,…` URL produced by
    /// `QKAvatarImage.makeDataURL`. The backend flips `approval_status` back to
    /// "pending" and echoes the updated listing.
    @discardableResult
    func resubmitOwnershipDoc(listingID: String, doc: String) async throws -> Listing {
        try await sendListing(
            method: "PATCH",
            path: "/api/local/listings/\(Self.pathEscape(listingID))",
            body: ["ownership_doc": doc],
            failure: "Couldn't submit the document"
        )
    }

    // MARK: - Edit listing (host only) → back to admin review

    /// Everything the host "Edit listing" form can change, in the same field set
    /// (and with the same rules) as `NewListing`. Photos are **not** here: they
    /// go through the dedicated `/images` endpoints so an edit never re-uploads
    /// the photos that didn't change.
    ///
    /// Every field sent re-queues the listing for admin review — the backend
    /// flips `approval_status` to "pending" and `is_published` to false in the
    /// same statement — so the editor warns the host before it calls this.
    struct ListingEdit {
        var title: String
        var description: String
        var location: String
        var country: String
        /// Curated area (e.g. "North Coast"). Sent as `region`; omitted when nil
        /// so a listing without one keeps its current value.
        var region: String?
        var pricePerNight: Double
        var bedrooms: Int
        var beds: Int
        var bathrooms: Int
        var maxGuests: Int
        var propertyType: String
        var amenities: [String] = []
        var cancellationPolicy: CancellationPolicy = .moderate
        var weeklyDiscount: Int = 0
        var monthlyDiscount: Int = 0
        var weekendPrice: Double? = nil
        var monthlyPrices: [String: Double] = [:]
        /// A **newly attached** ownership document (`data:image/*;base64,…`).
        /// Empty means "leave the one already on file alone" — the field is then
        /// omitted from the body entirely.
        var ownershipDoc: String = ""
        /// Pin-picker coordinate; both are sent together or not at all.
        var lat: Double?
        var lng: Double?

        /// Seed the editor from the listing the host tapped, so the form opens
        /// showing exactly what is live today.
        init(listing: Listing) {
            title = listing.title
            description = listing.description ?? ""
            location = listing.location ?? ""
            country = listing.country ?? ""
            region = listing.region
            pricePerNight = listing.pricePerNight
            bedrooms = listing.bedrooms ?? 0
            beds = listing.beds ?? 0
            bathrooms = listing.bathrooms ?? 0
            maxGuests = listing.maxGuests ?? 1
            propertyType = listing.propertyType ?? ""
            amenities = listing.amenities
            cancellationPolicy = listing.policy
            weeklyDiscount = listing.weeklyDiscount
            monthlyDiscount = listing.monthlyDiscount
            weekendPrice = listing.weekendPrice
            monthlyPrices = listing.monthlyPrices
            lat = listing.lat
            lng = listing.lng
        }
    }

    /// Save a host's edits to their own listing
    /// (`PATCH /api/local/listings/:id`). Ownership is enforced server-side in
    /// the SQL, so someone else's listing answers 403 → `HostError.forbidden`.
    /// Returns the updated listing, whose `approval_status` is already "pending"
    /// — the caller can show "Under review" without a refetch.
    @discardableResult
    func updateListing(id: String, _ edit: ListingEdit) async throws -> Listing {
        var body: [String: Any] = [
            "title": edit.title,
            "description": edit.description,
            "location": edit.location,
            "country": edit.country,
            "price_per_night": edit.pricePerNight,
            "bedrooms": edit.bedrooms,
            "beds": edit.beds,
            "bathrooms": edit.bathrooms,
            "max_guests": edit.maxGuests,
            "property_type": edit.propertyType,
            "amenities": edit.amenities,
            "cancellation_policy": edit.cancellationPolicy.rawValue,
            "weekly_discount": max(0, min(edit.weeklyDiscount, 100)),
            "monthly_discount": max(0, min(edit.monthlyDiscount, 100)),
        ]
        // Weekend rate: a number when set, else null (clears any override) —
        // same encoding the create request uses.
        if let weekend = edit.weekendPrice, weekend > 0 {
            body["weekend_price"] = weekend
        } else {
            body["weekend_price"] = NSNull()
        }
        body["monthly_prices"] = edit.monthlyPrices.filter { $0.value > 0 }
        if let region = edit.region?.trimmingCharacters(in: .whitespacesAndNewlines),
           !region.isEmpty {
            body["region"] = region
        }
        // Only sent when the host attached a NEW document; otherwise the listing
        // keeps the one already on file.
        let trimmedDoc = edit.ownershipDoc.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedDoc.isEmpty {
            body["ownership_doc"] = trimmedDoc
        }
        if let lat = edit.lat, let lng = edit.lng {
            body["lat"] = lat
            body["lng"] = lng
        }

        return try await sendListing(
            method: "PATCH",
            path: "/api/local/listings/\(Self.pathEscape(id))",
            body: body,
            failure: "Couldn't save your changes"
        )
    }

    // MARK: - Listing photos (host only) → back to admin review

    /// Append photos to a listing (`POST /api/local/listings/:id/images`). Each
    /// entry is a `data:image/*;base64,…` URL produced by
    /// `QKAvatarImage.makeDataURL` (or an `http(s)` URL). They land after the
    /// existing photos, in the order given.
    @discardableResult
    func addListingPhotos(listingID: String, urls: [String]) async throws -> Listing {
        try await sendListing(
            method: "POST",
            path: "/api/local/listings/\(Self.pathEscape(listingID))/images",
            body: ["images": urls],
            failure: "Couldn't add the photos"
        )
    }

    /// Remove one photo (`DELETE /api/local/listings/:id/images/:imageId`). The
    /// remaining photos are re-packed server-side, so deleting the cover
    /// promotes the next photo.
    @discardableResult
    func deleteListingPhoto(listingID: String, imageID: String) async throws -> Listing {
        try await sendListing(
            method: "DELETE",
            path: "/api/local/listings/\(Self.pathEscape(listingID))/images/\(Self.pathEscape(imageID))",
            body: nil,
            failure: "Couldn't remove the photo"
        )
    }

    /// Reorder the whole photo set (`PATCH /api/local/listings/:id/images`).
    /// `imageIDs` must list every photo of the listing exactly once; index 0
    /// becomes the cover. Covers both "reorder" and "set as cover".
    @discardableResult
    func setListingPhotoOrder(listingID: String, imageIDs: [String]) async throws -> Listing {
        try await sendListing(
            method: "PATCH",
            path: "/api/local/listings/\(Self.pathEscape(listingID))/images",
            body: ["order": imageIDs],
            failure: "Couldn't reorder the photos"
        )
    }

    /// Shared transport for every host listing mutation: one authenticated
    /// request that decodes the echoed listing. `failure` is the fallback text
    /// when the server sends no `error` of its own.
    private func sendListing(
        method: String,
        path: String,
        body: [String: Any]?,
        failure: String
    ) async throws -> Listing {
        guard let token else { throw HostError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)\(path)")!
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(Listing.self, from: data)
        }
        if http.statusCode == 401 { throw HostError.notSignedIn }
        if http.statusCode == 403 {
            throw HostError.forbidden(Self.decodeError(data) ?? "You can only update your own listings.")
        }
        throw HostError.message(Self.decodeError(data) ?? "\(failure) (\(http.statusCode)).")
    }

    // MARK: - Become a host (application → admin review)

    /// The fields the "Become a host" form collects. Sent as the body of
    /// `POST /api/local/host/apply`.
    struct HostApplicationDraft {
        var fullName: String = ""
        var nationalID: String = ""
        var phone: String = ""
        var address: String = ""
        /// Company / brokerage display name — only sent for the business types.
        var company: String = ""
        var hostType: HostType = .individual
        var notes: String = ""
    }

    /// The signed-in account's application + its server-derived status. Used to
    /// prefill the form when a rejected applicant reapplies and to date the
    /// "under review" card.
    func fetchHostApplication() async throws -> HostApplicationState {
        try await get("\(Config.apiBaseURL)/api/local/host/application", as: HostApplicationState.self)
    }

    /// Submit (or re-submit, after a rejection) the host application.
    ///
    /// This does **not** make the account a host — the backend files it as
    /// `pending` for an admin to review in `/ops` and echoes the new
    /// `host_status`. Only that approval flips `is_host`, which the client picks
    /// up from `GET /api/auth/me` (`AuthStore.refreshSession`).
    ///
    /// Throws `HostError.message` with the server's text for the documented 4xx
    /// cases (400 validation, 409 "Already a host" / "Application already under
    /// review") so the form can show it inline.
    @discardableResult
    func submitHostApplication(_ draft: HostApplicationDraft) async throws -> HostStatus {
        guard let token else { throw HostError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/host/apply")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        var body: [String: Any] = [
            "full_name": draft.fullName.trimmingCharacters(in: .whitespacesAndNewlines),
            "national_id": draft.nationalID.trimmingCharacters(in: .whitespacesAndNewlines),
            "phone": draft.phone.trimmingCharacters(in: .whitespacesAndNewlines),
            "address": draft.address.trimmingCharacters(in: .whitespacesAndNewlines),
            "host_type": draft.hostType.rawValue,
        ]
        // Company only applies to the business host types; notes are optional.
        let company = draft.company.trimmingCharacters(in: .whitespacesAndNewlines)
        if draft.hostType.isBusiness, !company.isEmpty {
            body["company"] = company
        }
        let notes = draft.notes.trimmingCharacters(in: .whitespacesAndNewlines)
        if !notes.isEmpty {
            body["notes"] = notes
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            struct ApplyResponse: Decodable {
                let hostStatus: String?
                enum CodingKeys: String, CodingKey { case hostStatus = "host_status" }
            }
            let decoded = try? JSONDecoder().decode(ApplyResponse.self, from: data)
            // The backend always files an application as pending; fall back to
            // that when it omits the field.
            let status = HostStatus(raw: decoded?.hostStatus)
            return status == .none ? .pending : status
        }
        if http.statusCode == 401 { throw HostError.notSignedIn }
        throw HostError.message(Self.decodeError(data) ?? "Couldn't submit your application (\(http.statusCode)).")
    }

    // MARK: - Host reservations

    /// Reservation requests across all of the host's listings.
    func fetchHostBookings() async throws -> [HostBooking] {
        try await get("\(Config.apiBaseURL)/api/local/host/bookings", as: [HostBooking].self)
    }

    /// The host's own listings.
    func fetchHostListings() async throws -> [Listing] {
        try await get("\(Config.apiBaseURL)/api/local/host/listings", as: [Listing].self)
    }

    /// Whether this host may add a listing, and if not, why — so the wizard can
    /// say so before they fill it in. The create endpoint enforces the same rule.
    func fetchListingGate() async throws -> ListingGate {
        try await get("\(Config.apiBaseURL)/api/local/host/listing-gate", as: ListingGate.self)
    }

    /// The platform commission, so the add/edit-listing screens can tell a host
    /// what guests will pay for the price they are typing. Auth-gated server-side:
    /// guests see one inclusive price, and the rate divides back out to the raw one.
    func fetchCommission() async throws -> CommissionInfo {
        try await get("\(Config.apiBaseURL)/api/local/host/commission", as: CommissionInfo.self)
    }

    /// Confirm or reject a pending reservation. `action` is `confirm` or `reject`.
    @discardableResult
    func updateBooking(id: String, action: HostBookingAction) async throws -> HostBooking? {
        guard let token else { throw HostError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/bookings/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["status": action.rawValue])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            // The updated booking is returned, but the caller can refresh anyway.
            return try? JSONDecoder().decode(HostBooking.self, from: data)
        }
        if http.statusCode == 401 { throw HostError.notSignedIn }
        throw HostError.message(Self.decodeError(data) ?? "Couldn't update the request (\(http.statusCode)).")
    }

    // MARK: - Reservation detail

    /// A single reservation's full detail (drives the detail screen + QR).
    func fetchReservation(id: String) async throws -> ReservationDetail {
        try await get("\(Config.apiBaseURL)/api/local/bookings/\(id)", as: ReservationDetail.self)
    }

    // MARK: - Stay guide (host-authored content on a confirmed booking)

    /// The fields the stay-guide editor collects for one item. Sent as the body
    /// of the create/update calls.
    struct StayGuideDraft {
        var kind: StayGuideKind = .info
        var title: String = ""
        /// Info text, or the caption of a photo / file / place link.
        var body: String = ""
        /// A `data:image/*;base64,…` URL (photo / attached file) produced by
        /// `QKAvatarImage.makeDataURL`, or an `https://` link (place QR, remote
        /// file). Empty for a plain info block.
        var url: String = ""
        /// Display position within the guide. Appended at the end on create.
        var order: Int = 0

        init(kind: StayGuideKind = .info, order: Int = 0) {
            self.kind = kind
            self.order = order
        }

        /// Seed the editor from an existing item (the "edit" path).
        init(item: StayGuideItem) {
            kind = item.guideKind
            title = item.titleText ?? ""
            body = item.bodyText ?? ""
            url = item.urlText ?? ""
            order = item.order ?? 0
        }
    }

    /// A booking's stay-guide items — readable by the listing's host **and** by
    /// that booking's guest (the backend enforces it; 403 otherwise).
    func fetchStayGuide(bookingID: String) async throws -> [StayGuideItem] {
        let encoded = bookingID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? bookingID
        return try await get("\(Config.apiBaseURL)/api/local/bookings/\(encoded)/stay-guide",
                             as: [StayGuideItem].self)
    }

    /// Add an item to a booking's stay guide
    /// (`POST /api/local/bookings/:id/stay-guide`). Host of that listing only,
    /// and only once the booking is confirmed — the backend re-checks both.
    @discardableResult
    func createStayGuideItem(bookingID: String, draft: StayGuideDraft) async throws -> StayGuideItem {
        try await sendStayGuide(
            method: "POST",
            path: "/api/local/bookings/\(Self.pathEscape(bookingID))/stay-guide",
            draft: draft
        )
    }

    /// Edit an existing item (`PATCH …/stay-guide/:itemId`). Host only.
    @discardableResult
    func updateStayGuideItem(bookingID: String, itemID: String, draft: StayGuideDraft) async throws -> StayGuideItem {
        try await sendStayGuide(
            method: "PATCH",
            path: "/api/local/bookings/\(Self.pathEscape(bookingID))/stay-guide/\(Self.pathEscape(itemID))",
            draft: draft
        )
    }

    /// Reorder one item (`PATCH …/stay-guide/:itemId` with just `order`). Host
    /// only. Sent for each of the two rows a move swaps.
    func setStayGuideOrder(bookingID: String, itemID: String, order: Int) async throws {
        guard let token else { throw HostError.notSignedIn }

        let path = "/api/local/bookings/\(Self.pathEscape(bookingID))/stay-guide/\(Self.pathEscape(itemID))"
        let url = URL(string: "\(Config.apiBaseURL)\(path)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["order": order])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) { return }
        if http.statusCode == 401 { throw HostError.notSignedIn }
        if http.statusCode == 403 {
            throw HostError.forbidden(Self.decodeError(data) ?? "Only the listing's host can edit the stay guide.")
        }
        throw HostError.message(Self.decodeError(data) ?? "Couldn't reorder the guide (\(http.statusCode)).")
    }

    /// Remove an item (`DELETE …/stay-guide/:itemId`). Host only.
    func deleteStayGuideItem(bookingID: String, itemID: String) async throws {
        guard let token else { throw HostError.notSignedIn }

        let path = "/api/local/bookings/\(Self.pathEscape(bookingID))/stay-guide/\(Self.pathEscape(itemID))"
        let url = URL(string: "\(Config.apiBaseURL)\(path)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) { return }
        if http.statusCode == 401 { throw HostError.notSignedIn }
        if http.statusCode == 403 {
            throw HostError.forbidden(Self.decodeError(data) ?? "Only the listing's host can edit the stay guide.")
        }
        throw HostError.message(Self.decodeError(data) ?? "Couldn't remove the item (\(http.statusCode)).")
    }

    /// Shared create/update transport: validates the draft, PUTs the JSON body
    /// and decodes the echoed item.
    private func sendStayGuide(method: String, path: String, draft: StayGuideDraft) async throws -> StayGuideItem {
        guard let token else { throw HostError.notSignedIn }
        let body = try await Self.stayGuideBody(draft)

        let url = URL(string: "\(Config.apiBaseURL)\(path)")!
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(StayGuideItem.self, from: data)
        }
        if http.statusCode == 401 { throw HostError.notSignedIn }
        if http.statusCode == 403 {
            throw HostError.forbidden(
                Self.decodeError(data) ?? "Only the listing's host can edit the stay guide, once the booking is confirmed."
            )
        }
        throw HostError.message(Self.decodeError(data) ?? "Couldn't save the item (\(http.statusCode)).")
    }

    /// Validate a draft and build its JSON body. Mirrors the server rules so a
    /// bad item is rejected inline instead of round-tripping: the four kinds,
    /// `data:`/`http(s)` for an upload, `http(s)` **only** for a place link
    /// (never `data:`/`javascript:`), and the length caps. `@MainActor` so the
    /// messages it throws come out of the localized string table.
    @MainActor
    static func stayGuideBody(_ draft: StayGuideDraft) throws -> [String: Any] {
        let title = draft.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let text = draft.body.trimmingCharacters(in: .whitespacesAndNewlines)
        let link = draft.url.trimmingCharacters(in: .whitespacesAndNewlines)

        if title.count > StayGuideRules.maxTitleChars || text.count > StayGuideRules.maxBodyChars {
            throw HostError.message(L.t("guide.error.tooLong"))
        }

        switch draft.kind {
        case .info:
            if title.isEmpty && text.isEmpty {
                throw HostError.message(L.t("guide.error.info"))
            }
        case .photo:
            guard !link.isEmpty, StayGuideRules.isUploadURL(link) else {
                throw HostError.message(L.t("guide.error.photo"))
            }
        case .attachment:
            guard !link.isEmpty, StayGuideRules.isUploadURL(link) else {
                throw HostError.message(L.t("guide.error.file"))
            }
        case .placeQR:
            guard StayGuideRules.isWebLink(link) else {
                throw HostError.message(L.t("guide.error.link"))
            }
        }
        if link.count > StayGuideRules.maxURLChars {
            throw HostError.message(L.t("guide.error.tooLarge"))
        }

        var body: [String: Any] = [
            "kind": draft.kind.rawValue,
            "order": max(0, draft.order),
        ]
        body["title"] = title.isEmpty ? NSNull() : title
        body["body"] = text.isEmpty ? NSNull() : text
        body["url"] = link.isEmpty ? NSNull() : link
        return body
    }

    /// Percent-encode an id for use as a path segment.
    private static func pathEscape(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value
    }

    // MARK: - Money (host earnings + guest receipts)

    /// The signed-in host's earnings + payout summary (drives the Earnings view).
    /// Maps 403 to `.forbidden` (account isn't a host) and 401 to `.notSignedIn`.
    func fetchHostEarnings() async throws -> HostEarnings {
        try await get("\(Config.apiBaseURL)/api/local/host/earnings", as: HostEarnings.self)
    }

    /// The signed-in guest's paid receipts, itemized (drives the Receipts view).
    func fetchReceipts() async throws -> [GuestReceipt] {
        try await get("\(Config.apiBaseURL)/api/local/receipts", as: [GuestReceipt].self)
    }

    // MARK: - Host analytics (Section 10)

    /// The signed-in host's analytics dashboard (bookings, revenue, rating,
    /// conversion, monthly trend, top listings). Maps 403 to `.forbidden`
    /// (account isn't a host) and 401 to `.notSignedIn`.
    func fetchAnalytics() async throws -> HostAnalytics {
        try await get("\(Config.apiBaseURL)/api/local/host/analytics", as: HostAnalytics.self)
    }

    /// Fetch the multi-currency FX rates (`GET /api/local/currencies`). Public —
    /// no auth. Powers the in-app currency switcher; the caller falls back to the
    /// baked-in `CurrencyRates.fallback` when this throws (offline / non-2xx).
    func fetchCurrencyRates() async throws -> CurrencyRates {
        let url = URL(string: "\(Config.apiBaseURL)/api/local/currencies")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        guard (200...299).contains(http.statusCode) else {
            throw HostError.message("Couldn't load currency rates (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(CurrencyRates.self, from: data)
    }

    // MARK: - Booking chat (host ↔ guest)

    /// Fetch the message thread for a booking, oldest-first. Used by `ChatView`
    /// for the initial load and the ~4s poll.
    func fetchMessages(bookingID: String) async throws -> [ChatMessage] {
        try await get("\(Config.apiBaseURL)/api/local/bookings/\(bookingID)/messages", as: [ChatMessage].self)
    }

    /// Send a message in a booking thread. Returns the created message (201).
    @discardableResult
    func sendMessage(bookingID: String, body: String) async throws -> ChatMessage {
        guard let token else { throw HostError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/bookings/\(bookingID)/messages")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["body": body])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(ChatMessage.self, from: data)
        }
        if http.statusCode == 401 { throw HostError.notSignedIn }
        throw HostError.message(Self.decodeError(data) ?? "Couldn't send the message (\(http.statusCode)).")
    }

    // MARK: - Helpers

    /// Authenticated GET → decoded `T`. Maps 401 to `.notSignedIn`.
    private func get<T: Decodable>(_ urlString: String, as type: T.Type) async throws -> T {
        guard let token else { throw HostError.notSignedIn }

        let url = URL(string: urlString)!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw HostError.notSignedIn }
        if http.statusCode == 403 {
            throw HostError.forbidden(Self.decodeError(data) ?? "You don't have access to that.")
        }
        guard (200...299).contains(http.statusCode) else {
            throw HostError.message(Self.decodeError(data) ?? "Request failed (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private static func decodeError(_ data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String }
        return (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
    }
}

/// The PATCH action sent to confirm or reject a reservation.
enum HostBookingAction: String {
    case confirm
    case reject
}

/// Errors surfaced to the host + reservation-detail UI.
enum HostError: LocalizedError {
    case notSignedIn
    case forbidden(String)
    case message(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn:        return "Sign in to continue"
        case let .forbidden(text): return text
        case let .message(text):   return text
        }
    }
}
