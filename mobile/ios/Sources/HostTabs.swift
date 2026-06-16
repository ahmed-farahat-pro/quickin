import SwiftUI

// Host-side tab screens used by the role-aware root TabView (see QuickInApp).
//
// A host sees a different tab set than a guest: Listings · Reservations ·
// Services · Profile (no Explore). Each screen here reuses the existing host
// view models (HostDashboardViewModel, HostServicesViewModel) and the existing
// row/card components (HostListingRow, HostRequestCard, HostServiceRequestCard,
// HostServiceRow) so behaviour matches the old single HostDashboardView — just
// split across dedicated tabs.

// MARK: - Listings tab

/// Host "Listings" tab: an Add-listing entry plus the host's own listings.
/// Reuses `HostDashboardViewModel` for loading + `HostListingRow` for rows and
/// presents the existing `AddListingView` wizard as a sheet.
struct HostListingsTab: View {
    @EnvironmentObject private var loc: LocalizationManager
    @StateObject private var viewModel = HostDashboardViewModel()
    @State private var showingAddListing = false

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()
                content
            }
            .navigationTitle(loc.t("host.listings.title"))
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.qkCream, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showingAddListing = true } label: {
                        Image(systemName: "plus")
                    }
                    .tint(.qkBurgundy)
                }
            }
        }
        .tint(.qkBurgundy)
        .sheet(isPresented: $showingAddListing) {
            AddListingView(onCreated: {
                Task { await viewModel.load() }
            })
        }
        .task {
            if !viewModel.hasLoaded { await viewModel.load() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && !viewModel.hasLoaded {
            ProgressView(loc.t("host.loadingListings"))
                .tint(.qkBurgundy)
                .foregroundStyle(Color.qkMuted)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    addListingCard
                    earningsCard
                    analyticsCard
                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(Color.qkBurgundy)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Text(loc.t("host.yourListings"))
                        .font(.system(.title3, design: .serif).weight(.semibold))
                        .foregroundStyle(Color.qkInk)

                    if viewModel.listings.isEmpty {
                        HostEmptyHint(icon: "house", text: loc.t("host.listings.empty"))
                    } else {
                        ForEach(viewModel.listings) { listing in
                            HostListingRow(listing: listing, onResubmitted: {
                                Task { await viewModel.load() }
                            })
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .refreshable { await viewModel.load() }
        }
    }

    private var addListingCard: some View {
        Button {
            showingAddListing = true
        } label: {
            HStack(spacing: 13) {
                Image(systemName: "house.badge.plus")
                    .font(.title3)
                VStack(alignment: .leading, spacing: 2) {
                    Text(loc.t("host.addListing"))
                        .font(.system(size: 15, weight: .bold))
                    Text(loc.t("host.addListing.subtitle"))
                        .font(.caption)
                        .foregroundStyle(Color.qkCream.opacity(0.82))
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.forward").font(.system(size: 14, weight: .semibold))
            }
            .foregroundStyle(Color.qkCream)
            .padding(16)
            .background(LinearGradient.qkBurgundyPanel)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(color: Color.qkBurgundy.opacity(0.26), radius: 14, x: 0, y: 10)
        }
        .buttonStyle(.qkTap)
    }

    /// Entry into the host earnings/payouts view. A white card (matching the
    /// profile NavigationLink rows) so it reads as secondary to the burgundy
    /// "Add listing" CTA above it.
    private var earningsCard: some View {
        NavigationLink {
            HostEarningsView()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "banknote.fill")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(loc.t("money.earnings"))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.qkInk)
                    Text(loc.t("money.earnings.subtitle"))
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.forward")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.qkTan4)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 15)
            .contentShape(Rectangle())
            .qkCard(cornerRadius: 18)
        }
        .buttonStyle(.qkTap)
    }

    /// Entry into the host analytics dashboard (Section 10). A white card mirroring
    /// the earnings row, so both read as secondary to the burgundy "Add listing".
    private var analyticsCard: some View {
        NavigationLink {
            HostAnalyticsView()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "chart.bar.xaxis")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(loc.t("analytics.title"))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.qkInk)
                    Text(loc.t("analytics.subtitle"))
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.forward")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.qkTan4)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 15)
            .contentShape(Rectangle())
            .qkCard(cornerRadius: 18)
        }
        .buttonStyle(.qkTap)
    }
}

// MARK: - Reservations tab (host inbox)

/// Host "Reservations" tab: incoming booking requests with Confirm / Reject.
/// Reuses `HostDashboardViewModel` + `HostRequestCard` (the same inbox the old
/// HostDashboardView showed).
struct HostReservationsTab: View {
    @EnvironmentObject private var loc: LocalizationManager
    @StateObject private var viewModel = HostDashboardViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()
                content
            }
            .navigationTitle(loc.t("reservations.title"))
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.qkCream, for: .navigationBar)
        }
        .tint(.qkBurgundy)
        .task {
            if !viewModel.hasLoaded { await viewModel.load() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && !viewModel.hasLoaded {
            ProgressView(loc.t("host.loadingRequests"))
                .tint(.qkBurgundy)
                .foregroundStyle(Color.qkMuted)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(Color.qkBurgundy)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if viewModel.requests.isEmpty {
                        HostEmptyHint(icon: "tray", text: loc.t("host.requests.empty"))
                            .padding(.top, 4)
                    } else {
                        ForEach(viewModel.pendingRequests) { booking in
                            HostRequestCard(
                                booking: booking,
                                isUpdating: viewModel.updatingIDs.contains(booking.id),
                                onConfirm: { Task { await viewModel.update(booking, action: .confirm) } },
                                onReject: { Task { await viewModel.update(booking, action: .reject) } }
                            )
                        }
                        if !viewModel.pastRequests.isEmpty {
                            Text(loc.t("common.past"))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color.qkMuted)
                                .padding(.top, 4)
                            ForEach(viewModel.pastRequests) { booking in
                                HostRequestCard(booking: booking, isUpdating: false, onConfirm: nil, onReject: nil)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .refreshable { await viewModel.load() }
        }
    }
}

// MARK: - Services tab (host management)

/// Host "Services" tab: the host's services management — Add service, incoming
/// subscription requests, and the host's published services. Reuses the
/// existing `HostServicesSection` (which owns its own view model + sheet).
struct HostServicesTab: View {
    @EnvironmentObject private var loc: LocalizationManager
    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()
                ScrollView {
                    HostServicesSection()
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .padding(.bottom, 32)
                }
            }
            .navigationTitle(loc.t("services.title"))
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.qkCream, for: .navigationBar)
        }
        .tint(.qkBurgundy)
    }
}

// MARK: - Shared empty hint

/// Cream-card empty hint used across the host tabs. Mirrors the inline
/// `emptyHint` the old HostDashboardView used.
struct HostEmptyHint: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(Color.qkBurgundy.opacity(0.6))
            Text(text)
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .qkCard(cornerRadius: 18)
    }
}
