import SwiftUI
import MapKit

/// Whether the Explore tab shows the scrollable card list or the map.
enum ListingsViewMode: String, CaseIterable, Identifiable {
    case list
    case map

    var id: String { rawValue }
    var label: String { self == .list ? "List" : "Map" }
    var icon: String { self == .list ? "list.bullet" : "map" }
}

/// Map mode for the Explore tab: every listing with coordinates becomes a
/// tappable burgundy price pill (Airbnb-style). Selecting a pill reveals a small
/// card at the bottom with a thumbnail, title, location, price and a "View"
/// button that pushes the listing detail via the shared NavigationStack path.
///
/// This uses Apple **MapKit** — native, no API key, no download. The same
/// Airbnb price-pin look is achievable with the Google Maps iOS SDK; that swap
/// is a documented follow-up (see `Config.googleMapsAPIKey`).
struct ListingsMapView: View {
    let listings: [Listing]
    /// Shared with `ListingsView`'s `NavigationStack(path:)` so "View" can push
    /// `ListingDetailView` through the existing `.navigationDestination`.
    @Binding var path: [Listing]
    /// CLI screenshot hook: when true, auto-selects the first mappable listing
    /// on appear so the bottom card overlay can be captured without a tap.
    var preselectFirst: Bool = false
    /// Optional "close the map" (X) control — returns the Explore tab to the list.
    var onClose: (() -> Void)? = nil

    @State private var position: MapCameraPosition = .automatic
    @State private var selectedID: String?

    /// Listings that actually have a coordinate to plot.
    private var mappable: [Listing] {
        listings.filter { $0.coordinate != nil }
    }

    private var selected: Listing? {
        guard let selectedID else { return nil }
        return mappable.first { $0.id == selectedID }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            if mappable.isEmpty {
                emptyState
            } else {
                map
                if let selected {
                    SelectedListingCard(listing: selected, path: $path) {
                        withAnimation(.easeInOut(duration: 0.2)) { selectedID = nil }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 18)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
        .overlay(alignment: .topTrailing) {
            if let onClose {
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Color.qkInk)
                        .frame(width: 40, height: 40)
                        .background(.white, in: Circle())
                        .overlay(Circle().stroke(Color.black.opacity(0.06), lineWidth: 1))
                        .shadow(color: .black.opacity(0.22), radius: 5, x: 0, y: 2)
                }
                .buttonStyle(.plain)
                .padding(.trailing, 16)
                .padding(.top, 12)
                .accessibilityLabel("Close map")
            }
        }
        .onChange(of: listings) { _, _ in
            // New search results → drop any stale selection and refit the camera
            // to the new pins so the map always frames exactly what was found.
            withAnimation(.easeInOut(duration: 0.35)) {
                if preselectFirst, let first = mappable.first, let coord = first.coordinate {
                    selectedID = first.id
                    position = .region(
                        MKCoordinateRegion(
                            center: coord,
                            span: MKCoordinateSpan(latitudeDelta: 2.2, longitudeDelta: 2.2)
                        )
                    )
                } else {
                    selectedID = nil
                    position = mapRegion.map { .region($0) } ?? .automatic
                }
            }
        }
        .onAppear {
            if preselectFirst, let first = mappable.first, let coord = first.coordinate {
                // Screenshot hook: select the first stay and frame it tightly so
                // the visible pin matches the bottom card.
                selectedID = first.id
                position = .region(
                    MKCoordinateRegion(
                        center: coord,
                        span: MKCoordinateSpan(latitudeDelta: 2.2, longitudeDelta: 2.2)
                    )
                )
            } else {
                position = mapRegion.map { .region($0) } ?? .automatic
            }
        }
    }

    private var map: some View {
        Map(position: $position, selection: $selectedID) {
            ForEach(mappable) { listing in
                if let coordinate = listing.coordinate {
                    Annotation(listing.title, coordinate: coordinate, anchor: .bottom) {
                        PricePin(
                            text: listing.priceText,
                            isSelected: selectedID == listing.id
                        )
                        .onTapGesture {
                            withAnimation(.easeInOut(duration: 0.25)) {
                                selectedID = listing.id
                                // Re-center the camera on the tapped stay.
                                position = .region(
                                    MKCoordinateRegion(
                                        center: coordinate,
                                        span: MKCoordinateSpan(latitudeDelta: 1.2, longitudeDelta: 1.2)
                                    )
                                )
                            }
                        }
                        // Selected pin floats above its neighbours.
                        .zIndex(selectedID == listing.id ? 1 : 0)
                    }
                    .tag(listing.id)
                    .annotationTitles(.hidden)
                }
            }
        }
        .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))
        .mapControlVisibility(.hidden)
        .ignoresSafeArea(edges: .bottom)
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "mappin.slash")
                .font(.system(size: 48))
                .foregroundStyle(Color.qkBurgundy.opacity(0.6))
            Text("No map locations")
                .font(.headline)
                .foregroundStyle(Color.qkInk)
            Text("None of these stays have coordinates to plot yet.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.qkMuted)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.qkCream)
    }

    /// A region framing the pins, with padding. `nil` when empty (caller falls
    /// back to `.automatic`).
    ///
    /// For a regional result set (a real search) this fits every pin. For a
    /// globally-scattered set (e.g. the unfiltered catalogue spanning multiple
    /// continents) fitting *everything* would land the camera mid-ocean with
    /// pins off every edge — so instead it frames the **densest cluster**, the
    /// Airbnb-style "open on a real neighbourhood" behaviour.
    private var mapRegion: MKCoordinateRegion? {
        let coords = mappable.compactMap { $0.coordinate }
        guard let first = coords.first else { return nil }

        // Single result → a tight, centered frame (Airbnb-style for one stay).
        if coords.count == 1 {
            return MKCoordinateRegion(
                center: first,
                span: MKCoordinateSpan(latitudeDelta: 1.6, longitudeDelta: 1.6)
            )
        }

        // If the pins are spread across a very wide area, frame the biggest
        // cluster rather than the global centroid.
        if let cluster = densestCluster(of: coords), cluster.count < coords.count {
            return region(fitting: cluster)
        }
        return region(fitting: coords)
    }

    /// Bounding region for a set of coordinates, padded so pills sit inside the
    /// edges. Clamped to MapKit's valid span range.
    private func region(fitting coords: [CLLocationCoordinate2D]) -> MKCoordinateRegion {
        guard let first = coords.first else {
            return MKCoordinateRegion(center: .init(), span: .init(latitudeDelta: 60, longitudeDelta: 60))
        }
        var minLat = first.latitude, maxLat = first.latitude
        var minLng = first.longitude, maxLng = first.longitude
        for c in coords {
            minLat = min(minLat, c.latitude)
            maxLat = max(maxLat, c.latitude)
            minLng = min(minLng, c.longitude)
            maxLng = max(maxLng, c.longitude)
        }
        let center = CLLocationCoordinate2D(
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2
        )
        // 1.5x padding so pills aren't flush against the edges; clamp to valid.
        let span = MKCoordinateSpan(
            latitudeDelta: min(max((maxLat - minLat) * 1.5, 1.6), 170),
            longitudeDelta: min(max((maxLng - minLng) * 1.5, 1.6), 350)
        )
        return MKCoordinateRegion(center: center, span: span)
    }

    /// Greedily groups coordinates that sit within ~`thresholdDegrees` of each
    /// other and returns the largest group — but only when the overall spread is
    /// wide enough that fitting everything would be unhelpful (e.g. a global
    /// catalogue). Returns `nil` to mean "just fit them all".
    private func densestCluster(
        of coords: [CLLocationCoordinate2D],
        thresholdDegrees: Double = 35
    ) -> [CLLocationCoordinate2D]? {
        let lngs = coords.map(\.longitude)
        let lats = coords.map(\.latitude)
        let spread = max((lngs.max()! - lngs.min()!), (lats.max()! - lats.min()!))
        // Only cluster for genuinely global spreads.
        guard spread > 90 else { return nil }

        var best: [CLLocationCoordinate2D] = []
        for anchor in coords {
            let group = coords.filter {
                abs($0.latitude - anchor.latitude) <= thresholdDegrees &&
                abs($0.longitude - anchor.longitude) <= thresholdDegrees
            }
            if group.count > best.count { best = group }
        }
        return best.count >= 2 ? best : nil
    }
}

/// A rounded burgundy price pill used as a map annotation, with a pointer tail.
/// Selected state inverts to a white pill with burgundy text and grows slightly
/// — the Airbnb selected-pin look.
private struct PricePin: View {
    let text: String
    let isSelected: Bool

    private var fill: Color { isSelected ? .white : .qkBurgundy }
    private var ink: Color { isSelected ? .qkBurgundy : .white }
    private var stroke: Color { isSelected ? .qkBurgundy : .white }

    var body: some View {
        VStack(spacing: 0) {
            Text(text)
                .font(.footnote.weight(.bold))
                .monospacedDigit()
                .foregroundStyle(ink)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(fill)
                .clipShape(Capsule())
                .overlay(
                    Capsule().stroke(stroke, lineWidth: isSelected ? 2 : 1.5)
                )
            // Pointer tail, color-matched to the pill body.
            PinTail()
                .fill(fill)
                .frame(width: 11, height: 6)
                .offset(y: -0.5)
        }
        .scaleEffect(isSelected ? 1.16 : 1)
        .shadow(color: .black.opacity(0.28), radius: isSelected ? 5 : 3, x: 0, y: 2)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isSelected)
    }
}

/// Downward-pointing triangle for the pin tail.
private struct PinTail: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}

/// Bottom overlay card shown when a pin is tapped.
private struct SelectedListingCard: View {
    let listing: Listing
    @Binding var path: [Listing]
    let onClose: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            AsyncImage(url: URL(string: listing.sortedImageURLs.first ?? Listing.placeholder)) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fill)
                case .failure:
                    Color.qkTan.overlay(Image(systemName: "photo").foregroundStyle(Color.qkMuted))
                default:
                    Color.qkTan.overlay(ProgressView().tint(.qkBurgundy))
                }
            }
            .frame(width: 88, height: 88)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                if listing.isGuestFavorite == true {
                    Text("Guest favorite")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Color.qkBurgundy)
                }
                Text(listing.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.qkInk)
                    .lineLimit(2)
                if let location = listing.location {
                    Text(location)
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                        .lineLimit(1)
                }
                HStack(spacing: 3) {
                    Text(listing.priceText).fontWeight(.bold).foregroundStyle(Color.qkInk)
                    Text("/ night").foregroundStyle(Color.qkMuted)
                }
                .font(.caption)
                .padding(.top, 1)
            }

            Spacer(minLength: 4)

            Button {
                path.append(listing)
            } label: {
                Text("View")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 11)
                    .background(Color.qkBurgundy)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(Color.black.opacity(0.05), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.18), radius: 18, x: 0, y: 8)
        .overlay(alignment: .topTrailing) {
            Button(action: onClose) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title3)
                    .foregroundStyle(Color.qkMuted.opacity(0.7), Color.white)
            }
            .buttonStyle(.plain)
            .offset(x: 7, y: -7)
        }
    }
}
