import SwiftUI

/// Drives the AI travel-concierge conversation: holds the `[AIMessage]` history,
/// sends a turn, and appends streamed deltas to the last assistant message live.
/// Networking lives in `AITravelChatService`.
@MainActor
final class AITravelChatViewModel: ObservableObject {
    /// The full conversation (user + assistant turns). Drives the transcript.
    @Published var messages: [AIMessage] = []
    @Published var draft = ""
    /// True from the moment a turn is sent until the stream completes/fails.
    @Published var isStreaming = false
    /// True while we're waiting for the *first* token of the current reply, so
    /// the bubble shows the animated dots instead of an empty bubble.
    @Published var awaitingFirstToken = false
    /// An error from the last attempt, shown as an inline error bubble + retry.
    @Published var errorMessage: String?

    /// The user turns we last sent, kept so "Retry" can resubmit after a failure
    /// (the failed assistant placeholder is rolled back first).
    private var lastSentMessages: [AIMessage] = []

    var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isStreaming
    }

    /// True before the first turn — the view shows the greeting + suggestions.
    var isEmpty: Bool { messages.isEmpty }

    /// Send the current draft (or a tapped suggestion).
    func send(_ text: String? = nil) {
        let body = (text ?? draft).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty, !isStreaming else { return }
        draft = ""
        errorMessage = nil
        messages.append(AIMessage(role: "user", content: body))
        Task { await runStream() }
    }

    /// Re-send the last user turn after an error (drops the failed reply first).
    func retry() {
        guard !isStreaming else { return }
        errorMessage = nil
        // Remove a trailing empty assistant placeholder left by the failed turn.
        if messages.last?.role == "assistant", messages.last?.content.isEmpty == true {
            messages.removeLast()
        }
        Task { await runStream() }
    }

    /// Append an empty assistant turn, open the stream, and grow that turn as
    /// deltas land. Surfaces a friendly error and rolls back the placeholder on
    /// failure.
    private func runStream() async {
        isStreaming = true
        awaitingFirstToken = true
        defer {
            isStreaming = false
            awaitingFirstToken = false
        }

        // The conversation to send is everything so far (the just-added user turn
        // is already included). Snapshot it for a possible retry.
        lastSentMessages = messages
        let assistantIndex = messages.count
        messages.append(AIMessage(role: "assistant", content: ""))

        do {
            try await AITravelChatService.shared.stream(messages: lastSentMessages) { [weak self] delta in
                guard let self, self.messages.indices.contains(assistantIndex) else { return }
                self.awaitingFirstToken = false
                self.messages[assistantIndex].content += delta
            }
            // A reply with no text at all reads as a soft failure — surface it.
            if messages.indices.contains(assistantIndex),
               messages[assistantIndex].content.isEmpty {
                messages.remove(at: assistantIndex)
                errorMessage = L.t("ai.error.generic")
            }
        } catch {
            // Drop the empty placeholder so the failed turn doesn't linger.
            if messages.indices.contains(assistantIndex),
               messages[assistantIndex].content.isEmpty {
                messages.remove(at: assistantIndex)
            }
            if let aiError = error as? AIChatError {
                errorMessage = aiError.localizedMessage
            } else {
                errorMessage = L.t("ai.error.generic")
            }
        }
    }
}

/// The AI travel-concierge chat sheet. A branded burgundy header, a scrolling
/// transcript of bubbles (user = burgundy trailing, assistant = cream leading),
/// a greeting + suggestion chips before the first turn, and a disabled-while-
/// streaming input bar. Auto-scrolls to the newest content; honors RTL + Reduce
/// Motion; fully localized.
struct AITravelChatView: View {
    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = AITravelChatViewModel()
    @FocusState private var inputFocused: Bool

    /// The starter prompts shown in the empty state. Each prefills + sends.
    private var suggestions: [String] {
        [
            loc.t("ai.suggest.beach"),
            loc.t("ai.suggest.summer"),
            loc.t("ai.suggest.family"),
            loc.t("ai.suggest.dive"),
        ]
    }

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                transcript
                composer
            }
        }
        .task {
            // CLI screenshot hook: auto-ask once so a live streamed reply can be
            // captured without driving the UI by hand.
            if UserDefaults.standard.bool(forKey: "uitestAIChat"), viewModel.isEmpty {
                viewModel.send("Where should I go this weekend near Cairo?")
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: "sparkles")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Color.qkGoldLight)
                .frame(width: 42, height: 42)
                .background(Color.qkCream.opacity(0.16), in: Circle())
                .overlay(Circle().strokeBorder(Color.qkCream.opacity(0.28), lineWidth: 1))

            VStack(alignment: .leading, spacing: 2) {
                Text(loc.t("ai.title"))
                    .font(.system(size: 19, weight: .heavy, design: .serif))
                    .foregroundStyle(Color.qkCream)
                Text(loc.t("ai.subtitle"))
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(Color.qkCream.opacity(0.82))
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.qkCream)
                    .frame(width: 36, height: 36)
                    .background(Color.qkCream.opacity(0.16), in: Circle())
                    .overlay(Circle().strokeBorder(Color.qkCream.opacity(0.28), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(loc.t("common.close"))
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient.qkBurgundyCTA
                .overlay(
                    RadialGradient(
                        colors: [Color.qkGoldLight.opacity(0.22), .clear],
                        center: .topTrailing, startRadius: 4, endRadius: 220
                    )
                )
        )
    }

    // MARK: - Transcript

    private var transcript: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    if viewModel.isEmpty {
                        emptyState
                    } else {
                        ForEach(Array(viewModel.messages.enumerated()), id: \.offset) { index, message in
                            AIChatBubble(
                                message: message,
                                showTyping: showTyping(for: index)
                            )
                            .id(index)
                        }
                    }
                    if let error = viewModel.errorMessage {
                        errorBubble(error)
                    }
                    Color.clear.frame(height: 1).id(Self.bottomAnchor)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: viewModel.messages) { _, _ in scrollToBottom(proxy) }
            .onChange(of: viewModel.awaitingFirstToken) { _, _ in scrollToBottom(proxy) }
            .onChange(of: viewModel.errorMessage) { _, _ in scrollToBottom(proxy) }
        }
    }

    /// The trailing assistant bubble shows the typing dots while we wait for the
    /// first token (its content is still empty).
    private func showTyping(for index: Int) -> Bool {
        viewModel.awaitingFirstToken
            && index == viewModel.messages.count - 1
            && viewModel.messages[index].role == "assistant"
            && viewModel.messages[index].content.isEmpty
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        withAnimation(.easeOut(duration: 0.2)) {
            proxy.scrollTo(Self.bottomAnchor, anchor: .bottom)
        }
    }

    // MARK: - Empty state (greeting + suggestions)

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: "sparkles")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(Color.qkBurgundy)
                Text(loc.t("ai.greeting.title"))
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Color.qkInk)
                Text(loc.t("ai.greeting.body"))
                    .font(.system(size: 14))
                    .foregroundStyle(Color.qkMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .qkCard(cornerRadius: 22, lifts: false)

            VStack(alignment: .leading, spacing: 9) {
                ForEach(suggestions, id: \.self) { suggestion in
                    Button {
                        inputFocused = false
                        viewModel.send(suggestion)
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "sparkle")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.qkGold)
                            Text(suggestion)
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Color.qkInk)
                                .multilineTextAlignment(.leading)
                            Spacer(minLength: 8)
                            Image(systemName: "arrow.up.forward")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Color.qkBurgundy.opacity(0.6))
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 13)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.qkSurface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .strokeBorder(Color.qkInk.opacity(0.06), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.qkTap)
                }
            }
        }
        .padding(.top, 4)
    }

    // MARK: - Error bubble

    private func errorBubble(_ message: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.qkBurgundy)
                    Text(message)
                        .font(.system(size: 14))
                        .foregroundStyle(Color.qkInk)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Button {
                    viewModel.retry()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 12, weight: .bold))
                        Text(loc.t("common.retry"))
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundStyle(Color.qkCream)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(LinearGradient.qkBurgundyCTA)
                    .clipShape(Capsule())
                }
                .buttonStyle(QKPressStyle())
            }
            .padding(14)
            .background(Color.qkBurgundy.opacity(0.06))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(Color.qkBurgundy.opacity(0.18), lineWidth: 1)
            )
            Spacer(minLength: 36)
        }
    }

    // MARK: - Composer

    private var composer: some View {
        HStack(spacing: 10) {
            TextField(loc.t("ai.input.placeholder"), text: $viewModel.draft, axis: .vertical)
                .lineLimit(1...4)
                .focused($inputFocused)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color.qkSurface)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(Color.qkBurgundy.opacity(0.12), lineWidth: 1)
                )
                .foregroundStyle(Color.qkInk)
                .disabled(viewModel.isStreaming)
                .onSubmit { sendDraft() }

            Button {
                sendDraft()
            } label: {
                ZStack {
                    if viewModel.isStreaming {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: "arrow.up")
                            .font(.headline.weight(.bold))
                    }
                }
                .frame(width: 48, height: 48)
                .background(viewModel.canSend ? AnyShapeStyle(LinearGradient.qkBurgundyCTA)
                                              : AnyShapeStyle(Color.qkBurgundy.opacity(0.4)))
                .foregroundStyle(Color.qkCream)
                .clipShape(Circle())
            }
            .buttonStyle(QKPressStyle())
            .disabled(!viewModel.canSend)
            .accessibilityLabel(loc.t("ai.send"))
        }
        .padding(.horizontal, 14)
        .padding(.top, 10)
        .padding(.bottom, 12)
        .background(.ultraThinMaterial)
    }

    private func sendDraft() {
        inputFocused = false
        viewModel.send()
    }

    private static let bottomAnchor = "qk-ai-chat-bottom"
}

/// One concierge bubble. The user's turn sits trailing in a burgundy bubble with
/// cream text; the assistant's sits leading in a white bubble with ink text. When
/// `showTyping` is set (assistant, awaiting the first token) it renders the
/// animated dots instead of text. Mirrors `ChatBubble` shapes (18pt corners).
struct AIChatBubble: View {
    let message: AIMessage
    var showTyping: Bool = false

    private var isUser: Bool { message.role == "user" }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 44) }
            Group {
                if showTyping {
                    AITypingIndicator()
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                } else {
                    Text(message.content)
                        .font(.system(size: 15))
                        .foregroundStyle(isUser ? Color.qkCream : Color.qkInk)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                }
            }
            .background(
                Group {
                    if isUser {
                        LinearGradient.qkBurgundyCTA
                    } else {
                        Color.qkSurface
                    }
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(isUser ? Color.clear : Color.qkInk.opacity(0.06), lineWidth: 1)
            )
            if !isUser { Spacer(minLength: 44) }
        }
        .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)
    }
}

/// Three burgundy dots that fade up and down in sequence — the "concierge is
/// typing" cue shown until the first token lands. Honors Reduce Motion (the dots
/// just rest at a steady opacity).
struct AITypingIndicator: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase = false

    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(Color.qkBurgundy.opacity(0.55))
                    .frame(width: 7, height: 7)
                    .opacity(reduceMotion ? 0.6 : (phase ? 1 : 0.3))
                    .animation(
                        reduceMotion ? nil :
                            .easeInOut(duration: 0.6)
                            .repeatForever(autoreverses: true)
                            .delay(Double(i) * 0.2),
                        value: phase
                    )
            }
        }
        .onAppear { phase = true }
        .accessibilityLabel(L.t("ai.typing"))
    }
}
