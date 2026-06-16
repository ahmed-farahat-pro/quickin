import SwiftUI

/// Public host profile, pushed from the "Hosted by …" row on `ListingDetailView`.
///
/// Privacy-safe: shows ONLY what `GET /api/local/users/:id` returns publicly —
/// avatar, name, bio, trust badges, host rating + member-since, the reviews
/// guests left about the host's listings (`GET /api/local/users/:id/reviews`),
/// and the host's other published listings (`GET /api/local/listings?host=:id`).
/// It never shows the host's phone or email (those aren't in the payload).
///
/// Reached via `NavigationLink(value: HostProfileTarget(...))`; the enclosing
/// stack registers the `.navigationDestination(for: HostProfileTarget.self)`.
struct HostProfileView: View {
    /// The seed values from the listing (host id + name) so the header renders
    /// instantly while the full profile loads.
    let hostID: String
    let initialName: String?

    @EnvironmentObject private var loc: LocalizationManager

    // Public profile (avatar / bio / badges / rating). `nil` until loaded.
    @State private var profile: PublicProfile?
    @State private var profileLoaded = false

    // Reviews about the host's listings.
    @State private var reviews: [HostReview] = []
    @State private var reviewsLoaded = false

    // The host's other published listings.
    @State private var listings: [Listing] = []
    @State private var listingsLoaded = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                headerCard
                if let bio = bioText {
                    aboutSection(bio)
                }
                if !listings.isEmpty {
                    listingsSection
                }
                reviewsSection
            }
            .padding(20)
        }
        .background(LinearGradient.qkPageWash.ignoresSafeArea())
        .navigationTitle(displayName)
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadProfile() }
        .task { await loadReviews() }
        .task { await loadListings() }
    }

    // MARK: - Header

    /// Avatar + name + trust badges + a rating / member-since stat row.
    private var headerCard: some View {
        VStack(spacing: 14) {
            QKPhotoAvatar(
                avatarURL: profile?.avatarURL,
                initials: initials,
                size: 96,
                gold: true
            )

            VStack(spacing: 4) {
                Text(displayName)
                    .font(.system(.title2, design: .serif).weight(.bold))
                    .foregroundStyle(Color.qkInk)
                    .multilineTextAlignment(.center)
                Text(loc.t("host.profile.subtitle"))
                    .font(.system(size: 13))
                    .foregroundStyle(Color.qkMuted)
            }

            if let badges = profile?.badges {
                QKTrustBadgesRow(badges: badges)
            }

            statRow
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .qkCard(lifts: false)
    }

    /// Host rating (when rated) + member-since (when known), as a centered row of
    /// stat pills. Hidden entirely when neither is available.
    @ViewBuilder
    private var statRow: some View {
        let badges = profile?.badges
        let showRating = (badges?.hostRating ?? 0) > 0
        let memberYear = memberSinceYear
        if showRating || memberYear != nil {
            HStack(spacing: 10) {
                if showRating, let badges {
                    statPill(
                        icon: "star.fill",
                        tint: .qkGold,
                        value: String(format: "%.1f", badges.hostRating),
                        label: loc.t("host.profile.rating")
                    )
                }
                if let memberYear {
                    statPill(
                        icon: "calendar",
                        tint: .qkBurgundy,
                        value: memberYear,
                        label: loc.t("host.profile.memberSince")
                    )
                }
            }
        }
    }

    private func statPill(icon: String, tint: Color, value: String, label: String) -> some View {
        VStack(spacing: 4) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(tint)
                Text(value)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color.qkInk)
                    .monospacedDigit()
            }
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(Color.qkMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .padding(.horizontal, 10)
        .background(Color.qkCream)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.qkInk.opacity(0.06), lineWidth: 1)
        )
    }

    // MARK: - About

    private func aboutSection(_ bio: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(loc.t("host.profile.about"))
                .font(.title3).fontWeight(.semibold)
                .foregroundStyle(Color.qkInk)
            Text(bio)
                .font(.body)
                .foregroundStyle(Color.qkMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Other listings

    /// The host's other published listings — each pushes its own
    /// `ListingDetailView` via the enclosing stack's `Listing` destination.
    private var listingsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(loc.t("host.profile.listings"))
                .font(.title3).fontWeight(.semibold)
                .foregroundStyle(Color.qkInk)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 14) {
                    ForEach(listings) { listing in
                        NavigationLink(value: listing) {
                            ListingCard(listing: listing)
                                // Responsive width: ~78% of the viewport (a sliver
                                // of the next card peeks), clamped on wide screens.
                                .containerRelativeFrame(
                                    .horizontal,
                                    count: 100, span: 78, spacing: 0
                                )
                                .frame(maxWidth: 320)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
                .scrollTargetLayout()
            }
            // Leading/trailing inset so the first/last card isn't cut off
            // (RTL-safe). Counteract the parent's 20pt inset so the rail spans
            // full-width and content margins handle the edge spacing.
            .contentMargins(.horizontal, 20, for: .scrollContent)
            .scrollTargetBehavior(.viewAligned)
            .padding(.horizontal, -20)
            .scrollClipDisabled()
        }
    }

    // MARK: - Reviews

    /// Reviews guests left about the host's listings. Shows a ★ summary count and
    /// each review (reusing the same look as the listing-detail review row), plus
    /// the listing each review was about. Empty hint when there are none.
    private var reviewsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "star.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(Color.qkGold)
                Text(loc.t("host.profile.reviews"))
                    .font(.title3).fontWeight(.semibold)
                    .foregroundStyle(Color.qkInk)
                if !reviews.isEmpty {
                    Text("·")
                        .foregroundStyle(Color.qkMuted)
                    Text(reviewCountText(reviews.count))
                        .font(.title3).fontWeight(.semibold)
                        .foregroundStyle(Color.qkMuted)
                }
            }

            if reviews.isEmpty {
                Text(loc.t("host.profile.reviews.empty"))
                    .font(.subheadline)
                    .foregroundStyle(Color.qkMuted)
            } else {
                VStack(spacing: 12) {
                    ForEach(reviews) { review in
                        HostReviewRow(review: review)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// "12 reviews" / "1 review" using the shared singular/plural keys.
    private func reviewCountText(_ n: Int) -> String {
        String(format: loc.t(n == 1 ? "reviews.count" : "reviews.count.plural"), n)
    }

    // MARK: - Loaders

    private func loadProfile() async {
        guard !profileLoaded else { return }
        profileLoaded = true
        profile = try? await TrustService.shared.fetchPublicProfile(userID: hostID)
    }

    private func loadReviews() async {
        guard !reviewsLoaded else { return }
        reviewsLoaded = true
        reviews = (try? await TrustService.shared.fetchUserReviews(userID: hostID)) ?? []
    }

    private func loadListings() async {
        guard !listingsLoaded else { return }
        listingsLoaded = true
        listings = (try? await SupabaseService.shared.fetchHostListings(hostID: hostID)) ?? []
    }

    // MARK: - Derived

    /// The host's display name: the loaded profile name, else the seed name from
    /// the listing, else a generic "Host".
    private var displayName: String {
        if let name = profile?.fullName?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty {
            return name
        }
        if let seed = initialName?.trimmingCharacters(in: .whitespacesAndNewlines), !seed.isEmpty {
            return seed
        }
        return loc.t("common.host")
    }

    /// The bio text, trimmed; `nil` when absent or blank.
    private var bioText: String? {
        let trimmed = profile?.bio?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (trimmed?.isEmpty == false) ? trimmed : nil
    }

    /// Up to two uppercase initials from the display name (falls back to "H").
    private var initials: String {
        let parts = displayName.split(separator: " ").prefix(2).compactMap { $0.first }
        let result = String(parts).uppercased()
        return result.isEmpty ? "H" : result
    }

    /// The year the host joined, parsed from `badges.memberSince` (an ISO
    /// timestamp or a bare year string). `nil` when absent / unparseable.
    private var memberSinceYear: String? {
        guard let raw = profile?.badges.memberSince?.trimmingCharacters(in: .whitespacesAndNewlines),
              !raw.isEmpty else { return nil }
        // Already a 4-digit year?
        if raw.count == 4, Int(raw) != nil { return raw }
        // Parse an ISO-8601 timestamp and take its year.
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: raw) ?? {
            let plain = ISO8601DateFormatter()
            plain.formatOptions = [.withInternetDateTime]
            return plain.date(from: raw)
        }() {
            return String(Calendar.current.component(.year, from: date))
        }
        // Tolerate a plain `yyyy-MM-dd`.
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd"
        if let date = df.date(from: raw) {
            return String(Calendar.current.component(.year, from: date))
        }
        return nil
    }
}

/// Lightweight value used to push `HostProfileView` via `NavigationLink(value:)`.
/// Carries the host id (for the fetch) + the name we already know (for an instant
/// title) — never any private contact info.
struct HostProfileTarget: Hashable {
    let hostID: String
    let name: String?
}

/// A single host-review row: gold-initials avatar, reviewer name + month, gold
/// stars, the comment, the listing it was about, and any attached photos.
/// Mirrors `ReviewRow` (listing detail) so the two read identically. RTL-safe.
struct HostReviewRow: View {
    @EnvironmentObject private var loc: LocalizationManager
    let review: HostReview

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                QKAvatar(initials: initials, size: 40, gold: true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(review.displayName)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.qkInk)
                        .lineLimit(1)
                    if !review.monthText.isEmpty {
                        Text(review.monthText)
                            .font(.caption)
                            .foregroundStyle(Color.qkMuted)
                    }
                }
                Spacer(minLength: 8)
                QKStarsDisplay(rating: review.rating)
            }

            if let comment = review.comment?.trimmingCharacters(in: .whitespacesAndNewlines),
               !comment.isEmpty {
                Text(comment)
                    .font(.subheadline)
                    .foregroundStyle(Color.qkInk.opacity(0.88))
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Which listing this review was about (e.g. "Stay · Seaside Villa").
            if let title = review.listingTitleTrimmed {
                Label(title, systemImage: "house")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Color.qkMuted)
                    .labelStyle(.titleAndIcon)
                    .lineLimit(1)
            }

            if !review.photos.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(review.photos.enumerated()), id: \.offset) { _, url in
                            ReviewPhotoThumbnail(urlString: url, size: 84)
                        }
                    }
                    .padding(.top, 2)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .qkCard(cornerRadius: 18, lifts: false)
    }

    /// Up to two uppercase initials from the reviewer name (falls back to "G").
    private var initials: String {
        let source = review.reviewerName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let parts = source.split(separator: " ").prefix(2).compactMap { $0.first }
        let result = String(parts).uppercased()
        return result.isEmpty ? "G" : result
    }
}
