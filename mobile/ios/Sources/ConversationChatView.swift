import SwiftUI

/// Drives a pre-booking conversation thread: initial load, send, and a ~4s
/// poll. Networking lives in `ConversationService` (`fetchMessages` /
/// `sendMessage`). Mirrors `ChatViewModel` — including keeping the typed draft
/// on a failed send so the server's reason (e.g. redacted contact info) can be
/// read and the message edited.
@MainActor
final class ConversationChatViewModel: ObservableObject {
    @Published var messages: [ConversationMessage] = []
    @Published var draft = ""
    @Published var isLoading = false
    @Published var isSending = false
    @Published var errorMessage: String?

    let conversationID: String

    init(conversationID: String) {
        self.conversationID = conversationID
    }

    /// True once at least one fetch has completed, so the poll doesn't flash the
    /// spinner over an already-rendered thread.
    private var hasLoaded = false

    var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSending
    }

    /// Load the thread. `silent` is used by the poll so it doesn't toggle the
    /// loading spinner or surface transient errors over existing content.
    func load(silent: Bool = false) async {
        if !silent && !hasLoaded { isLoading = true }
        do {
            let fetched = try await ConversationService.shared.fetchMessages(conversationID: conversationID)
            messages = fetched
            errorMessage = nil
        } catch HostError.notSignedIn {
            if !silent { errorMessage = L.t("messages.signIn") }
        } catch {
            if !silent { errorMessage = error.localizedDescription }
        }
        isLoading = false
        hasLoaded = true
    }

    /// POST the draft, clear it, then reload so the new message (and any that
    /// arrived meanwhile) appear in order. On failure the typed text is KEPT so
    /// the user can edit and resend, and the server's message surfaces inline.
    func send() async {
        let body = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }
        isSending = true
        // Clear any prior send error so a fresh attempt starts clean.
        errorMessage = nil
        defer { isSending = false }
        do {
            _ = try await ConversationService.shared.sendMessage(conversationID: conversationID, body: body)
            // Only clear the draft once the send actually succeeded.
            draft = ""
            await load(silent: true)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// A pre-booking guest ⇄ host conversation thread (no booking required).
/// Reuses the booking chat's bubbles (`ChatBubble`) and composer layout; polls
/// the backend every ~4 seconds while on screen.
struct ConversationChatView: View {
    @EnvironmentObject private var loc: LocalizationManager
    @StateObject private var viewModel: ConversationChatViewModel
    @FocusState private var inputFocused: Bool

    /// Listing title shown as a fallback nav title.
    let listingTitle: String?
    /// The other party's display name — the nav title when present.
    let otherName: String?

    /// Fires every ~4s to refresh the thread.
    private let pollTimer = Timer.publish(every: 4, on: .main, in: .common).autoconnect()

    init(conversationID: String, listingTitle: String? = nil, otherName: String? = nil) {
        _viewModel = StateObject(wrappedValue: ConversationChatViewModel(conversationID: conversationID))
        self.listingTitle = listingTitle
        self.otherName = otherName
    }

    /// Convenience for pushing from a `ConversationTarget` navigation value.
    init(target: ConversationTarget) {
        self.init(conversationID: target.id, listingTitle: target.listingTitle, otherName: target.otherName)
    }

    private var navTitle: String {
        let other = otherName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !other.isEmpty { return other }
        let listing = listingTitle?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return listing.isEmpty ? loc.t("messages.title") : listing
    }

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            VStack(spacing: 0) {
                messageList
                composer
            }
        }
        .navigationTitle(navTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color.qkCream, for: .navigationBar)
        .task { await viewModel.load() }
        .onReceive(pollTimer) { _ in
            Task { await viewModel.load(silent: true) }
        }
    }

    // MARK: - Message list

    @ViewBuilder
    private var messageList: some View {
        if viewModel.isLoading && viewModel.messages.isEmpty {
            Spacer()
            ProgressView(loc.t("chat.loading"))
                .tint(.qkBurgundy)
                .foregroundStyle(Color.qkMuted)
            Spacer()
        } else if viewModel.messages.isEmpty {
            Spacer()
            emptyState
            Spacer()
        } else {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(viewModel.messages) { message in
                            ChatBubble(message: message.asChatMessage, isMine: message.mine)
                                .id(message.id)
                        }
                        // Anchor to scroll to the newest message.
                        Color.clear.frame(height: 1).id(Self.bottomAnchor)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                }
                .onChange(of: viewModel.messages) { _, _ in
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo(Self.bottomAnchor, anchor: .bottom)
                    }
                }
                .onAppear {
                    proxy.scrollTo(Self.bottomAnchor, anchor: .bottom)
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 44))
                .foregroundStyle(Color.qkBurgundy.opacity(0.5))
            Text(loc.t("chat.noMessages"))
                .font(.headline)
                .foregroundStyle(Color.qkInk)
            Text(loc.t("chat.sayHello"))
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.qkMuted)
                .padding(.horizontal, 40)
        }
    }

    // MARK: - Composer

    private var composer: some View {
        VStack(spacing: 6) {
            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
            }
            HStack(spacing: 10) {
                TextField(loc.t("chat.placeholder"), text: $viewModel.draft, axis: .vertical)
                    .lineLimit(1...4)
                    .focused($inputFocused)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(
                                (viewModel.errorMessage != nil
                                    ? Color.qkBurgundy.opacity(0.55)
                                    : Color.qkBurgundy.opacity(0.12)),
                                lineWidth: 1
                            )
                    )
                    .foregroundStyle(Color.qkInk)
                    .onSubmit { Task { await viewModel.send() } }
                    // Clear the inline error as soon as the user edits, so the
                    // warning dismisses while they fix the message.
                    .onChange(of: viewModel.draft) { _, _ in
                        if viewModel.errorMessage != nil { viewModel.errorMessage = nil }
                    }

                Button {
                    inputFocused = false
                    Task { await viewModel.send() }
                } label: {
                    ZStack {
                        if viewModel.isSending {
                            ProgressView().tint(.white)
                        } else {
                            Image(systemName: "arrow.up")
                                .accessibilityLabel(L.t("chat.send"))
                                .font(.headline.weight(.bold))
                        }
                    }
                    .frame(width: 44, height: 44)
                    .background(viewModel.canSend ? Color.qkBurgundy : Color.qkBurgundy.opacity(0.4))
                    .foregroundStyle(.white)
                    .clipShape(Circle())
                }
                .disabled(!viewModel.canSend)
            }
            .padding(.horizontal, 12)
            .padding(.top, 8)
            .padding(.bottom, 10)
        }
        .background(Color.qkTan.opacity(0.6))
    }

    private static let bottomAnchor = "qk-conversation-bottom"
}

/// "Message host" entry screen: resolves (or reuses) the guest ⇄ host conversation
/// for a listing via `ConversationService.openConversation`, then renders the
/// thread. Pushed from the listing detail — mirroring the web's message-host
/// drawer and Android's PreBookingChatScreen, which also resolve the conversation
/// on appear. A 400 ("You can't message your own listing", …) or a sign-out shows
/// an inline error state with a retry.
struct MessageHostView: View {
    let listingID: String
    let hostName: String?

    @EnvironmentObject private var loc: LocalizationManager
    @State private var target: ConversationTarget?
    @State private var errorMessage: String?
    @State private var attempt = 0

    var body: some View {
        Group {
            if let target {
                ConversationChatView(target: target)
            } else if let errorMessage {
                VStack(spacing: 12) {
                    Spacer()
                    Image(systemName: "bubble.left.and.bubble.right")
                        .font(.system(size: 44))
                        .foregroundStyle(Color.qkBurgundy.opacity(0.5))
                    Text(errorMessage)
                        .font(.subheadline)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Color.qkMuted)
                        .padding(.horizontal, 40)
                    Button(loc.t("common.retry")) { attempt += 1 }
                        .buttonStyle(.borderedProminent)
                        .tint(.qkBurgundy)
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(LinearGradient.qkPageWash.ignoresSafeArea())
            } else {
                VStack {
                    Spacer()
                    ProgressView(loc.t("chat.loading"))
                        .tint(.qkBurgundy)
                        .foregroundStyle(Color.qkMuted)
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(LinearGradient.qkPageWash.ignoresSafeArea())
            }
        }
        .navigationTitle(hostName ?? loc.t("messages.title"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color.qkCream, for: .navigationBar)
        .task(id: attempt) {
            guard target == nil else { return }
            do {
                let opened = try await ConversationService.shared.openConversation(listingID: listingID)
                target = ConversationTarget(
                    id: opened.id,
                    listingTitle: opened.listingTitle,
                    otherName: hostName
                )
                errorMessage = nil
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
