import SwiftUI

/// Loads the signed-in user's guest ⇄ host conversations from
/// `GET /api/local/chat` (newest activity first) for the Messages inbox.
@MainActor
final class MessagesViewModel: ObservableObject {
    @Published var conversations: [ConversationSummary] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var hasLoaded = false

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            conversations = try await ConversationService.shared.fetchConversations()
        } catch HostError.notSignedIn {
            errorMessage = "Sign in to see your messages."
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
        hasLoaded = true
    }
}

/// Messages INBOX — every guest ⇄ host conversation the signed-in user is part
/// of, newest activity first. Mirrors the web `/messages` page. Designed to be
/// pushed onto an existing navigation stack (e.g. from the Profile tab), so it
/// sets a title but not its own stack. Tapping a row pushes the thread.
struct MessagesView: View {
    @EnvironmentObject private var loc: LocalizationManager
    @StateObject private var viewModel = MessagesViewModel()

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            content
        }
        .navigationTitle(loc.t("messages.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Color.qkCream, for: .navigationBar)
        .tint(.qkBurgundy)
        .task { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.conversations.isEmpty {
            ProgressView(loc.t("chat.loading"))
                .tint(.qkBurgundy)
                .foregroundStyle(Color.qkMuted)
        } else if let error = viewModel.errorMessage, viewModel.conversations.isEmpty {
            emptyState(
                icon: "exclamationmark.bubble",
                title: loc.t("messages.error"),
                message: error,
                retry: true
            )
        } else if viewModel.conversations.isEmpty {
            emptyState(
                icon: "bubble.left.and.bubble.right",
                title: loc.t("messages.empty.title"),
                message: loc.t("messages.empty.body"),
                retry: false
            )
        } else {
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(viewModel.conversations) { convo in
                        NavigationLink {
                            ConversationChatView(
                                conversationID: convo.id,
                                listingTitle: convo.listingTitle,
                                otherName: convo.otherName
                            )
                        } label: {
                            ConversationRow(conversation: convo)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .refreshable { await viewModel.load() }
        }
    }

    private func emptyState(icon: String, title: String, message: String, retry: Bool) -> some View {
        VStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(Color.qkBurgundy.opacity(0.6))
            Text(title)
                .font(.headline)
                .foregroundStyle(Color.qkInk)
            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.qkMuted)
                .padding(.horizontal, 32)
            if retry {
                Button {
                    Task { await viewModel.load() }
                } label: {
                    Text(loc.t("common.retry"))
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
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// One inbox row: listing thumb, other party (+ "Host" badge when the signed-in
/// user is the host side), the listing title, and the last-message preview with
/// a relative timestamp.
private struct ConversationRow: View {
    let conversation: ConversationSummary

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            ListingImageView(url: conversation.listingImage, placeholderLabel: "")
                .frame(width: 54, height: 54)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(conversation.otherName ?? "")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.qkInk)
                        .lineLimit(1)
                    if conversation.isHost {
                        Text(L.t("messages.hostBadge"))
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Color.qkBurgundy)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(Color.qkGold.opacity(0.25))
                            .clipShape(Capsule())
                    }
                    Spacer(minLength: 4)
                    if !conversation.relativeTimeText.isEmpty {
                        Text(conversation.relativeTimeText)
                            .font(.caption2)
                            .foregroundStyle(Color.qkMuted.opacity(0.8))
                    }
                }
                if let title = conversation.listingTitle, !title.isEmpty {
                    Text(title)
                        .font(.caption)
                        .foregroundStyle(Color.qkBurgundy)
                        .lineLimit(1)
                }
                Text(conversation.lastMessage ?? L.t("messages.noMessages"))
                    .font(.footnote)
                    .foregroundStyle(Color.qkMuted)
                    .lineLimit(1)
            }

            Image(systemName: "chevron.forward")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.qkTan4)
        }
        .padding(14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
    }
}
