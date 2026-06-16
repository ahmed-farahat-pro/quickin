import SwiftUI
import GoogleMaps

/// A tappable Google map used by the host "Add listing" wizard to place the
/// listing's location. Tapping the map drops/moves a single marker and reports
/// the chosen coordinate back through `selection`. The marker is also draggable
/// for fine adjustment.
///
/// An external caller (e.g. the place-search field in the location step) can ask
/// the map to recenter + move the pin programmatically by setting `recenterTo`
/// and bumping `recenterToken`. The token is what triggers the animation, so the
/// same coordinate can be re-applied and repeated searches always re-center.
///
/// Wraps `GMSMapView` in a `UIViewRepresentable`. The camera defaults to the
/// center of Egypt (26.8206, 30.8025) at a country-level zoom until the host
/// taps, so both the Explore map and the add-listing picker open on Egypt.
struct LocationPickerMap: UIViewRepresentable {
    /// The currently chosen coordinate, or `nil` before the first tap.
    @Binding var selection: CLLocationCoordinate2D?

    /// External "move the camera + pin here" target. Applied whenever
    /// `recenterToken` changes to a value the coordinator hasn't seen yet.
    var recenterTo: CLLocationCoordinate2D? = nil

    /// Monotonic trigger. Increment it (alongside setting `recenterTo`) to make
    /// the map animate to `recenterTo` and place the pin there.
    var recenterToken: Int = 0

    /// Default camera center (center of Egypt) used until the host picks a spot.
    static let defaultCenter = CLLocationCoordinate2D(latitude: 26.8206, longitude: 30.8025)

    /// Country-level zoom used when no pin is placed, so the map frames Egypt
    /// rather than a single city or the whole world.
    static let defaultZoom: Float = 5.5

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> GMSMapView {
        let center = selection ?? Self.defaultCenter
        let camera = GMSCameraPosition.camera(
            withLatitude: center.latitude,
            longitude: center.longitude,
            zoom: selection == nil ? Self.defaultZoom : 13
        )
        let options = GMSMapViewOptions()
        options.camera = camera
        let mapView = GMSMapView(options: options)
        mapView.delegate = context.coordinator
        mapView.isMyLocationEnabled = false
        mapView.settings.compassButton = true

        // If a coordinate is already chosen (e.g. view recreated), show its marker.
        if let selection {
            context.coordinator.placeMarker(at: selection, on: mapView)
        }
        // Seed the last-seen token so a stale token doesn't fire on first layout.
        context.coordinator.lastRecenterToken = recenterToken
        return mapView
    }

    func updateUIView(_ mapView: GMSMapView, context: Context) {
        context.coordinator.parent = self

        // 1) Programmatic recenter requested via the search field.
        if recenterToken != context.coordinator.lastRecenterToken {
            context.coordinator.lastRecenterToken = recenterToken
            if let target = recenterTo {
                context.coordinator.placeMarker(at: target, on: mapView)
                let camera = GMSCameraPosition.camera(
                    withLatitude: target.latitude,
                    longitude: target.longitude,
                    zoom: max(mapView.camera.zoom, 14)
                )
                mapView.animate(to: camera)
            }
        }

        // 2) Keep the marker in sync when `selection` is changed programmatically
        // (e.g. cleared). Avoids fighting the user's own taps because the
        // coordinator only writes back through the binding, never re-reads here
        // during interaction.
        if let selection {
            if context.coordinator.marker == nil {
                context.coordinator.placeMarker(at: selection, on: mapView)
            }
        } else {
            context.coordinator.marker?.map = nil
            context.coordinator.marker = nil
        }
    }

    final class Coordinator: NSObject, GMSMapViewDelegate {
        var parent: LocationPickerMap
        var marker: GMSMarker?
        /// Last `recenterToken` the coordinator acted on, to dedupe recenters.
        var lastRecenterToken: Int = 0

        init(_ parent: LocationPickerMap) { self.parent = parent }

        /// Tap-to-place: drop or move the single marker, report the coordinate.
        func mapView(_ mapView: GMSMapView, didTapAt coordinate: CLLocationCoordinate2D) {
            placeMarker(at: coordinate, on: mapView)
            parent.selection = coordinate
        }

        /// Dragging the marker updates the chosen coordinate too.
        func mapView(_ mapView: GMSMapView, didEndDragging marker: GMSMarker) {
            parent.selection = marker.position
        }

        /// Creates the burgundy marker on first use, otherwise repositions it.
        /// Pure UIKit side-effects only — never writes the `selection` binding,
        /// so it's safe to call from `updateUIView`. Call sites that originate a
        /// new coordinate (tap, drag, or the search field) update the binding.
        func placeMarker(at coordinate: CLLocationCoordinate2D, on mapView: GMSMapView) {
            if let marker {
                marker.position = coordinate
                marker.map = mapView
            } else {
                let newMarker = GMSMarker(position: coordinate)
                newMarker.isDraggable = true
                newMarker.icon = GMSMarker.markerImage(with: UIColor(Color.qkBurgundy))
                newMarker.appearAnimation = .pop
                newMarker.map = mapView
                marker = newMarker
            }
        }
    }
}
