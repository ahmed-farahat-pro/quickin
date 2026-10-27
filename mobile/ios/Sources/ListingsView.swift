import SwiftUI

struct ListingsView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var wishlist: WishlistStore
    @StateObject private var viewModel = ListingsViewModel()
    @State private var path = NavigationPath()
    @State private var viewMode: ListingsViewMode = .list
    @State private var showingAuth = false
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
                            HStack(spacing: 10) {
                                // Host-only, and invisible to a guest: the way
                                // into the dashboard from the tab a host opens
                                // most. Sits before the avatar so the account
                                // disc stays the outermost accessory.
                                QKHostHeaderButton()
                                AnimatedProfileAvatar(
                                    user: auth.user,
                                    isAuthenticated: auth.isAuthenticated,
                                    onOpenProfile: onOpenProfile,
                                    onSignIn: { showingAuth = true },
                                    onDark: true
                                )
                            }
                        }

                        // Discovery chrome — also scrolls with the page.
                        VStack(spacing: 12) {
                            SearchHeader(viewModel: viewModel)
                                .padding(.horizontal, 16)
                                .padding(.top, 8)
                            RegionSortBar(viewModel: viewModel, onOpenFilters: { showingFilters = true })
                        }
                        .padding(.bottom, 12)

                        // List / Map toggle
                        viewModeToggle
                            .padding(.horizontal, 16)
                            .padding(.bottom, 12)

                        // Cards or skeleton while loading
                        if viewModel.isLoading && viewModel.listings.isEmpty {
                            CompactSkeletonGrid(count: 6)
                        } else {
                            results
                        }
                        Spacer(minLength: 32)
                    }
                }
                .refreshable { await viewModel.load() }

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
        .sheet(isPresented: $showingFilters) {
            FiltersSheet(viewModel: viewModel)
                .environmentObject(loc)
        }
        .onChange(of: auth.isAuthenticated) { _, isAuthed in
            if isAuthed { showingAuth = false }
        }
        .task {
            if UserDefaults.standard.bool(forKey: "uitestAuth") { showingAuth = true }
            if viewModel.destinations.isEmpty { await viewModel.loadDestinations() }
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
            emptyState(
                viewModel.errorMessage
                    ?? loc.t(viewModel.anyFilterActive ? "explore.empty.noMatchMsg" : "explore.empty.nothingMsg")
            )
        } else {
            // Two-column grid of compact cards — more stays per screen while a
            // guest browses a region / sub-area.
            LazyVGrid(columns: Self.gridColumns, alignment: .leading, spacing: 20) {
                ForEach(viewModel.listings) { listing in
                    NavigationLink(value: listing) {
                        CompactListingCard(listing: listing, onRequireSignIn: { showingAuth = true })
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    static let gridColumns = [
        GridItem(.flexible(), spacing: 14, alignment: .top),
        GridItem(.flexible(), spacing: 14, alignment: .top),
    ]

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
            // A catalogue that is simply empty has nothing to retry and no filter to clear, so
            // it gets no button. The old one offered "Retry", which re-ran a query that had
            // already answered correctly.
            if viewModel.errorMessage != nil || viewModel.anyFilterActive {
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

    /// "Cairo · Aug 1–4 · 2 guests" when filters are set. Unset dates and
    /// guests are left out entirely, so an idle bar reads just "Where to?".
    private var summaryText: String {
        let place = viewModel.locationQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        var parts = [place.isEmpty ? loc.t("explore.whereTo") : place]
        if let when = viewModel.dateRangeLabel { parts.append(when) }
        // Show the count once a search has run or the user bumped it past the
        // default of 1.
        if viewModel.isFiltered || viewModel.guests > 1 {
            parts.append(guestsText(viewModel.guests))
        }
        return parts.joined(separator: " · ")
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
                    viewModel.clearPlaceSuggestions()
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
                    .onSubmit {
                        viewModel.clearPlaceSuggestions()
                        runSearch()
                    }
                    .onChange(of: viewModel.locationQuery) { _, _ in
                        viewModel.suggestPlaces()
                    }
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

            // Place autocomplete (web + Android parity): curated popular destinations
            // while the field is empty, matching places as the user types.
            if !viewModel.placeSuggestions.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    if viewModel.locationQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text(loc.t("explore.popularDestinations"))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.qkMuted)
                            .padding(.horizontal, 14)
                            .padding(.top, 10)
                            .padding(.bottom, 2)
                    }
                    ForEach(viewModel.placeSuggestions, id: \.self) { place in
                        Button {
                            viewModel.locationQuery = place
                            viewModel.clearPlaceSuggestions()
                            runSearch()
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "mappin.and.ellipse")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color.qkBurgundy)
                                Text(place)
                                    .font(.subheadline)
                                    .foregroundStyle(Color.qkInk)
                                Spacer(minLength: 0)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.bottom, 6)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(Color.qkTan, lineWidth: 1)
                )
            }

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
        .onAppear {
            // Open with the curated popular destinations when the location field
            // is empty (matches the web + Android explore search).
            if viewModel.locationQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                viewModel.suggestPlaces(debounced: false)
            }
        }
    }

    // MARK: - Helpers

    /// Runs the existing search, then collapses the header so results get the
    /// screen.
    private func runSearch() {
        viewModel.clearPlaceSuggestions()
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

/// The two-level destinations rail + filters/sort shown under the search field.
///
/// • Row 1 — the region rail: "All" plus one icon-over-label button per region
///   from `GET /api/local/destinations`. The selected one turns burgundy with an
///   underline. Tapping refetches with `region=<name>` and clears any sub-area.
/// • Row 2 — the sub-area chips for the selected region ("All · N", then each
///   compound with its km marker), hidden when the region has none.
/// • Row 3 — Filters and the sort menu, trailing, as before.
struct RegionSortBar: View {
    @ObservedObject var viewModel: ListingsViewModel
    @EnvironmentObject private var loc: LocalizationManager
    /// Opens the discovery Filters sheet (amenities + property type).
    var onOpenFilters: () -> Void = {}

    private var isArabic: Bool { loc.lang == .ar }

    var body: some View {
        VStack(spacing: 10) {
            regionRail

            // Full width of its own so long compound names never squeeze
            // Filters / Sort into truncation.
            if !viewModel.selectedSubAreas.isEmpty {
                subAreaRow
            }

            HStack(spacing: 8) {
                Spacer(minLength: 0)
                filtersButton
                sortMenu
            }
            .padding(.horizontal, 16)
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.selectedRegion)
    }

    // MARK: - Region rail

    private var regionRail: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 18) {
                    railItem(
                        symbol: DestinationRules.allSymbol,
                        title: loc.t("explore.region.all"),
                        count: nil,
                        isSelected: viewModel.selectedRegion == nil
                    ) {
                        Task { await viewModel.selectRegion(nil) }
                    }
                    ForEach(viewModel.destinations) { destination in
                        railItem(
                            symbol: DestinationRules.symbol(forIcon: destination.icon),
                            title: DestinationRules.displayName(
                                english: destination.name, arabic: destination.nameAr, isArabic: isArabic
                            ),
                            count: destination.count,
                            isSelected: viewModel.selectedRegion == destination.name
                        ) {
                            Task { await viewModel.selectRegion(destination.name) }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 2)
            }
            Rectangle()
                .fill(Color.qkInk.opacity(0.08))
                .frame(height: 1)
        }
    }

    /// Icon on top, name below, a burgundy underline when selected.
    private func railItem(symbol: String, title: String, count: Int?, isSelected: Bool,
                          action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: symbol)
                    .font(.system(size: 20, weight: isSelected ? .semibold : .regular))
                    .frame(height: 24)
                Text(title)
                    .font(.system(size: 12, weight: isSelected ? .bold : .medium))
                    .lineLimit(1)
                    .fixedSize()
                Capsule()
                    .fill(isSelected ? Color.qkBurgundy : Color.clear)
                    .frame(height: 2.5)
            }
            .foregroundStyle(isSelected ? Color.qkBurgundy : Color.qkMuted)
            .frame(minWidth: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.qkTap)
        .accessibilityLabel(count.map { "\(title), \($0) stays" } ?? title)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    // MARK: - Sub-area row

    private var subAreaRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                // "All · N" — N is how many sub-areas, as on web and Android
                // (not a stay count, so it skips chip()'s "N stays" label).
                QKChip(
                    title: loc.t("explore.region.all"),
                    count: viewModel.selectedSubAreas.count,
                    isSelected: viewModel.selectedArea == nil
                ) {
                    Task { await viewModel.selectArea(nil) }
                }
                ForEach(viewModel.selectedSubAreas) { area in
                    let title = DestinationRules.displayName(
                        english: area.name, arabic: area.nameAr, isArabic: isArabic
                    )
                    QKChip(
                        title: title,
                        suffix: DestinationRules.kmLabel(area.kmMarker),
                        isSelected: viewModel.selectedArea == area.slug
                    ) {
                        Task { await viewModel.selectArea(area.slug) }
                    }
                    .accessibilityLabel(title)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 2)
        }
        .transition(.opacity)
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
                    // `.clipped()` hides an aspect-filled photo's overflow but it
                    // still takes touches. A portrait photo overflowed ~140pt above
                    // the first card — over the search pill, Filters, Sort and the
                    // List/Map toggle — and swallowed every tap there.
                    .contentShape(Rectangle())

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

/// The compact stay card for Explore's two-column grid: a square, rounded
/// cover photo with the wishlist heart, then title (+ ★ when reviewed), a
/// location line and the nightly price. Same pieces and tokens as
/// `ListingCard`, just denser.
struct CompactListingCard: View {
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var wishlist: WishlistStore
    @EnvironmentObject private var currency: CurrencyManager
    let listing: Listing
    var onRequireSignIn: () -> Void = {}

    private var locationLine: String? {
        let region = listing.region.flatMap { r -> String? in
            let trimmed = r.trimmingCharacters(in: .whitespaces)
            guard !trimmed.isEmpty else { return nil }
            return DestinationRules.displayName(
                english: trimmed,
                arabic: DestinationRules.arabicName(forRegion: trimmed),
                isArabic: loc.lang == .ar
            )
        }
        let place = listing.location?.trimmingCharacters(in: .whitespaces)
        if let place, !place.isEmpty { return place }
        return region
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Color.qkTan
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    ListingImageView(url: listing.sortedImageURLs.first, placeholderIconSize: 22)
                }
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                // An aspect-filled photo's overflow still takes touches unless the
                // hit area is pinned to the visible square (see ListingCard).
                .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(alignment: .topTrailing) {
                    QKHeartButton(
                        isOn: Binding(
                            get: { wishlist.isListingSaved(listing.id) },
                            set: { _ in }
                        ),
                        size: 30
                    ) {
                        guard auth.isAuthenticated else { onRequireSignIn(); return }
                        wishlist.toggleListing(listing.id)
                    }
                    .padding(8)
                }

            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(listing.title)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.qkInk)
                        .lineLimit(1)
                    Spacer(minLength: 2)
                    if listing.hasRating {
                        QKStarRating(value: listing.rating, size: 11)
                    }
                }
                if let locationLine {
                    Text(locationLine)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.qkMuted)
                        .lineLimit(1)
                }
                HStack(alignment: .firstTextBaseline, spacing: 3) {
                    Text(currency.format(listing.pricePerNight))
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(Color.qkBurgundy)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    Text("/ \(loc.t("common.night"))")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.qkMuted)
                        .lineLimit(1)
                }
                .padding(.top, 1)
            }
            .padding(.horizontal, 2)
        }
        .contentShape(Rectangle())
    }
}

/// Loading placeholder shaped like the compact two-column grid.
struct CompactSkeletonGrid: View {
    var count: Int = 6

    var body: some View {
        LazyVGrid(columns: ListingsView.gridColumns, alignment: .leading, spacing: 20) {
            ForEach(0..<count, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 8) {
                    Color.qkTan
                        .aspectRatio(1, contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    SkeletonBlock(height: 13, width: 110)
                    SkeletonBlock(height: 11, width: 80)
                    SkeletonBlock(height: 13, width: 70)
                }
                .shimmering()
            }
        }
        .padding(.horizontal, 16)
        .allowsHitTesting(false)
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
