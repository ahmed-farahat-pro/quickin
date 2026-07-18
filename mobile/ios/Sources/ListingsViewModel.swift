import Foundation
import SwiftUI

@MainActor
final class ListingsViewModel: ObservableObject {
    // Results
    @Published var listings: [Listing] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    // Search inputs (bound to the search header)
    @Published var locationQuery = ""
    @Published var useDates = false
    @Published var checkIn = Calendar.current.startOfDay(for: Date())
    @Published var checkOut = Calendar.current.date(byAdding: .day, value: 3, to: Date()) ?? Date()
    @Published var guests = 1

    // Region + sort (bound to the chips row + sort menu under the search field)
    /// Curated browse regions with counts, from `GET /api/local/regions`.
    @Published var regions: [RegionFacet] = []
    /// Active region filter; `nil` means "All" (no region constraint).
    @Published var selectedRegion: String?
    /// Active sort order; defaults to the backend's "recommended".
    @Published var sort: ListingSort = .recommended

    // Discovery filters (set in the Filters sheet) — applied on top of the
    // region/search/date filters above.
    /// Amenities the listing must ALL have. Sent comma-joined as `amenities`.
    @Published var selectedAmenities: Set<String> = []
    /// Single property-type filter (e.g. "Villa"); `nil` means "Any type".
    @Published var selectedPropertyType: String?

    /// Property types offered in the Filters sheet, matching the backend's
    /// case-insensitive `propertyType` values.
    let propertyTypes: [String] = ["Apartment", "Chalet", "House", "Villa"]

    /// True once the user has run a filtered search — used to switch the empty
    /// state copy from "seed the database" to "no stays match your search".
    @Published var isFiltered = false

    // Place autocomplete (web + Android parity) — suggestions for the location
    // field from `GET /api/local/places`, refreshed (debounced) as the user types.
    @Published var placeSuggestions: [String] = []
    /// Monotonic token so a stale suggestions task can detect it was superseded.
    private var placeSuggestToken = 0

    /// Debounced place-suggestions refresh for the location search field. Called
    /// from the header whenever `locationQuery` changes (and when the field gains
    /// focus with an empty query, which returns the curated popular destinations).
    func suggestPlaces(debounced: Bool = true) {
        placeSuggestToken += 1
        let token = placeSuggestToken
        let query = locationQuery
        Task {
            if debounced { try? await Task.sleep(nanoseconds: 300_000_000) }
            guard token == placeSuggestToken else { return }
            let places = await SupabaseService.shared.fetchPlaceSuggestions(query: query)
            guard token == placeSuggestToken else { return }
            placeSuggestions = places
        }
    }

    /// Hides the suggestion list (on submit / selection / clear).
    func clearPlaceSuggestions() {
        placeSuggestToken += 1
        placeSuggestions = []
    }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    /// Short human label for the currently-selected range, e.g. "Jun 12 → Jun 15".
    /// `nil` when no dates are active so the UI can show its placeholder.
    var dateRangeLabel: String? {
        guard useDates else { return nil }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "MMM d"
        return "\(f.string(from: checkIn)) → \(f.string(from: checkOut))"
    }

    /// Apply a range chosen in the `DateRangePicker`. A non-nil pair turns dates
    /// on; clearing (nil) turns them off and resets to the defaults.
    func applyDateRange(checkIn newIn: Date?, checkOut newOut: Date?) {
        if let newIn, let newOut {
            checkIn = newIn
            checkOut = newOut
            useDates = true
        } else {
            useDates = false
            checkIn = Calendar.current.startOfDay(for: Date())
            checkOut = Calendar.current.date(byAdding: .day, value: 3, to: Date()) ?? Date()
        }
    }

    /// Initial / pull-to-refresh load — respects the current filter state so a
    /// refresh after searching keeps the same results.
    func load() async {
        await fetch(filtered: isFiltered)
    }

    /// Run a search with the current header inputs.
    func search() async {
        await fetch(filtered: true)
    }

    /// Reset the header to its defaults and reload the full catalogue. Also
    /// clears the region chip + sort so "Clear" returns to a truly blank slate.
    func clear() async {
        locationQuery = ""
        useDates = false
        guests = 1
        checkIn = Calendar.current.startOfDay(for: Date())
        checkOut = Calendar.current.date(byAdding: .day, value: 3, to: Date()) ?? Date()
        selectedRegion = nil
        sort = .recommended
        selectedAmenities = []
        selectedPropertyType = nil
        await fetch(filtered: false)
    }

    /// Apply the discovery filters chosen in the Filters sheet and refetch,
    /// keeping the active region / search / dates. Treated as a filtered fetch so
    /// the empty state reads "no stays match" rather than the seed prompt.
    func applyFilters() async {
        await fetch(filtered: true)
    }

    /// Reset just the discovery filters (amenities + property type) and refetch,
    /// leaving the region / search / dates untouched.
    func clearFilters() async {
        selectedAmenities = []
        selectedPropertyType = nil
        await load()
    }

    /// Whether any discovery filter (amenities or property type) is set. Drives
    /// the Filters button's "active" badge.
    var hasDiscoveryFilters: Bool {
        !selectedAmenities.isEmpty || selectedPropertyType != nil
    }

    /// Number of active discovery filters, shown as a count badge on the Filters
    /// button (each selected amenity + a chosen property type each count once).
    var discoveryFilterCount: Int {
        selectedAmenities.count + (selectedPropertyType == nil ? 0 : 1)
    }

    /// "Search this area" on the map: refetch listings inside `box`, combined with
    /// any active region / search / date / discovery filters. The box is one-shot
    /// (not stored), so later region/sort/search changes return to the full set.
    func searchArea(_ box: BBox) async {
        await fetch(filtered: true, bbox: box)
    }

    /// Select a region chip (or `nil` for "All") and refetch. Region filtering is
    /// independent of the search header, so it keeps any active location/dates.
    func selectRegion(_ region: String?) async {
        guard selectedRegion != region else { return }
        selectedRegion = region
        await load()
    }

    /// Change the sort order and refetch, keeping all other filters.
    func applySort(_ newSort: ListingSort) async {
        guard sort != newSort else { return }
        sort = newSort
        await load()
    }

    /// Load the curated browse regions (with counts) for the chips row. Best
    /// effort — a failure just leaves the chips at "All" only.
    func loadRegions() async {
        if let fetched = try? await SupabaseService.shared.fetchRegions() {
            regions = fetched
        }
    }

    /// Whether any filter beyond the default is active (region, sort, the search
    /// header, or a discovery filter). Drives the empty-state copy + the "Clear
    /// search" button.
    var anyFilterActive: Bool {
        isFiltered || selectedRegion != nil || sort != .recommended || hasDiscoveryFilters
    }

    private func fetch(filtered: Bool, bbox: BBox? = nil) async {
        isLoading = true
        errorMessage = nil
        isFiltered = filtered
        do {
            let dates = filtered && useDates
            listings = try await SupabaseService.shared.fetchListings(
                location: filtered ? locationQuery : nil,
                region: selectedRegion,
                guests: filtered && guests > 0 ? guests : nil,
                checkIn: dates ? Self.dayFormatter.string(from: checkIn) : nil,
                checkOut: dates ? Self.dayFormatter.string(from: checkOut) : nil,
                sort: sort,
                propertyType: selectedPropertyType,
                amenities: Array(selectedAmenities),
                bbox: bbox
            )
            if listings.isEmpty {
                errorMessage = anyFilterActive
                    ? "No stays match your filters. Try a different area or clearing them."
                    : "No listings found yet. Seed the database to see stays here."
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
