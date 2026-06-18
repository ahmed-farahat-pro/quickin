import SwiftUI
import GoogleMaps

/// Whether the Explore tab shows the scrollable card list or the map.
enum ListingsViewMode: String, CaseIterable, Identifiable {
    case list
    case map

    var id: String { rawValue }
    @MainActor
    var label: String { self == .list ? L.t("viewmode.list") : L.t("viewmode.map") }
    var icon: String { self == .list ? "list.bullet" : "map" }
}

/// The three Egyptian coast regions offered as quick-jump tabs on the map. Tapping
/// one flies the camera to that resort belt (North Coast / El Gouna / Ain Sokhna).
enum MapRegion: String, CaseIterable, Identifiable {
    case northCoast
    case elGouna
    case ainSokhna

    var id: String { rawValue }

    var label: String {
        switch self {
        case .northCoast: return "North Coast"
        case .elGouna:    return "El Gouna"
        case .ainSokhna:  return "Ain Sokhna"
        }
    }

    /// Center of each resort belt.
    var center: CLLocationCoordinate2D {
        switch self {
        case .northCoast: return CLLocationCoordinate2D(latitude: 30.95, longitude: 28.75)
        case .elGouna:    return CLLocationCoordinate2D(latitude: 27.3954, longitude: 33.6781)
        case .ainSokhna:  return CLLocationCoordinate2D(latitude: 29.6000, longitude: 32.3500)
        }
    }

    var zoom: Float {
        switch self {
        case .northCoast: return 9
        case .elGouna:    return 12
        case .ainSokhna:  return 11
        }
    }
}

/// Map mode for the Explore tab: every listing with coordinates becomes a
/// tappable burgundy price pill (Airbnb-style). Selecting a pill reveals a small
/// card at the bottom with a thumbnail, title, location, price and a "View"
/// button that pushes the listing detail via the shared NavigationStack path.
///
/// This uses the **Google Maps iOS SDK** (`GMSMapView`). Each listing renders as
/// a burgundy price-pill marker (drawn into a `UIImage`), matching the Airbnb
/// look. Selection state, the bottom card, camera fitting, and the screenshot
/// `preselectFirst` hook are all preserved from the prior MapKit implementation.
struct ListingsMapView: View {
    let listings: [Listing]
    /// Shared with `ListingsView`'s `NavigationStack(path:)` so "View" can push
    /// `ListingDetailView` through the existing `.navigationDestination`.
    @Binding var path: NavigationPath
    /// Mirrors the view model's loading flag so the "Search this area" button can
    /// show a spinner while the bbox refetch is in flight.
    var isLoading: Bool = false
    /// CLI screenshot hook: when true, auto-selects the first mappable listing
    /// on appear so the bottom card overlay can be captured without a tap.
    var preselectFirst: Bool = false
    /// Optional "close the map" (X) control — returns the Explore tab to the list.
    var onClose: (() -> Void)? = nil
    /// "Search this area" — called with the map's current visible-region box so
    /// the Explore screen can refetch listings inside it (combined with any
    /// active filters). No-op when unset.
    var onSearchArea: ((BBox) -> Void)? = nil
    /// Free-text place search at the top of the full-page map. Submitting filters
    /// the listings (and thus the pins) to the typed destination; empty clears it.
    var onSubmitSearch: ((String) -> Void)? = nil

    @State private var selectedID: String?
    /// The place-search field text.
    @State private var placeText: String = ""
    /// Which region tab is active (nil = camera fits to all pins).
    @State private var selectedRegion: MapRegion?
    /// Bumped on every region tap so re-tapping the same region re-centers too.
    @State private var regionNonce: Int = 0
    /// Reads the live `GMSMapView` visible region → `BBox`. Populated by the map
    /// coordinator once it's on screen; nil until then.
    @State private var visibleBBoxProvider: (() -> BBox?)?

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
                GoogleListingsMap(
                    listings: mappable,
                    selectedID: $selectedID,
                    region: selectedRegion,
                    regionNonce: regionNonce,
                    preselectFirst: preselectFirst,
                    bboxProvider: $visibleBBoxProvider
                )
                .ignoresSafeArea(edges: .bottom)

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
        .overlay(alignment: .top) {
            topControls
        }
        .onChange(of: listings) { _, _ in
            // New search results → drop any stale selection. The underlying map
            // refits to the new pins itself (see GoogleListingsMap.updateUIView).
            if preselectFirst, let first = mappable.first {
                selectedID = first.id
            } else {
                selectedID = nil
            }
        }
    }

    /// Floating controls pinned to the top of the full-page map: a place-search
    /// field + close (X), the region quick-jumps, then "Search this area".
    private var topControls: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                mapSearchBar
                if let onClose {
                    Button(action: onClose) {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Color.qkInk)
                            .frame(width: 44, height: 44)
                            .background(.white, in: Circle())
                            .overlay(Circle().stroke(Color.black.opacity(0.06), lineWidth: 1))
                            .shadow(color: .black.opacity(0.18), radius: 5, x: 0, y: 2)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Close map")
                }
            }
            if !mappable.isEmpty { regionTabs }
            if onSearchArea != nil {
                HStack {
                    searchAreaButton
                    Spacer(minLength: 0)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
    }

    /// A rounded place-search field. Submitting filters the listings (and thus the
    /// pins) to the typed destination; the clear (x) resets to all listings.
    private var mapSearchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.qkMuted)
            TextField(L.t("explore.whereToPlaceholder"), text: $placeText)
                .font(.subheadline)
                .submitLabel(.search)
                .autocorrectionDisabled()
                .onSubmit { onSubmitSearch?(placeText) }
            if !placeText.isEmpty {
                Button {
                    placeText = ""
                    onSubmitSearch?("")
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Color.qkMuted.opacity(0.6))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 14)
        .frame(height: 44)
        .frame(maxWidth: .infinity)
        .background(.white, in: Capsule(style: .continuous))
        .overlay(Capsule(style: .continuous).stroke(Color.black.opacity(0.06), lineWidth: 1))
        .shadow(color: .black.opacity(0.12), radius: 6, x: 0, y: 2)
    }

    /// Horizontal quick-jump pills for the three Egyptian coast regions. Scrolls
    /// horizontally so it never collides with the close (X) button.
    private var regionTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(MapRegion.allCases) { region in
                    let isOn = selectedRegion == region
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selectedRegion = region
                            regionNonce += 1
                        }
                    } label: {
                        Text(region.label)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(isOn ? .white : Color.qkInk)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 9)
                            .background(isOn ? Color.qkBurgundy : .white, in: Capsule())
                            .overlay(Capsule().stroke(Color.black.opacity(0.06), lineWidth: 1))
                            .shadow(color: .black.opacity(0.14), radius: 5, x: 0, y: 2)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.leading, 16)
            // Leave room on the right for the close (X) button when it's present.
            .padding(.trailing, onClose != nil ? 64 : 16)
            .padding(.vertical, 2)
        }
        .padding(.top, 10)
    }

    /// A floating pill that re-queries listings inside the map's current visible
    /// region. Reads the live `GMSMapView` projection via `visibleBBoxProvider`.
    private var searchAreaButton: some View {
        Button {
            guard let box = visibleBBoxProvider?() else { return }
            onSearchArea?(box)
        } label: {
            HStack(spacing: 7) {
                if isLoading {
                    ProgressView()
                        .controlSize(.small)
                        .tint(Color.qkBurgundy)
                } else {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.system(size: 14, weight: .bold))
                }
                Text(L.t("filters.searchThisArea"))
                    .font(.subheadline.weight(.bold))
                    .lineLimit(1)
            }
            .foregroundStyle(Color.qkBurgundy)
            .padding(.horizontal, 18)
            .frame(height: 42)
            .background(.white, in: Capsule(style: .continuous))
            .overlay(Capsule(style: .continuous).stroke(Color.black.opacity(0.06), lineWidth: 1))
            .shadow(color: .black.opacity(0.16), radius: 8, x: 0, y: 3)
        }
        .buttonStyle(QKPressStyle(shadow: Color.qkBurgundy.opacity(0.22), shadowRadius: 8))
        .disabled(isLoading)
        .accessibilityLabel(L.t("filters.searchThisArea"))
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
}

// MARK: - Google map (UIViewRepresentable)

/// The `GMSMapView` wrapper. Renders one burgundy price-pill marker per listing,
/// fits the camera to the pins, and reports selection back through `selectedID`.
private struct GoogleListingsMap: UIViewRepresentable {
    let listings: [Listing]
    @Binding var selectedID: String?
    /// Active region tab (nil = no override; camera fits the pins).
    var region: MapRegion?
    /// Increments on each region tap so re-tapping the same tab re-centers.
    var regionNonce: Int
    var preselectFirst: Bool
    /// Receives a closure that reads the live map's visible region as a `BBox`.
    /// The "Search this area" button calls it to get the current viewport box.
    @Binding var bboxProvider: (() -> BBox?)?

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> GMSMapView {
        let options = GMSMapViewOptions()
        // Seed on Egypt at a country-level zoom. When listings have pins,
        // `fitCamera` immediately reframes to fit them; with no pins the map
        // stays framed on Egypt rather than a zoomed-out world view.
        options.camera = GMSCameraPosition.camera(
            withLatitude: LocationPickerMap.defaultCenter.latitude,
            longitude: LocationPickerMap.defaultCenter.longitude,
            zoom: LocationPickerMap.defaultZoom
        )
        let mapView = GMSMapView(options: options)
        mapView.delegate = context.coordinator
        mapView.settings.compassButton = false
        mapView.settings.myLocationButton = false

        context.coordinator.rebuildMarkers(on: mapView, listings: listings)
        context.coordinator.fitCamera(mapView, animated: false)

        // Hand the parent a closure that reads this map's current visible region.
        // Deferred so we don't mutate SwiftUI state during view construction.
        DispatchQueue.main.async { [weak mapView] in
            bboxProvider = { [weak mapView] in
                guard let mapView else { return nil }
                return Coordinator.visibleBBox(of: mapView)
            }
        }

        if preselectFirst, let first = listings.first {
            DispatchQueue.main.async { selectedID = first.id }
        }
        return mapView
    }

    func updateUIView(_ mapView: GMSMapView, context: Context) {
        let coordinator = context.coordinator
        coordinator.parent = self

        // Rebuild markers when the listing set changes, then refit.
        let ids = listings.map(\.id)
        if ids != coordinator.lastListingIDs {
            coordinator.rebuildMarkers(on: mapView, listings: listings)
            coordinator.fitCamera(mapView, animated: true)
        }

        // Reflect the current selection in marker icons + z-order.
        coordinator.applySelection(selectedID, on: mapView)

        // A region tab tap (tracked by a nonce so re-taps also re-center) flies
        // the camera to that resort belt.
        if regionNonce != coordinator.lastRegionNonce, let region {
            coordinator.lastRegionNonce = regionNonce
            let camera = GMSCameraPosition.camera(
                withLatitude: region.center.latitude,
                longitude: region.center.longitude,
                zoom: region.zoom
            )
            mapView.animate(to: camera)
        }
    }

    final class Coordinator: NSObject, GMSMapViewDelegate {
        var parent: GoogleListingsMap
        /// listing id → its marker, so selection can restyle the right pin.
        private var markers: [String: GMSMarker] = [:]
        private(set) var lastListingIDs: [String] = []
        private var currentSelection: String?
        /// Last region nonce the camera animated for (see updateUIView).
        var lastRegionNonce: Int = 0

        init(_ parent: GoogleListingsMap) { self.parent = parent }

        /// The map's current viewport as a `BBox` (GeoJSON west,south,east,north).
        /// Derived from the four corners of the Google projection's visible region,
        /// so it's correct even if the map is rotated or tilted.
        static func visibleBBox(of mapView: GMSMapView) -> BBox {
            let region = mapView.projection.visibleRegion()
            let lats = [region.nearLeft.latitude, region.nearRight.latitude,
                        region.farLeft.latitude, region.farRight.latitude]
            let lngs = [region.nearLeft.longitude, region.nearRight.longitude,
                        region.farLeft.longitude, region.farRight.longitude]
            return BBox(
                minLng: lngs.min() ?? 0,
                minLat: lats.min() ?? 0,
                maxLng: lngs.max() ?? 0,
                maxLat: lats.max() ?? 0
            )
        }

        /// Clear and recreate all price-pill markers for `listings`.
        func rebuildMarkers(on mapView: GMSMapView, listings: [Listing]) {
            mapView.clear()
            markers.removeAll()
            for listing in listings {
                guard let coordinate = listing.coordinate else { continue }
                let marker = GMSMarker(position: coordinate)
                marker.userData = listing.id
                marker.icon = PriceMarkerIcon.image(text: listing.priceText, selected: false)
                marker.groundAnchor = CGPoint(x: 0.5, y: 1.0)  // tail points at the spot
                marker.map = mapView
                markers[listing.id] = marker
            }
            lastListingIDs = listings.map(\.id)
            currentSelection = nil
        }

        /// Restyle markers so the selected one inverts (white pill) and floats up.
        func applySelection(_ selectedID: String?, on mapView: GMSMapView) {
            guard selectedID != currentSelection else { return }
            currentSelection = selectedID
            let lookup = Dictionary(uniqueKeysWithValues: parent.listings.map { ($0.id, $0) })
            for (id, marker) in markers {
                let isSelected = (id == selectedID)
                if let listing = lookup[id] {
                    marker.icon = PriceMarkerIcon.image(text: listing.priceText, selected: isSelected)
                }
                marker.zIndex = isSelected ? 1 : 0
            }
            // Recenter on the freshly selected pin (Airbnb-style).
            if let selectedID, let marker = markers[selectedID] {
                mapView.animate(toLocation: marker.position)
            }
        }

        /// Fit the camera to all pins with padding. For a single pin, centers on
        /// it at a sensible city-level zoom. With no pins, leaves the seeded
        /// Egypt camera in place.
        func fitCamera(_ mapView: GMSMapView, animated: Bool) {
            let coords = parent.listings.compactMap { $0.coordinate }
            guard let first = coords.first else { return }

            if coords.count == 1 {
                let camera = GMSCameraPosition.camera(
                    withLatitude: first.latitude,
                    longitude: first.longitude,
                    zoom: 11
                )
                if animated { mapView.animate(to: camera) } else { mapView.camera = camera }
                return
            }

            var bounds = GMSCoordinateBounds()
            for c in coords { bounds = bounds.includingCoordinate(c) }
            let update = GMSCameraUpdate.fit(bounds, withPadding: 64)
            if animated { mapView.animate(with: update) } else { mapView.moveCamera(update) }
        }

        // Tapping a price pill selects it.
        func mapView(_ mapView: GMSMapView, didTap marker: GMSMarker) -> Bool {
            if let id = marker.userData as? String {
                parent.selectedID = id
            }
            return true  // we handled it; suppress the default info window
        }

        // Tapping empty map space clears the selection.
        func mapView(_ mapView: GMSMapView, didTapAt coordinate: CLLocationCoordinate2D) {
            parent.selectedID = nil
        }
    }
}

// MARK: - Price-pill marker icon

/// Renders the burgundy (or inverted white, when selected) Airbnb-style price
/// pill — with a pointer tail — into a `UIImage` for use as a `GMSMarker.icon`.
/// Google Maps markers take a static image rather than a live SwiftUI view, so
/// the pill is drawn with Core Graphics.
private enum PriceMarkerIcon {
    static func image(text: String, selected: Bool) -> UIImage {
        let burgundy = UIColor(Color.qkBurgundy)
        let fill: UIColor = selected ? .white : burgundy
        let ink: UIColor = selected ? burgundy : .white
        let stroke: UIColor = selected ? burgundy : .white

        let font = UIFont.systemFont(ofSize: 13, weight: .bold)
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: ink]
        let textSize = (text as NSString).size(withAttributes: attrs)

        let hPad: CGFloat = 12
        let vPad: CGFloat = 7
        let tailH: CGFloat = 6
        let tailW: CGFloat = 11
        let scale: CGFloat = selected ? 1.16 : 1.0
        let lineW: CGFloat = selected ? 2 : 1.5
        let shadowBlur: CGFloat = 3
        let pad = shadowBlur + 2  // breathing room so the shadow isn't clipped

        let pillW = textSize.width + hPad * 2
        let pillH = textSize.height + vPad * 2
        let contentW = pillW
        let contentH = pillH + tailH
        let canvasW = (contentW * scale) + pad * 2
        let canvasH = (contentH * scale) + pad * 2

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: canvasW, height: canvasH))
        let image = renderer.image { ctx in
            let cg = ctx.cgContext
            cg.translateBy(x: canvasW / 2, y: canvasH / 2)
            cg.scaleBy(x: scale, y: scale)
            cg.translateBy(x: -contentW / 2, y: -contentH / 2)

            // Shadow under the whole pill.
            cg.setShadow(offset: CGSize(width: 0, height: 2),
                         blur: shadowBlur,
                         color: UIColor.black.withAlphaComponent(0.28).cgColor)

            // Capsule body.
            let pillRect = CGRect(x: 0, y: 0, width: pillW, height: pillH)
            let capsule = UIBezierPath(roundedRect: pillRect, cornerRadius: pillH / 2)

            // Pointer tail (downward triangle) merged into the same path so the
            // fill + stroke read as one shape.
            let tail = UIBezierPath()
            let midX = pillW / 2
            tail.move(to: CGPoint(x: midX - tailW / 2, y: pillH - 0.5))
            tail.addLine(to: CGPoint(x: midX + tailW / 2, y: pillH - 0.5))
            tail.addLine(to: CGPoint(x: midX, y: pillH + tailH))
            tail.close()

            let shape = UIBezierPath()
            shape.append(capsule)
            shape.append(tail)

            fill.setFill()
            shape.fill()

            // Stroke only the capsule outline (the tail tucks under it).
            cg.setShadow(offset: .zero, blur: 0, color: nil)
            stroke.setStroke()
            capsule.lineWidth = lineW
            capsule.stroke()

            // Price text, vertically centered in the capsule.
            let textOrigin = CGPoint(
                x: (pillW - textSize.width) / 2,
                y: (pillH - textSize.height) / 2
            )
            (text as NSString).draw(at: textOrigin, withAttributes: attrs)
        }
        return image
    }
}

// MARK: - Selected listing card

/// Bottom overlay card shown when a pin is tapped.
private struct SelectedListingCard: View {
    @EnvironmentObject private var currency: CurrencyManager
    let listing: Listing
    @Binding var path: NavigationPath
    let onClose: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            ListingImageView(url: listing.sortedImageURLs.first, placeholderLabel: "", placeholderIconSize: 24)
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
                    Text(currency.format(listing.pricePerNight))
                        .font(.caption.weight(.heavy))
                        .foregroundStyle(Color.qkBurgundy)
                    Text("/ night").font(.caption).foregroundStyle(Color.qkMuted)
                }
                .padding(.top, 1)
            }

            Spacer(minLength: 4)

            Button {
                path.append(listing)
            } label: {
                Text("View")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Color.qkCream)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 11)
                    .background(LinearGradient.qkBurgundyCTA)
                    .clipShape(Capsule())
            }
            .buttonStyle(QKPressStyle(shadowRadius: 8))
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
