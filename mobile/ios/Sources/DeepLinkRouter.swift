import SwiftUI

/// Drives navigation from incoming Universal Links / custom-scheme URLs.
///
/// The app root (`RootView`) installs `.onOpenURL` + `.onContinueUserActivity`
/// and forwards the URL here via `handle(_:)`. We parse it (`AppLinks`), resolve
/// the entity by id against the existing local API, then publish a `Route` that
/// `RootView` presents as a full-screen guest detail. Unknown / garbage links
/// are ignored — the app just opens normally, never crashes.
@MainActor
final class DeepLinkRouter: ObservableObject {
    /// A resolved destination, ready to present. Listings need the full `Listing`
    /// (the detail view renders it directly); services likewise; reservations
    /// only need the id (the detail view fetches by id).
    enum Route: Identifiable {
        /// `focusComments`: opened from a comment notification (or a
        /// `#comments` link) — the detail scrolls to "Questions & comments".
        case listing(Listing, focusComments: Bool = false)
        case service(Service)
        case reservation(id: String)
        /// The host dashboard — from a `/host` notification (hosts only).
        case hostDashboard
        /// "My subscriptions" — from a `/subscriptions` notification.
        case subscriptions

        var id: String {
            switch self {
            case .listing(let l, _): return "listing-\(l.id)"
            case .service(let s): return "service-\(s.id)"
            case .reservation(let id): return "reservation-\(id)"
            case .hostDashboard: return "host-dashboard"
            case .subscriptions: return "subscriptions"
            }
        }
    }

    /// The destination currently being presented (drives a `.fullScreenCover`).
    @Published var route: Route?
    /// True while we're fetching the entity for an incoming link (shows a spinner).
    @Published var isResolving = false

    /// Entry point for both Universal Links and the custom scheme. Parses the URL
    /// and, if it maps to a known destination, resolves + presents it. No-ops for
    /// anything we don't recognise.
    func handle(_ url: URL) {
        guard let destination = AppLinks.destination(from: url) else { return }
        let focusComments = url.fragment?.lowercased() == "comments"
        Task { await resolve(destination, focusComments: focusComments) }
    }

    /// A tapped notification — in-app feed row (`type` known) or push (`type`
    /// nil, only the `link` travels in the payload). `NotificationLinkRules`
    /// maps the link to a destination: an entity (listing / service /
    /// reservation) or the host dashboard / subscriptions open over the
    /// current tab like any deep link; Trips and Profile switch tabs.
    /// `/messages`, `/ops`, blank and unknown links open nothing.
    ///
    /// Returns the destination so the caller can get out of the way (the
    /// feed pops itself when the destination is the Profile tab it sits on).
    @discardableResult
    func openNotification(type: String?, link: String?, isHost: Bool) -> NotificationLinkRules.Destination? {
        guard let destination = NotificationLinkRules.destination(type: type, link: link, isHost: isHost) else {
            return nil
        }
        switch destination {
        case let .listing(id, focusComments):
            Task { await resolve(.listing(id: id), focusComments: focusComments) }
        case .service(let id):
            Task { await resolve(.service(id: id)) }
        case .reservation(let id):
            Task { await resolve(.reservation(id: id)) }
        case .hostDashboard:
            route = .hostDashboard
        case .subscriptions:
            route = .subscriptions
        case .reservations:
            AppNavigation.shared.pendingSection = .reservations
        case .account:
            AppNavigation.shared.pendingSection = .profile
        }
        return destination
    }

    /// Fetch the entity for a parsed destination and publish the route. Failures
    /// (bad id, offline, 404) leave the app on whatever screen it was showing.
    private func resolve(_ destination: AppLinks.Destination, focusComments: Bool = false) async {
        isResolving = true
        defer { isResolving = false }

        switch destination {
        case .listing(let id):
            if let listing = try? await SupabaseService.shared.fetchListing(id: id) {
                route = .listing(listing, focusComments: focusComments)
            }
        case .service(let id):
            if let service = try? await ServiceService.shared.fetchService(id: id) {
                route = .service(service)
            }
        case .reservation(let id):
            // The reservation detail view fetches its own data by id (and gates
            // on sign-in), so we present it directly without a pre-fetch.
            route = .reservation(id: id)
        }
    }
}

/// Wraps the deep-linked detail in its own `NavigationStack` so it presents
/// consistently regardless of which tab (guest or host) is frontmost — routing
/// the link into the GUEST detail experience. A close button dismisses it.
struct DeepLinkDetailHost: View {
    let route: DeepLinkRouter.Route
    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            destination
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button {
                            dismiss()
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Color.qkBurgundy)
                        }
                        .accessibilityLabel(loc.t("common.close"))
                    }
                }
        }
        .tint(.qkBurgundy)
    }

    @ViewBuilder
    private var destination: some View {
        switch route {
        case let .listing(listing, focusComments):
            ListingDetailView(listing: listing, focusComments: focusComments)
        case .service(let service):
            ServiceDetailView(service: service)
        case .reservation(let id):
            ReservationDetailView(bookingID: id)
        case .hostDashboard:
            HostDashboardView()
        case .subscriptions:
            MySubscriptionsView()
        }
    }
}
