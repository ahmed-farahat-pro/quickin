import Foundation
import CoreLocation

/// A photo attached to a listing (from the `listing_images` table).
struct ListingImage: Codable, Hashable {
    let url: String
    let order: Int?

    enum CodingKeys: String, CodingKey {
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

    enum CodingKeys: String, CodingKey {
        case id, title, description, location, currency, bedrooms, beds, bathrooms, lat, lng
        case pricePerNight = "price_per_night"
        case maxGuests = "max_guests"
        case isGuestFavorite = "is_guest_favorite"
        case listingCode = "listing_code"
        case images = "listing_images"
    }

    /// Map coordinate for this listing, when both `lat` and `lng` are present.
    var coordinate: CLLocationCoordinate2D? {
        guard let lat, let lng else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    /// Photo URLs sorted by their `order` field, falling back to a stock image.
    var sortedImageURLs: [String] {
        let urls = (images ?? [])
            .sorted { ($0.order ?? 0) < ($1.order ?? 0) }
            .map { $0.url }
        return urls.isEmpty ? [Listing.placeholder] : urls
    }

    var currencySymbol: String {
        switch (currency ?? "USD").uppercased() {
        case "USD": return "$"
        case "EUR": return "€"
        case "GBP": return "£"
        case "EGP": return "E£"
        default: return (currency ?? "$") + " "
        }
    }

    var priceText: String {
        "\(currencySymbol)\(Int(pricePerNight))"
    }

    static let placeholder = "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80"
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
    let title: String?
    let location: String?
    let image: String?

    enum CodingKeys: String, CodingKey {
        case id, guests, status, title, location, image
        case listingId = "listing_id"
        case checkIn = "check_in"
        case checkOut = "check_out"
        case totalPrice = "total_price"
    }

    /// "$1,100" style price for the card. Falls back to "—" if absent.
    var totalText: String {
        guard let totalPrice else { return "—" }
        return "$\(Int(totalPrice))"
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
