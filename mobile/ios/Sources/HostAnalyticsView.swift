import SwiftUI

// Section 10 — Host analytics dashboard.
//
// Reachable from the host "Listings" tab. Shows a hero revenue panel, a grid of
// stat cards (listings, total/paid bookings, avg rating, conversion), a monthly
// bookings/revenue trend drawn with plain SwiftUI shapes (no chart dependency),
// and a "Top listings" list. All money arrives in EGP and is converted for
// DISPLAY only via the injected `CurrencyManager`. Bilingual + RTL-safe via
// leading/trailing layout and DesignKit tokens.

/// Loads the signed-in host's analytics for `HostAnalyticsView`.
@MainActor
final class HostAnalyticsViewModel: ObservableObject {
    @Published var analytics: HostAnalytics?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var hasLoaded = false

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            analytics = try await HostService.shared.fetchAnalytics()
        } catch HostError.notSignedIn {
            errorMessage = L.t("money.signInHost")
        } catch let HostError.forbidden(message) {
            errorMessage = message
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
        hasLoaded = true
    }
}

/// The host analytics dashboard. Pull-to-refresh; respects the chosen display
/// currency for all monetary values.
struct HostAnalyticsView: View {
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var currency: CurrencyManager
    @StateObject private var viewModel = HostAnalyticsViewModel()

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            content
        }
        .navigationTitle(loc.t("analytics.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Color.qkCream, for: .navigationBar)
        .tint(.qkBurgundy)
        .task { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && !viewModel.hasLoaded {
            ProgressView()
                .tint(.qkBurgundy)
                .foregroundStyle(Color.qkMuted)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(Color.qkBurgundy)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if let analytics = viewModel.analytics {
                        revenueHero(analytics)
                        statGrid(analytics)
                        trendSection(analytics)
                        topListingsSection(analytics)
                    } else if viewModel.errorMessage == nil {
                        HostEmptyHint(icon: "chart.bar", text: loc.t("analytics.noData"))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .refreshable { await viewModel.load() }
        }
    }

    // MARK: - Revenue hero

    /// Burgundy-gradient hero: total revenue + the paid-bookings subline.
    private func revenueHero(_ a: HostAnalytics) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            QKEyebrow(text: loc.t("analytics.revenue"), color: Color.qkCream.opacity(0.85))
            Text(currency.format(a.revenue))
                .font(.system(size: 34, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.qkCream)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            Text(loc.t("analytics.bookingsCount")
                .replacingOccurrences(of: "%@", with: "\(a.paidBookings)"))
                .font(.caption)
                .foregroundStyle(Color.qkCream.opacity(0.82))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(LinearGradient.qkBurgundyPanel)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: Color.qkBurgundy.opacity(0.26), radius: 14, x: 0, y: 10)
    }

    // MARK: - Stat grid

    /// A two-column grid of stat tiles. Conversion shows a percent; the rating
    /// tile shows "—" until the host has any reviews.
    private func statGrid(_ a: HostAnalytics) -> some View {
        let columns = [
            GridItem(.flexible(), spacing: 12),
            GridItem(.flexible(), spacing: 12),
        ]
        return LazyVGrid(columns: columns, spacing: 12) {
            AnalyticsStatTile(
                icon: "house.fill",
                label: loc.t("analytics.listings"),
                value: "\(a.listings)",
                tint: .qkBurgundy
            )
            AnalyticsStatTile(
                icon: "calendar",
                label: loc.t("analytics.bookings"),
                value: "\(a.totalBookings)",
                tint: .qkBurgundy
            )
            AnalyticsStatTile(
                icon: "checkmark.seal.fill",
                label: loc.t("analytics.paidBookings"),
                value: "\(a.paidBookings)",
                tint: .qkSuccess
            )
            AnalyticsStatTile(
                icon: "star.fill",
                label: loc.t("analytics.avgRating"),
                value: a.hasRating ? String(format: "%.1f", a.avgRating) : "—",
                tint: .qkGoldDeep,
                footnote: a.reviewCount > 0
                    ? loc.t("analytics.reviews").replacingOccurrences(of: "%@", with: "\(a.reviewCount)")
                    : nil
            )
            AnalyticsStatTile(
                icon: "percent",
                label: loc.t("analytics.conversion"),
                value: "\(a.conversionPercent)%",
                tint: .qkBurgundy
            )
            AnalyticsStatTile(
                icon: "slash.circle.fill",
                label: loc.t("analytics.cancelled"),
                value: "\(a.cancelledBookings)",
                tint: .qkMuted
            )
        }
    }

    // MARK: - Monthly trend

    /// "Monthly trend" — a row of vertical bars (one per month) sized to the
    /// peak month's revenue, with the month label + booking count beneath.
    @ViewBuilder
    private func trendSection(_ a: HostAnalytics) -> some View {
        Text(loc.t("analytics.monthlyTrend"))
            .font(.system(.title3, design: .serif).weight(.semibold))
            .foregroundStyle(Color.qkInk)
            .padding(.top, 4)

        if a.byMonth.isEmpty {
            HostEmptyHint(icon: "chart.bar", text: loc.t("analytics.noData"))
        } else {
            MonthlyTrendChart(months: a.byMonth, peak: a.peakMonthlyRevenue)
                .padding(16)
                .qkCard(cornerRadius: 18)
        }
    }

    // MARK: - Top listings

    @ViewBuilder
    private func topListingsSection(_ a: HostAnalytics) -> some View {
        Text(loc.t("analytics.topListings"))
            .font(.system(.title3, design: .serif).weight(.semibold))
            .foregroundStyle(Color.qkInk)
            .padding(.top, 4)

        if a.topListings.isEmpty {
            HostEmptyHint(icon: "list.star", text: loc.t("analytics.noData"))
        } else {
            VStack(spacing: 12) {
                ForEach(Array(a.topListings.enumerated()), id: \.element.id) { index, listing in
                    TopListingRow(rank: index + 1, listing: listing)
                }
            }
        }
    }
}

// MARK: - Stat tile

/// One stat tile (icon + label + value, optional footnote). A white card; the
/// value carries the tile's tint.
private struct AnalyticsStatTile: View {
    let icon: String
    let label: String
    let value: String
    var tint: Color = .qkBurgundy
    var footnote: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(tint)
            Text(label)
                .font(.caption)
                .foregroundStyle(Color.qkMuted)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(value)
                .font(.system(size: 22, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.qkInk)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            if let footnote {
                Text(footnote)
                    .font(.caption2)
                    .foregroundStyle(Color.qkMuted)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 96, alignment: .topLeading)
        .padding(14)
        .qkCard(cornerRadius: 18)
    }
}

// MARK: - Monthly trend chart

/// A dependency-free monthly bookings/revenue bar chart drawn with SwiftUI
/// shapes. Each bar's height is proportional to that month's revenue vs. the
/// series peak; the booking count is shown above the bar and the month label
/// beneath. RTL-safe — the `HStack` mirrors automatically.
private struct MonthlyTrendChart: View {
    @EnvironmentObject private var currency: CurrencyManager
    let months: [AnalyticsMonth]
    let peak: Double

    /// Max bar height in points; zero-revenue months still show a thin stub.
    private let maxBarHeight: CGFloat = 120

    var body: some View {
        HStack(alignment: .bottom, spacing: 10) {
            ForEach(months) { month in
                bar(for: month)
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
    }

    private func bar(for month: AnalyticsMonth) -> some View {
        let fraction = peak > 0 ? CGFloat(month.revenue / peak) : 0
        // Keep a visible stub (6pt) even for empty months so the axis reads.
        let height = max(maxBarHeight * fraction, month.revenue > 0 ? 10 : 6)
        return VStack(spacing: 6) {
            // Booking count above the bar (only when there were any).
            Text(month.bookings > 0 ? "\(month.bookings)" : " ")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Color.qkBurgundy)
                .lineLimit(1)

            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(month.revenue > 0
                      ? AnyShapeStyle(LinearGradient.qkBurgundyCTA)
                      : AnyShapeStyle(Color.qkTan))
                .frame(height: height)
                .frame(maxWidth: .infinity)

            Text(month.shortLabel)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.qkMuted)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(month.month): \(month.bookings) bookings, \(currency.format(month.revenue))")
    }
}

// MARK: - Top listing row

/// One row in the "Top listings" list: a rank badge, the listing title, its
/// booking count, and its revenue (converted to the display currency).
private struct TopListingRow: View {
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var currency: CurrencyManager
    let rank: Int
    let listing: TopListing

    var body: some View {
        HStack(spacing: 12) {
            // Rank badge.
            ZStack {
                Circle()
                    .fill(rank == 1 ? AnyShapeStyle(LinearGradient.qkBurgundyCTA)
                                    : AnyShapeStyle(Color.qkTan))
                    .frame(width: 34, height: 34)
                Text("\(rank)")
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(rank == 1 ? Color.qkCream : Color.qkBurgundy)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(listing.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.qkInk)
                    .lineLimit(2)
                Text(loc.t("analytics.bookingsCount")
                    .replacingOccurrences(of: "%@", with: "\(listing.bookings)"))
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
            }
            Spacer(minLength: 8)

            Text(currency.format(listing.revenue))
                .font(.system(size: 16, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.qkBurgundy)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
        }
        .padding(16)
        .qkCard(cornerRadius: 18)
    }
}
