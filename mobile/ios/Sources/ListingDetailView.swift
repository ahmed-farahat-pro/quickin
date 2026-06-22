import SwiftUI

struct ListingDetailView: View {
    let listing: Listing
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var wishlist: WishlistStore
    @EnvironmentObject private var currency: CurrencyManager
    @State private var selectedImage = 0

    // Reviews
    @State private var reviews: [Review] = []

    // "More from this host" — the host's other published listings (current
    // listing excluded). Loaded on appear; the section hides itself when empty.
    @State private var hostListings: [Listing] = []

    // Host trust badges — fetched from the public-profile endpoint so the host
    // row can show the full Verified / Superhost / New host chip set. Falls back
    // to the listing's `host_verified` flag while loading / on failure.
    @State private var hostBadges: TrustBadges?

    // Reporting — presents the report sheet (requires sign-in; otherwise routes
    // through the existing auth sheet first).
    @State private var showingReport = false

    // Reserve inputs
    @State private var checkIn = Calendar.current.startOfDay(for: Date())
    @State private var checkOut = Calendar.current.date(byAdding: .day, value: 3, to: Date()) ?? Date()
    @State private var adults = 1
    @State private var children = 0
    @State private var infants = 0
    @State private var pets = 0
    /// Total headcount = adults + children (infants and pets don't count toward capacity).
    private var guests: Int { adults + children }
    /// Presents the branded `DateRangePicker` for the reserve dates.
    @State private var showingDatePicker = false

    // Live availability — booked + host-blocked spans for this listing. Loaded
    // on appear and fed to the date picker so taken days grey out.
    @State private var availability: [AvailabilityRange] = []
    /// Presents the host availability manager (only when the signed-in user is
    /// the host of this listing).
    @State private var showingAvailabilityManager = false

    // Reserve flow state
    @State private var isReserving = false
    @State private var reserveError: String?
    @State private var confirmation: Booking?
    @State private var showingAuth = false
    /// The freshly-created booking awaiting (mock) payment. Set on a successful
    /// reserve → drives the `PaymentSheet`. Cleared once paid or dismissed.
    @State private var pendingPayment: Booking?

    // Seasonal pricing quote — the authoritative price for the chosen dates from
    // `POST /api/local/listings/:id/quote`. Fetched (debounced) whenever the
    // dates change; the reserve total falls back to the naive client estimate
    // while loading or if the call fails.
    @State private var quote: StayQuote?
    @State private var isQuoting = false
    /// Monotonic token so a stale debounced quote task can detect it was
    /// superseded by a newer date change and bail out before publishing.
    @State private var quoteToken = 0

    /// Whole nights between check-in and check-out (minimum 1).
    private var nights: Int {
        let days = Calendar.current.dateComponents([.day], from: checkIn, to: checkOut).day ?? 0
        return max(days, 1)
    }

    private var total: Int { nights * Int(listing.pricePerNight) }

    /// The naive client-side estimate (base nightly × nights), used as the
    /// fallback total before the authoritative quote resolves / on failure.
    private var estimateEGP: Double { Double(nights) * listing.pricePerNight }

    /// The total to charge/display in EGP: the authoritative quote `total` when
    /// available (and matching the current night count), else the naive estimate.
    private var totalEGP: Double {
        if let quote, quote.nights == nights { return quote.total }
        return estimateEGP
    }

    /// "Aug 1 → Aug 4" label for the reserve dates row.
    private var dateRangeLabel: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "MMM d"
        return "\(f.string(from: checkIn)) → \(f.string(from: checkOut))"
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    gallery
                        .overlay(alignment: .topTrailing) {
                            HStack(spacing: 10) {
                                shareButton
                                favoriteHeart
                            }
                            .padding(14)
                        }
                    VStack(alignment: .leading, spacing: 16) {
                        header
                        if hasHost {
                            Divider()
                            hostRow
                        }
                        Divider()
                        reportRow
                        Divider()
                        specs
                        if let description = listing.description, !description.isEmpty {
                            Divider()
                            VStack(alignment: .leading, spacing: 8) {
                                Text(loc.t("detail.about"))
                                    .font(.title3).fontWeight(.semibold)
                                    .foregroundStyle(Color.qkInk)
                                Text(description)
                                    .font(.body)
                                    .foregroundStyle(Color.qkMuted)
                            }
                        }
                        if !listing.amenities.isEmpty {
                            Divider()
                            amenitiesSection
                        }
                        Divider()
                        cancellationPolicySection
                        Divider()
                        reviewsSection
                        if !hostListings.isEmpty {
                            Divider()
                            moreFromHostSection
                        }
                        Divider()
                        reservePanel.id("reserve")
                    }
                    .padding(20)
                }
            }
            .onAppear {
                // CLI screenshot hook: scroll the reserve panel into view.
                if UserDefaults.standard.bool(forKey: "uitestScroll") {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                        withAnimation { proxy.scrollTo("reserve", anchor: .top) }
                    }
                }
            }
        }
        .background(LinearGradient.qkPageWash.ignoresSafeArea())
        .navigationTitle(listing.title)
        .navigationBarTitleDisplayMode(.inline)
        // Tapping the host row pushes the public host profile. Registered here so
        // it resolves no matter which stack presented this detail screen.
        .navigationDestination(for: HostProfileTarget.self) { target in
            HostProfileView(hostID: target.hostID, initialName: target.name)
        }
        .safeAreaInset(edge: .bottom) { bookingBar }
        .sheet(isPresented: $showingDatePicker) {
            DateRangePicker(
                checkIn: Binding(get: { checkIn }, set: { if let v = $0 { checkIn = v } }),
                checkOut: Binding(get: { checkOut }, set: { if let v = $0 { checkOut = v } }),
                unavailableRanges: availability
            ) { ci, co in
                if let ci { checkIn = ci }
                // Keep check-out strictly after check-in; default to +1 night when
                // the user picked only a check-in (or an invalid same-day range).
                if let co, co > (ci ?? checkIn) {
                    checkOut = co
                } else if let ci {
                    checkOut = Calendar.current.date(byAdding: .day, value: 1, to: ci) ?? ci
                }
            }
        }
        .sheet(isPresented: $showingAuth) {
            AuthView().environmentObject(auth)
        }
        .sheet(item: $pendingPayment) { booking in
            // Mock payment for the just-created booking. On success the booking
            // is paid + confirmed; we then show the existing confirmation modal.
            PaymentSheet(
                bookingID: booking.id,
                nightly: Int(listing.pricePerNight),
                nights: nights
            ) { _ in
                // Reflect paid + confirmed locally so the confirmation modal
                // reads "Reservation confirmed" rather than "Request sent".
                confirmation = booking.markedPaidConfirmed()
            }
            .environmentObject(loc)
        }
        .onChange(of: auth.isAuthenticated) { _, isAuthed in
            if isAuthed { showingAuth = false }
        }
        .onChange(of: checkIn) { _, _ in scheduleQuote() }
        .onChange(of: checkOut) { _, _ in scheduleQuote() }
        .task {
            // Initial authoritative quote for the default date range.
            await loadQuote()
        }
        .task {
            // Load real guest reviews for this listing (public endpoint).
            reviews = (try? await ReviewService.shared.fetchReviews(listingID: listing.id)) ?? []
        }
        .task {
            await loadHostListings()
        }
        .task {
            await loadHostProfile()
        }
        .task {
            await loadAvailability()
        }
        .sheet(isPresented: $showingReport) {
            ReportSheet(targetType: .listing, targetID: listing.id)
                .environmentObject(loc)
                .environmentObject(auth)
        }
        .sheet(isPresented: $showingAvailabilityManager, onDismiss: {
            // The host may have added/removed blocks — refresh the guest-facing
            // greyed-out days so the reserve calendar stays in sync.
            Task { await loadAvailability() }
        }) {
            AvailabilityManagerView(listing: listing)
                .environmentObject(auth)
                .environmentObject(loc)
        }
        .overlay { confirmationOverlay }
    }

    /// The favorite heart pinned to the gallery's top-trailing corner. Reflects
    /// the shared wishlist state; toggles optimistically when signed in,
    /// otherwise presents the sign-in sheet.
    private var favoriteHeart: some View {
        QKHeartButton(
            isOn: Binding(
                get: { wishlist.isListingSaved(listing.id) },
                set: { _ in }
            ),
            size: 40
        ) {
            guard auth.isAuthenticated else { showingAuth = true; return }
            wishlist.toggleListing(listing.id)
        }
    }

    /// Share this listing's public web URL. The link opens the website if the
    /// app isn't installed, or this same screen (Universal Link) if it is.
    private var shareButton: some View {
        QKShareButton(
            url: AppLinks.listing(listing.id),
            title: String(format: loc.t("share.listing.title"), listing.title),
            message: loc.t("share.listing.message"),
            size: 40
        )
    }

    /// Bookings now come back as `pending` (the host must confirm). Title +
    /// subtitle adapt so the guest knows the request is awaiting approval.
    private var confirmationTitle: String {
        loc.t((confirmation?.bookingStatus == .pending) ? "detail.requestSent" : "detail.reservationConfirmed")
    }

    /// Friendly one-liner under the title; pluralizes "night" correctly.
    private var confirmationSubtitle: String {
        guard let confirmation else { return "" }
        let nightsText = "\(nights) night\(nights == 1 ? "" : "s")"
        if confirmation.bookingStatus == .pending {
            return "Waiting for the host to confirm your \(nightsText) at \(listing.title)."
        }
        return "You're booked at \(listing.title) for \(nightsText)."
    }

    /// Dismiss the branded confirmation modal with a gentle fade.
    private func dismissConfirmation() {
        withAnimation(.easeInOut(duration: 0.2)) { confirmation = nil }
    }

    // MARK: - Confirmation modal

    /// Branded "Request sent" / "Reservation confirmed" overlay shown after a
    /// successful reserve, replacing the native system alert.
    @ViewBuilder
    private var confirmationOverlay: some View {
        if let confirmation {
            ZStack {
                // Dimmed, tap-to-dismiss backdrop.
                Color.black.opacity(0.45)
                    .ignoresSafeArea()
                    .onTapGesture { dismissConfirmation() }

                confirmationCard(for: confirmation)
                    .transition(.opacity.combined(with: .scale(scale: 0.96)))
            }
            .animation(.easeInOut(duration: 0.2), value: confirmation)
        }
    }

    private func confirmationCard(for booking: Booking) -> some View {
        let isPending = booking.bookingStatus == .pending
        return VStack(spacing: 16) {
            // Badge — animated draw checkmark when confirmed; a popping
            // paperplane while the host's approval is still pending.
            if isPending {
                QKPopIn {
                    Circle()
                        .fill(LinearGradient.qkBurgundyCTA)
                        .frame(width: 72, height: 72)
                        .overlay(
                            Image(systemName: "paperplane.fill")
                                .font(.system(size: 28, weight: .semibold))
                                .foregroundStyle(Color.qkCream)
                        )
                        .shadow(color: Color.qkBurgundy.opacity(0.25), radius: 14, x: 0, y: 8)
                }
            } else {
                QKDrawCheck(size: 72, light: true)
            }

            // Title + subtitle
            VStack(spacing: 6) {
                Text(confirmationTitle)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Color.qkInk)
                    .multilineTextAlignment(.center)
                Text(confirmationSubtitle)
                    .font(.system(size: 15))
                    .foregroundStyle(Color.qkMuted)
                    .multilineTextAlignment(.center)
            }

            // Summary block
            VStack(spacing: 10) {
                HStack {
                    Text(booking.dateRangeText)
                    Text("·")
                    Text("\(booking.guests) guest\(booking.guests == 1 ? "" : "s")")
                    Spacer()
                }
                .font(.system(size: 13))
                .foregroundStyle(Color.qkMuted)

                Divider()

                HStack {
                    Text(loc.t("common.total"))
                        .foregroundStyle(Color.qkMuted)
                    Spacer()
                    Text(booking.totalText)
                        .fontWeight(.bold)
                        .foregroundStyle(Color.qkBurgundy)
                }
                .font(.system(size: 15))
            }
            .padding(14)
            .frame(maxWidth: .infinity)
            .background(Color.qkTan)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            // Primary action
            Button {
                dismissConfirmation()
            } label: {
                QKPrimaryButtonLabel(title: loc.t("common.done"), height: 50)
            }
            .buttonStyle(QKPressStyle())
        }
        .padding(24)
        .frame(maxWidth: 340)
        .background(Color.qkSurface)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .strokeBorder(Color.black.opacity(0.06), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.18), radius: 24, x: 0, y: 12)
        .padding(24)
    }

    /// Fixed height for the hero gallery. Keeping this a constant (rather than
    /// letting the image's intrinsic pixel size drive it) is what stops a large
    /// photo from stretching the whole detail page.
    private static let galleryHeight: CGFloat = 300

    @ViewBuilder
    private var gallery: some View {
        let urls = listing.sortedImageURLs
        if urls.isEmpty {
            // No photos → a single full-width branded placeholder (no stock image).
            PhotoPlaceholder(iconSize: 44)
                .frame(maxWidth: .infinity)
                .frame(height: Self.galleryHeight)
                .clipped()
        } else if urls.count == 1 {
            // Single hero → slow Ken Burns zoom, like the mockup. The image is
            // pinned to a fixed-height, full-width frame and clipped BEFORE the
            // Ken Burns scale so its native pixel size can never size the page;
            // the zoom then animates safely within that clipped box.
            ListingImageView(url: urls[0], placeholderIconSize: 44)
                .frame(maxWidth: .infinity, minHeight: Self.galleryHeight, maxHeight: Self.galleryHeight)
                .clipped()
                .kenBurns()
                .clipped()
        } else {
            TabView(selection: $selectedImage) {
                ForEach(Array(urls.enumerated()), id: \.offset) { index, url in
                    ListingImageView(url: url, placeholderIconSize: 44)
                        .frame(maxWidth: .infinity, minHeight: Self.galleryHeight, maxHeight: Self.galleryHeight)
                        .clipped()
                        .tag(index)
                }
            }
            // The TabView itself gets an explicit height so the pager doesn't
            // inherit the (now-contained) image's intrinsic size.
            .frame(height: Self.galleryHeight)
            .tabViewStyle(.page(indexDisplayMode: urls.count > 1 ? .always : .never))
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            if listing.isGuestFavorite == true {
                QKPopIn {
                    QKGuestFavoriteBadge(text: loc.t("explore.guestFavorite"))
                }
            }
            if let region = listing.region, !region.isEmpty {
                QKEyebrow(text: region)
            }
            Text(listing.title)
                .font(.system(.title, design: .serif).weight(.bold))
                .foregroundStyle(Color.qkInk)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                // Real rating + review count when the place has reviews;
                // a gold-flavored "New" pill otherwise.
                if listing.hasRating {
                    QKStarRating(value: listing.rating, size: 14)
                    Text("·")
                        .foregroundStyle(Color.qkMuted)
                    Text(reviewCountText(listing.reviewCount))
                        .font(.system(size: 14))
                        .foregroundStyle(Color.qkMuted)
                } else {
                    HStack(spacing: 4) {
                        Image(systemName: "sparkle")
                            .font(.system(size: 11, weight: .bold))
                        Text(loc.t("reviews.new"))
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundStyle(Color.qkGoldDeep)
                }
                if let location = listing.location {
                    Text("·")
                        .foregroundStyle(Color.qkMuted)
                    Label(location, systemImage: "mappin.and.ellipse")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.qkMuted)
                        .labelStyle(.titleAndIcon)
                        .lineLimit(1)
                }
            }
        }
    }

    /// "12 reviews" / "1 review" using the singular/plural keys.
    private func reviewCountText(_ n: Int) -> String {
        String(format: loc.t(n == 1 ? "reviews.count" : "reviews.count.plural"), n)
    }

    // MARK: - Host

    /// Up to two uppercase initials from the host name (mirrors the profile /
    /// reviewer avatar). Falls back to "H" when the name is empty.
    private var hostInitials: String {
        let source = (listing.hostName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let parts = source.split(separator: " ").prefix(2).compactMap { $0.first }
        let result = String(parts).uppercased()
        return result.isEmpty ? "H" : result
    }

    /// The host's display name, trimmed; empty when the listing has no host.
    private var hostName: String {
        (listing.hostName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Whether to show the "Hosted by" row (and its leading divider).
    private var hasHost: Bool { !hostName.isEmpty }

    /// "Hosted by {hostName}" row with the gold host avatar, plus the host's
    /// trust badges (Verified ✓ / Superhost / New host) underneath. When the
    /// listing carries a `host_id`, the avatar+name area is a `NavigationLink`
    /// into the public `HostProfileView` (reviews + the host's other listings).
    private var hostRow: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let target = hostProfileTarget {
                NavigationLink(value: target) {
                    hostRowContent(showsChevron: true)
                }
                .buttonStyle(.plain)
                .accessibilityHint(loc.t("host.profile.openHint"))
            } else {
                // No host id → no profile to open; render the row inert.
                hostRowContent(showsChevron: false)
            }
            hostBadgesView
        }
    }

    /// The avatar + "Hosted by …" labels, optionally with a trailing chevron to
    /// signal it's tappable. Shared by the linked and inert variants above.
    private func hostRowContent(showsChevron: Bool) -> some View {
        HStack(spacing: 12) {
            QKAvatar(initials: hostInitials, size: 46, gold: true)
            VStack(alignment: .leading, spacing: 2) {
                Text(String(format: loc.t("detail.hostedBy"), hostName))
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.qkInk)
                    .lineLimit(1)
                Text(loc.t(showsChevron ? "host.profile.viewProfile" : "common.host"))
                    .font(.system(size: 13))
                    .foregroundStyle(showsChevron ? Color.qkBurgundy : Color.qkMuted)
            }
            Spacer(minLength: 0)
            if showsChevron {
                Image(systemName: "chevron.forward")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.qkMuted)
            }
        }
        .contentShape(Rectangle())
    }

    /// The push target for the host's public profile — present only when the
    /// listing has a non-empty `host_id`.
    private var hostProfileTarget: HostProfileTarget? {
        guard let hostID = listing.hostId?.trimmingCharacters(in: .whitespacesAndNewlines),
              !hostID.isEmpty else { return nil }
        return HostProfileTarget(hostID: hostID, name: hostName.isEmpty ? nil : hostName)
    }

    /// Trust chips for the host. Prefers the full badge set from the public
    /// profile once it's loaded; otherwise shows a single "Verified host" chip
    /// from the listing's `host_verified` flag so the badge appears immediately.
    @ViewBuilder
    private var hostBadgesView: some View {
        if let hostBadges {
            QKTrustBadgesRow(badges: hostBadges)
        } else if listing.hostVerified {
            QKVerifiedHostChip()
        }
    }

    /// "Report this listing" row — a muted, low-emphasis action below the host
    /// row. Requires sign-in: guests are routed through the auth sheet first.
    private var reportRow: some View {
        Button {
            if auth.isAuthenticated {
                showingReport = true
            } else {
                showingAuth = true
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "flag")
                    .accessibilityLabel(L.t("listing.report"))
                    .font(.system(size: 14, weight: .semibold))
                Text(loc.t("report.reportListing"))
                    .font(.system(size: 14, weight: .semibold))
                    .underline()
                Spacer(minLength: 0)
            }
            .foregroundStyle(Color.qkMuted)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(loc.t("report.reportListing"))
    }

    /// "More from this host" — a horizontal row of the host's other listings,
    /// each pushing its own `ListingDetailView` via the enclosing stack's
    /// `Listing` destination. Rendered only when `hostListings` is non-empty.
    private var moreFromHostSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(loc.t("detail.moreFromHost"))
                .font(.title3).fontWeight(.semibold)
                .foregroundStyle(Color.qkInk)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 14) {
                    ForEach(hostListings) { other in
                        NavigationLink(value: other) {
                            ListingCard(listing: other)
                                // Responsive: ~78% of the viewport so a sliver of
                                // the next card peeks, clamped so it never grows
                                // oversized on wide screens.
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
            // Leading/trailing inset so the first/last card isn't flush against
            // the edge (RTL-safe — horizontal resolves with the layout direction).
            // Counteract the parent's 20pt inset so the rail bleeds full-width and
            // the content margins do the spacing.
            .contentMargins(.horizontal, 20, for: .scrollContent)
            .scrollTargetBehavior(.viewAligned)
            .padding(.horizontal, -20)
            // Don't clip the cards' soft shadows at the scroll-view bounds.
            .scrollClipDisabled()
        }
    }

    /// Fetch the host's other published listings (excluding the current one) for
    /// the "More from this host" rail. Best-effort: failures leave the section
    /// hidden. Runs once per host id.
    private func loadHostListings() async {
        guard let hostID = listing.hostId?.trimmingCharacters(in: .whitespacesAndNewlines),
              !hostID.isEmpty else { return }
        let all = (try? await SupabaseService.shared.fetchHostListings(hostID: hostID)) ?? []
        hostListings = all.filter { $0.id != listing.id }
    }

    /// Fetch the host's public profile to get the full trust-badge set
    /// (Verified / Superhost / New host). Best-effort: on failure the host row
    /// falls back to the listing's `host_verified` flag. Runs once per host id.
    private func loadHostProfile() async {
        guard let hostID = listing.hostId?.trimmingCharacters(in: .whitespacesAndNewlines),
              !hostID.isEmpty else { return }
        if let profile = try? await TrustService.shared.fetchPublicProfile(userID: hostID) {
            hostBadges = profile.badges
        }
    }

    /// Whether the signed-in user is the host of this listing — gates the
    /// "Manage availability" entry. Compares the account id to the listing's
    /// `host_id` (both trimmed); `false` for guests or when either id is absent.
    private var isHostOfThisListing: Bool {
        guard let userID = auth.user?.id.trimmingCharacters(in: .whitespacesAndNewlines),
              !userID.isEmpty,
              let hostID = listing.hostId?.trimmingCharacters(in: .whitespacesAndNewlines),
              !hostID.isEmpty else { return false }
        return userID == hostID
    }

    /// Fetch the listing's booked + host-blocked spans (public endpoint) so the
    /// date picker can grey out unavailable days. Best-effort: failures leave the
    /// calendar fully open. Re-runnable by clearing `availabilityLoaded`.
    private func loadAvailability() async {
        availability = (try? await SupabaseService.shared.fetchAvailability(listingID: listing.id)) ?? []
    }

    private var specs: some View {
        HStack(spacing: 0) {
            spec(value: listing.maxGuests, label: loc.t("detail.spec.guests"), divider: false)
            spec(value: listing.bedrooms, label: loc.t("detail.spec.bedrooms"), divider: true)
            spec(value: listing.beds, label: loc.t("detail.spec.beds"), divider: true)
            spec(value: listing.bathrooms, label: loc.t("detail.spec.baths"), divider: true)
        }
        .padding(.vertical, 16)
        .overlay(Rectangle().frame(height: 1).foregroundStyle(Color.qkInk.opacity(0.1)), alignment: .top)
        .overlay(Rectangle().frame(height: 1).foregroundStyle(Color.qkInk.opacity(0.1)), alignment: .bottom)
    }

    private func spec(value: Int?, label: String, divider: Bool) -> some View {
        VStack(spacing: 3) {
            Text("\(value ?? 0)")
                .font(.system(size: 18, weight: .heavy))
                .foregroundStyle(Color.qkInk)
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(Color.qkMuted)
        }
        .frame(maxWidth: .infinity)
        .overlay(alignment: .leading) {
            if divider {
                Rectangle().frame(width: 1).foregroundStyle(Color.qkInk.opacity(0.08))
            }
        }
    }

    // MARK: - Amenities

    /// "What this place offers" — a two-column grid of the listing's amenities
    /// (SF Symbol + label), shown only when the listing has any.
    private var amenitiesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(loc.t("detail.offers"))
                .font(.title3).fontWeight(.semibold)
                .foregroundStyle(Color.qkInk)

            LazyVGrid(
                columns: [GridItem(.flexible(), alignment: .leading),
                          GridItem(.flexible(), alignment: .leading)],
                alignment: .leading,
                spacing: 14
            ) {
                ForEach(listing.amenities, id: \.self) { amenity in
                    HStack(spacing: 10) {
                        Image(systemName: Amenities.icon(for: amenity))
                            .font(.system(size: 17))
                            .foregroundStyle(Color.qkBurgundy)
                            .frame(width: 24)
                        Text(amenity)
                            .font(.subheadline)
                            .foregroundStyle(Color.qkInk)
                            .lineLimit(2)
                        Spacer(minLength: 0)
                    }
                }
            }
        }
    }

    // MARK: - Cancellation policy

    /// "Cancellation policy" — the host-set policy name + its one-line refund
    /// explanation, so a guest knows the terms before they reserve.
    private var cancellationPolicySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(loc.t("cancel.policy"))
                .font(.title3).fontWeight(.semibold)
                .foregroundStyle(Color.qkInk)

            HStack(alignment: .top, spacing: 12) {
                Image(systemName: listing.policy.systemImage)
                    .font(.system(size: 17))
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 3) {
                    Text(listing.policy.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.qkInk)
                    Text(listing.policy.explanation)
                        .font(.subheadline)
                        .foregroundStyle(Color.qkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
        }
    }

    // MARK: - Reviews

    /// "Reviews" — a gold ★ summary header plus the real guest reviews from
    /// `GET /api/local/reviews?listing_id=`. Shows an empty hint when there are
    /// none yet.
    @ViewBuilder
    private var reviewsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "star.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(Color.qkGold)
                if listing.hasRating {
                    Text(String(format: "%.1f", listing.rating))
                        .font(.title3).fontWeight(.bold)
                        .foregroundStyle(Color.qkInk)
                        .monospacedDigit()
                    Text("·")
                        .foregroundStyle(Color.qkMuted)
                    Text(reviewCountText(listing.reviewCount))
                        .font(.title3).fontWeight(.semibold)
                        .foregroundStyle(Color.qkInk)
                } else {
                    Text(loc.t("reviews.title"))
                        .font(.title3).fontWeight(.semibold)
                        .foregroundStyle(Color.qkInk)
                }
            }

            if reviews.isEmpty {
                Text(loc.t("reviews.empty"))
                    .font(.subheadline)
                    .foregroundStyle(Color.qkMuted)
            } else {
                VStack(spacing: 12) {
                    ForEach(reviews) { review in
                        ReviewRow(review: review)
                    }
                }
            }
        }
    }

    // MARK: - Reserve panel

    /// Host entry into the availability manager (block / unblock dates). Renders
    /// as a tan secondary row inside the reserve panel.
    private var manageAvailabilityButton: some View {
        Button {
            showingAvailabilityManager = true
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "calendar.badge.clock")
                    .font(.system(size: 16, weight: .semibold))
                Text(loc.t("availability.manage"))
                    .fontWeight(.semibold)
                Spacer()
                Image(systemName: "chevron.forward")
                    .font(.system(size: 13, weight: .semibold))
            }
            .foregroundStyle(Color.qkBurgundy)
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .frame(maxWidth: .infinity)
            .background(Color.qkTan)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.qkTap)
    }

    /// The itemized price for the chosen dates. Uses the authoritative quote when
    /// available (blended nightly average × nights, discount line, total), else a
    /// single base-nightly × nights estimate row. A subtle spinner shows while a
    /// fresh quote is in flight.
    @ViewBuilder
    private var priceBreakdown: some View {
        let useQuote = quote != nil && quote?.nights == nights
        VStack(spacing: 8) {
            if let quote, useQuote {
                // Blended nightly average × nights → subtotal.
                breakdownRow(
                    label: "\(currency.format(quote.nightlyAvg)) \(loc.t("pricing.perNightAvg")) × \(nightsText)",
                    value: currency.format(quote.subtotal),
                    bold: false
                )
                // Length-of-stay discount, when the quote applied one.
                if quote.hasDiscount {
                    breakdownRow(
                        label: String(format: loc.t("growth.discountOff"), "\(quote.discountPercent)"),
                        value: "−\(currency.format(quote.subtotal - quote.total))",
                        bold: false,
                        tint: Color.qkSuccess
                    )
                }
                Divider()
                breakdownRow(label: loc.t("common.total"), value: currency.format(quote.total), bold: true)
            } else {
                // Fallback: naive base-nightly × nights.
                breakdownRow(
                    label: "\(currency.format(listing.pricePerNight)) × \(nightsText)",
                    value: currency.format(estimateEGP),
                    bold: true
                )
            }
        }
        .overlay(alignment: .topTrailing) {
            if isQuoting {
                ProgressView()
                    .controlSize(.mini)
                    .tint(.qkBurgundy)
            }
        }
    }

    /// "3 nights" / "1 night" — localized, pluralized.
    private var nightsText: String {
        String(format: loc.t(nights == 1 ? "pricing.night" : "pricing.nights"), "\(nights)")
    }

    /// One label/value row in the price breakdown.
    private func breakdownRow(label: String, value: String, bold: Bool, tint: Color = Color.qkMuted) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(bold ? Color.qkInk : tint)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Spacer(minLength: 8)
            Text(value)
                .fontWeight(bold ? .bold : .semibold)
                .foregroundStyle(bold ? Color.qkInk : tint)
                .monospacedDigit()
        }
        .font(.subheadline)
    }

    private var reservePanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(loc.t("detail.reserveStay"))
                .font(.title3).fontWeight(.semibold)
                .foregroundStyle(Color.qkInk)

            // Host-only: manage this listing's blocked dates. Shown when the
            // signed-in account owns the listing.
            if isHostOfThisListing {
                manageAvailabilityButton
            }

            VStack(spacing: 10) {
                // Branded date-range row → opens the QuickIn calendar sheet
                // (premium replacement for two plain DatePickers).
                Button {
                    showingDatePicker = true
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "calendar")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(Color.qkBurgundy)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(loc.t("detail.dates"))
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Color.qkMuted)
                            Text(dateRangeLabel)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Color.qkInk)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.qkMuted)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(Color.qkCream)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)

                VStack(spacing: 10) {
                    guestStepper("Adults", "Age 13+", value: $adults,
                                 range: 1...(listing.maxGuests ?? 16))
                    guestStepper("Children", "Ages 2–12", value: $children,
                                 range: 0...max(0, (listing.maxGuests ?? 16) - adults))
                    guestStepper("Infants", "Under 2", value: $infants, range: 0...5)
                    guestStepper("Pets", "Service animals welcome", value: $pets, range: 0...5)
                }
            }

            // Seasonal-rates note — shown when the host set a weekend / per-month
            // rate, so the guest knows the nightly price varies by date.
            if listing.hasSeasonalPricing {
                SeasonalRatesNote()
            }

            // Price breakdown. When an authoritative quote is in hand (and matches
            // the chosen nights) we itemize the blended nightly average × nights,
            // any length-of-stay discount, and the quote total. Otherwise we fall
            // back to the naive base-nightly × nights estimate.
            priceBreakdown

            if let reserveError {
                Text(reserveError)
                    .font(.footnote)
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button {
                Task { await reserve() }
            } label: {
                QKPrimaryButtonLabel(
                    title: loc.t(auth.isAuthenticated ? "detail.reserve" : "detail.signInToReserve"),
                    isLoading: isReserving
                )
                .opacity(isReserving ? 0.85 : 1)
                .background(alignment: .center) {
                    if !isReserving {
                        QKPulseRing(cornerRadius: 16)
                    }
                }
            }
            .buttonStyle(QKPressStyle())
            .disabled(isReserving)
        }
        .padding(18)
        .qkCard(lifts: false)
    }

    private var bookingBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Text(currency.format(listing.pricePerNight))
                        .font(.system(size: 20, weight: .heavy))
                        .foregroundStyle(Color.qkBurgundy)
                    Text(loc.t("detail.perNight")).font(.subheadline).foregroundStyle(Color.qkMuted)
                }
                Text("\(currency.format(totalEGP)) total · \(nights) night\(nights == 1 ? "" : "s")")
                    .font(.caption2).foregroundStyle(Color.qkMuted)
                // Length-of-stay discounts the host offers (hidden when none).
                if listing.hasLengthOfStayDiscount {
                    ListingDiscountNote(weekly: listing.weeklyDiscount, monthly: listing.monthlyDiscount)
                } else if listing.hasSeasonalPricing {
                    // Otherwise, when seasonal rates apply, hint that the nightly
                    // price varies by date (the breakdown shows the exact total).
                    Text(loc.t("pricing.seasonalNote"))
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.qkBurgundy)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
            }
            Spacer()
            Button {
                Task { await reserve() }
            } label: {
                Text(loc.t(auth.isAuthenticated ? "detail.reserve" : "explore.signIn"))
                    .fontWeight(.bold)
                    .foregroundStyle(Color.qkCream)
                    .padding(.horizontal, 30)
                    .padding(.vertical, 14)
                    .background(LinearGradient.qkBurgundyCTA)
                    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
            }
            .buttonStyle(QKPressStyle())
            .disabled(isReserving)
        }
        .padding(.horizontal, 20)
        .padding(.top, 14)
        .padding(.bottom, 14)
        .background(.regularMaterial)
        .overlay(Rectangle().frame(height: 1).foregroundStyle(Color.qkInk.opacity(0.08)), alignment: .top)
    }

    /// One labelled +/- row used by the guest breakdown (adults/children/infants/pets).
    @ViewBuilder
    private func guestStepper(_ title: String, _ subtitle: String,
                              value: Binding<Int>, range: ClosedRange<Int>) -> some View {
        Stepper(value: value, in: range) {
            VStack(alignment: .leading, spacing: 1) {
                Text(title).foregroundStyle(Color.qkInk).font(.system(size: 15, weight: .semibold))
                Text(subtitle).foregroundStyle(Color.qkMuted).font(.caption)
            }
        }
        .tint(.qkBurgundy)
    }

    // MARK: - Reserve action

    private func reserve() async {
        reserveError = nil

        // Guests must sign in first.
        guard auth.isAuthenticated, BookingService.shared.token != nil else {
            showingAuth = true
            return
        }

        isReserving = true
        defer { isReserving = false }

        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.dateFormat = "yyyy-MM-dd"

        do {
            let booking = try await BookingService.shared.reserve(
                listingID: listing.id,
                checkIn: fmt.string(from: checkIn),
                checkOut: fmt.string(from: checkOut),
                guests: guests,
                adults: adults,
                children: children,
                infants: infants,
                pets: pets
            )
            // Booking created → collect (mock) payment before confirming. The
            // PaymentSheet flips it to paid + confirmed, then we show the modal.
            pendingPayment = booking
        } catch BookingError.notSignedIn {
            showingAuth = true
        } catch {
            // 400 → server's { error } (e.g. dates unavailable); anything else.
            reserveError = error.localizedDescription
        }
    }

    // MARK: - Seasonal pricing quote

    /// `yyyy-MM-dd`, locale-independent — matches the quote API exactly.
    private static let quoteFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    /// Debounce a quote refresh after the dates change: stamp a fresh token, wait
    /// ~350ms, and only fetch if no newer change superseded this one. Keeps us
    /// from hammering the endpoint while the user scrubs the calendar.
    private func scheduleQuote() {
        quoteToken &+= 1
        let token = quoteToken
        Task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard token == quoteToken else { return }
            await loadQuote(token: token)
        }
    }

    /// Fetch the authoritative quote for the current dates. Publishes only when
    /// this call is still the latest (its `token` matches). Silently keeps the
    /// naive estimate on failure so the reserve total always shows something.
    private func loadQuote(token: Int? = nil) async {
        isQuoting = true
        defer { if token == nil || token == quoteToken { isQuoting = false } }
        let ci = Self.quoteFormatter.string(from: checkIn)
        let co = Self.quoteFormatter.string(from: checkOut)
        let fetched = try? await BookingService.shared.fetchStayQuote(
            listingID: listing.id, checkIn: ci, checkOut: co
        )
        // Bail if a newer date change superseded this fetch.
        if let token, token != quoteToken { return }
        if let fetched { quote = fetched }
    }
}
