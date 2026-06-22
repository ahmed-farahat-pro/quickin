import SwiftUI

/// Drives the per-booking chat thread: initial load, send, and a ~4s poll.
/// Networking lives in `HostService` (`fetchMessages` / `sendMessage`).
@MainActor
final class ChatViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var draft = ""
    @Published var isLoading = false
    @Published var isSending = false
    @Published var errorMessage: String?

    let bookingID: String

    init(bookingID: String) {
        self.bookingID = bookingID
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
            let fetched = try await HostService.shared.fetchMessages(bookingID: bookingID)
            messages = fetched
            errorMessage = nil
        } catch HostError.notSignedIn {
            if !silent { errorMessage = "Sign in to view this conversation." }
        } catch {
            if !silent { errorMessage = error.localizedDescription }
        }
        isLoading = false
        hasLoaded = true
    }

    /// POST the draft, clear it, then reload so the new message (and any that
    /// arrived meanwhile) appear in order.
    ///
    /// On failure (e.g. the backend's 400 "sharing phone numbers in chat isn't
    /// allowed…") the typed text is KEPT so the user can edit and resend, and the
    /// server's message is surfaced inline via `errorMessage`.
    func send() async {
        let body = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }
        isSending = true
        // Clear any prior send error so a fresh attempt starts clean.
        errorMessage = nil
        defer { isSending = false }
        do {
            _ = try await HostService.shared.sendMessage(bookingID: bookingID, body: body)
            // Only clear the draft once the send actually succeeded.
            draft = ""
            await load(silent: true)
        } catch {
            // Surface the server's reason (phone-number block, etc.) and leave
            // `draft` untouched so nothing the user typed is lost.
            errorMessage = error.localizedDescription
        }
    }
}

/// A per-booking chat thread (host ↔ guest). My messages sit right-aligned in a
/// burgundy bubble; the other party's sit left-aligned in a tan bubble — decided
/// by comparing each message's `senderID` to the signed-in user's id. Polls the
/// backend every ~4 seconds while on screen.
struct ChatView: View {
    @EnvironmentObject private var auth: AuthStore
    @StateObject private var viewModel: ChatViewModel
    @FocusState private var inputFocused: Bool

    /// Fires every ~4s to refresh the thread.
    private let pollTimer = Timer.publish(every: 4, on: .main, in: .common).autoconnect()

    init(bookingID: String) {
        _viewModel = StateObject(wrappedValue: ChatViewModel(bookingID: bookingID))
    }

    /// The signed-in user's id, used to align/colour each bubble.
    private var currentUserID: String? { auth.user?.id }

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            VStack(spacing: 0) {
                messageList
                composer
            }
        }
        .navigationTitle("Messages")
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
            ProgressView("Loading messages…")
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
                            ChatBubble(message: message, isMine: isMine(message))
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
            Text("No messages yet")
                .font(.headline)
                .foregroundStyle(Color.qkInk)
            Text("Say hello — start the conversation about this stay.")
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
                TextField("Message", text: $viewModel.draft, axis: .vertical)
                    .lineLimit(1...4)
                    .focused($inputFocused)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(
                                // Tint the border red while an error (e.g. the
                                // phone-number block) is showing, so the warning
                                // ties visually to the field the user must edit.
                                (viewModel.errorMessage != nil
                                    ? Color.qkBurgundy.opacity(0.55)
                                    : Color.qkBurgundy.opacity(0.12)),
                                lineWidth: 1
                            )
                    )
                    .foregroundStyle(Color.qkInk)
                    .onSubmit { Task { await viewModel.send() } }
                    // Clear the inline error as soon as the user edits, so the
                    // phone-block warning dismisses while they fix the message.
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

    // MARK: - Helpers

    /// Whether `message` was sent by the signed-in user. When the current id is
    /// unknown (shouldn't happen on an authed screen), treat as "other".
    private func isMine(_ message: ChatMessage) -> Bool {
        guard let currentUserID else { return false }
        return message.senderID == currentUserID
    }

    private static let bottomAnchor = "qk-chat-bottom"
}

/// One chat bubble. Mine: right-aligned, burgundy, white text. Other: left-
/// aligned, tan, ink text — with the sender's name above.
struct ChatBubble: View {
    let message: ChatMessage
    let isMine: Bool

    var body: some View {
        HStack {
            if isMine { Spacer(minLength: 48) }
            VStack(alignment: isMine ? .trailing : .leading, spacing: 3) {
                if !isMine, let name = message.senderName, !name.isEmpty {
                    Text(name)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Color.qkMuted)
                        .padding(.horizontal, 4)
                }
                Text(message.body)
                    .font(.body)
                    .foregroundStyle(isMine ? .white : Color.qkInk)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(isMine ? Color.qkBurgundy : Color.qkTan)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                let time = message.timeText
                if !time.isEmpty {
                    Text(time)
                        .font(.caption2)
                        .foregroundStyle(Color.qkMuted)
                        .padding(.horizontal, 4)
                }
            }
            if !isMine { Spacer(minLength: 48) }
        }
    }
}
