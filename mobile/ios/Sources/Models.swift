import Foundation
import CoreLocation

/// The rules for the weekend rung of the pricing ladder: which weekdays a
/// listing's `weekendPrice` is charged on, and what a (rate, days) pair may be.
///
/// The Swift twin of `listing-pricing-core.ts` on the server, which is the file
/// the website and the API both run. Keep the four answers below in step with
/// `resolveWeekendSchedule` there — the API refuses the same two sets this
/// refuses, and a host should be told by the screen they are typing into rather
/// than by a save that comes back 400.
enum WeekendSchedule {
    /// Egypt's weekend, and the fallback when a host never chose (`weekend_days`
    /// is NULL). Matches `DEFAULT_WEEKEND_DAYS` on the server.
    static let defaultDays: [Int] = [5, 6]

    /// Days in a week — the ceiling a weekend has to stay under.
    static let daysInWeek = 7

    /// Why a chosen day set cannot be saved. `Error` so it can be the failure of
    /// a `Result`, which is how the screens ask this question.
    enum Problem: Error {
        /// All seven days, which leaves the nightly price applying to no night.
        case wholeWeek
        /// A rate was typed with no day left lit to charge it on.
        case noDaysChosen
    }

    /// Keep whole days in 0...6, drop repeats, sort ascending.
    static func normalize(_ raw: [Int]) -> [Int] {
        Array(Set(raw.filter { (0..<daysInWeek).contains($0) })).sorted()
    }

    /// The days a listing actually prices at its weekend rate — the host's own
    /// set, or the default when they never chose. What the server's ladder does,
    /// so a preview here matches the quote.
    static func effective(_ days: [Int]?) -> [Int] {
        guard let days, !days.isEmpty else { return defaultDays }
        return normalize(days)
    }

    /// Judge a (rate, days) pair as ONE thing, the way the API does.
    ///
    /// - no rate → no days, and never an error: clearing the weekend price is
    ///   how a host turns weekend pricing off, and refusing that save would
    ///   strand them on a form they are in the middle of fixing.
    /// - all seven days → `.wholeWeek`.
    /// - no days under a real rate → `.noDaysChosen`.
    static func resolve(price: Double?, days: [Int]) -> Result<[Int]?, Problem> {
        guard let price, price > 0 else { return .success(nil) }
        let cleaned = normalize(days)
        if cleaned.count >= daysInWeek { return .failure(.wholeWeek) }
        if cleaned.isEmpty { return .failure(.noDaysChosen) }
        return .success(cleaned)
    }
}

/// A photo attached to a listing (from the `listing_images` table).
struct ListingImage: Codable, Hashable {
    /// `listing_images.id` — what the photo delete / reorder endpoints address.
    /// `nil` on older responses that only returned `url` + `order`; the host
    /// photo editor then can't address that row individually.
    let id: String?
    let url: String
    let order: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case url
        case order
    }
}

/// A QuickIn listing (subset of columns needed for browse + detail).
struct Listing: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let description: String?
    let location: String?
    /// The place's country, from the `country` column. `nil` when unset. Only
    /// the host edit form reads it (the guest UI shows `location`/`region`).
    let country: String?
    /// Curated area the place belongs to (e.g. "North Coast", "Ain Sokhna").
    /// Backed by the listings' `region` column; `nil` when unset.
    let region: String?
    /// The catalog resort this listing belongs to, from the `resort_id` column.
    /// `nil` when the host typed their own compound name or picked none — the
    /// two are mutually exclusive server-side. Seeds the host editor's picker.
    let resortId: String?
    /// The resort / compound to SHOW: the catalog resort's name when `resortId`
    /// is set, otherwise whatever the host typed. `nil` when the listing isn't in
    /// one. Backed by the API's derived `resort` field, not by a column.
    let resort: String?
    /// The property type ("Apartment", "Villa", …), from the `property_type`
    /// column. `nil` when unset. Prefills the host edit form's type picker.
    let propertyType: String?
    /// The host's profile id, from the `host_id` column. `nil` when the backend
    /// omits it. Drives the "More from this host" fetch on the detail screen.
    let hostId: String?
    /// The host's display name, from the `host_name` column. `nil` when unset —
    /// the detail screen then hides the "Hosted by" row.
    let hostName: String?
    let pricePerNight: Double
    let currency: String?
    let bedrooms: Int?
    let beds: Int?
    let bathrooms: Int?
    let maxGuests: Int?
    let isGuestFavorite: Bool?
    let listingCode: String?
    let lat: Double?
    let lng: Double?
    let images: [ListingImage]?
    /// Amenity labels offered by the place (e.g. "WiFi", "Pool"). Defaults to
    /// empty when the backend omits the field.
    let amenities: [String]
    /// Average guest rating (0–5) from the `rating` column. `0` when the place
    /// has no reviews yet — the UI shows "New" instead of a star value.
    let rating: Double
    /// Number of reviews backing `rating`, from the `review_count` column.
    /// Defaults to `0` when the backend omits the field.
    let reviewCount: Int
    /// The host-set cancellation policy ("flexible" | "moderate" | "strict"),
    /// from the `cancellation_policy` column. Defaults to "moderate" when the
    /// backend omits it. Surfaced as a "Cancellation policy" row on detail.
    let cancellationPolicy: String
    /// Whether the listing's host has a verified identity, from the
    /// `host_verified` column. Defaults to `false` when the backend omits it.
    /// Drives the "Verified host" trust badge on the detail screen.
    let hostVerified: Bool
    /// The listing's moderation state ("pending" | "approved" | "rejected"),
    /// from the `approval_status` column. Defaults to "approved" when the backend
    /// omits it (older responses / public reads, which only ever return approved
    /// listings). Drives the host's own "Under review / Approved / Rejected"
    /// badge + the re-upload-ownership-doc action.
    let approvalStatus: String
    /// Length-of-stay weekly discount (% off), from the `weekly_discount` column.
    /// Applied server-side to stays of ≥7 nights. Defaults to `0` (no discount)
    /// when the backend omits it. Surfaced as a small note near the price.
    let weeklyDiscount: Int
    /// Length-of-stay monthly discount (% off), from the `monthly_discount`
    /// column. Applied server-side to stays of ≥28 nights (takes precedence over
    /// the weekly discount). Defaults to `0` when the backend omits it.
    let monthlyDiscount: Int
    /// Optional seasonal weekend nightly rate (EGP), from the `weekend_price`
    /// column. `nil` when the host hasn't set one — the base `pricePerNight`
    /// then applies on weekends. Used by the authoritative quote endpoint;
    /// surfaced on the guest detail screen as a "seasonal rates" note.
    /// Which nights it applies to is `weekendDays`, NOT a fixed Fri + Sat.
    let weekendPrice: Double?
    /// Which weekdays `weekendPrice` is charged on, from the `weekend_days`
    /// column (`0`=Sun … `6`=Sat). `nil` when the host never chose, which means
    /// the default weekend applies — see `WeekendSchedule.effective`.
    ///
    /// A weekend is not Friday and Saturday everywhere, nor for every property,
    /// so this is the host's answer and not a constant. Both apps used to have
    /// no picker at all and told the host "Applied on Fri + Sat nights"; the
    /// column existed and the backend simply never sent it.
    let weekendDays: [Int]?
    /// Optional per-month seasonal nightly rates (EGP), from the `monthly_prices`
    /// object keyed by month "1".."12" → nightly EGP. Only the months the host
    /// filled in are present. Defaults to empty `[:]` when the backend omits it.
    let monthlyPrices: [String: Double]
    /// ISO-8601 timestamp the listing was created, from the `created_at` column.
    /// `nil` when the backend omits it (older responses). Drives the
    /// "Listed 27 Jul 2026" line on the host's own listing rows.
    let createdAt: String?
    /// Why staff rejected this listing, from the `review_note` column. `nil` when they
    /// rejected without writing a reason (the note is optional), on listings rejected
    /// before the reason was stored at all, and on every guest read — the backend
    /// returns it only in the host projection, since it is staff-authored text about
    /// this host. Shown under the "Rejected" badge on the host's own listing rows,
    /// which fall back to generic guidance when it is nil. Cleared server-side the
    /// moment the listing goes back into the review queue.
    let reviewNote: String?
    /// Whether guests can see this listing at all, from `is_published`. Defaults
    /// to `true` when the backend omits it — every public read only ever returns
    /// published listings, so absence means "visible".
    let isPublished: Bool
    /// HOST READS ONLY. The host took this listing down themselves — the one
    /// takedown reason they can undo, and what the Deactivate / Reactivate button
    /// acts on. QuickIn has no host-facing delete: bookings, reviews and payment
    /// records hang off the listing id, so "remove my listing" is this flag going
    /// true and `is_published` going false, with nothing erased.
    let unpublishedByHost: Bool
    /// HOST READS ONLY. An account block hid it; only a staff restore undoes it.
    let unpublishedByAdmin: Bool
    /// HOST READS ONLY. The identity gate hid it; only re-verifying undoes it.
    let unpublishedByVerification: Bool
    /// HOST READS ONLY. Booking requests still waiting on this host — the number
    /// a deactivate would decline, named in the confirmation before it happens.
    let pendingRequestCount: Int
    /// HOST READS ONLY. Whether a proof-of-ownership document is on file, from
    /// `has_ownership_doc`. A flag, never the document — that stays admin-only.
    /// The document is OPTIONAL at create time, so this is a different question
    /// from `approvalStatus`: a listing sits in the queue as `.pending` with
    /// nothing attached. Decides whether the card offers "Upload ownership
    /// document" or "Re-upload ownership document"; defaults to `false`, which
    /// asks for the document either way rather than claiming one exists.
    let hasOwnershipDoc: Bool

    enum CodingKeys: String, CodingKey {
        case id, title, description, location, country, region, resort, currency, bedrooms, beds, bathrooms, lat, lng, amenities, rating
        case resortId = "resort_id"
        case propertyType = "property_type"
        case pricePerNight = "price_per_night"
        case maxGuests = "max_guests"
        case isGuestFavorite = "is_guest_favorite"
        case listingCode = "listing_code"
        case images = "listing_images"
        case reviewCount = "review_count"
        case hostId = "host_id"
        case hostName = "host_name"
        case cancellationPolicy = "cancellation_policy"
        case hostVerified = "host_verified"
        case approvalStatus = "approval_status"
        case weeklyDiscount = "weekly_discount"
        case monthlyDiscount = "monthly_discount"
        case weekendPrice = "weekend_price"
        case weekendDays = "weekend_days"
        case monthlyPrices = "monthly_prices"
        case createdAt = "created_at"
        case reviewNote = "review_note"
        case isPublished = "is_published"
        case unpublishedByHost = "unpublished_by_host"
        case unpublishedByAdmin = "unpublished_by_admin"
        case unpublishedByVerification = "unpublished_by_verification"
        case pendingRequestCount = "pending_request_count"
        case hasOwnershipDoc = "has_ownership_doc"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        location = try c.decodeIfPresent(String.self, forKey: .location)
        country = try c.decodeIfPresent(String.self, forKey: .country)
        region = try c.decodeIfPresent(String.self, forKey: .region)
        resortId = try c.decodeIfPresent(String.self, forKey: .resortId)
        resort = try c.decodeIfPresent(String.self, forKey: .resort)
        propertyType = try c.decodeIfPresent(String.self, forKey: .propertyType)
        hostId = try c.decodeIfPresent(String.self, forKey: .hostId)
        hostName = try c.decodeIfPresent(String.self, forKey: .hostName)
        pricePerNight = try c.decode(Double.self, forKey: .pricePerNight)
        currency = try c.decodeIfPresent(String.self, forKey: .currency)
        bedrooms = try c.decodeIfPresent(Int.self, forKey: .bedrooms)
        beds = try c.decodeIfPresent(Int.self, forKey: .beds)
        bathrooms = try c.decodeIfPresent(Int.self, forKey: .bathrooms)
        maxGuests = try c.decodeIfPresent(Int.self, forKey: .maxGuests)
        isGuestFavorite = try c.decodeIfPresent(Bool.self, forKey: .isGuestFavorite)
        listingCode = try c.decodeIfPresent(String.self, forKey: .listingCode)
        lat = try c.decodeIfPresent(Double.self, forKey: .lat)
        lng = try c.decodeIfPresent(Double.self, forKey: .lng)
        images = try c.decodeIfPresent([ListingImage].self, forKey: .images)
        amenities = try c.decodeIfPresent([String].self, forKey: .amenities) ?? []
        rating = try c.decodeIfPresent(Double.self, forKey: .rating) ?? 0
        reviewCount = try c.decodeIfPresent(Int.self, forKey: .reviewCount) ?? 0
        cancellationPolicy = (try c.decodeIfPresent(String.self, forKey: .cancellationPolicy))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "moderate"
        hostVerified = try c.decodeIfPresent(Bool.self, forKey: .hostVerified) ?? false
        approvalStatus = (try c.decodeIfPresent(String.self, forKey: .approvalStatus))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "approved"
        weeklyDiscount = try c.decodeIfPresent(Int.self, forKey: .weeklyDiscount) ?? 0
        monthlyDiscount = try c.decodeIfPresent(Int.self, forKey: .monthlyDiscount) ?? 0
        // Seasonal weekend rate: treat 0 / negative as "unset".
        weekendPrice = (try c.decodeIfPresent(Double.self, forKey: .weekendPrice)).flatMap { $0 > 0 ? $0 : nil }
        // The days that rate is charged on. An EMPTY array is decoded as `nil`
        // rather than as "no day is a weekend": rows predating the write rules
        // can hold `{}`, and the server prices those at the default weekend, so
        // showing the host anything else here would contradict their own quote.
        weekendDays = (try c.decodeIfPresent([Int].self, forKey: .weekendDays))
            .map(WeekendSchedule.normalize)
            .flatMap { $0.isEmpty ? nil : $0 }
        // Per-month seasonal rates: keep only positive nightly values keyed "1".."12".
        monthlyPrices = (try c.decodeIfPresent([String: Double].self, forKey: .monthlyPrices) ?? [:])
            .filter { $0.value > 0 }
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        // Blank and whitespace-only are the same as absent: the server already
        // normalizes them to NULL, and treating "" as a reason here would render an
        // empty box where the generic copy belongs.
        reviewNote = (try c.decodeIfPresent(String.self, forKey: .reviewNote))
            .flatMap { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : $0 }
        // Absent means visible: a guest read only ever returns published listings,
        // and defaulting to false there would badge every one of them "hidden".
        isPublished = try c.decodeIfPresent(Bool.self, forKey: .isPublished) ?? true
        // The three takedown flags and the pending count ride only on HOST reads
        // (LISTING_COLS_HOST). On a guest read they are simply absent, and false /
        // zero is the honest answer for a listing nobody is holding down.
        unpublishedByHost = try c.decodeIfPresent(Bool.self, forKey: .unpublishedByHost) ?? false
        unpublishedByAdmin = try c.decodeIfPresent(Bool.self, forKey: .unpublishedByAdmin) ?? false
        unpublishedByVerification = try c.decodeIfPresent(Bool.self, forKey: .unpublishedByVerification) ?? false
        pendingRequestCount = try c.decodeIfPresent(Int.self, forKey: .pendingRequestCount) ?? 0
        // Host reads only, same as above. Absent → false, so an app talking to a
        // backend that predates the field asks the host to upload the document
        // rather than telling them to re-upload one it cannot see.
        hasOwnershipDoc = try c.decodeIfPresent(Bool.self, forKey: .hasOwnershipDoc) ?? false
    }

    /// `true` once the place has at least one review backing a rating.
    var hasRating: Bool { reviewCount > 0 && rating > 0 }

    /// `true` when the host offers any length-of-stay discount.
    var hasLengthOfStayDiscount: Bool { weeklyDiscount > 0 || monthlyDiscount > 0 }

    /// `true` when the host has set any seasonal/variable pricing — a weekend
    /// rate or at least one per-month rate. Drives the "seasonal rates apply"
    /// note near the price on the guest detail screen.
    var hasSeasonalPricing: Bool { weekendPrice != nil || !monthlyPrices.isEmpty }

    /// The strongly-typed cancellation policy (falls back to `.moderate`).
    var policy: CancellationPolicy { CancellationPolicy(raw: cancellationPolicy) }

    /// The strongly-typed moderation state (falls back to `.approved`).
    var approval: ApprovalStatus { ApprovalStatus(raw: approvalStatus) }

    /// The single state the host's own listing row is shown in — moderation and
    /// visibility folded together, because from the host's side "why can nobody
    /// see this?" has one answer, not two, and a listing can be approved and
    /// hidden at the same time. Mirrors `hostVisibilityState()` in the backend's
    /// host-visibility-core.ts, which the API enforces the same rules from.
    var hostVisibility: HostVisibility {
        if unpublishedByHost { return .deactivated }
        switch approval {
        case .rejected: return .rejected
        case .pending: return .underReview
        case .approved: return isPublished ? .live : .blocked
        }
    }

    /// Map coordinate for this listing, when both `lat` and `lng` are present.
    var coordinate: CLLocationCoordinate2D? {
        guard let lat, let lng else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    /// Photos sorted by their `order` field (first = cover). Empty when the
    /// listing has none. Keeps each row's `id`, which the host photo editor
    /// needs to delete / reorder an individual photo.
    var sortedImages: [ListingImage] {
        (images ?? []).sorted { ($0.order ?? 0) < ($1.order ?? 0) }
    }

    /// Photo URLs sorted by their `order` field. Empty when the listing has no
    /// photos — callers render a `PhotoPlaceholder` instead of a stock image.
    var sortedImageURLs: [String] {
        sortedImages.map { $0.url }
    }

    /// "27 Jul 2026" style creation date, parsed from the ISO-8601 `created_at`.
    /// Empty when the timestamp is missing or unparseable — callers then render
    /// no "Listed …" line at all rather than a placeholder.
    var listedDateText: String {
        guard let createdAt, let date = Listing.parseDate(createdAt) else { return "" }
        return Listing.listedFormatter.string(from: date)
    }

    /// Parse an ISO-8601 timestamp, tolerating both with- and without-fractional
    /// seconds (Postgres `timestamptz` serializes either way), plus a bare
    /// `yyyy-MM-dd` date.
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

    private static let listedFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = .current
        f.dateFormat = "d MMM yyyy"
        return f
    }()

    var currencySymbol: String { "EGP " }

    var priceText: String {
        "\(currencySymbol)\(Int(pricePerNight))"
    }
}

/// The authoritative price quote for a chosen stay, returned by
/// `POST /api/local/listings/:id/quote` `{ checkIn, checkOut }` (public, no auth).
/// The backend honors the weekend + per-month seasonal rates and the
/// length-of-stay discount, so the guest detail screen uses `total` directly
/// rather than the naive `pricePerNight × nights` estimate. All amounts are in
/// `currency` (EGP) — convert for display only via `CurrencyManager`.
struct StayQuote: Decodable, Hashable {
    /// Whole nights in the stay (half-open `[checkIn, checkOut)`).
    let nights: Int
    /// Sum of the per-night rates before any length-of-stay discount.
    let subtotal: Double
    /// The length-of-stay discount applied (% off, 0 when none).
    let discountPercent: Int
    /// The final price after the discount — what the guest pays.
    let total: Double
    /// `total ÷ nights`, the blended nightly average across the seasonal rates.
    let nightlyAvg: Double
    /// Base currency the amounts are denominated in (always "EGP").
    let currency: String
    /// `true` when the quote reflects a weekend / per-month seasonal rate, or a
    /// night the host pinned on their calendar — anything that makes the stay
    /// something other than a flat `pricePerNight × nights`.
    let hasSeasonalPricing: Bool
    /// Every night of the stay, priced and labelled — what the booking summary
    /// itemises. Empty on a backend that predates the host calendar, which is
    /// why the UI falls back to the flat line rather than showing an empty list.
    let nightsBreakdown: [QuoteNight]
    /// `true` when at least one night was pinned on the host's calendar.
    let hasCustomNights: Bool

    enum CodingKeys: String, CodingKey {
        case nights, subtotal, discountPercent, total, nightlyAvg, currency, hasSeasonalPricing
        case nightsBreakdown = "nights_breakdown"
        case hasCustomNights
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        nights = try c.decodeIfPresent(Int.self, forKey: .nights) ?? 0
        subtotal = try c.decodeIfPresent(Double.self, forKey: .subtotal) ?? 0
        discountPercent = try c.decodeIfPresent(Int.self, forKey: .discountPercent) ?? 0
        total = try c.decodeIfPresent(Double.self, forKey: .total) ?? 0
        nightlyAvg = try c.decodeIfPresent(Double.self, forKey: .nightlyAvg) ?? 0
        currency = (try c.decodeIfPresent(String.self, forKey: .currency))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "EGP"
        hasSeasonalPricing = try c.decodeIfPresent(Bool.self, forKey: .hasSeasonalPricing) ?? false
        nightsBreakdown = try c.decodeIfPresent([QuoteNight].self, forKey: .nightsBreakdown) ?? []
        hasCustomNights = try c.decodeIfPresent(Bool.self, forKey: .hasCustomNights) ?? false
    }

    /// `true` when a length-of-stay discount shaved money off the subtotal.
    var hasDiscount: Bool { discountPercent > 0 && total < subtotal }
}

/// A curated browse region returned by `GET /api/local/regions`, e.g.
/// `{ "region": "North Coast", "count": 4 }`. Drives the Explore region chips.
struct RegionFacet: Codable, Identifiable, Hashable {
    let region: String
    let count: Int

    /// `Identifiable` by the region name (unique per row).
    var id: String { region }
}

/// One resort / compound from `GET /api/local/resorts` (optionally narrowed to a
/// region), e.g. `{ "id": "…", "name": "Marassi", "region": "North Coast" }`.
/// Drives the host location step's resort picker. Only ACTIVE resorts are
/// returned — a retired one stays valid on the listings that already point at it
/// but is no longer offered.
struct ResortOption: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    /// The curated area the resort belongs to. Picking the resort is what sets
    /// the listing's region server-side, which is the point of the pairing.
    let region: String
}

/// A geographic bounding box for the "Search this area" map filter. Serialized
/// to the backend's `bbox` query param in GeoJSON `west,south,east,north` order
/// (`minLng,minLat,maxLng,maxLat`) — the endpoint returns only listings inside it.
struct BBox: Equatable {
    let minLng: Double
    let minLat: Double
    let maxLng: Double
    let maxLat: Double

    /// `minLng,minLat,maxLng,maxLat`, formatted with a fixed locale so the
    /// decimal separator is always a dot regardless of the device region.
    var queryValue: String {
        [minLng, minLat, maxLng, maxLat]
            .map { String(format: "%.6f", $0) }
            .joined(separator: ",")
    }
}

/// A reservation returned by `GET /api/local/bookings` (and `POST` on create).
/// The list endpoint denormalizes a few listing fields (title/location/image)
/// so the Reservations tab can render a card without a second fetch.
struct Booking: Codable, Identifiable, Hashable {
    let id: String
    let listingId: String
    let checkIn: String
    let checkOut: String
    let guests: Int
    let totalPrice: Double?
    let status: String?
    /// "unpaid" | "paid", from the `payment_status` column. `nil` when the
    /// backend omits it (older responses) — treated as unpaid by `isPaid`.
    let paymentStatus: String?
    /// The latest transfer screenshot's own verdict, from `payment_proof_status`
    /// ("submitted" | "approved" | "rejected" | "disputed"). `nil` when the guest
    /// has never uploaded one. Read together with `paymentStatus` by
    /// `PaymentFlowRules` — neither column alone tells the whole story.
    let paymentProofStatus: String?
    /// Why the reviewer turned the last screenshot down, from
    /// `payment_reject_reason`. `nil` unless the payment was rejected.
    let paymentRejectReason: String?
    /// ISO-8601 timestamp the booking was paid, from `paid_at`. `nil` until paid.
    let paidAt: String?
    let title: String?
    let location: String?
    /// The stay's city / curated area, from the `region` column. `nil` when unset.
    let region: String?
    /// Free-text notes the host attached for this guest, from `host_notes`.
    /// `nil`/empty until the host writes any.
    let hostNotes: String?
    let image: String?
    /// The cancellation policy in force for this booking ("flexible" |
    /// "moderate" | "strict"), from `cancellation_policy`. `nil` on older
    /// responses; treated as "moderate" by `policy`.
    let cancellationPolicy: String?
    /// ISO-8601 timestamp the booking was cancelled, from `cancelled_at`.
    /// `nil` until the guest cancels.
    let cancelledAt: String?
    /// The refund percentage applied on cancellation (0–100), from
    /// `refund_percent`. `nil` until cancelled.
    let refundPercent: Int?

    enum CodingKeys: String, CodingKey {
        case id, guests, status, title, location, region, image
        case listingId = "listing_id"
        case checkIn = "check_in"
        case checkOut = "check_out"
        case totalPrice = "total_price"
        case paymentStatus = "payment_status"
        case paymentProofStatus = "payment_proof_status"
        case paymentRejectReason = "payment_reject_reason"
        case paidAt = "paid_at"
        case hostNotes = "host_notes"
        case cancellationPolicy = "cancellation_policy"
        case cancelledAt = "cancelled_at"
        case refundPercent = "refund_percent"
    }

    /// Where this reservation sits in the payment flow, decided by
    /// `PaymentFlowRules` — the Swift twin of the backend's `paymentStageFor`.
    var paymentStage: PaymentFlowRules.Stage {
        PaymentFlowRules.stage(for: PaymentFlowRules.Snapshot(
            status: status,
            paymentState: paymentStatus,
            proofStatus: paymentProofStatus,
            paidAt: paidAt
        ))
    }

    /// `true` once the booking has been paid. Asks the shared rule rather than
    /// comparing `payment_status` by hand, so an approved proof whose rollup
    /// never landed still reads as paid — exactly as the server sees it.
    var isPaid: Bool { paymentStage == .paid }

    /// "EGP 1100" style price for the card. Falls back to "—" if absent.
    var totalText: String {
        guard let totalPrice else { return "—" }
        return "EGP \(Int(totalPrice))"
    }

    /// "Jul 10 → Jul 14" style date range, parsed from the `yyyy-MM-dd` strings.
    var dateRangeText: String {
        let pretty = Booking.prettyFormatter
        let iso = Booking.isoFormatter
        func format(_ raw: String) -> String {
            guard let date = iso.date(from: raw) else { return raw }
            return pretty.string(from: date)
        }
        return "\(format(checkIn)) → \(format(checkOut))"
    }

    private static let isoFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static let prettyFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "MMM d"
        return f
    }()
}

/// Booking lifecycle status. The backend now returns `pending` on create; a host
/// confirms or rejects it. Falls back to `.unknown` for any future value.
enum BookingStatus: String {
    case pending
    case confirmed
    case rejected
    case cancelled
    case completed
    case unknown

    init(raw: String?) {
        self = BookingStatus(rawValue: (raw ?? "").lowercased()) ?? .unknown
    }

    /// Human label for the status badge.
    @MainActor
    var label: String {
        switch self {
        case .pending:   return L.t("status.pending")
        case .confirmed: return L.t("status.confirmed")
        case .rejected:  return L.t("status.rejected")
        case .cancelled: return L.t("status.cancelled")
        case .completed: return L.t("status.completed")
        case .unknown:   return "—"
        }
    }

    /// SF Symbol paired with the badge.
    var systemImage: String {
        switch self {
        case .pending:   return "clock.fill"
        case .confirmed: return "checkmark.seal.fill"
        case .rejected:  return "xmark.seal.fill"
        case .cancelled: return "slash.circle.fill"
        case .completed: return "flag.checkered"
        case .unknown:   return "questionmark.circle"
        }
    }
}

extension Booking {
    var bookingStatus: BookingStatus { BookingStatus(raw: status) }

    /// The strongly-typed cancellation policy in force (falls back to `.moderate`).
    var policy: CancellationPolicy { CancellationPolicy(raw: cancellationPolicy) }

    /// A copy flipped to paid + confirmed, used to update the local UI right
    /// after a successful mock payment (the server has already done the same).
    func markedPaidConfirmed() -> Booking {
        Booking(
            id: id,
            listingId: listingId,
            checkIn: checkIn,
            checkOut: checkOut,
            guests: guests,
            totalPrice: totalPrice,
            status: "confirmed",
            paymentStatus: "paid",
            // The proof that was just accepted, and no stale rejection note
            // beside it — a paid booking must never carry "we couldn't confirm
            // your transfer" from an earlier round.
            paymentProofStatus: "approved",
            paymentRejectReason: nil,
            paidAt: paidAt ?? ISO8601DateFormatter().string(from: Date()),
            title: title,
            location: location,
            region: region,
            hostNotes: hostNotes,
            image: image,
            cancellationPolicy: cancellationPolicy,
            cancelledAt: cancelledAt,
            refundPercent: refundPercent
        )
    }
}

/// A reservation request shown to the host, returned by
/// `GET /api/local/host/bookings`. Each row denormalizes its listing's
/// title/location so the requests list renders without a second fetch.
struct HostBooking: Codable, Identifiable, Hashable {
    let id: String
    let reservationCode: String?
    let title: String?
    let location: String?
    /// The requesting guest's full name, from the host-only `guest_name` column.
    /// `nil` when their account has been deleted — the backend LEFT JOINs so the
    /// host keeps the record of the stay — and on an older response that omitted
    /// it. The card falls back to a generic "Guest" so it is never nameless
    /// (the fallback lives in the view: `L.t` is main-actor isolated).
    let guestName: String?
    let checkIn: String
    let checkOut: String
    let guests: Int
    let totalPrice: Double?
    let status: String?
    /// The raw `bookings.payment_status` rollup ("unpaid" | "submitted" | "paid" |
    /// "rejected" | "disputed", plus the retired gateway's values). `nil` on an
    /// older response that omitted it.
    let paymentState: String?
    /// The latest `payment_proofs.status` — the screenshot's own verdict. `nil`
    /// when the guest has never uploaded one. Two columns describe the same
    /// thing and can disagree, which is why `PaymentFlowRules` reads both.
    let paymentProofStatus: String?
    /// Stamped when the payment was approved; `nil` while it is outstanding.
    let paidAt: String?
    /// Percent of the total refunded on cancel (0–100); `nil` when never
    /// cancelled. Splits the Cancelled chip into Cancelled / Refunded /
    /// Partially refunded.
    let refundPercent: Int?

    enum CodingKeys: String, CodingKey {
        case id, title, location, guests, status
        case guestName = "guest_name"
        case reservationCode = "reservation_code"
        case checkIn = "check_in"
        case checkOut = "check_out"
        case totalPrice = "total_price"
        case paymentState = "payment_status"
        case paymentProofStatus = "payment_proof_status"
        case paidAt = "paid_at"
        case refundPercent = "refund_percent"
    }

    var bookingStatus: BookingStatus { BookingStatus(raw: status) }

    /// Where this reservation's money stands, from the one rule the server, the
    /// web and Android all run. Never compare the payment columns by hand.
    var paymentStage: PaymentFlowRules.Stage {
        PaymentFlowRules.stage(for: PaymentFlowRules.Snapshot(
            status: status,
            paymentState: paymentState,
            proofStatus: paymentProofStatus,
            paidAt: paidAt
        ))
    }

    /// Which status chip this reservation is filed behind.
    var filterBucket: HostBookingFilterRules.Bucket {
        HostBookingFilterRules.bucket(for: HostBookingFilterRules.Snapshot(
            status: status,
            paymentStage: paymentStage,
            refundPercent: refundPercent,
            // A separate question from the stage, which calls everything cancelled
            // `.notPayable` and so cannot tell a refund from a booking nobody paid for.
            wasPaid: PaymentFlowRules.everPaid(PaymentFlowRules.Snapshot(
                status: status,
                paymentState: paymentState,
                proofStatus: paymentProofStatus,
                paidAt: paidAt
            ))
        ))
    }

    var totalText: String {
        guard let totalPrice else { return "—" }
        return "EGP \(Int(totalPrice))"
    }

    var dateRangeText: String {
        Booking.format(checkIn: checkIn, checkOut: checkOut)
    }
}

/// A reservation's full detail, returned by `GET /api/local/bookings/:id`.
/// Drives the detail screen + the QR code (encodes `reservationCode`).
struct ReservationDetail: Codable, Identifiable, Hashable {
    let id: String
    let reservationCode: String?
    let status: String?
    /// "unpaid" | "paid", from the `payment_status` column. `nil` when omitted.
    let paymentStatus: String?
    /// The latest transfer screenshot's own verdict, from `payment_proof_status`
    /// ("submitted" | "approved" | "rejected" | "disputed"). `nil` when the guest
    /// has never uploaded one.
    let paymentProofStatus: String?
    /// Why the reviewer turned the last screenshot down, from
    /// `payment_reject_reason`. `nil` unless the payment was rejected. This is
    /// the admin's own words and the only explanation the guest ever gets —
    /// without it a rejection is indistinguishable from never having paid.
    let paymentRejectReason: String?
    /// ISO-8601 timestamp the booking was paid, from `paid_at`. `nil` until paid.
    let paidAt: String?
    let title: String?
    let location: String?
    /// The stay's city / curated area, from the `region` column. `nil` when unset.
    let region: String?
    /// Free-text notes the host attached for this guest, from `host_notes`.
    /// `nil`/empty until the host writes any. Shown in a "From your host" card.
    let hostNotes: String?
    /// The listing's host id, from `host_id`. Used to tell whether the signed-in
    /// user is the host of this reservation (so we show the notes editor). `nil`
    /// when the backend omits it — then we fall back to the account's role.
    let hostId: String?
    let checkIn: String
    let checkOut: String
    let guests: Int
    let totalPrice: Double?
    /// The cancellation policy in force for this booking ("flexible" |
    /// "moderate" | "strict"), from `cancellation_policy`. `nil` on older
    /// responses; treated as "moderate" by `policy`.
    let cancellationPolicy: String?
    /// ISO-8601 timestamp the booking was cancelled, from `cancelled_at`.
    /// `nil` until the guest cancels.
    let cancelledAt: String?
    /// The refund percentage applied on cancellation (0–100), from
    /// `refund_percent`. `nil` until cancelled.
    let refundPercent: Int?

    enum CodingKeys: String, CodingKey {
        case id, title, location, region, guests, status
        case reservationCode = "reservation_code"
        case checkIn = "check_in"
        case checkOut = "check_out"
        case totalPrice = "total_price"
        case paymentStatus = "payment_status"
        case paymentProofStatus = "payment_proof_status"
        case paymentRejectReason = "payment_reject_reason"
        case paidAt = "paid_at"
        case hostNotes = "host_notes"
        case hostId = "host_id"
        case cancellationPolicy = "cancellation_policy"
        case cancelledAt = "cancelled_at"
        case refundPercent = "refund_percent"
    }

    var bookingStatus: BookingStatus { BookingStatus(raw: status) }

    /// The strongly-typed cancellation policy in force (falls back to `.moderate`).
    var policy: CancellationPolicy { CancellationPolicy(raw: cancellationPolicy) }

    /// `true` when the guest can still cancel this reservation: it's `pending`
    /// or `confirmed` (i.e. not already cancelled / rejected / completed).
    var isCancellable: Bool {
        bookingStatus == .pending || bookingStatus == .confirmed
    }

    /// `true` once this booking has been cancelled.
    var isCancelled: Bool { bookingStatus == .cancelled }

    /// Where this reservation sits in the payment flow, decided by
    /// `PaymentFlowRules` — the Swift twin of the backend's `paymentStageFor`,
    /// and the only thing the payment card is allowed to branch on. Testing
    /// `payment_status` by hand is what hid a rejection behind a bare "Pay now".
    var paymentStage: PaymentFlowRules.Stage {
        PaymentFlowRules.stage(for: PaymentFlowRules.Snapshot(
            status: status,
            paymentState: paymentStatus,
            proofStatus: paymentProofStatus,
            paidAt: paidAt
        ))
    }

    /// `true` once the booking has been paid. Asks the shared rule rather than
    /// comparing `payment_status` by hand, so an approved proof whose rollup
    /// never landed still reads as paid — exactly as the server sees it.
    var isPaid: Bool { paymentStage == .paid }

    /// `true` when the guest may (re)submit a transfer. A rejected screenshot is
    /// payable: they upload a clearer one, the reservation survives.
    var canPay: Bool {
        PaymentFlowRules.canPay(PaymentFlowRules.Snapshot(
            status: status,
            paymentState: paymentStatus,
            proofStatus: paymentProofStatus,
            paidAt: paidAt
        ))
    }

    /// The reviewer's own words on why the last transfer was turned down, shown
    /// verbatim to the guest. `nil` unless this reservation is actually at
    /// `.rejected`, so a reason left on the row from an earlier round can never
    /// surface beside a payment that has since been accepted.
    var paymentRejectReasonText: String? {
        guard paymentStage == .rejected else { return nil }
        return PaymentFlowRules.rejectReasonText(paymentRejectReason)
    }

    var totalText: String {
        guard let totalPrice else { return "—" }
        return "EGP \(Int(totalPrice))"
    }

    var dateRangeText: String {
        Booking.format(checkIn: checkIn, checkOut: checkOut)
    }

    /// The city/area to surface on the detail screen: prefers the curated
    /// `region`, falling back to the listing `location`. Empty when neither set.
    var cityText: String {
        let r = region?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let r, !r.isEmpty { return r }
        let l = location?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (l?.isEmpty == false) ? l! : ""
    }

    /// Trimmed host notes, or `nil` when the host hasn't written any.
    var hostNotesText: String? {
        let n = hostNotes?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (n?.isEmpty == false) ? n : nil
    }

    /// The real reservation code, or `nil` when the booking doesn't carry one.
    /// A missing value, an empty/blank string and the literal `"null"` (what a
    /// JSON `null` collapses to on some clients) all count as **absent** — a
    /// stay URL must never be built from any of them, or it resolves to the
    /// `/stay/null` page the guest reported.
    ///
    /// Note there is deliberately **no fallback to the booking id**: the pass
    /// page looks a stay up by `reservation_code`, so an id could never resolve.
    var stayCode: String? {
        guard let raw = reservationCode?.trimmingCharacters(in: .whitespacesAndNewlines),
              !raw.isEmpty,
              raw.lowercased() != "null"
        else { return nil }
        return raw
    }

    /// Whether this reservation's stay pass is live, decided by
    /// `PaymentFlowRules` — the Swift twin of the backend's `isLiveStayPass`,
    /// and the only thing the QR, the Wallet button and the guest's view of the
    /// stay guide are allowed to branch on. `confirmed` **AND paid**, or
    /// `completed`. Testing `status == .confirmed` by hand is what put a working
    /// QR on the host's and the guest's screen the instant Approve was tapped,
    /// for a stay nobody had paid for.
    var isLiveStayPass: Bool {
        PaymentFlowRules.isLiveStayPass(PaymentFlowRules.Snapshot(
            status: status,
            paymentState: paymentStatus,
            proofStatus: paymentProofStatus,
            paidAt: paidAt
        ))
    }

    /// `true` once this reservation actually has a stay pass — the gate behind
    /// the QR card and the `/stay/<code>` link (the Wallet button uses the
    /// stricter `canAddToWallet`).
    ///
    /// Two conditions, both required: the backend has issued a
    /// `reservation_code` (it only does that at the confirmation transition),
    /// **and** `isLiveStayPass` — the stay is confirmed *and paid*, or already
    /// completed.
    var hasStayPass: Bool {
        guard stayCode != nil else { return false }
        return isLiveStayPass
    }

    /// `true` when an Apple Wallet pass can be minted for this reservation.
    /// Deliberately stricter than `hasStayPass`: the backend's
    /// `GET /api/wallet/pass/:id` rejects anything that isn't a **live and
    /// currently-confirmed** stay with a `reservation_code` (400), so the button
    /// is only offered when it works. `completed` is excluded for that reason —
    /// it has a pass, but the backend won't sign one for it.
    var canAddToWallet: Bool {
        bookingStatus == .confirmed && isLiveStayPass && stayCode != nil
    }

    /// `true` while the pass simply hasn't been issued **yet** — the reservation
    /// is awaiting the host's approval, or awaiting the guest's payment. Drives
    /// the "your QR code will appear once…" placeholder; `awaitingPassMessage`
    /// says which of the two it is. Cancelled / rejected stays are never coming
    /// back, so they show nothing at all.
    var isAwaitingStayPass: Bool {
        guard !hasStayPass else { return false }
        return bookingStatus == .pending || bookingStatus == .confirmed
    }

    /// `true` when the pass is held up by the **payment** rather than by the
    /// host — the host has approved, and the money is what's outstanding. Lets
    /// the placeholder tell the guest something they can act on.
    var isAwaitingPaymentForPass: Bool {
        isAwaitingStayPass && bookingStatus == .confirmed
    }

    /// The bare reservation code shown under the QR, or `nil` when there is no
    /// pass to show.
    var qrPayload: String? { hasStayPass ? stayCode : nil }

    /// The public stay-pass URL the QR encodes — scanning/clicking it opens the
    /// deployed pass page. `nil` unless this reservation has a pass, so the
    /// caller physically cannot render a QR/wallet/stay link for a booking that
    /// is still awaiting approval.
    var stayPassURL: URL? {
        guard let code = qrPayload else { return nil }
        let encoded = code.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? code
        return URL(string: "\(AppLinks.webBase)/stay/\(encoded)")
    }
}

// MARK: - Stay guide (host-authored content on a confirmed booking)

/// The kinds of item a host can attach to a confirmed booking's stay guide,
/// matching the `stay_guide_items.kind` column. Anything unrecognised (an older
/// or newer server) reads as `.info` so the guide still renders.
enum StayGuideKind: String, CaseIterable, Identifiable, Hashable {
    case info
    case photo
    case placeQR = "place_qr"
    case attachment

    var id: String { rawValue }

    init(raw: String?) {
        self = StayGuideKind(rawValue: (raw ?? "").lowercased()) ?? .info
    }

    /// Short label for the type picker in the host editor.
    @MainActor
    var label: String {
        switch self {
        case .info:       return L.t("guide.kind.info")
        case .photo:      return L.t("guide.kind.photo")
        case .placeQR:    return L.t("guide.kind.placeQR")
        case .attachment: return L.t("guide.kind.attachment")
        }
    }

    /// Heading of the guest-facing section this kind is grouped under.
    @MainActor
    var sectionTitle: String {
        switch self {
        case .info:       return L.t("guide.section.info")
        case .photo:      return L.t("guide.section.photo")
        case .placeQR:    return L.t("guide.section.placeQR")
        case .attachment: return L.t("guide.section.attachment")
        }
    }

    var systemImage: String {
        switch self {
        case .info:       return "info.circle.fill"
        case .photo:      return "photo.on.rectangle.angled"
        case .placeQR:    return "qrcode"
        case .attachment: return "paperclip"
        }
    }

    /// `true` when this kind carries an uploaded file (a `data:` URL is allowed).
    var acceptsUpload: Bool { self == .photo || self == .attachment }
}

/// Limits + validation shared by the stay-guide editor and `HostService`, kept
/// in step with the server rules so bad input is caught before a round trip.
/// Mirrors the ownership-doc / payment-proof house style.
enum StayGuideRules {
    /// Max characters of a `data:` (or `http(s)`) URL — ~3.5 MB, the same cap
    /// the backend applies to uploaded images.
    static let maxURLChars = 3_500_000
    static let maxTitleChars = 120
    static let maxBodyChars = 2_000

    /// `true` for an `http(s)://` link — the only thing a `place_qr` may hold,
    /// since the guest's phone opens it. Rejects `data:` and `javascript:`.
    static func isWebLink(_ value: String) -> Bool {
        let v = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return v.hasPrefix("http://") || v.hasPrefix("https://")
    }

    /// `true` for something a photo/attachment may hold: an inline `data:` URL
    /// or an `http(s)://` link.
    static func isUploadURL(_ value: String) -> Bool {
        value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased().hasPrefix("data:")
            || isWebLink(value)
    }
}

/// One host-authored stay-guide item, from
/// `GET /api/local/bookings/:id/stay-guide` (and embedded in the public
/// `GET /api/local/stay/:code` response as `guide`).
struct StayGuideItem: Codable, Identifiable, Hashable {
    let id: String
    /// Raw `kind` column — read the typed value through `guideKind`.
    let kind: String?
    let title: String?
    /// The info text, or the caption of a photo / file / place link.
    let body: String?
    /// A `data:` URL (photo, attachment) or an external link (place QR).
    let url: String?
    /// Display order within the guide, ascending. `nil` on older rows.
    let order: Int?

    enum CodingKeys: String, CodingKey {
        case id, kind, title, body, url, order
    }

    var guideKind: StayGuideKind { StayGuideKind(raw: kind) }

    /// Trimmed title, or `nil` when the host left it blank.
    var titleText: String? { StayGuideItem.clean(title) }

    /// Trimmed body/caption, or `nil` when blank.
    var bodyText: String? { StayGuideItem.clean(body) }

    /// Trimmed URL, or `nil` when blank.
    var urlText: String? { StayGuideItem.clean(url) }

    /// The external link a `place_qr` points at. `https?://` only — a `data:`
    /// or `javascript:` value that somehow reached the column is dropped rather
    /// than opened or encoded into a QR.
    var placeLink: URL? {
        guard guideKind == .placeQR,
              let raw = urlText,
              StayGuideRules.isWebLink(raw)
        else { return nil }
        return URL(string: raw)
    }

    /// The link behind an `attachment` row, when it is a remote file (inline
    /// `data:` attachments are rendered in-app instead of opened in Safari).
    var attachmentLink: URL? {
        guard guideKind == .attachment,
              let raw = urlText,
              StayGuideRules.isWebLink(raw)
        else { return nil }
        return URL(string: raw)
    }

    /// The image source of a `photo` (or of an image the host attached as a
    /// file), suitable for `QKAvatarImage.decodeDataURL` / `AsyncImage`.
    var imageSource: String? {
        guard guideKind == .photo || guideKind == .attachment,
              let raw = urlText,
              StayGuideRules.isUploadURL(raw)
        else { return nil }
        return raw
    }

    /// `true` when there is nothing at all to draw for this row.
    var isEmpty: Bool { titleText == nil && bodyText == nil && urlText == nil }

    private static func clean(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (trimmed?.isEmpty == false) ? trimmed : nil
    }
}

extension Array where Element == StayGuideItem {
    /// The guide in display order: by the host's `order`, ties broken by id so
    /// the list never shuffles between reloads. Blank rows are dropped.
    var sortedForDisplay: [StayGuideItem] {
        filter { !$0.isEmpty }
            .sorted {
                let a = $0.order ?? 0, b = $1.order ?? 0
                return a == b ? $0.id < $1.id : a < b
            }
    }
}

/// A single message in a per-booking host ↔ guest thread, returned by
/// `GET /api/local/bookings/:id/messages` (oldest-first) and `POST` on send.
struct ChatMessage: Codable, Identifiable, Hashable {
    let id: String
    let senderID: String
    let senderName: String?
    let body: String
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, body
        case senderID = "sender_id"
        case senderName = "sender_name"
        case createdAt = "created_at"
    }

    /// "9:41 AM" style time for the bubble footnote, parsed from the ISO
    /// `created_at`. Empty when the timestamp is missing or unparseable.
    var timeText: String {
        guard let createdAt, let date = ChatMessage.parseDate(createdAt) else { return "" }
        return ChatMessage.timeFormatter.string(from: date)
    }

    /// Parse an ISO-8601 timestamp, tolerating both with- and without-fractional
    /// seconds (Postgres `timestamptz` serializes either way).
    private static func parseDate(_ raw: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFraction.date(from: raw) { return d }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: raw)
    }

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = .current
        f.dateFormat = "h:mm a"
        return f
    }()
}

extension Booking {
    /// Shared "Jul 10 → Jul 14" range formatter used by the booking models.
    static func format(checkIn: String, checkOut: String) -> String {
        let pretty = DateFormatter()
        pretty.locale = Locale(identifier: "en_US_POSIX")
        pretty.dateFormat = "MMM d"
        let iso = DateFormatter()
        iso.locale = Locale(identifier: "en_US_POSIX")
        iso.dateFormat = "yyyy-MM-dd"
        func f(_ raw: String) -> String {
            guard let date = iso.date(from: raw) else { return raw }
            return pretty.string(from: date)
        }
        return "\(f(checkIn)) → \(f(checkOut))"
    }
}

// MARK: - Cancellation policy

/// A host-set cancellation policy. Each listing carries one; it governs the
/// refund a guest receives when they cancel an upcoming stay. Falls back to
/// `.moderate` for any missing / unknown value (matching the backend default).
enum CancellationPolicy: String, CaseIterable, Identifiable, Hashable {
    case flexible
    case moderate
    case strict

    var id: String { rawValue }

    init(raw: String?) {
        self = CancellationPolicy(rawValue: (raw ?? "").lowercased()) ?? .moderate
    }

    /// Localized short name shown on the listing detail + pickers.
    @MainActor
    var name: String {
        switch self {
        case .flexible: return L.t("cancel.flexible")
        case .moderate: return L.t("cancel.moderate")
        case .strict:   return L.t("cancel.strict")
        }
    }

    /// Localized one-line explanation of the refund terms.
    @MainActor
    var explanation: String {
        switch self {
        case .flexible: return L.t("cancel.flexibleDesc")
        case .moderate: return L.t("cancel.moderateDesc")
        case .strict:   return L.t("cancel.strictDesc")
        }
    }

    /// SF Symbol paired with the policy (calmer → stricter).
    var systemImage: String {
        switch self {
        case .flexible: return "checkmark.circle"
        case .moderate: return "clock.arrow.circlepath"
        case .strict:   return "lock.shield"
        }
    }
}

/// The cancellation quote returned by `GET /api/local/bookings/:id/cancel`
/// (Bearer guest), shown to the guest **before** they confirm a cancellation.
/// No mutation happens on this call. All amounts are in `currency` (EGP).
struct CancellationQuote: Decodable, Hashable {
    /// The policy in force ("flexible" | "moderate" | "strict").
    let policy: String
    /// Whole days between now and check-in (can be 0 or negative on the day of).
    let daysUntilCheckIn: Int
    /// The refund percentage that will be applied (0–100).
    let refundPercent: Int
    /// The refund amount the guest will receive, in `currency`.
    let refundAmount: Double
    /// The booking's total, in `currency`.
    let total: Double
    let currency: String

    /// The strongly-typed policy in force (falls back to `.moderate`).
    var cancellationPolicy: CancellationPolicy { CancellationPolicy(raw: policy) }

    /// "EGP 550" style refund amount.
    var refundText: String { "EGP \(Int(refundAmount.rounded()))" }
    /// "EGP 1100" style booking total.
    var totalText: String { "EGP \(Int(total.rounded()))" }
}

// MARK: - Availability

/// A span on a listing's calendar returned by
/// `GET /api/local/listings/:id/availability` → `[{ id, start, end, kind, note }]`.
///
/// `start`/`end` are `yyyy-MM-dd` strings and the span is **half-open**
/// `[start, end)` — the checkout day is free again. `kind` is `"booked"`
/// (an existing reservation, read-only to the host) or `"blocked"` (a manual
/// host block, removable). `note` is optional free text on a block.
struct AvailabilityRange: Decodable, Identifiable, Hashable {
    let id: String
    let start: String
    let end: String
    let kind: String
    let note: String?

    enum CodingKeys: String, CodingKey {
        case id, start, end, kind, note
    }

    /// `true` for a manual host block (removable); `false` for a booked span.
    var isBlocked: Bool { kind.lowercased() == "blocked" }

    /// The shared `yyyy-MM-dd` parser used to turn the API strings into `Date`s.
    /// Locale-independent (`en_US_POSIX`) so it matches the API exactly.
    static let isoFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    /// Parsed start day (midnight UTC), or `nil` when unparseable.
    var startDate: Date? { AvailabilityRange.isoFormatter.date(from: start) }
    /// Parsed end day (midnight UTC) — exclusive, or `nil` when unparseable.
    var endDate: Date? { AvailabilityRange.isoFormatter.date(from: end) }

    /// Re-anchor a date parsed in UTC (via `isoFormatter`) to the *same*
    /// calendar y/m/d in `calendar`, returning its start-of-day. Keeps the
    /// picker's day comparisons free of timezone drift between the UTC-parsed
    /// API dates and the locally-built month grid.
    static func localDay(from utcDate: Date, in calendar: Calendar) -> Date? {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let comps = utc.dateComponents([.year, .month, .day], from: utcDate)
        guard let rebuilt = calendar.date(from: comps) else { return nil }
        return calendar.startOfDay(for: rebuilt)
    }

    /// "Jul 10 → Jul 14" inclusive-feeling label for the host manager. Because
    /// the span is half-open, the displayed last night is `end − 1 day`.
    var displayRangeText: String {
        Booking.format(checkIn: start, checkOut: end)
    }
}

// MARK: - Services

/// A standalone experience a host offers (jet ski, diving, yacht…), returned by
/// `GET /api/local/services` (browse) and `GET /api/local/services/:id` (detail).
/// A user "subscribes"/requests it → pending → the host confirms/rejects,
/// mirroring the stay-booking flow. JSON is snake_case.
struct Service: Codable, Identifiable, Hashable {
    let id: String
    let hostID: String?
    let hostName: String?
    let title: String
    let description: String?
    let category: String?
    let location: String?
    let price: Double
    let currency: String?
    let imageURL: String?
    let lat: Double?
    let lng: Double?
    let isPublished: Bool?
    /// HOST READS ONLY. The host took this service down themselves — the services
    /// twin of `Listing.unpublishedByHost`, and what the Deactivate / Reactivate
    /// button acts on. Absent (nil → false) on a public read.
    let unpublishedByHost: Bool?
    /// HOST READS ONLY. Requests still waiting on this host — the number a
    /// deactivate would decline, named in the confirmation before it happens.
    let pendingRequestCount: Int?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, title, description, category, location, price, currency, lat, lng
        case hostID = "host_id"
        case hostName = "host_name"
        case imageURL = "image_url"
        case isPublished = "is_published"
        case unpublishedByHost = "unpublished_by_host"
        case pendingRequestCount = "pending_request_count"
        case createdAt = "created_at"
    }

    /// True when the host has taken this service off the market themselves — the
    /// only reason a host may undo. A service hidden without the flag was hidden
    /// by staff and is not theirs to republish.
    var isDeactivatedByHost: Bool { unpublishedByHost == true }

    /// Requests waiting on the host right now, defaulting to none.
    var pendingRequests: Int { pendingRequestCount ?? 0 }

    var currencySymbol: String { "EGP " }

    /// "EGP 120" style price for cards + detail.
    var priceText: String {
        "\(currencySymbol)\(Int(price))"
    }

    /// First non-empty image URL, or `nil` when the service has no photo (the UI
    /// then renders a `PhotoPlaceholder` instead of a stock image).
    var photoURL: String? {
        let trimmed = imageURL?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (trimmed?.isEmpty == false) ? trimmed : nil
    }
}

/// A user's service subscription/request, returned by
/// `GET /api/local/service-requests` (my subscriptions) and
/// `GET /api/local/host/service-requests` (host inbox). Each row denormalizes the
/// service title/category/image/price + the requester's name so a card renders
/// without a second fetch. Reuses `BookingStatus` for the pending/confirmed/rejected pill.
struct ServiceRequest: Codable, Identifiable, Hashable {
    let id: String
    let serviceID: String?
    let userID: String?
    let status: String?
    let preferredDate: String?
    let note: String?
    let requestCode: String?
    let createdAt: String?
    let serviceTitle: String?
    let serviceCategory: String?
    let serviceImage: String?
    let servicePrice: Double?
    let serviceCurrency: String?
    let serviceLocation: String?
    let hostID: String?
    let hostName: String?
    let requesterName: String?
    let requesterEmail: String?

    enum CodingKeys: String, CodingKey {
        case id, status, note
        case serviceID = "service_id"
        case userID = "user_id"
        case preferredDate = "preferred_date"
        case requestCode = "request_code"
        case createdAt = "created_at"
        case serviceTitle = "service_title"
        case serviceCategory = "service_category"
        case serviceImage = "service_image"
        case servicePrice = "service_price"
        case serviceCurrency = "service_currency"
        case serviceLocation = "service_location"
        case hostID = "host_id"
        case hostName = "host_name"
        case requesterName = "requester_name"
        case requesterEmail = "requester_email"
    }

    /// pending / confirmed / rejected badge state (shared with bookings).
    var requestStatus: BookingStatus { BookingStatus(raw: status) }

    var currencySymbol: String { "EGP " }

    /// "EGP 120" style price for the card, or "—" if absent.
    var priceText: String {
        guard let servicePrice else { return "—" }
        return "\(currencySymbol)\(Int(servicePrice))"
    }

    /// First non-empty service image, or `nil` when absent (the UI renders a
    /// `PhotoPlaceholder` instead of a stock image).
    var photoURL: String? {
        let trimmed = serviceImage?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (trimmed?.isEmpty == false) ? trimmed : nil
    }

    /// "Jul 10" style preferred date, parsed from `yyyy-MM-dd`. Empty if unset.
    var preferredDateText: String {
        guard let preferredDate, !preferredDate.isEmpty else { return "" }
        let iso = DateFormatter()
        iso.locale = Locale(identifier: "en_US_POSIX")
        iso.dateFormat = "yyyy-MM-dd"
        guard let date = iso.date(from: preferredDate) else { return preferredDate }
        let pretty = DateFormatter()
        pretty.locale = Locale(identifier: "en_US_POSIX")
        pretty.dateFormat = "MMM d, yyyy"
        return pretty.string(from: date)
    }
}

// MARK: - Notifications

/// An in-app notification returned by `GET /api/local/notifications`. Named
/// `AppNotification` to avoid clashing with Apple's `UserNotifications` types.
/// JSON is snake_case (matching the booking/service models). Notifications are
/// created server-side on booking/service events.
struct AppNotification: Codable, Identifiable, Hashable {
    let id: String
    let type: String
    let title: String
    let body: String?
    let link: String?
    let read: Bool
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, type, title, body, link, read
        case createdAt = "created_at"
    }

    /// SF Symbol for the row's leading glyph, picked from the `type` string.
    var systemImage: String {
        switch type.lowercased() {
        case let t where t.contains("booking"),
             let t where t.contains("reservation"):
            return "calendar"
        case let t where t.contains("service"),
             let t where t.contains("subscription"):
            return "sparkles"
        case let t where t.contains("message"),
             let t where t.contains("chat"):
            return "bubble.left.fill"
        case let t where t.contains("review"):
            return "star.fill"
        default:
            return "bell.fill"
        }
    }

    /// "2h ago" style relative time, parsed from the ISO-8601 `created_at`.
    /// Empty when the timestamp is missing or unparseable.
    var relativeTimeText: String {
        guard let createdAt, let date = AppNotification.parseDate(createdAt) else { return "" }
        return AppNotification.relativeFormatter.localizedString(for: date, relativeTo: Date())
    }

    /// Parse an ISO-8601 timestamp, tolerating both with- and without-fractional
    /// seconds (Postgres `timestamptz` serializes either way).
    private static func parseDate(_ raw: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFraction.date(from: raw) { return d }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: raw)
    }

    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.locale = .current
        f.unitsStyle = .abbreviated
        return f
    }()
}

// MARK: - Reviews

/// A single guest review for a listing, returned by
/// `GET /api/local/reviews?listing_id=ID` → `[{ rating, comment,
/// reviewer_name, created_at }]`. JSON is snake_case.
struct Review: Codable, Identifiable, Hashable {
    /// Some backends omit an id on the public list; fall back to a synthesized
    /// one (reviewer + created_at) so SwiftUI lists stay stable.
    let id: String
    let rating: Int
    let comment: String?
    let reviewerName: String?
    let createdAt: String?
    /// Photos attached to the review: an array of `data:image/*` or `http(s)`
    /// image URL strings. Defaults to `[]` when the field is absent or null.
    let photos: [String]

    enum CodingKeys: String, CodingKey {
        case id, rating, comment, photos
        case reviewerName = "reviewer_name"
        case createdAt = "created_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        rating = try c.decodeIfPresent(Int.self, forKey: .rating) ?? 0
        comment = try c.decodeIfPresent(String.self, forKey: .comment)
        reviewerName = try c.decodeIfPresent(String.self, forKey: .reviewerName)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        photos = (try c.decodeIfPresent([String].self, forKey: .photos) ?? [])
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        if let explicit = try c.decodeIfPresent(String.self, forKey: .id) {
            id = explicit
        } else {
            id = "\(reviewerName ?? "guest")-\(createdAt ?? UUID().uuidString)"
        }
    }

    /// Display name for the review row; falls back to a generic "Guest".
    @MainActor
    var displayName: String {
        let trimmed = reviewerName?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (trimmed?.isEmpty == false) ? trimmed! : L.t("reviews.aGuest")
    }

    /// "Jul 2026" style month label, parsed from the ISO `created_at`. Empty
    /// when the timestamp is missing or unparseable.
    var monthText: String {
        guard let createdAt, let date = Review.parseDate(createdAt) else { return "" }
        return Review.monthFormatter.string(from: date)
    }

    private static func parseDate(_ raw: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFraction.date(from: raw) { return d }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        if let d = plain.date(from: raw) { return d }
        // Tolerate a plain `yyyy-MM-dd` date.
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

/// A stay the signed-in user can review, returned by `GET /api/local/reviews`
/// (Bearer). The backend returns confirmed stays past checkout that haven't
/// been reviewed yet. Field names are tolerant: we accept a few aliases so the
/// reviewable list renders regardless of the exact server shape.
struct ReviewableStay: Decodable, Identifiable, Hashable {
    /// The booking to attach the review to.
    let bookingId: String
    let listingId: String?
    let title: String?
    let location: String?
    let image: String?
    let checkIn: String?
    let checkOut: String?

    /// `Identifiable` by the booking id (one review per booking).
    var id: String { bookingId }

    enum CodingKeys: String, CodingKey {
        case bookingId = "booking_id"
        case bookingIdAlt = "id"
        case listingId = "listing_id"
        case title, location, image
        case checkIn = "check_in"
        case checkOut = "check_out"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // Prefer an explicit `booking_id`; fall back to `id`.
        if let bid = try c.decodeIfPresent(String.self, forKey: .bookingId) {
            bookingId = bid
        } else {
            bookingId = try c.decode(String.self, forKey: .bookingIdAlt)
        }
        listingId = try c.decodeIfPresent(String.self, forKey: .listingId)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        location = try c.decodeIfPresent(String.self, forKey: .location)
        image = try c.decodeIfPresent(String.self, forKey: .image)
        checkIn = try c.decodeIfPresent(String.self, forKey: .checkIn)
        checkOut = try c.decodeIfPresent(String.self, forKey: .checkOut)
    }

    /// "Jul 10 → Jul 14" range when both dates are present, else "".
    var dateRangeText: String {
        guard let checkIn, let checkOut else { return "" }
        return Booking.format(checkIn: checkIn, checkOut: checkOut)
    }
}

// MARK: - Guest reviews (host → guest)

/// A review a host left about a guest, returned by
/// `GET /api/local/guest-reviews?guest_id=ID` →
/// `[{ id, booking_id, guest_id, host_id, rating, comment, created_at,
/// host_name }]`. Shown on the guest's own profile. JSON is snake_case.
struct GuestReview: Decodable, Identifiable, Hashable {
    let id: String
    let bookingId: String?
    let guestId: String?
    let hostId: String?
    let rating: Int
    let comment: String?
    let createdAt: String?
    /// The host who wrote the review (display name).
    let hostName: String?

    enum CodingKeys: String, CodingKey {
        case id, rating, comment
        case bookingId = "booking_id"
        case guestId = "guest_id"
        case hostId = "host_id"
        case createdAt = "created_at"
        case hostName = "host_name"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        rating = try c.decodeIfPresent(Int.self, forKey: .rating) ?? 0
        comment = try c.decodeIfPresent(String.self, forKey: .comment)
        bookingId = try c.decodeIfPresent(String.self, forKey: .bookingId)
        guestId = try c.decodeIfPresent(String.self, forKey: .guestId)
        hostId = try c.decodeIfPresent(String.self, forKey: .hostId)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        hostName = try c.decodeIfPresent(String.self, forKey: .hostName)
        if let explicit = try c.decodeIfPresent(String.self, forKey: .id) {
            id = explicit
        } else {
            id = "\(bookingId ?? "booking")-\(createdAt ?? UUID().uuidString)"
        }
    }

    /// Display name for the row; falls back to a generic "A host".
    @MainActor
    var displayName: String {
        let trimmed = hostName?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (trimmed?.isEmpty == false) ? trimmed! : L.t("reviews.aHost")
    }

    /// "Jul 2026" style month label parsed from `created_at` (empty if absent).
    var monthText: String {
        guard let createdAt, let date = GuestReview.parseDate(createdAt) else { return "" }
        return GuestReview.monthFormatter.string(from: date)
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

// MARK: - Host reviews (reviews about a host's listings)

/// A guest review about one of a host's listings, returned by
/// `GET /api/local/users/:id/reviews` →
/// `[{ id, rating, comment, photos[], created_at, reviewer_name, listing_id,
/// listing_title }]`. Shown on the public `HostProfileView`. Mirrors `Review`
/// but also carries which listing the review was about. JSON is snake_case;
/// every field is tolerant/defaulted so a partial payload still decodes.
struct HostReview: Decodable, Identifiable, Hashable {
    let id: String
    let rating: Int
    let comment: String?
    /// Photos attached to the review (`data:` or `http(s)` image URLs).
    let photos: [String]
    let createdAt: String?
    let reviewerName: String?
    /// The listing the review was left about (id + title), so the profile can
    /// label each review with the place it concerns. Both `nil` when absent.
    let listingId: String?
    let listingTitle: String?

    enum CodingKeys: String, CodingKey {
        case id, rating, comment, photos
        case createdAt = "created_at"
        case reviewerName = "reviewer_name"
        case listingId = "listing_id"
        case listingTitle = "listing_title"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        rating = try c.decodeIfPresent(Int.self, forKey: .rating) ?? 0
        comment = try c.decodeIfPresent(String.self, forKey: .comment)
        photos = (try c.decodeIfPresent([String].self, forKey: .photos) ?? [])
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        reviewerName = try c.decodeIfPresent(String.self, forKey: .reviewerName)
        listingId = try c.decodeIfPresent(String.self, forKey: .listingId)
        listingTitle = try c.decodeIfPresent(String.self, forKey: .listingTitle)
        if let explicit = try c.decodeIfPresent(String.self, forKey: .id) {
            id = explicit
        } else {
            id = "\(reviewerName ?? "guest")-\(createdAt ?? UUID().uuidString)"
        }
    }

    /// Display name for the review row; falls back to a generic "A guest".
    @MainActor
    var displayName: String {
        let trimmed = reviewerName?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (trimmed?.isEmpty == false) ? trimmed! : L.t("reviews.aGuest")
    }

    /// The listing title, trimmed; `nil` when absent or blank.
    var listingTitleTrimmed: String? {
        let trimmed = listingTitle?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (trimmed?.isEmpty == false) ? trimmed : nil
    }

    /// "Jul 2026" style month label parsed from `created_at` (empty if absent).
    var monthText: String {
        guard let createdAt, let date = HostReview.parseDate(createdAt) else { return "" }
        return HostReview.monthFormatter.string(from: date)
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

/// A past guest a host can review, returned by `GET /api/local/guest-reviews`
/// (Bearer host) → `[{ booking_id, listing_id, title, guest_name, check_out }]`.
/// Field names are tolerant of a few aliases so the list renders regardless of
/// the exact server shape.
struct ReviewableGuest: Decodable, Identifiable, Hashable {
    /// The booking to attach the guest review to.
    let bookingId: String
    let listingId: String?
    let title: String?
    let guestName: String?
    let checkOut: String?

    /// `Identifiable` by the booking id (one guest review per booking).
    var id: String { bookingId }

    enum CodingKeys: String, CodingKey {
        case bookingId = "booking_id"
        case bookingIdAlt = "id"
        case listingId = "listing_id"
        case title
        case guestName = "guest_name"
        case checkOut = "check_out"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let bid = try c.decodeIfPresent(String.self, forKey: .bookingId) {
            bookingId = bid
        } else {
            bookingId = try c.decode(String.self, forKey: .bookingIdAlt)
        }
        listingId = try c.decodeIfPresent(String.self, forKey: .listingId)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        guestName = try c.decodeIfPresent(String.self, forKey: .guestName)
        checkOut = try c.decodeIfPresent(String.self, forKey: .checkOut)
    }

    /// Guest display name; falls back to a generic "Your guest".
    @MainActor
    var displayGuestName: String {
        let trimmed = guestName?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (trimmed?.isEmpty == false) ? trimmed! : L.t("reviews.aGuest")
    }
}

// MARK: - Trust & safety

/// The four identity-verification states the backend reports for a user, from
/// `verification_status`. Strongly typed so the profile card can branch on it
/// without stringly comparisons; tolerant of unknown values (→ `.unverified`).
enum VerificationStatus: String, Equatable {
    case unverified
    case pending
    case verified
    case rejected

    /// Parse a raw backend string, defaulting to `.unverified` for nil / unknown.
    init(raw: String?) {
        self = VerificationStatus(rawValue: (raw ?? "").lowercased()) ?? .unverified
    }
}

/// A listing's moderation state, from the `approval_status` column. New listings
/// are created `.pending` (unpublished) until an admin approves them on the web;
/// the host sees this on their own listings and can (re)submit an ownership doc
/// to re-queue. Falls back to `.approved` for nil / unknown so public reads —
/// which only ever return approved listings — keep working.
enum ApprovalStatus: String, Equatable {
    case pending
    case approved
    case rejected

    init(raw: String?) {
        self = ApprovalStatus(rawValue: (raw ?? "").lowercased()) ?? .approved
    }

    /// Whether the host should be offered the "re-upload ownership document"
    /// action — i.e. the listing is awaiting review or was rejected.
    var canResubmitDoc: Bool { self == .pending || self == .rejected }
}

/// What a host is shown for one of their OWN listings: the union of moderation
/// state and visibility. Mirrors `HostVisibility` in the backend's
/// host-visibility-core.ts — the module the API enforces these rules from — so
/// the badge, the filter chip and the button can never disagree with the write.
///
/// `.deactivated` deliberately outranks the moderation states: it is the state
/// the host themselves set, it is what the button acts on, and it is the reason
/// the listing will STAY hidden even after the queue approves it. The rejection
/// reason still renders separately off `approvalStatus`, so a listing that is
/// both deactivated and rejected still tells the host why.
///
/// `.blocked` is "unpublished, but not by you" — an account block, the identity
/// gate, or an operator takedown. The host cannot clear it; the state exists so
/// the row can say so rather than looking live or offering a button that fails.
enum HostVisibility: Equatable {
    case live
    case deactivated
    case underReview
    case rejected
    case blocked

    /// Whether the host may take this listing down. True unless they already
    /// have — or unless someone else is holding it, which is not theirs to
    /// compound.
    var canDeactivate: Bool { self != .deactivated && self != .blocked }

    /// Whether the host may put it back. Only what they hid themselves: a
    /// listing an operator took down is not theirs to republish, and the API
    /// refuses it.
    var canReactivate: Bool { self == .deactivated }
}

/// The trust badges a public profile carries, from the `badges` object on
/// `GET /api/local/users/:id`. Every field is optional/defaulted so a partial
/// payload still decodes — the badges view simply shows whichever apply.
struct TrustBadges: Decodable, Hashable {
    var verified: Bool = false
    var superhost: Bool = false
    var newHost: Bool = false
    var isHost: Bool = false
    var completedStays: Int = 0
    var reviewCount: Int = 0
    var hostRating: Double = 0
    /// ISO-8601 timestamp (or year string) the user joined; `nil` when absent.
    var memberSince: String? = nil

    /// All-false / zero badges, used when the backend omits the whole object.
    static let none = TrustBadges()

    /// Memberwise default initializer (the synthesized one is suppressed by the
    /// custom `init(from:)` below).
    init(
        verified: Bool = false,
        superhost: Bool = false,
        newHost: Bool = false,
        isHost: Bool = false,
        completedStays: Int = 0,
        reviewCount: Int = 0,
        hostRating: Double = 0,
        memberSince: String? = nil
    ) {
        self.verified = verified
        self.superhost = superhost
        self.newHost = newHost
        self.isHost = isHost
        self.completedStays = completedStays
        self.reviewCount = reviewCount
        self.hostRating = hostRating
        self.memberSince = memberSince
    }

    enum CodingKeys: String, CodingKey {
        case verified, superhost, newHost, isHost, completedStays, reviewCount, hostRating, memberSince
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        verified = try c.decodeIfPresent(Bool.self, forKey: .verified) ?? false
        superhost = try c.decodeIfPresent(Bool.self, forKey: .superhost) ?? false
        newHost = try c.decodeIfPresent(Bool.self, forKey: .newHost) ?? false
        isHost = try c.decodeIfPresent(Bool.self, forKey: .isHost) ?? false
        completedStays = try c.decodeIfPresent(Int.self, forKey: .completedStays) ?? 0
        reviewCount = try c.decodeIfPresent(Int.self, forKey: .reviewCount) ?? 0
        hostRating = try c.decodeIfPresent(Double.self, forKey: .hostRating) ?? 0
        memberSince = try c.decodeIfPresent(String.self, forKey: .memberSince)
    }
}

/// A public, privacy-safe view of another user (a host or a guest), from
/// `GET /api/local/users/:id`. Carries NO email / phone / id — only what's safe
/// to show publicly: name, avatar, bio, verification, guest rating, and badges.
struct PublicProfile: Decodable, Identifiable, Hashable {
    let id: String
    let fullName: String?
    let avatarURL: String?
    let bio: String?
    /// Raw verification string ("unverified" | "pending" | "verified" |
    /// "rejected"); use `status` for the typed value.
    let verificationStatusRaw: String
    /// Average rating this user has received as a guest (0 when none).
    let guestRating: Double
    /// Number of guest reviews backing `guestRating`.
    let guestReviewCount: Int
    let badges: TrustBadges

    enum CodingKeys: String, CodingKey {
        case id
        case fullName = "full_name"
        case avatarURL = "avatar_url"
        case bio
        case verificationStatusRaw = "verification_status"
        case guestRating = "guest_rating"
        case guestReviewCount = "guest_review_count"
        case badges
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        fullName = try c.decodeIfPresent(String.self, forKey: .fullName)
        avatarURL = try c.decodeIfPresent(String.self, forKey: .avatarURL)
        bio = try c.decodeIfPresent(String.self, forKey: .bio)
        verificationStatusRaw = (try c.decodeIfPresent(String.self, forKey: .verificationStatusRaw))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "unverified"
        guestRating = try c.decodeIfPresent(Double.self, forKey: .guestRating) ?? 0
        guestReviewCount = try c.decodeIfPresent(Int.self, forKey: .guestReviewCount) ?? 0
        badges = try c.decodeIfPresent(TrustBadges.self, forKey: .badges) ?? .none
    }

    /// Strongly-typed verification state.
    var status: VerificationStatus { VerificationStatus(raw: verificationStatusRaw) }
}

// MARK: - Become a host (application → admin review)

/// Where the signed-in account sits in the "become a host" flow, from the
/// server-derived `host_status` on `GET /api/auth/me`. There is no instant
/// promotion any more: a guest applies, an admin approves in `/ops`, and only
/// then does `users.is_host` flip.
///
/// `approved` is driven by `is_host`, not by the application row, so a
/// pre-existing host with no application still reads as approved.
enum HostStatus: String, Codable, Equatable {
    case none
    case pending
    case rejected
    case approved

    /// Parse a raw backend string, defaulting to `.none` for nil / unknown.
    init(raw: String?) {
        self = HostStatus(rawValue: (raw ?? "").lowercased()) ?? .none
    }

    /// Whether the account may submit the application form — nothing on file
    /// yet, or the last one was rejected (a reapply overwrites it).
    var canApply: Bool { self == .none || self == .rejected }
}

/// What kind of host is applying (`host_type`). Drives the picker on the
/// application form; the two business types also collect a company name.
enum HostType: String, CaseIterable, Identifiable, Equatable {
    case individual
    case company
    case brokerage

    var id: String { rawValue }

    /// Parse a raw backend string, defaulting to `.individual`.
    init(raw: String?) {
        self = HostType(rawValue: (raw ?? "").lowercased()) ?? .individual
    }

    /// Localized picker label.
    @MainActor var label: String { L.t("hostApply.type.\(rawValue)") }

    /// Companies and brokerages carry a display name; individuals don't.
    var isBusiness: Bool { self != .individual }
}

/// The signed-in account's host application, from
/// `GET /api/local/host/application` → `{ host_status, application }`. Every
/// field is optional so a partial row still decodes; it's used to prefill the
/// form when a rejected applicant reapplies and to date the pending card.
struct HostApplication: Decodable, Equatable {
    let fullName: String?
    let nationalID: String?
    let phone: String?
    let address: String?
    let company: String?
    let hostType: String?
    let notes: String?
    let submittedAt: String?
    let reviewNote: String?

    enum CodingKeys: String, CodingKey {
        case notes
        case company
        case phone
        case address
        case fullName = "full_name"
        case nationalID = "national_id"
        case hostType = "host_type"
        case submittedAt = "submitted_at"
        case reviewNote = "review_note"
    }

    /// "Submitted 12 Mar 2026" style line for the pending card, or `nil` when
    /// the timestamp is missing / unparseable.
    @MainActor var submittedText: String? {
        guard let submittedAt, let date = HostApplication.parseDate(submittedAt) else { return nil }
        return String(format: L.t("hostApply.submitted"), HostApplication.dayFormatter.string(from: date))
    }

    private static func parseDate(_ raw: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFraction.date(from: raw) { return d }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        if let d = plain.date(from: raw) { return d }
        // The backend `to_char`s this column without a zone designator
        // ("2026-07-27T12:34:56"), which the ISO parsers reject.
        let naive = DateFormatter()
        naive.locale = Locale(identifier: "en_US_POSIX")
        naive.timeZone = TimeZone(secondsFromGMT: 0)
        naive.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        if let d = naive.date(from: raw) { return d }
        let dateOnly = DateFormatter()
        dateOnly.locale = Locale(identifier: "en_US_POSIX")
        dateOnly.dateFormat = "yyyy-MM-dd"
        return dateOnly.date(from: raw)
    }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = .current
        f.dateFormat = "d MMM yyyy"
        return f
    }()
}

/// `GET /api/local/host/application` → `{ host_status, application }`. The
/// status is authoritative (server-derived); `application` is nil when nothing
/// has been submitted.
struct HostApplicationState: Decodable, Equatable {
    let status: HostStatus
    let application: HostApplication?

    enum CodingKeys: String, CodingKey {
        case status = "host_status"
        case application
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        status = HostStatus(raw: try c.decodeIfPresent(String.self, forKey: .status))
        application = try c.decodeIfPresent(HostApplication.self, forKey: .application)
    }
}

// MARK: - Money — host earnings / payouts

/// A host's earnings + payout summary, returned by
/// `GET /api/local/host/listing-gate` (Bearer) → `{ allowed, code, message, reason }`.
///
/// Whether this host may add a listing, and if not, why. The create endpoint
/// enforces the same rule and returns the same `code` on 403; this exists so the
/// app can say so BEFORE the host fills in a whole listing.
///
/// Switch on `code`, never on `message` — the wording is server-owned and
/// shared with the website, but the call to action differs per case.
struct ListingGate: Decodable, Hashable {
    let allowed: Bool
    /// ok | not_host | verification_missing | verification_pending | verification_rejected
    let code: String
    /// Shown to the host verbatim.
    let message: String
    /// The reviewer's reason. Present only when the documents were rejected.
    let reason: String?

    /// Assume allowed until told otherwise: a failed gate fetch must not lock a
    /// legitimate host out of their own app. The server refuses the write anyway.
    static let unknown = ListingGate(allowed: true, code: "ok", message: "", reason: nil)

    init(allowed: Bool, code: String, message: String, reason: String?) {
        self.allowed = allowed
        self.code = code
        self.message = message
        self.reason = reason
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        allowed = try c.decodeIfPresent(Bool.self, forKey: .allowed) ?? true
        code = try c.decodeIfPresent(String.self, forKey: .code) ?? "ok"
        message = try c.decodeIfPresent(String.self, forKey: .message) ?? ""
        reason = try c.decodeIfPresent(String.self, forKey: .reason)
    }

    enum CodingKeys: String, CodingKey { case allowed, code, message, reason }

    /// A short heading for the blocked state.
    var title: String {
        switch code {
        case "not_host": return "Become a host first"
        case "verification_pending": return "We're reviewing your documents"
        case "verification_rejected": return "Your documents need another look"
        default: return "Verify your identity to start listing"
        }
    }

    /// The action that actually unblocks this refusal, if there is one.
    /// `verification_pending` deliberately has none — there is nothing to do but
    /// wait, and a button would invite resubmissions that reset the queue.
    var actionTitle: String? {
        switch code {
        case "not_host": return "Apply to become a host"
        case "verification_missing": return "Verify my identity"
        case "verification_rejected": return "Upload my documents again"
        default: return nil
        }
    }
}

/// `GET /api/local/host/commission` (Bearer) → `{ rate, percent }`.
///
/// QuickIn takes its cut as a MARKUP, not a deduction: a host names the price
/// they want to receive and is paid it in full; a guest is quoted
/// `raw × (1 + rate)`, rounded UP to the nearest 10 EGP. This type exists so the
/// add/edit-listing screens can show the host that second number as they type.
///
/// `guestPrice` must round exactly as the server does — the rule lives in
/// `src/lib/local/commission-core.ts` (`withCommission` / `roundUpToStep`) in
/// both quickin-backend and quickin-frontend. If you change it there, change it
/// here and in the Android `Commission` object too.
struct CommissionInfo: Decodable, Hashable {
    /// The commission as a fraction, e.g. 0.1 = 10%.
    let rate: Double
    /// The same value as a percentage, e.g. 10.
    let percent: Double

    /// The default the server falls back to, so a failed fetch still shows a
    /// sane hint rather than nothing.
    static let fallback = CommissionInfo(rate: 0.1, percent: 10)

    init(rate: Double, percent: Double) {
        self.rate = rate
        self.percent = percent
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        rate = try c.decodeIfPresent(Double.self, forKey: .rate) ?? 0
        percent = try c.decodeIfPresent(Double.self, forKey: .percent) ?? (rate * 100)
    }

    enum CodingKeys: String, CodingKey { case rate, percent }

    /// What a guest is quoted for a host's raw price. Returns nil for a price
    /// that isn't set yet, so the caller can show nothing rather than "EGP 0".
    func guestPrice(for raw: Double) -> Double? {
        guard raw > 0 else { return nil }
        // Settle to piasters before rounding up: `100 * 1.1` is 110.00000000000001
        // in binary floating point, and a naive ceil would bill 120.
        let settled = (raw * (1 + rate) * 100).rounded() / 100
        return (settled / 10).rounded(.up) * 10
    }

    /// The commission as a whole percent for display, e.g. "10".
    var percentText: String {
        percent == percent.rounded() ? String(Int(percent)) : String(format: "%.2g", percent)
    }
}

/// `GET /api/local/host/earnings` (Bearer host) → `{ currency, totalEarned,
/// paidOut, pending, bookingsCount, commissionRate, guestPaid, recent: [...] }`.
/// All amounts are in `currency` (EGP) — convert for display only via `CurrencyManager`.
struct HostEarnings: Decodable, Hashable {
    /// Base currency the amounts are denominated in (always "EGP").
    let currency: String
    /// Gross lifetime earnings across all paid + upcoming bookings.
    let totalEarned: Double
    /// The portion already paid out to the host.
    let paidOut: Double
    /// The portion still pending payout (upcoming / not-yet-settled stays).
    let pending: Double
    /// Number of bookings backing the totals.
    let bookingsCount: Int
    /// The live platform rate (0–1, e.g. 0.1 = 10%). Present so a host can be
    /// told "guests pay 10% above your price" — it is NOT deducted from any
    /// figure here.
    let commissionRate: Double
    /// What guests paid in total across the same bookings. The difference from
    /// `totalEarned` is the platform's commission.
    let guestPaid: Double
    /// Recent per-booking breakdown rows (newest-first from the backend).
    let recent: [HostEarningItem]

    enum CodingKeys: String, CodingKey {
        case currency, totalEarned, paidOut, pending, bookingsCount, commissionRate, guestPaid, recent
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        currency = (try c.decodeIfPresent(String.self, forKey: .currency))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "EGP"
        totalEarned = try c.decodeIfPresent(Double.self, forKey: .totalEarned) ?? 0
        paidOut = try c.decodeIfPresent(Double.self, forKey: .paidOut) ?? 0
        pending = try c.decodeIfPresent(Double.self, forKey: .pending) ?? 0
        bookingsCount = try c.decodeIfPresent(Int.self, forKey: .bookingsCount) ?? 0
        commissionRate = try c.decodeIfPresent(Double.self, forKey: .commissionRate) ?? 0
        guestPaid = try c.decodeIfPresent(Double.self, forKey: .guestPaid) ?? 0
        recent = try c.decodeIfPresent([HostEarningItem].self, forKey: .recent) ?? []
    }

    /// The commission as a whole-percent integer for display (e.g. 10 for 0.1).
    var commissionPercent: Int { Int((commissionRate * 100).rounded()) }
}

/// One row in a host's earnings breakdown (an element of `HostEarnings.recent`):
/// `{ booking_id, title, check_in, check_out, gross, net, status, paid_at }`.
/// `status` is `"paid_out"` (settled) or `"upcoming"` (awaiting payout).
struct HostEarningItem: Decodable, Identifiable, Hashable {
    let bookingId: String
    let title: String?
    let checkIn: String?
    let checkOut: String?
    /// What the GUEST paid (commission-inclusive), in the parent's currency.
    let gross: Double
    /// What this host earns. Under the markup model that is their FULL raw price
    /// — the commission is charged on top to the guest, never withheld from the
    /// host — so `gross - net` is the platform's cut, not a deduction.
    let net: Double
    /// `"paid_out"` or `"upcoming"`.
    let status: String
    /// ISO-8601 timestamp the payout settled, from `paid_at`. `nil` when upcoming.
    let paidAt: String?
    /// The booking was cancelled and the host still kept part (or all) of it.
    /// `gross` and `net` above are ALREADY net of `refundPercent`. Absent on
    /// older backends, which dropped cancelled rows entirely — which is the bug
    /// this flag exists because of: a cancellation refunds a SHARE of the stay,
    /// so erasing the row deducted the host's whole price for a refund the guest
    /// never received. `false` is therefore the right default.
    let cancelled: Bool
    /// Share of the guest's money returned, 0–100. Meaningful only when `cancelled`.
    let refundPercent: Int

    /// `Identifiable` by the booking id (one row per booking).
    var id: String { bookingId }

    enum CodingKeys: String, CodingKey {
        case bookingId = "booking_id"
        case title
        case checkIn = "check_in"
        case checkOut = "check_out"
        case gross, net, status, cancelled, refundPercent
        case paidAt = "paid_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        bookingId = try c.decode(String.self, forKey: .bookingId)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        checkIn = try c.decodeIfPresent(String.self, forKey: .checkIn)
        checkOut = try c.decodeIfPresent(String.self, forKey: .checkOut)
        gross = try c.decodeIfPresent(Double.self, forKey: .gross) ?? 0
        net = try c.decodeIfPresent(Double.self, forKey: .net) ?? 0
        status = (try c.decodeIfPresent(String.self, forKey: .status))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "upcoming"
        paidAt = try c.decodeIfPresent(String.self, forKey: .paidAt)
        cancelled = try c.decodeIfPresent(Bool.self, forKey: .cancelled) ?? false
        refundPercent = try c.decodeIfPresent(Int.self, forKey: .refundPercent) ?? 0
    }

    /// A cancellation the guest was refunded nothing on — the host keeps their
    /// full price, and the earnings row must say so rather than look like a
    /// stay that mysteriously paid out after being called off.
    var keptInFull: Bool { cancelled && refundPercent <= 0 }

    /// `true` once this booking's payout has settled (`status == "paid_out"`).
    var isPaidOut: Bool { status.lowercased() == "paid_out" }

    /// "Jul 10 → Jul 14" range when both dates are present, else "".
    var dateRangeText: String {
        guard let checkIn, let checkOut else { return "" }
        return Booking.format(checkIn: checkIn, checkOut: checkOut)
    }
}

// MARK: - Money — guest receipts

/// A guest's paid receipt, returned by `GET /api/local/receipts` (Bearer) →
/// `[{ booking_id, reservation_code, title, check_in, check_out, nights,
/// subtotal, serviceFee, method, methodFee, promoCode, promoDiscount, total,
/// paidAt, currency }]`. All amounts are in `currency` (EGP) — convert for
/// display only via `CurrencyManager`.
struct GuestReceipt: Decodable, Identifiable, Hashable {
    let bookingId: String
    let reservationCode: String?
    let title: String?
    let checkIn: String?
    let checkOut: String?
    let nights: Int
    /// Nightly × nights subtotal.
    let subtotal: Double
    /// Flat service fee charged on the stay.
    let serviceFee: Double
    /// Payment method used ("card" | "bank_transfer" / "bank").
    let method: String?
    /// Signed method adjustment (+ for card surcharge, − for bank discount).
    let methodFee: Double
    /// The promo code applied, when any.
    let promoCode: String?
    /// The discount the promo code granted (0 when none).
    let promoDiscount: Double
    /// Grand total charged.
    let total: Double
    /// ISO-8601 timestamp the booking was paid, from `paidAt`.
    let paidAt: String?
    /// Base currency the amounts are denominated in (always "EGP").
    let currency: String

    /// `Identifiable` by the booking id (one receipt per booking).
    var id: String { bookingId }

    enum CodingKeys: String, CodingKey {
        case bookingId = "booking_id"
        case reservationCode = "reservation_code"
        case title
        case checkIn = "check_in"
        case checkOut = "check_out"
        case nights, subtotal, serviceFee, method, methodFee, promoCode, promoDiscount, total, paidAt, currency
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        bookingId = try c.decode(String.self, forKey: .bookingId)
        reservationCode = try c.decodeIfPresent(String.self, forKey: .reservationCode)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        checkIn = try c.decodeIfPresent(String.self, forKey: .checkIn)
        checkOut = try c.decodeIfPresent(String.self, forKey: .checkOut)
        nights = try c.decodeIfPresent(Int.self, forKey: .nights) ?? 0
        subtotal = try c.decodeIfPresent(Double.self, forKey: .subtotal) ?? 0
        serviceFee = try c.decodeIfPresent(Double.self, forKey: .serviceFee) ?? 0
        method = try c.decodeIfPresent(String.self, forKey: .method)
        methodFee = try c.decodeIfPresent(Double.self, forKey: .methodFee) ?? 0
        promoCode = try c.decodeIfPresent(String.self, forKey: .promoCode)
        promoDiscount = try c.decodeIfPresent(Double.self, forKey: .promoDiscount) ?? 0
        total = try c.decodeIfPresent(Double.self, forKey: .total) ?? 0
        paidAt = try c.decodeIfPresent(String.self, forKey: .paidAt)
        currency = (try c.decodeIfPresent(String.self, forKey: .currency))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "EGP"
    }

    /// `true` when the guest applied a promo code that granted a discount.
    var hasPromo: Bool {
        promoDiscount > 0 && (promoCode?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
    }

    /// `true` when there's a non-zero method surcharge/discount to itemize.
    var hasMethodFee: Bool { abs(methodFee) >= 0.5 }

    /// "Jul 10 → Jul 14" range when both dates are present, else "".
    var dateRangeText: String {
        guard let checkIn, let checkOut else { return "" }
        return Booking.format(checkIn: checkIn, checkOut: checkOut)
    }

    /// The bare reservation code (falls back to the booking id) for the header.
    var codeText: String {
        let code = reservationCode?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (code?.isEmpty == false) ? code! : bookingId
    }

    /// "Paid Jul 12, 2026" style date, parsed from the ISO `paidAt`. Empty when
    /// the timestamp is missing or unparseable.
    var paidOnText: String {
        guard let paidAt, let date = GuestReceipt.parseDate(paidAt) else { return "" }
        return GuestReceipt.dayFormatter.string(from: date)
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

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = .current
        f.dateFormat = "MMM d, yyyy"
        return f
    }()
}

// MARK: - Money — multi-currency

/// FX rates returned by `GET /api/local/currencies` →
/// `{ base: "EGP", rates: { EGP: 1, USD: 0.0203, … } }`. To convert an EGP
/// amount to a target currency: `amount * rates[target]`.
struct CurrencyRates: Decodable, Hashable {
    /// Base currency all rates are relative to (always "EGP").
    let base: String
    /// Multipliers keyed by ISO currency code (the base maps to 1).
    let rates: [String: Double]

    enum CodingKeys: String, CodingKey {
        case base, rates
    }

    init(base: String, rates: [String: Double]) {
        self.base = base
        self.rates = rates
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        base = (try c.decodeIfPresent(String.self, forKey: .base))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "EGP"
        rates = try c.decodeIfPresent([String: Double].self, forKey: .rates) ?? CurrencyRates.fallback.rates
    }

    /// Baked-in static rates used when the network call fails (matches the
    /// backend's `GET /api/local/currencies` defaults).
    static let fallback = CurrencyRates(
        base: "EGP",
        rates: [
            "EGP": 1,
            "USD": 0.0203,
            "EUR": 0.0188,
            "GBP": 0.016,
            "SAR": 0.0762,
            "AED": 0.0746,
        ]
    )
}

/// A display currency the user can switch to in the Profile picker. EGP is the
/// base; the rest convert via the static/fetched `CurrencyRates`. Conversion is
/// display-only — bookings are always created and charged in EGP.
enum DisplayCurrency: String, CaseIterable, Identifiable {
    case egp = "EGP"
    case usd = "USD"
    case eur = "EUR"
    case gbp = "GBP"
    case sar = "SAR"
    case aed = "AED"

    var id: String { rawValue }

    /// The ISO currency code (matches the backend `rates` keys).
    var code: String { rawValue }

    /// The currency symbol shown before the amount.
    var symbol: String {
        switch self {
        case .egp: return "EGP "
        case .usd: return "$"
        case .eur: return "€"
        case .gbp: return "£"
        case .sar: return "SAR "
        case .aed: return "AED "
        }
    }

    /// Localized display name for the picker (looked up per language).
    @MainActor
    var displayName: String {
        L.t("currency.\(rawValue.lowercased())")
    }

    /// Number of fraction digits to show. EGP/SAR/AED read better as whole
    /// numbers at these magnitudes; the foreign minors keep 2 decimals.
    var fractionDigits: Int {
        switch self {
        case .egp, .sar, .aed: return 0
        case .usd, .eur, .gbp: return 2
        }
    }
}

// MARK: - Section 10 — Host analytics

/// One month's bucket in the host's booking/revenue trend, an element of
/// `HostAnalytics.byMonth` → `{ month, bookings, revenue }`. `month` is a label
/// the backend formats (e.g. "Jan", "2026-01"); `revenue` is in EGP.
struct AnalyticsMonth: Decodable, Identifiable, Hashable {
    /// The month label as the backend supplies it (used as-is on the trend axis).
    let month: String
    /// Paid bookings counted in this month.
    let bookings: Int
    /// Revenue earned this month, in EGP.
    let revenue: Double

    /// `Identifiable` by the month label (unique per bucket in the series).
    var id: String { month }

    enum CodingKeys: String, CodingKey { case month, bookings, revenue }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        month = (try c.decodeIfPresent(String.self, forKey: .month))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "—"
        bookings = try c.decodeIfPresent(Int.self, forKey: .bookings) ?? 0
        revenue = try c.decodeIfPresent(Double.self, forKey: .revenue) ?? 0
    }

    /// A short axis label: the trailing month token of `month` (so "2026-01"
    /// renders as "01" / "Jan 2026" renders as "Jan") to fit under a narrow bar.
    var shortLabel: String {
        let parts = month.split(whereSeparator: { $0 == "-" || $0 == " " || $0 == "/" })
        return String(parts.last ?? Substring(month))
    }
}

/// One of the host's best-performing places, an element of
/// `HostAnalytics.topListings` → `{ title, bookings, revenue }`. `revenue` is EGP.
struct TopListing: Decodable, Identifiable, Hashable {
    let title: String
    let bookings: Int
    let revenue: Double

    /// `Identifiable` by title (the analytics rollup is keyed per listing title).
    var id: String { title }

    enum CodingKeys: String, CodingKey { case title, bookings, revenue }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = (try c.decodeIfPresent(String.self, forKey: .title))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "—"
        bookings = try c.decodeIfPresent(Int.self, forKey: .bookings) ?? 0
        revenue = try c.decodeIfPresent(Double.self, forKey: .revenue) ?? 0
    }
}

/// The signed-in host's analytics dashboard, returned by
/// `GET /api/local/host/analytics` (Bearer host) → `{ currency, listings,
/// totalBookings, paidBookings, cancelledBookings, revenue, avgRating,
/// reviewCount, conversionRate, byMonth:[…], topListings:[…] }`. All money is in
/// `currency` (EGP) — convert for display only via `CurrencyManager`.
struct HostAnalytics: Decodable, Hashable {
    /// Base currency the amounts are denominated in (always "EGP").
    let currency: String
    /// Number of the host's listings.
    let listings: Int
    /// All booking requests across the host's listings (any status).
    let totalBookings: Int
    /// Bookings that have been paid.
    let paidBookings: Int
    /// Bookings the guest cancelled.
    let cancelledBookings: Int
    /// Gross revenue from paid bookings, in `currency`.
    let revenue: Double
    /// Average guest rating across the host's listings (0 when none).
    let avgRating: Double
    /// Number of reviews backing `avgRating`.
    let reviewCount: Int
    /// Paid ÷ total bookings, as a fraction (0–1). Surfaced as a percent.
    let conversionRate: Double
    /// The monthly bookings/revenue trend (oldest-first from the backend).
    let byMonth: [AnalyticsMonth]
    /// The host's best-performing listings (highest revenue first).
    let topListings: [TopListing]

    enum CodingKeys: String, CodingKey {
        case currency, listings, totalBookings, paidBookings, cancelledBookings
        case revenue, avgRating, reviewCount, conversionRate, byMonth, topListings
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        currency = (try c.decodeIfPresent(String.self, forKey: .currency))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "EGP"
        listings = try c.decodeIfPresent(Int.self, forKey: .listings) ?? 0
        totalBookings = try c.decodeIfPresent(Int.self, forKey: .totalBookings) ?? 0
        paidBookings = try c.decodeIfPresent(Int.self, forKey: .paidBookings) ?? 0
        cancelledBookings = try c.decodeIfPresent(Int.self, forKey: .cancelledBookings) ?? 0
        revenue = try c.decodeIfPresent(Double.self, forKey: .revenue) ?? 0
        avgRating = try c.decodeIfPresent(Double.self, forKey: .avgRating) ?? 0
        reviewCount = try c.decodeIfPresent(Int.self, forKey: .reviewCount) ?? 0
        conversionRate = try c.decodeIfPresent(Double.self, forKey: .conversionRate) ?? 0
        byMonth = try c.decodeIfPresent([AnalyticsMonth].self, forKey: .byMonth) ?? []
        topListings = try c.decodeIfPresent([TopListing].self, forKey: .topListings) ?? []
    }

    /// `true` once the host has at least one rated review (so we show a ★ value
    /// instead of "—").
    var hasRating: Bool { reviewCount > 0 && avgRating > 0 }

    /// The conversion rate as a whole-percent integer for display (e.g. 42 for
    /// 0.42). The backend may already send a percent (>1); normalize either way.
    var conversionPercent: Int {
        let fraction = conversionRate > 1 ? conversionRate / 100 : conversionRate
        return Int((fraction * 100).rounded())
    }

    /// The largest single-month revenue in the trend, used to scale the bars.
    /// At least 1 so an all-zero series still divides safely.
    var peakMonthlyRevenue: Double {
        max(byMonth.map(\.revenue).max() ?? 0, 1)
    }
}

// MARK: - Section 10 — AI natural-language search

/// The structured filters the AI parsed out of a guest's plain-language query,
/// the `filters` object on `POST /api/local/ai/search`. Every field is optional —
/// the model only fills the ones it inferred — so a partial payload still decodes.
/// Surfaced as removable chips above the AI search results.
struct AISearchFilters: Decodable, Hashable {
    /// A free-text place/keyword the model extracted (e.g. "sea view").
    let q: String?
    /// A curated region (e.g. "North Coast").
    let region: String?
    /// Inferred guest count.
    let guests: Int?
    /// Inferred nightly price floor, in EGP.
    let minPrice: Double?
    /// Inferred nightly price ceiling, in EGP.
    let maxPrice: Double?
    /// Inferred property type (e.g. "Villa").
    let propertyType: String?
    /// Inferred required amenities (the listing must have all).
    let amenities: [String]

    enum CodingKeys: String, CodingKey {
        case q, region, guests, minPrice, maxPrice, propertyType, amenities
    }

    /// All-nil filters, used as the fallback when the response omits the object.
    static let empty = AISearchFilters()

    /// Memberwise initializer (suppressed once a custom `init(from:)` exists).
    init(
        q: String? = nil,
        region: String? = nil,
        guests: Int? = nil,
        minPrice: Double? = nil,
        maxPrice: Double? = nil,
        propertyType: String? = nil,
        amenities: [String] = []
    ) {
        self.q = q
        self.region = region
        self.guests = guests
        self.minPrice = minPrice
        self.maxPrice = maxPrice
        self.propertyType = propertyType
        self.amenities = amenities
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        q = (try c.decodeIfPresent(String.self, forKey: .q)).flatMap { $0.isEmpty ? nil : $0 }
        region = (try c.decodeIfPresent(String.self, forKey: .region)).flatMap { $0.isEmpty ? nil : $0 }
        guests = try c.decodeIfPresent(Int.self, forKey: .guests)
        minPrice = try c.decodeIfPresent(Double.self, forKey: .minPrice)
        maxPrice = try c.decodeIfPresent(Double.self, forKey: .maxPrice)
        propertyType = (try c.decodeIfPresent(String.self, forKey: .propertyType)).flatMap { $0.isEmpty ? nil : $0 }
        amenities = (try c.decodeIfPresent([String].self, forKey: .amenities) ?? [])
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    /// Human-readable chip labels for each parsed filter, in a stable order, so
    /// the search screen can render them as removable pills. EGP prices are shown
    /// as whole numbers (matching the rest of the app's EGP display).
    ///
    /// `nonisolated` (pure data formatting) so it's safe to call from any context.
    /// The one localized label — the guests count — is supplied by the caller via
    /// `guestsLabel`, since localization (`L.t`) is `@MainActor`. Defaults to a
    /// plain "N guests" so off-actor callers still get a sensible value.
    nonisolated func chipLabels(guestsLabel: (Int) -> String = { "\($0) guests" }) -> [String] {
        var out: [String] = []
        if let q { out.append(q) }
        if let region { out.append(region) }
        if let propertyType { out.append(propertyType) }
        if let guests, guests > 0 { out.append(guestsLabel(guests)) }
        if let minPrice, minPrice > 0 { out.append("≥ EGP \(Int(minPrice))") }
        if let maxPrice, maxPrice > 0 { out.append("≤ EGP \(Int(maxPrice))") }
        out.append(contentsOf: amenities)
        return out
    }

    /// `true` when the model didn't extract any filter (a pure keyword search).
    /// Checks the raw fields directly so it stays usable off the main actor
    /// (unlike `chips`, which localizes and is therefore `@MainActor`).
    var isEmpty: Bool {
        q == nil && region == nil && propertyType == nil
            && (guests ?? 0) <= 0
            && (minPrice ?? 0) <= 0
            && (maxPrice ?? 0) <= 0
            && amenities.isEmpty
    }
}

/// The decoded `POST /api/local/ai/search` response: the parsed `filters` plus the
/// matching `listings` (decoded with the app's existing `Listing` model). The
/// `ai` provenance field is ignored — the UI only needs filters + results.
struct AISearchResult: Decodable {
    let filters: AISearchFilters
    let listings: [Listing]

    enum CodingKeys: String, CodingKey { case filters, listings }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        filters = (try c.decodeIfPresent(AISearchFilters.self, forKey: .filters)) ?? .empty
        listings = try c.decodeIfPresent([Listing].self, forKey: .listings) ?? []
    }
}

// MARK: - Host calendar (per-date pricing + day-level availability)


/// One priced night inside a `StayQuote` — what the booking summary itemises.
/// `price` is commission-inclusive, like every other figure on the quote.
struct QuoteNight: Decodable, Identifiable, Hashable {
    /// `yyyy-MM-dd`. The night STARTS on this day; a stay never includes the
    /// checkout day, so a guest is not charged for the morning they leave.
    let date: String
    let price: Double
    /// Which rung priced it — `custom` means the host pinned this exact night.
    let source: PriceSource

    var id: String { date }
}

/// Which rung of the pricing ladder set a night's rate. The host calendar pins a
/// price to an exact day, and that pin beats every seasonal rule:
///
///     custom → weekend → that month's rate → base price
enum PriceSource: String, Decodable, Hashable {
    /// Pinned by the host on this exact day.
    case custom
    /// The listing's weekend rate.
    case weekend
    /// That month's rate.
    case monthly
    /// `price_per_night` — the listing's default.
    case base

    /// An unknown value from a newer backend reads as `base` rather than failing
    /// to decode: a calendar that won't parse is worse than one rung mislabelled.
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = PriceSource(rawValue: raw) ?? .base
    }
}

/// Whether the host may still edit a day.
enum DayStatus: String, Decodable, Hashable {
    /// Sellable, and the host may price or close it.
    case available
    /// Closed by the host. Still editable — that is how they reopen it.
    case blocked
    /// Held by a reservation. Read-only: the price a guest agreed to is
    /// snapshotted on their booking and must not be restated underneath them.
    case booked

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = DayStatus(rawValue: raw) ?? .available
    }
}

/// One night of one listing's calendar. `price` is the host's RAW rate when the
/// caller is the listing's host (with `guestPrice` alongside), and the
/// commission-inclusive figure for anyone else — decided by the server from the
/// bearer token, exactly like the listing projections.
struct CalendarDay: Decodable, Identifiable, Hashable {
    /// `yyyy-MM-dd`. Doubles as the identity — one row per day.
    let date: String
    let price: Double
    /// What a guest pays for this night. Present only on a host read.
    let guestPrice: Double?
    let source: PriceSource
    let status: DayStatus
    /// The host's note on the block covering this day. Host reads only.
    let note: String?

    var id: String { date }

    /// The host may act on any day that is not held by a reservation.
    var isEditable: Bool { status != .booked }

    enum CodingKeys: String, CodingKey {
        case date, price, source, status, note
        case guestPrice = "guest_price"
    }
}

/// A listing's calendar over a window, as returned by
/// `GET /api/local/listings/:id/calendar?start=&end=`.
struct ListingCalendar: Decodable, Hashable {
    let listingID: String
    let currency: String
    /// The platform markup in force, as a fraction (0.1 = 10%).
    let commissionRate: Double
    /// `price_per_night`, in the same raw/guest terms as `days[].price`.
    let basePrice: Double
    let start: String
    /// INCLUSIVE — the last day in `days`, not a half-open bound.
    let end: String
    let days: [CalendarDay]

    enum CodingKeys: String, CodingKey {
        case currency, start, end, days
        case listingID = "listing_id"
        case commissionRate = "commission_rate"
        case basePrice = "base_price"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        listingID = try c.decodeIfPresent(String.self, forKey: .listingID) ?? ""
        currency = (try c.decodeIfPresent(String.self, forKey: .currency))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "EGP"
        commissionRate = try c.decodeIfPresent(Double.self, forKey: .commissionRate) ?? 0
        basePrice = try c.decodeIfPresent(Double.self, forKey: .basePrice) ?? 0
        start = try c.decodeIfPresent(String.self, forKey: .start) ?? ""
        end = try c.decodeIfPresent(String.self, forKey: .end) ?? ""
        days = try c.decodeIfPresent([CalendarDay].self, forKey: .days) ?? []
    }
}

/// What one calendar edit did, from `PUT …/calendar`.
struct CalendarUpdateResult: Decodable {
    /// Days actually written.
    let updated: Int
    /// Days the host selected that we refused, and why. Never silent: a day left
    /// unchanged without saying so is one the host believes they priced.
    let skipped: [SkippedDay]
    /// The calendar after the edit, over the days that were selected.
    let calendar: ListingCalendar

    struct SkippedDay: Decodable, Hashable {
        let date: String
        /// Currently only `"booked"`.
        let reason: String
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        updated = try c.decodeIfPresent(Int.self, forKey: .updated) ?? 0
        skipped = try c.decodeIfPresent([SkippedDay].self, forKey: .skipped) ?? []
        calendar = try c.decode(ListingCalendar.self, forKey: .calendar)
    }

    enum CodingKeys: String, CodingKey { case updated, skipped, calendar }
}

/// What a calendar edit does to the selected days' prices. Three states, because
/// "set 3,500", "clear the pin" and "don't touch prices" are three different
/// edits and a plain `Double?` can only express two of them.
enum CalendarPriceChange {
    /// Leave prices as they are (used when only blocking or unblocking).
    case unchanged
    /// Delete the pinned rates so the days follow the listing's normal pricing.
    case reset
    /// Pin this raw nightly rate on every selected day.
    case set(Double)
}
