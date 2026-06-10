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

    /// True once the user has run a filtered search — used to switch the empty
    /// state copy from "seed the database" to "no stays match your search".
    @Published var isFiltered = false

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

    /// Reset the header to its defaults and reload the full catalogue.
    func clear() async {
        locationQuery = ""
        useDates = false
        guests = 1
        checkIn = Calendar.current.startOfDay(for: Date())
        checkOut = Calendar.current.date(byAdding: .day, value: 3, to: Date()) ?? Date()
        await fetch(filtered: false)
    }

    private func fetch(filtered: Bool) async {
        isLoading = true
        errorMessage = nil
        isFiltered = filtered
        do {
            let dates = filtered && useDates
            listings = try await SupabaseService.shared.fetchListings(
                location: filtered ? locationQuery : nil,
                guests: filtered && guests > 0 ? guests : nil,
                checkIn: dates ? Self.dayFormatter.string(from: checkIn) : nil,
                checkOut: dates ? Self.dayFormatter.string(from: checkOut) : nil
            )
            if listings.isEmpty {
                errorMessage = filtered
                    ? "No stays match your search. Try different dates or fewer guests."
                    : "No listings found yet. Seed the database to see stays here."
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
