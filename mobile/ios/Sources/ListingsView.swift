import SwiftUI

struct ListingsView: View {
    @StateObject private var viewModel = ListingsViewModel()
    @State private var path: [Listing] = []
    @State private var viewMode: ListingsViewMode = .list

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                Color.qkCream.ignoresSafeArea()
                content
            }
            .navigationTitle("QuickIn")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.qkCream, for: .navigationBar)
            .navigationDestination(for: Listing.self) { listing in
                ListingDetailView(listing: listing)
            }
        }
        .tint(.qkBurgundy)
        .task {
            // CLI screenshot hook: start on the Map tab.
            if UserDefaults.standard.bool(forKey: "uitestMap") {
                viewMode = .map
            }
            // CLI screenshot hook: prefill a location and run a real search
            // (e.g. `-uitestSearch Aspen`) so the map frames the filtered result.
            if let q = UserDefaults.standard.string(forKey: "uitestSearch"),
               !q.isEmpty {
                viewModel.locationQuery = q
                await viewModel.search()
            } else if viewModel.listings.isEmpty {
                await viewModel.load()
            }
            // CLI screenshot hook: auto-open the first listing's detail.
            if UserDefaults.standard.bool(forKey: "uitestDetail"),
               path.isEmpty, let first = viewModel.listings.first {
                path = [first]
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        VStack(spacing: 12) {
            SearchHeader(viewModel: viewModel)
                .padding(.horizontal, 16)
                .padding(.top, 8)

            viewModeToggle
                .padding(.horizontal, 16)

            switch viewMode {
            case .list:
                listContent
            case .map:
                ListingsMapView(
                    listings: viewModel.listings,
                    path: $path,
                    preselectFirst: UserDefaults.standard.bool(forKey: "uitestMapCard"),
                    onClose: { withAnimation(.easeInOut(duration: 0.2)) { viewMode = .list } }
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
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
    private var listContent: some View {
        ScrollView {
            VStack(spacing: 16) {
                results
            }
            .padding(.top, 4)
            .padding(.bottom, 32)
        }
        .refreshable { await viewModel.load() }
    }

    @ViewBuilder
    private var results: some View {
        if viewModel.isLoading && viewModel.listings.isEmpty {
            ProgressView("Finding stays…")
                .tint(.qkBurgundy)
                .foregroundStyle(Color.qkMuted)
                .padding(.top, 60)
        } else if viewModel.listings.isEmpty {
            emptyState(viewModel.errorMessage ?? "Nothing to show yet.")
        } else {
            LazyVStack(spacing: 20) {
                ForEach(viewModel.listings) { listing in
                    NavigationLink(value: listing) {
                        ListingCard(listing: listing)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func emptyState(_ message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: viewModel.isFiltered ? "magnifyingglass" : "house.lodge")
                .font(.system(size: 48))
                .foregroundStyle(Color.qkBurgundy.opacity(0.6))
            Text(viewModel.isFiltered ? "No stays match" : "Nothing to show yet")
                .font(.headline)
                .foregroundStyle(Color.qkInk)
            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.qkMuted)
                .padding(.horizontal, 32)
            Button {
                Task {
                    if viewModel.isFiltered { await viewModel.clear() }
                    else { await viewModel.load() }
                }
            } label: {
                Text(viewModel.isFiltered ? "Clear search" : "Retry")
                    .fontWeight(.semibold)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(Color.qkBurgundy)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
            }
        }
        .padding(.top, 50)
    }
}

/// Search header on the Explore tab: location, optional date range, guests,
/// plus Search / Clear actions. Drives `ListingsViewModel`.
struct SearchHeader: View {
    @ObservedObject var viewModel: ListingsViewModel

    var body: some View {
        VStack(spacing: 12) {
            // Location
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(Color.qkMuted)
                TextField("Where to? (city or place)", text: $viewModel.locationQuery)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .foregroundStyle(Color.qkInk)
                    .submitLabel(.search)
                    .onSubmit { Task { await viewModel.search() } }
                if !viewModel.locationQuery.isEmpty {
                    Button {
                        viewModel.locationQuery = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(Color.qkMuted.opacity(0.6))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

            // Dates
            VStack(spacing: 8) {
                Toggle(isOn: $viewModel.useDates.animation(.easeInOut(duration: 0.2))) {
                    Label("Add dates", systemImage: "calendar")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color.qkInk)
                }
                .tint(.qkBurgundy)

                if viewModel.useDates {
                    DatePicker("Check-in", selection: $viewModel.checkIn, displayedComponents: .date)
                        .font(.subheadline)
                        .foregroundStyle(Color.qkInk)
                        .tint(.qkBurgundy)
                    DatePicker("Check-out", selection: $viewModel.checkOut, in: viewModel.checkIn..., displayedComponents: .date)
                        .font(.subheadline)
                        .foregroundStyle(Color.qkInk)
                        .tint(.qkBurgundy)
                }
            }

            // Guests
            Stepper(value: $viewModel.guests, in: 1...20) {
                HStack(spacing: 8) {
                    Image(systemName: "person.2.fill").foregroundStyle(Color.qkBurgundy)
                    Text("\(viewModel.guests) guest\(viewModel.guests == 1 ? "" : "s")")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color.qkInk)
                }
            }
            .tint(.qkBurgundy)

            // Actions
            HStack(spacing: 12) {
                Button {
                    Task { await viewModel.clear() }
                } label: {
                    Text("Clear")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .frame(height: 46)
                        .background(Color.qkTan)
                        .foregroundStyle(Color.qkInk)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)

                Button {
                    Task { await viewModel.search() }
                } label: {
                    HStack(spacing: 8) {
                        if viewModel.isLoading {
                            ProgressView().tint(.white)
                        } else {
                            Image(systemName: "magnifyingglass")
                            Text("Search").fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 46)
                    .background(Color.qkBurgundy)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(viewModel.isLoading)
            }
        }
        .padding(16)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: Color.black.opacity(0.06), radius: 12, x: 0, y: 6)
    }
}

/// A single stay card in the feed.
struct ListingCard: View {
    let listing: Listing

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topTrailing) {
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
                .frame(height: 220)
                .clipped()

                if listing.isGuestFavorite == true {
                    Text("Guest favorite")
                        .font(.caption2).fontWeight(.bold)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(.ultraThinMaterial)
                        .clipShape(Capsule())
                        .padding(12)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(listing.title)
                        .font(.headline)
                        .foregroundStyle(Color.qkInk)
                        .lineLimit(1)
                    Spacer()
                    if listing.location != nil {
                        Label("", systemImage: "mappin.circle.fill")
                            .foregroundStyle(Color.qkBurgundy.opacity(0.7))
                            .labelStyle(.iconOnly)
                    }
                }
                if let location = listing.location {
                    Text(location)
                        .font(.subheadline)
                        .foregroundStyle(Color.qkMuted)
                        .lineLimit(1)
                }
                HStack(spacing: 4) {
                    Text(listing.priceText).fontWeight(.bold).foregroundStyle(Color.qkInk)
                    Text("night").foregroundStyle(Color.qkMuted)
                }
                .font(.subheadline)
                .padding(.top, 2)
            }
            .padding(14)
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: Color.black.opacity(0.06), radius: 12, x: 0, y: 6)
    }
}
