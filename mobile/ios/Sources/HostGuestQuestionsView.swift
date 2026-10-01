import SwiftUI

// The host's "Guest questions" — every public comment across their listings
// (`GET /api/local/host/comments`), unanswered first, with an inline reply.
// It sits on the host dashboard where the Messages entry used to be.

// MARK: - View model

@MainActor
final class HostGuestQuestionsViewModel: CommentThreadModel {
    @Published var unanswered = 0

    func load() async {
        isLoading = true
        defer { isLoading = false; hasLoaded = true }
        do {
            let page = try await ListingCommentsService.shared.fetchHostComments()
            comments = page.comments
            unanswered = page.unanswered
            loadError = nil
        } catch CommentError.notSignedIn {
            loadError = L.t("comments.error.signIn")
        } catch {
            loadError = L.t("hostQuestions.error")
        }
    }

    /// Recount locally after a reply is saved or removed, so the badge moves
    /// without a reload. Rows stay where they are — re-sorting under the
    /// host's thumb right after they reply would be disorienting.
    override func didUpdate(_ comment: ListingComment) {
        unanswered = comments.filter { $0.reply == nil }.count
    }

    override func didRemove(_ comment: ListingComment) {
        unanswered = comments.filter { $0.reply == nil }.count
    }
}

// MARK: - Screen

struct HostGuestQuestionsView: View {
    @EnvironmentObject private var loc: LocalizationManager
    @StateObject private var model = HostGuestQuestionsViewModel()
    /// The listing whose detail is being opened from a row.
    @State private var openingListingID: String?

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            content
        }
        .navigationTitle(loc.t("hostQuestions.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Color.qkCream, for: .navigationBar)
        .tint(.qkBurgundy)
        .task { await model.load() }
        .navigationDestination(item: $openingListingID) { id in
            CommentListingLoader(listingID: id)
        }
        .alert(
            loc.t("comments.error.title"),
            isPresented: Binding(get: { model.actionError != nil }, set: { if !$0 { model.actionError = nil } })
        ) {
            Button(loc.t("common.done"), role: .cancel) {}
        } message: {
            Text(model.actionError ?? "")
        }
    }

    @ViewBuilder
    private var content: some View {
        if model.isLoading && !model.hasLoaded {
            ProgressView(loc.t("hostQuestions.loading"))
                .tint(.qkBurgundy)
                .foregroundStyle(Color.qkMuted)
        } else if let error = model.loadError, model.comments.isEmpty {
            emptyState(icon: "exclamationmark.bubble", title: error, body: nil, retry: true)
        } else if model.comments.isEmpty {
            emptyState(
                icon: "bubble.left.and.text.bubble.right",
                title: loc.t("hostQuestions.empty.title"),
                body: loc.t("hostQuestions.empty.body"),
                retry: false
            )
        } else {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    summary
                    if let warning = model.warning, model.replyingTo == nil {
                        PolicyWarningBanner(text: warning.text, isAcknowledging: model.isAcknowledging) {
                            Task { await model.acknowledgeWarning() }
                        }
                    }
                    ForEach(model.comments) { comment in
                        VStack(alignment: .leading, spacing: 6) {
                            if comment.reply == nil {
                                Text(loc.t("hostQuestions.awaiting"))
                                    .font(.caption2.weight(.bold))
                                    .textCase(.uppercase)
                                    .foregroundStyle(Color.qkGold)
                            }
                            ListingCommentRow(
                                model: model,
                                comment: comment,
                                hostMode: true,
                                showsListing: true,
                                onOpenListing: comment.listingID.isEmpty ? nil : {
                                    openingListingID = comment.listingID
                                }
                            )
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .refreshable { await model.load() }
        }
    }

    private var summary: some View {
        HStack(spacing: 10) {
            Image(systemName: model.unanswered > 0 ? "questionmark.bubble.fill" : "checkmark.bubble.fill")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Color.qkBurgundy)
            Text(model.unanswered > 0
                 ? String(format: loc.t("hostQuestions.unanswered"), "\(model.unanswered)")
                 : loc.t("hostQuestions.allAnswered"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.qkInk)
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Color.qkBurgundy.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func emptyState(icon: String, title: String, body: String?, retry: Bool) -> some View {
        VStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 44))
                .foregroundStyle(Color.qkBurgundy.opacity(0.6))
            Text(title)
                .font(.headline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.qkInk)
            if let body {
                Text(body)
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color.qkMuted)
            }
            if retry {
                Button(loc.t("common.retry")) {
                    Task { await model.load() }
                }
                .font(.subheadline.weight(.semibold))
                .tint(.qkBurgundy)
            }
        }
        .padding(.horizontal, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Dashboard entry

/// The host dashboard card into `HostGuestQuestionsView`, with the unanswered
/// count as a badge. Reloads the count every time the dashboard reappears so
/// it drops after the host answers.
struct HostGuestQuestionsEntry: View {
    @EnvironmentObject private var loc: LocalizationManager
    @State private var unanswered = 0

    var body: some View {
        NavigationLink {
            HostGuestQuestionsView()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "bubble.left.and.text.bubble.right.fill")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(loc.t("hostQuestions.title"))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.qkInk)
                    Text(loc.t("hostQuestions.subtitle"))
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
                Spacer(minLength: 8)
                if unanswered > 0 {
                    Text("\(unanswered)")
                        .font(.caption.weight(.bold).monospacedDigit())
                        .foregroundStyle(Color.qkCream)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.qkBurgundy)
                        .clipShape(Capsule())
                        .accessibilityLabel(String(format: loc.t("hostQuestions.unanswered"), "\(unanswered)"))
                }
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
        .onAppear {
            Task {
                if let page = try? await ListingCommentsService.shared.fetchHostComments() {
                    unanswered = page.unanswered
                }
            }
        }
    }
}

// MARK: - Listing loader

/// Fetches a listing by id and shows its detail scrolled to the comments —
/// used where only the id is known (a host-feed row).
struct CommentListingLoader: View {
    let listingID: String
    @EnvironmentObject private var loc: LocalizationManager
    @State private var listing: Listing?
    @State private var failed = false

    var body: some View {
        Group {
            if let listing {
                ListingDetailView(listing: listing, focusComments: true)
            } else if failed {
                VStack(spacing: 12) {
                    Text(loc.t("hostQuestions.listingUnavailable"))
                        .font(.subheadline)
                        .foregroundStyle(Color.qkMuted)
                        .multilineTextAlignment(.center)
                    Button(loc.t("common.retry")) { Task { await load() } }
                        .tint(.qkBurgundy)
                }
                .padding(32)
            } else {
                ProgressView().tint(.qkBurgundy)
            }
        }
        .task { if listing == nil { await load() } }
    }

    private func load() async {
        failed = false
        if let fetched = try? await SupabaseService.shared.fetchListing(id: listingID) {
            listing = fetched
        } else {
            failed = true
        }
    }
}
