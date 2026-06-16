import SwiftUI

// Section 10 — Natural-language search.
//
// A presented sheet where a guest types a plain-language query (English or
// Arabic) and the AI parses it into structured filters + returns matching
// listings (`POST /api/local/ai/search`). The parsed filters render as chips so
// the guest sees how their words were understood; results reuse the same
// `ListingCard` the Explore list uses, and tapping one opens `ListingDetailView`.
// This is an *additional* discovery mode — the existing `SearchHeader` on Explore
// keeps working untouched. Bilingual + RTL-safe; DesignKit tokens.

/// Loads AI search results for `AISearchView`.
@MainActor
final class AISearchViewModel: ObservableObject {
    @Published var query = ""
    @Published var result: AISearchResult?
    @Published var isLoading = false
    @Published var errorMessage: String?
    /// True once a search has been run, to switch the empty-state copy from the
    /// initial prompt to "no matches".
    @Published var hasSearched = false

    /// Run the natural-language search. No-ops on an empty query.
    func run() async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        do {
            result = try await AIService.shared.search(query: trimmed)
            hasSearched = true
        } catch let error as AIServiceError {
            errorMessage = error.localizedMessage
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    /// Reset to the initial prompt state.
    func clear() {
        query = ""
        result = nil
        errorMessage = nil
        hasSearched = false
    }

    /// The parsed filter chip labels (empty when nothing was parsed).
    var filterChips: [String] { result?.filters.chips ?? [] }

    /// The matched listings (empty until a search returns).
    var listings: [Listing] { result?.listings ?? [] }
}

/// The natural-language search sheet. Owns its own `NavigationStack` so results
/// can push `ListingDetailView`. Presented from the Explore screen.
struct AISearchView: View {
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = AISearchViewModel()
    @FocusState private var searchFocused: Bool
    /// Present the auth sheet when a signed-out visitor taps a result's heart.
    @State private var showingAuth = false

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()
                VStack(spacing: 12) {
                    searchBar
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                    content
                }
            }
            .navigationTitle(loc.t("ai.aiSearchTitle"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.qkCream, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(loc.t("common.done")) { dismiss() }
                        .tint(.qkBurgundy)
                }
            }
            .navigationDestination(for: Listing.self) { listing in
                ListingDetailView(listing: listing)
            }
        }
        .tint(.qkBurgundy)
        .sheet(isPresented: $showingAuth) {
            AuthView().environmentObject(auth)
        }
        .onChange(of: auth.isAuthenticated) { _, isAuthed in
            if isAuthed { showingAuth = false }
        }
        .task {
            // Focus the field on present for an immediate typing experience.
            try? await Task.sleep(nanoseconds: 350_000_000)
            searchFocused = true
        }
    }

    // MARK: - Search bar

    /// A rounded field with a leading magnifier and a trailing "Ask AI" action.
    private var searchBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "sparkles")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.qkBurgundy)

            TextField(loc.t("ai.aiSearchPlaceholder"), text: $viewModel.query, axis: .horizontal)
                .focused($searchFocused)
                .submitLabel(.search)
                .foregroundStyle(Color.qkInk)
                .onSubmit { Task { await viewModel.run() } }

            if !viewModel.query.isEmpty {
                Button {
                    viewModel.clear()
                    searchFocused = true
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(Color.qkMuted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(loc.t("ai.search.clear"))
            }

            Button {
                searchFocused = false
                Task { await viewModel.run() }
            } label: {
                Group {
                    if viewModel.isLoading {
                        ProgressView().controlSize(.small).tint(.qkCream)
                    } else {
                        Text(loc.t("ai.aiSearch"))
                            .font(.system(size: 13, weight: .bold))
                    }
                }
                .foregroundStyle(Color.qkCream)
                .padding(.horizontal, 14)
                .frame(height: 36)
                .background(LinearGradient.qkBurgundyCTA)
                .clipShape(Capsule())
                .opacity(canSearch ? 1 : 0.55)
            }
            .buttonStyle(.qkTap)
            .disabled(!canSearch)
        }
        .padding(.leading, 16)
        .padding(.trailing, 6)
        .frame(height: 56)
        .background(Color.white)
        .clipShape(Capsule(style: .continuous))
        .overlay(Capsule(style: .continuous).strokeBorder(Color.qkTan, lineWidth: 1))
        .shadow(color: Color.black.opacity(0.06), radius: 10, x: 0, y: 5)
    }

    private var canSearch: Bool {
        !viewModel.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !viewModel.isLoading
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.result == nil {
            VStack(spacing: 12) {
                ProgressView().tint(.qkBurgundy)
                Text(loc.t("ai.searching"))
                    .font(.subheadline)
                    .foregroundStyle(Color.qkMuted)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let error = viewModel.errorMessage {
                        errorNote(error)
                    }

                    if !viewModel.filterChips.isEmpty {
                        parsedFiltersSection
                    }

                    if viewModel.hasSearched {
                        results
                    } else if viewModel.errorMessage == nil {
                        prompt
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .padding(.bottom, 32)
            }
        }
    }

    /// The "Understood as" chips reflecting the AI-parsed filters.
    private var parsedFiltersSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            QKEyebrow(text: loc.t("ai.parsedFilters"), color: .qkGoldDeep)
            FlowChips(labels: viewModel.filterChips)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .qkCard(cornerRadius: 18)
    }

    @ViewBuilder
    private var results: some View {
        if viewModel.listings.isEmpty {
            emptyState(icon: "magnifyingglass", text: loc.t("ai.search.empty"))
        } else {
            Text(loc.t("ai.search.resultsCount")
                .replacingOccurrences(of: "%@", with: "\(viewModel.listings.count)"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
                .frame(maxWidth: .infinity, alignment: .leading)

            LazyVStack(spacing: 20) {
                ForEach(viewModel.listings) { listing in
                    NavigationLink(value: listing) {
                        ListingCard(listing: listing, onRequireSignIn: { showingAuth = true })
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    /// The initial prompt shown before any search has run.
    private var prompt: some View {
        emptyState(icon: "sparkles", text: loc.t("ai.search.prompt"))
    }

    private func emptyState(icon: String, text: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 44))
                .foregroundStyle(Color.qkBurgundy.opacity(0.6))
            Text(text)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.qkMuted)
                .padding(.horizontal, 28)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }

    private func errorNote(_ message: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.qkBurgundy)
            Text(message)
                .font(.footnote)
                .foregroundStyle(Color.qkInk)
            Spacer(minLength: 0)
        }
        .padding(12)
        .qkCard(cornerRadius: 14)
    }
}

/// A simple wrapping flow of read-only chips (used for the parsed AI filters).
/// `LazyVGrid` with an adaptive column gives a wrap without a custom layout, and
/// stays RTL-safe via leading alignment.
private struct FlowChips: View {
    let labels: [String]

    var body: some View {
        let columns = [GridItem(.adaptive(minimum: 80), spacing: 8, alignment: .leading)]
        LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
            ForEach(Array(labels.enumerated()), id: \.offset) { _, label in
                Text(label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.qkBurgundy)
                    .lineLimit(1)
                    .padding(.horizontal, 12)
                    .frame(height: 32)
                    .frame(maxWidth: .infinity)
                    .background(Color.qkTan)
                    .clipShape(Capsule())
                    .overlay(Capsule().strokeBorder(Color.qkBurgundy.opacity(0.16), lineWidth: 1))
            }
        }
    }
}
