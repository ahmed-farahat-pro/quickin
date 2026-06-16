import Foundation
import CoreLocation
import MapKit

/// Backs the Add-listing location step's "Use my current location" button and
/// the place-search box. Keeps all CoreLocation / MapKit work off the views.
///
/// • Current location: wraps `CLLocationManager` (requestWhenInUseAuthorization
///   → requestLocation) and publishes a one-shot coordinate via `onLocation`.
///   Permission denial is surfaced through `errorMessage`, never a crash.
/// • Search: uses `MKLocalSearch` (MapKit) to geocode a free-text query — no API
///   key required — and publishes the matches in `results` for the UI to pick
///   from. Each result carries its coordinate plus a readable city / country.
@MainActor
final class LocationSearchManager: NSObject, ObservableObject {
    /// Place matches for the current query (top results), newest search wins.
    @Published var results: [PlaceResult] = []
    /// True while a `MKLocalSearch` is in flight.
    @Published var isSearching = false
    /// True while waiting on a one-shot `CLLocationManager` fix.
    @Published var isLocating = false
    /// User-facing error for either the search or the location request.
    @Published var errorMessage: String?

    /// Called with the user's coordinate once a current-location fix arrives.
    var onLocation: ((CLLocationCoordinate2D, PlaceResult?) -> Void)?

    private let locationManager = CLLocationManager()

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    // MARK: - Current location

    /// Ask for "when in use" permission (if needed) and request a single fix.
    /// The result is delivered through `onLocation`; failures land on
    /// `errorMessage`.
    func requestCurrentLocation() {
        errorMessage = nil
        let status = locationManager.authorizationStatus
        switch status {
        case .notDetermined:
            // Wait for the permission callback, then request the fix there.
            isLocating = true
            locationManager.requestWhenInUseAuthorization()
        case .restricted, .denied:
            errorMessage = "Location access is off. Enable it in Settings to use your current location."
        case .authorizedAlways, .authorizedWhenInUse:
            isLocating = true
            locationManager.requestLocation()
        @unknown default:
            errorMessage = "Couldn't access your location."
        }
    }

    // MARK: - Place search (MKLocalSearch)

    /// Search for `query` and publish the top matches in `results`. Clears the
    /// previous results when the query is blank.
    func search(_ query: String) async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            results = []
            return
        }

        errorMessage = nil
        isSearching = true
        defer { isSearching = false }

        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = trimmed
        // Result types: address-style places + points of interest.
        request.resultTypes = [.address, .pointOfInterest]

        do {
            let response = try await MKLocalSearch(request: request).start()
            let mapped = response.mapItems.prefix(8).map { PlaceResult($0) }
            if mapped.isEmpty {
                results = []
                errorMessage = "No place found for \u{201C}\(trimmed)\u{201D}. Try a more specific address."
            } else {
                results = Array(mapped)
            }
        } catch {
            // MKLocalSearch throws `MKError.placemarkNotFound` for an empty match.
            results = []
            if (error as? MKError)?.code == .placemarkNotFound {
                errorMessage = "No place found for \u{201C}\(trimmed)\u{201D}. Try a more specific address."
            } else {
                errorMessage = "Search failed. Check your connection and try again."
            }
        }
    }

    func clearResults() {
        results = []
    }

    // MARK: - Reverse geocode (label a coordinate)

    /// Best-effort reverse geocode so a coordinate (e.g. the current-location
    /// fix) gets a readable city / country. Returns `nil` on failure.
    private func reverseGeocode(_ coordinate: CLLocationCoordinate2D) async -> PlaceResult? {
        let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        let placemarks = try? await CLGeocoder().reverseGeocodeLocation(location)
        guard let placemark = placemarks?.first else { return nil }
        return PlaceResult(coordinate: coordinate, placemark: placemark)
    }
}

// MARK: - CLLocationManagerDelegate

extension LocationSearchManager: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            switch status {
            case .authorizedAlways, .authorizedWhenInUse:
                // Permission just granted following our request — get the fix.
                if isLocating {
                    manager.requestLocation()
                }
            case .denied, .restricted:
                isLocating = false
                errorMessage = "Location access is off. Enable it in Settings to use your current location."
            default:
                break
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let coordinate = locations.last?.coordinate else { return }
        Task { @MainActor in
            isLocating = false
            // Hand back the raw coordinate immediately, then enrich the labels.
            let labelled = await reverseGeocode(coordinate)
            onLocation?(coordinate, labelled)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            isLocating = false
            errorMessage = "Couldn't determine your location. Please try again."
        }
    }
}

// MARK: - PlaceResult

/// A single geocoded place: its coordinate plus readable title / subtitle and
/// the city / country fields the listing form stores.
struct PlaceResult: Identifiable {
    let id = UUID()
    let coordinate: CLLocationCoordinate2D
    /// Primary line (place name or street), e.g. "Cairo Tower".
    let title: String
    /// Secondary line (city, region, country) for the result row.
    let subtitle: String
    /// City for the form's "Location (city)" field.
    let city: String
    /// Country for the form's "Country" field.
    let country: String

    init(_ mapItem: MKMapItem) {
        let placemark = mapItem.placemark
        self.coordinate = placemark.coordinate
        self.title = mapItem.name ?? placemark.name ?? "Selected place"
        self.city = placemark.locality
            ?? placemark.subAdministrativeArea
            ?? placemark.administrativeArea
            ?? ""
        self.country = placemark.country ?? ""
        self.subtitle = PlaceResult.subtitle(for: placemark)
    }

    init(coordinate: CLLocationCoordinate2D, placemark: CLPlacemark) {
        self.coordinate = coordinate
        self.title = placemark.name
            ?? placemark.locality
            ?? "Current location"
        self.city = placemark.locality
            ?? placemark.subAdministrativeArea
            ?? placemark.administrativeArea
            ?? ""
        self.country = placemark.country ?? ""
        self.subtitle = PlaceResult.subtitle(for: placemark)
    }

    /// Builds a "City, Region, Country"-style subtitle from a placemark,
    /// skipping empty components.
    private static func subtitle(for placemark: CLPlacemark) -> String {
        let parts = [placemark.locality, placemark.administrativeArea, placemark.country]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
        return parts.isEmpty ? "" : parts.joined(separator: ", ")
    }
}
