import SwiftUI

struct ListingsView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var wishlist: WishlistStore
    @StateObject private var viewModel = ListingsViewModel()
    @State private var path = NavigationPath()
    @State private var viewMode: ListingsViewMode = .list
    @State private var showingAuth = false
    @State private var showingAIChat = false
    @State private var showingAISearch = false
    @State private var showingFilters = false

    var onOpenProfile: () -> Void = {}

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()

                // Single unified scroll: brand header + chrome + toggle + listings
                // all move together. Pull-to-refresh works on the whole page.
                ScrollView {
                    VStack(spacing: 0) {
                        // Brand banner — scrolls away as the user digs into listings.
                        QKBrandHeader(
                            eyebrow: loc.t("home.eyebrow"),
                            subtitle: loc.t("home.subtitle"),
                            wordmark: true
                        ) {
                            AnimatedProfileAvatar(
                                user: auth.user,
                                isAuthenticated: auth.isAuthenticated,
                                onOpenProfile: onOpenProfile,
                                onSignIn: { showingAuth = true },
                                onDark: true
                            )
                        }

                        // Discovery chrome — also scrolls with the page.
                        VStack(spacing: 12) {
                            SearchHeader(viewModel: viewModel)
                                .padding(.horizontal, 16)
                                .padding(.top, 8)
                            aiSearchEntry
                                .padding(.horizontal, 16)
                            RegionSortBar(viewModel: viewModel, onOpenFilters: { showingFilters = true })
                        }
                        .padding(.bottom, 12)

                        // List / Map toggle
                        viewModeToggle
                            .padding(.horizontal, 16)
                            .padding(.bottom, 12)

                        // Cards or skeleton while loading
                        if viewModel.isLoading && viewModel.listings.isEmpty {
                            SkeletonList(count: 5, imageHeight: 220)
                        } else {
                            results
                        }
                        Spacer(minLength: 32)
                    }
                }
                .refreshable { await viewModel.load() }

                // Floating Ask AI button (list mode only)
                if viewMode == .list {
                    AskAIButton { showingAIChat = true }
                        .padding(.trailing, 18)
                        .padding(.bottom, 16)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                }

                // Full-page map overlay — overlays the whole screen when Map is tapped.
                if viewMode == .map {
                    fullPageMap
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Listing.self) { listing in
                ListingDetailView(listing: listing)
            }
        }
        .tint(.qkBurgundy)
        .sheet(isPresented: $showingAuth) {
            AuthView().environmentObject(auth)
        }
        .sheet(isPresented: $showingAIChat) {
            AITravelChatView()
                .environmentObject(loc)
        }
        .sheet(isPresented: $showingAISearch) {
            AISearchView()
                .environmentObject(loc)
                .environmentObject(auth)
                .environmentObject(wishlist)
        }
        .sheet(isPresented: $showingFilters) {
            FiltersSheet(viewModel: viewModel)
                .environmentObject(loc)
        }
        .onChange(of: auth.isAuthenticated) { _, isAuthed in
            if isAuthed { showingAuth = false }
        }
        .task {
            if UserDefaults.standard.bool(forKey: "uitestAuth") { showingAuth = true }
            if UserDefaults.standard.bool(forKey: "uitestAIChat") { showingAIChat = true }
            if viewModel.regions.isEmpty { await viewModel.loadRegions() }
            if auth.isAuthenticated { await wishlist.refresh() }
            if UserDefaults.standard.bool(forKey: "uitestMap") { viewMode = .map }
            if let q = UserDefaults.standard.string(forKey: "uitestSearch"), !q.isEmpty {
                viewModel.locationQuery = q
                await viewModel.search()
            } else {
                await viewModel.load()
            }
            if UserDefaults.standard.bool(forKey: "uitestDetail"),
               path.isEmpty, let first = viewModel.listings.first {
                path = NavigationPath([first])
            }
        }
        // onAppear fires every time the Explore tab becomes visible — always
        // refresh listings so the feed reflects server-side changes (new
        // listings, price edits, etc.) without requiring a pull-to-refresh.
        .onAppear {
            Task { await viewModel.load() }
        }
    }

    private var fullPageMap: some View {
        ListingsMapView(
            listings: viewModel.listings,
            path: $path,
            isLoading: viewModel.isLoading,
            preselectFirst: UserDefaults.standard.bool(forKey: "uitestMapCard"),
            onClose: { withAnimation(QKAnim.swap) { viewMode = .list } },
            onSearchArea: { box in Task { await viewModel.searchArea(box) } },
            onSubmitSearch: { query in
                viewModel.locationQuery = query
                Task { await viewModel.search() }
            }
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.qkCream)
        .transition(.opacity)
    }

    /// "Ask AI" natural-language search entry — a slim outlined pill that opens
    /// the AI search sheet. RTL-safe (leading/trailing mirror automatically).
    private var aiSearchEntry: some View {
        Button {
            showingAISearch = true
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "sparkles")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.qkBurgundy)
                Text(loc.t("ai.aiSearchPlaceholder"))
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.qkMuted)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(loc.t("ai.aiSearch"))
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.qkCream)
                    .padding(.horizontal, 12)
                    .frame(height: 30)
                    .background(LinearGradient.qkBurgundyCTA)
                    .clipShape(Capsule())
            }
            .padding(.leading, 16)
            .padding(.trailing, 6)
            .frame(height: 48)
            .background(Color.qkSurface)
            .clipShape(Capsule(style: .continuous))
            .overlay(
                Capsule(style: .continuous)
                    .strokeBorder(Color.qkBurgundy.opacity(0.18), lineWidth: 1)
            )
        }
        .buttonStyle(.qkTap)
        .accessibilityLabel(loc.t("ai.aiSearchTitle"))
    }

    /// List / Map segmented control. Tinted burgundy.
    private var viewModeToggle: some View {
        Picker("View mode", selection: $viewMode.animation(.easeInOut(duration: 0.2))) {
            ForEach(ListingsViewMode.allCases) { mode in
                Label(mode.label, systemImage: mode.icon).tag(mode)
            }
        }
        .pickerStyle(.segmented)
        .tint(.qkBurgundy)
    }

    @ViewBuilder
    private var results: some View {
        if viewModel.listings.isEmpty {
            emptyState(viewModel.errorMessage ?? loc.t("explore.empty.nothingMsg"))
        } else {
            LazyVStack(spacing: 20) {
                ForEach(viewModel.listings) { listing in
                    NavigationLink(value: listing) {
                        ListingCard(listing: listing, onRequireSignIn: { showingAuth = true })
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func emptyState(_ message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: viewModel.anyFilterActive ? "magnifyingglass" : "house.lodge")
                .font(.system(size: 48))
                .foregroundStyle(Color.qkBurgundy.opacity(0.6))
            Text(loc.t(viewModel.anyFilterActive ? "explore.empty.noMatch" : "explore.empty.nothing"))
                .font(.headline)
                .foregroundStyle(Color.qkInk)
            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.qkMuted)
                .padding(.horizontal, 32)
            Button {
                Task {
                    if viewModel.anyFilterActive { await viewModel.clear() }
                    else { await viewModel.load() }
                }
            } label: {
                Text(loc.t(viewModel.anyFilterActive ? "explore.clearSearch" : "common.retry"))
                    .fontWeight(.semibold)
                    .foregroundStyle(Color.qkCream)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 11)
                    .background(LinearGradient.qkBurgundyCTA)
                    .clipShape(Capsule())
            }
            .buttonStyle(QKPressStyle())
        }
        .padding(.top, 50)
    }
}

/// The Explore profile avatar with a Google-style micro-animation: it springs in
/// on appear and a soft ring "pings" outward to draw the eye to the account entry,
/// then taps through to `ProfileAvatarButton`'s behaviour (Profile / sign-in).
struct AnimatedProfileAvatar: View {
    let user: AuthUser?
    let isAuthenticated: Bool
    let onOpenProfile: () -> Void
    let onSignIn: () -> Void
    var onDark: Bool = false

    @State private var appeared = false
    @State private var pinging = false

    var body: some View {
        ZStack {
            // Soft expanding ring — a gentle, repeating "ping".
            Circle()
                .stroke((onDark ? Color.qkCream : Color.qkBurgundy).opacity(0.4), lineWidth: 2)
                .frame(width: 40, height: 40)
                .scaleEffect(pinging ? 1.7 : 0.95)
                .opacity(pinging ? 0 : 0.55)

            ProfileAvatarButton(
                user: user,
                isAuthenticated: isAuthenticated,
                onOpenProfile: onOpenProfile,
                onSignIn: onSignIn,
                onDark: onDark
            )
        }
        .scaleEffect(appeared ? 1 : 0.4)
        .opacity(appeared ? 1 : 0)
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) { appeared = true }
            withAnimation(.easeOut(duration: 1.7).repeatForever(autoreverses: false)) { pinging = true }
        }
    }
}

/// Top-right header avatar on the Explore screen. When signed in it shows a
/// filled burgundy circle with the user's initials and switches to the Profile
/// tab on tap; when signed out it shows a `person.circle` glyph that opens the
/// auth flow (mirroring the Profile-tab sign-in entry).
struct ProfileAvatarButton: View {
    @EnvironmentObject private var loc: LocalizationManager
    let user: AuthUser?
    let isAuthenticated: Bool
    let onOpenProfile: () -> Void
    let onSignIn: () -> Void
    /// Render for a dark (burgundy) header: a gold avatar / a frosted-cream
    /// sign-in glyph that pops on the banner instead of the burgundy-on-cream
    /// treatment used in a light toolbar.
    var onDark: Bool = false

    var body: some View {
        Button {
            if isAuthenticated { onOpenProfile() } else { onSignIn() }
        } label: {
            if isAuthenticated {
                QKAvatar(initials: initials, size: 40, gold: onDark)
                    .overlay {
                        if onDark {
                            Circle().strokeBorder(Color.qkCream.opacity(0.4), lineWidth: 1.5)
                        }
                    }
            } else if onDark {
                Image(systemName: "person.circle")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(Color.qkCream)
                    .frame(width: 40, height: 40)
                    .background(Color.qkCream.opacity(0.16), in: Circle())
                    .overlay(Circle().strokeBorder(Color.qkCream.opacity(0.28), lineWidth: 1))
            } else {
                Image(systemName: "person.circle")
                    .font(.system(size: 26))
                    .foregroundStyle(Color.qkBurgundy)
            }
        }
        .accessibilityLabel(loc.t(isAuthenticated ? "explore.openProfile" : "explore.signIn"))
    }

    /// Up to two uppercase initials from the user's full name, falling back to
    /// the email local-part, then "?". Mirrors `ProfileView.initials`.
    private var initials: String {
        let source: String
        if let name = user?.fullName?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty {
            source = name
        } else if let email = user?.email, let local = email.split(separator: "@").first {
            source = String(local)
        } else {
            source = ""
        }
        let parts = source.split(separator: " ").prefix(2).compactMap { $0.first }
        let result = String(parts).uppercased()
        return result.isEmpty ? "?" : result
    }
}

/// Search header on the Explore tab. Collapsed by default to a single summary
/// pill so listings own the screen; tapping expands the full search form
/// (location, date range, guests, Search / Clear). Drives `ListingsViewModel`.
struct SearchHeader: View {
    @ObservedObject var viewModel: ListingsViewModel
    @EnvironmentObject private var loc: LocalizationManager

    /// Collapsed (pill) ⇆ expanded (full form). Starts collapsed.
    @State private var searchExpanded = false
    /// Presents the branded `DateRangePicker` sheet.
    @State private var showingDatePicker = false

    private let openClose = Animation.spring(response: 0.38, dampingFraction: 0.82)

    var body: some View {
        Group {
            if searchExpanded {
                expandedForm
                    .transition(.opacity.combined(with: .move(edge: .top)))
            } else {
                collapsedPill
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .sheet(isPresented: $showingDatePicker) {
            DateRangePicker(
                checkIn: dateBinding(\.checkIn),
                checkOut: dateBinding(\.checkOut)
            ) { ci, co in
                viewModel.applyDateRange(checkIn: ci, checkOut: co)
            }
        }
    }

    // MARK: - Collapsed pill

    /// One-line summary bar. Tapping anywhere expands the form.
    private var collapsedPill: some View {
        Button {
            withAnimation(openClose) { searchExpanded = true }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Color.qkBurgundy)

                Text(summaryText)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(viewModel.isFiltered ? Color.qkInk : Color.qkMuted)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.qkBurgundy)
                    .padding(8)
                    .background(Color.qkTan)
                    .clipShape(Circle())
            }
            .padding(.leading, 18)
            .padding(.trailing, 8)
            .frame(height: 56)
            .background(Color.white)
            .clipShape(Capsule(style: .continuous))
            .overlay(
                Capsule(style: .continuous)
                    .strokeBorder(Color.qkTan, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.06), radius: 10, x: 0, y: 5)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(loc.t("explore.searchStays"))
        .accessibilityValue(summaryText)
    }

    /// "Cairo · Aug 1–4 · 2 guests" when filters are set; a muted placeholder
    /// otherwise. Each segment falls back to its own placeholder.
    private var summaryText: String {
        let place = viewModel.locationQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        let where_ = place.isEmpty ? loc.t("explore.whereTo") : place
        let when = viewModel.dateRangeLabel ?? loc.t("explore.anytime")
        // Show the count once a search has run or the user bumped it past the
        // default of 1; otherwise keep the muted "Add guests" placeholder.
        let who = (viewModel.isFiltered || viewModel.guests > 1)
            ? guestsText(viewModel.guests)
            : loc.t("explore.addGuests")
        return "\(where_) · \(when) · \(who)"
    }

    /// Localized "N guest(s)", choosing the singular/plural key per language.
    private func guestsText(_ n: Int) -> String {
        String(format: loc.t(n == 1 ? "explore.guest" : "explore.guests.plural"), n)
    }

    // MARK: - Expanded form

    private var expandedForm: some View {
        VStack(spacing: 14) {
            // Header row: title + collapse chevron.
            HStack {
                Text(loc.t("explore.searchStays"))
                    .font(.headline)
                    .foregroundStyle(Color.qkInk)
                Spacer()
                Button {
                    withAnimation(openClose) { searchExpanded = false }
                } label: {
                    Image(systemName: "chevron.up")
                        .accessibilityLabel(L.t("explore.collapse"))
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.qkBurgundy)
                        .padding(9)
                        .background(Color.qkTan)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(loc.t("explore.collapse"))
            }

            // Location
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(Color.qkMuted)
                TextField(loc.t("explore.whereToPlaceholder"), text: $viewModel.locationQuery)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .foregroundStyle(Color.qkInk)
                    .submitLabel(.search)
                    .onSubmit { runSearch() }
                if !viewModel.locationQuery.isEmpty {
                    Button {
                        viewModel.locationQuery = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .accessibilityLabel(L.t("common.clear"))
                            .foregroundStyle(Color.qkMuted.opacity(0.6))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .background(Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Color.qkTan, lineWidth: 1)
            )

            // Dates — a single tidy row that opens the branded range picker.
            Button {
                showingDatePicker = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "calendar")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(Color.qkBurgundy)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(loc.t("explore.dates"))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.qkMuted)
                        Text(viewModel.dateRangeLabel ?? loc.t("explore.addDates"))
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(viewModel.useDates ? Color.qkInk : Color.qkMuted)
                    }
                    Spacer()
                    if viewModel.useDates {
                        Button {
                            viewModel.applyDateRange(checkIn: nil, checkOut: nil)
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .accessibilityLabel(L.t("common.clear"))
                                .foregroundStyle(Color.qkMuted.opacity(0.6))
                        }
                        .buttonStyle(.plain)
                    } else {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.qkMuted)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(Color.qkTan, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)

            // Guests
            Stepper(value: $viewModel.guests, in: 1...20) {
                HStack(spacing: 10) {
                    Image(systemName: "person.2.fill").foregroundStyle(Color.qkBurgundy)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(loc.t("explore.guests"))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.qkMuted)
                        Text(guestsText(viewModel.guests))
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Color.qkInk)
                    }
                }
            }
            .tint(.qkBurgundy)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Color.qkTan, lineWidth: 1)
            )

            // Actions
            HStack(spacing: 12) {
                Button {
                    Task { await viewModel.clear() }
                } label: {
                    Text(loc.t("common.clear"))
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Color.qkTan)
                        .foregroundStyle(Color.qkInk)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .buttonStyle(.plain)

                Button {
                    runSearch()
                } label: {
                    QKPrimaryButtonLabel(
                        title: loc.t("common.search"),
                        systemImage: "magnifyingglass",
                        isLoading: viewModel.isLoading,
                        height: 48
                    )
                }
                .buttonStyle(QKPressStyle())
                .disabled(viewModel.isLoading)
            }
        }
        .padding(16)
        .qkCard(cornerRadius: 24, lifts: false)
    }

    // MARK: - Helpers

    /// Runs the existing search, then collapses the header so results get the
    /// screen.
    private func runSearch() {
        Task { await viewModel.search() }
        withAnimation(openClose) { searchExpanded = false }
    }

    /// `DateRangePicker` takes `Binding<Date?>`; the view model stores non-optional
    /// dates. Bridge them, surfacing `nil` while dates are off so the picker opens
    /// with no preselection.
    private func dateBinding(_ keyPath: ReferenceWritableKeyPath<ListingsViewModel, Date>) -> Binding<Date?> {
        Binding(
            get: { viewModel.useDates ? viewModel[keyPath: keyPath] : nil },
            set: { if let v = $0 { viewModel[keyPath: keyPath] = v } }
        )
    }
}

/// Region chips + sort control shown under the search field on Explore.
///
/// • A horizontal scroll of region chips: "All" plus one per region from
///   `GET /api/local/regions` with its listing count. Tapping refetches with
///   `region=<name>` ("All" clears it). The selected chip fills burgundy.
/// • A trailing sort menu (Recommended · Price ↑ · Price ↓ · Newest) that adds
///   `sort=` to the fetch.
struct RegionSortBar: View {
    @ObservedObject var viewModel: ListingsViewModel
    @EnvironmentObject private var loc: LocalizationManager
    /// Opens the discovery Filters sheet (amenities + property type).
    var onOpenFilters: () -> Void = {}

    var body: some View {
        HStack(spacing: 10) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    // "All" clears the region filter.
                    chip(title: loc.t("explore.region.all"), count: nil, isSelected: viewModel.selectedRegion == nil) {
                        Task { await viewModel.selectRegion(nil) }
                    }
                    ForEach(viewModel.regions) { facet in
                        chip(
                            title: facet.region,
                            count: facet.count,
                            isSelected: viewModel.selectedRegion == facet.region
                        ) {
                            Task { await viewModel.selectRegion(facet.region) }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 2)
            }

            HStack(spacing: 8) {
                filtersButton
                sortMenu
            }
            .padding(.trailing, 16)
        }
    }

    /// Pill that opens the Filters sheet. Shows a gold count badge when any
    /// discovery filter (amenities / property type) is active.
    private var filtersButton: some View {
        Button(action: onOpenFilters) {
            HStack(spacing: 6) {
                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: 13, weight: .semibold))
                Text(loc.t("filters.button"))
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                if viewModel.discoveryFilterCount > 0 {
                    Text("\(viewModel.discoveryFilterCount)")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.qkInk)
                        .frame(minWidth: 18, minHeight: 18)
                        .background(Color.qkGold, in: Circle())
                }
            }
            .foregroundStyle(Color.qkBurgundy)
            .padding(.horizontal, 14)
            .frame(height: 36)
            .background(Color.white)
            .clipShape(Capsule(style: .continuous))
            .overlay(
                Capsule(style: .continuous)
                    .strokeBorder(viewModel.hasDiscoveryFilters ? Color.qkBurgundy : Color.qkTan,
                                  lineWidth: viewModel.hasDiscoveryFilters ? 1.5 : 1)
            )
        }
        .buttonStyle(.qkTap)
        .accessibilityLabel(loc.t("filters.title"))
        .accessibilityValue(viewModel.discoveryFilterCount > 0 ? "\(viewModel.discoveryFilterCount)" : "")
    }

    // MARK: - Pieces

    /// One pill — the shared `QKChip` (selected fills with the burgundy gradient;
    /// unselected is a white pill with a hairline border + springy tap).
    private func chip(title: String, count: Int?, isSelected: Bool, action: @escaping () -> Void) -> some View {
        QKChip(title: title, count: count, isSelected: isSelected, action: action)
            .accessibilityLabel(count.map { "\(title), \($0) stays" } ?? title)
    }

    /// A compact sort menu. The trigger shows the active option's label; picking
    /// a row refetches with the new `sort`.
    private var sortMenu: some View {
        Menu {
            Picker("Sort", selection: sortBinding) {
                ForEach(ListingSort.allCases) { option in
                    Label(option.label, systemImage: option.systemImage).tag(option)
                }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "arrow.up.arrow.down")
                    .font(.system(size: 13, weight: .semibold))
                Text(viewModel.sort.label)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
            }
            .foregroundStyle(Color.qkBurgundy)
            .padding(.horizontal, 14)
            .frame(height: 36)
            .background(Color.white)
            .clipShape(Capsule(style: .continuous))
            .overlay(
                Capsule(style: .continuous)
                    .strokeBorder(Color.qkTan, lineWidth: 1)
            )
        }
        .accessibilityLabel("Sort listings")
        .accessibilityValue(viewModel.sort.label)
    }

    /// Bridges the picker to the async `applySort` so selecting refetches.
    private var sortBinding: Binding<ListingSort> {
        Binding(
            get: { viewModel.sort },
            set: { newValue in Task { await viewModel.applySort(newValue) } }
        )
    }
}

/// A single stay card in the feed — boutique recipe: cover photo with a heart,
/// a "Guest favorite" pop-in pill, a gold ★ rating by the title, spec chips and
/// a burgundy price. The cover lifts/zooms subtly on appear (qkCard).
struct ListingCard: View {
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var wishlist: WishlistStore
    @EnvironmentObject private var currency: CurrencyManager
    let listing: Listing
    /// Called when a signed-out visitor taps the heart, so the host screen can
    /// present the sign-in sheet.
    var onRequireSignIn: () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topTrailing) {
                ListingImageView(url: listing.sortedImageURLs.first)
                    .frame(height: 210)
                    .frame(maxWidth: .infinity)
                    .clipped()

                // Heart top-trailing (mirrors in RTL). Reflects the shared
                // wishlist state and toggles it optimistically; prompts sign-in
                // when the visitor isn't authenticated.
                QKHeartButton(
                    isOn: Binding(
                        get: { wishlist.isListingSaved(listing.id) },
                        set: { _ in }
                    )
                ) {
                    guard auth.isAuthenticated else { onRequireSignIn(); return }
                    wishlist.toggleListing(listing.id)
                }
                .padding(11)

                // Guest-favorite pill pops in, top-leading.
                if listing.isGuestFavorite == true {
                    QKPopIn {
                        QKGuestFavoriteBadge(text: loc.t("explore.guestFavorite"))
                    }
                    .padding(11)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Text(listing.title)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Color.qkInk)
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    QKListingRating(listing: listing)
                }
                if let location = listing.location {
                    Text(location)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.qkMuted)
                        .lineLimit(1)
                }

                // Spec chips: guests · beds + a gold-flavored region tag.
                HStack(spacing: 6) {
                    if let g = listing.maxGuests {
                        specChip("\(g) \(loc.t("detail.spec.guests"))")
                    }
                    if let b = listing.beds {
                        specChip("\(b) \(loc.t("detail.spec.beds"))")
                    }
                    if let region = listing.region, !region.isEmpty {
                        Text(region)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Color.qkBurgundy)
                            .padding(.horizontal, 9).padding(.vertical, 3)
                            .background(Color.qkTan)
                            .clipShape(Capsule())
                            .lineLimit(1)
                    }
                }
                .padding(.top, 1)

                HStack(spacing: 4) {
                    Text(currency.format(listing.pricePerNight))
                        .font(.system(size: 17, weight: .heavy))
                        .foregroundStyle(Color.qkBurgundy)
                    Text("/ \(loc.t("common.night"))")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.qkMuted)
                }
                .padding(.top, 3)
            }
            .padding(.horizontal, 16)
            .padding(.top, 13)
            .padding(.bottom, 16)
        }
        .qkCard()
    }

    private func specChip(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(Color.qkMuted)
            .padding(.horizontal, 9).padding(.vertical, 3)
            .background(Color.qkCream)
            .overlay(Capsule().strokeBorder(Color.qkInk.opacity(0.08), lineWidth: 1))
            .clipShape(Capsule())
            .lineLimit(1)
    }
}

/// Floating circular "Ask AI" concierge launcher: a burgundy-gradient disc with
/// a cream sparkles glyph, a soft drop shadow and the springy `QKPressStyle`.
/// Sits bottom-trailing on the Explore screen and opens `AITravelChatView`.
struct AskAIButton: View {
    @EnvironmentObject private var loc: LocalizationManager
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            QKVacationWavesIcon(size: 30)
                .frame(width: 58, height: 58)
                .background(LinearGradient.qkBurgundyCTA)
                .clipShape(Circle())
                .overlay(Circle().strokeBorder(Color.qkCream.opacity(0.22), lineWidth: 1))
        }
        .buttonStyle(QKPressStyle(shadow: Color.qkBurgundy.opacity(0.38), shadowRadius: 16))
        .accessibilityLabel(loc.t("ai.button.label"))
    }
}

/// Discovery filters sheet: an amenities multi-select (toggle chips) and a
/// single-select property type with an "Any type" default. Edits happen on a
/// local draft so nothing refetches until the guest taps Apply; Clear empties
/// both. RTL-safe (leading/trailing alignment + symmetric padding).
struct FiltersSheet: View {
    @ObservedObject var viewModel: ListingsViewModel
    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    /// Working copies so the live results don't change until Apply.
    @State private var draftAmenities: Set<String> = []
    @State private var draftType: String?

    private let amenityColumns = [GridItem(.adaptive(minimum: 112), spacing: 10, alignment: .leading)]
    private let typeColumns = [GridItem(.adaptive(minimum: 96), spacing: 10, alignment: .leading)]

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        propertyTypeSection
                        amenitiesSection
                    }
                    .padding(20)
                    .padding(.bottom, 8)
                }
            }
            .navigationTitle(loc.t("filters.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.qkBurgundy)
                    }
                    .accessibilityLabel(loc.t("explore.collapse"))
                }
            }
            .safeAreaInset(edge: .bottom) { actionBar }
        }
        .tint(.qkBurgundy)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .onAppear {
            // Seed the draft from the live filter state each time the sheet opens.
            draftAmenities = viewModel.selectedAmenities
            draftType = viewModel.selectedPropertyType
        }
    }

    // MARK: - Property type (single-select, "Any type" default)

    private var propertyTypeSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            QKEyebrow(text: loc.t("filters.propertyType"))
            LazyVGrid(columns: typeColumns, alignment: .leading, spacing: 10) {
                typeChip(title: loc.t("filters.anyType"), isOn: draftType == nil) {
                    draftType = nil
                }
                ForEach(viewModel.propertyTypes, id: \.self) { type in
                    typeChip(title: loc.t("propertyType.\(type)"), isOn: draftType == type) {
                        // Tapping the active type again falls back to "Any type".
                        draftType = (draftType == type) ? nil : type
                    }
                }
            }
        }
    }

    private func typeChip(title: String, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.85)
                .foregroundStyle(isOn ? Color.qkCream : Color.qkInk)
                .padding(.horizontal, 14)
                .frame(height: 40)
                .frame(maxWidth: .infinity)
                .background(
                    Group {
                        if isOn { LinearGradient.qkBurgundyCTA } else { Color.qkSurface }
                    }
                )
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(isOn ? Color.clear : Color.qkInk.opacity(0.1), lineWidth: 1)
                )
        }
        .buttonStyle(.qkTap)
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }

    // MARK: - Amenities (multi-select toggle chips)

    private var amenitiesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            QKEyebrow(text: loc.t("filters.amenities"))
            LazyVGrid(columns: amenityColumns, alignment: .leading, spacing: 10) {
                ForEach(Amenities.all, id: \.self) { amenity in
                    let isOn = draftAmenities.contains(amenity)
                    Button {
                        if isOn { draftAmenities.remove(amenity) } else { draftAmenities.insert(amenity) }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: Amenities.icon(for: amenity))
                                .font(.footnote)
                            Text(Amenities.label(for: amenity))
                                .font(.subheadline.weight(.medium))
                                .lineLimit(1)
                                .minimumScaleFactor(0.85)
                        }
                        .foregroundStyle(isOn ? Color.qkCream : Color.qkInk)
                        .padding(.horizontal, 12)
                        .frame(height: 40)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            Group {
                                if isOn { LinearGradient.qkBurgundyCTA } else { Color.qkSurface }
                            }
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .strokeBorder(isOn ? Color.clear : Color.qkBurgundy.opacity(0.18), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.qkTap)
                    .accessibilityLabel(Amenities.label(for: amenity))
                    .accessibilityAddTraits(isOn ? .isSelected : [])
                }
            }
        }
    }

    // MARK: - Apply / Clear bar

    private var actionBar: some View {
        HStack(spacing: 12) {
            Button {
                draftAmenities = []
                draftType = nil
                Task {
                    await viewModel.clearFilters()
                    dismiss()
                }
            } label: {
                Text(loc.t("filters.clear"))
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color.qkTan)
                    .foregroundStyle(Color.qkInk)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .buttonStyle(.qkTap)

            Button {
                viewModel.selectedAmenities = draftAmenities
                viewModel.selectedPropertyType = draftType
                Task {
                    await viewModel.applyFilters()
                    dismiss()
                }
            } label: {
                QKPrimaryButtonLabel(
                    title: loc.t("filters.apply"),
                    systemImage: "checkmark",
                    isLoading: viewModel.isLoading,
                    height: 50
                )
            }
            .buttonStyle(QKPressStyle())
            .disabled(viewModel.isLoading)
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 16)
        .background(.ultraThinMaterial)
    }
}
