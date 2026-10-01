import SwiftUI

// Public "Questions & comments" on a listing — the replacement for host ⇄ guest
// messaging (2026-10-02). Anyone can read; a signed-in guest can ask; the
// listing's host answers with one reply per comment. See
// `ListingCommentsService` for the endpoints and `ListingCommentRules` for the
// pure rules.

// MARK: - Shared thread model

/// State + actions shared by the listing's comments section and the host's
/// "Guest questions" feed: the comment list, the inline host-reply composer,
/// deletes, and the policy-warning gate (HTTP 409) that blocks posting until
/// the user acknowledges a moderator's warning.
@MainActor
class CommentThreadModel: ObservableObject {
    @Published var comments: [ListingComment] = []
    @Published var isLoading = false
    @Published var hasLoaded = false
    @Published var loadError: String?

    /// The comment whose reply composer is open (nil when none).
    @Published var replyingTo: String?
    @Published var replyDraft = ""
    @Published var isSavingReply = false
    @Published var replyError: String?

    /// A moderator's unacknowledged warning. While set, the composers are
    /// replaced by `PolicyWarningBanner`; drafts are kept for the retry.
    @Published var warning: PendingWarning?
    @Published var isAcknowledging = false

    /// A failed delete, shown as an alert.
    @Published var actionError: String?
    /// Ids with a delete in flight (disables their buttons).
    @Published var busyIDs: Set<String> = []

    struct PendingWarning: Equatable {
        let id: String
        let text: String
    }

    /// The listing a comment belongs to, for the write endpoints.
    func listingID(for comment: ListingComment) -> String { comment.listingID }

    /// Hook for subclasses: a comment changed (reply saved / removed).
    func didUpdate(_ comment: ListingComment) {}
    /// Hook for subclasses: a comment was removed.
    func didRemove(_ comment: ListingComment) {}

    // MARK: Host reply

    func startReply(to comment: ListingComment) {
        replyingTo = comment.id
        replyDraft = comment.reply?.body ?? ""
        replyError = nil
    }

    func cancelReply() {
        replyingTo = nil
        replyDraft = ""
        replyError = nil
    }

    func saveReply(for comment: ListingComment) async {
        let body = ListingCommentRules.trimmed(replyDraft)
        guard ListingCommentRules.canSubmit(body), !isSavingReply else { return }
        isSavingReply = true
        replyError = nil
        defer { isSavingReply = false }
        do {
            let updated = try await ListingCommentsService.shared.reply(
                listingID: listingID(for: comment), commentID: comment.id, body: body
            )
            replace(comment, with: updated)
            replyingTo = nil
            replyDraft = ""
        } catch let CommentError.policyWarning(id, text) {
            warning = PendingWarning(id: id, text: text)
        } catch {
            replyError = CommentErrorText.text(error, fallbackKey: "comments.error.reply")
        }
    }

    func deleteReply(_ comment: ListingComment) async {
        guard !busyIDs.contains(comment.id) else { return }
        busyIDs.insert(comment.id)
        defer { busyIDs.remove(comment.id) }
        do {
            let updated = try await ListingCommentsService.shared.deleteReply(
                listingID: listingID(for: comment), commentID: comment.id
            )
            replace(comment, with: updated)
        } catch {
            actionError = CommentErrorText.text(error, fallbackKey: "comments.error.generic")
        }
    }

    // MARK: Delete own comment

    func delete(_ comment: ListingComment) async {
        guard !busyIDs.contains(comment.id) else { return }
        busyIDs.insert(comment.id)
        defer { busyIDs.remove(comment.id) }
        do {
            try await ListingCommentsService.shared.delete(
                listingID: listingID(for: comment), commentID: comment.id
            )
            comments.removeAll { $0.id == comment.id }
            didRemove(comment)
        } catch {
            actionError = CommentErrorText.text(error, fallbackKey: "comments.error.generic")
        }
    }

    // MARK: Policy warning

    func acknowledgeWarning() async {
        guard let warning, !isAcknowledging else { return }
        isAcknowledging = true
        defer { isAcknowledging = false }
        do {
            try await PolicyWarningService.acknowledge(id: warning.id)
            self.warning = nil
        } catch {
            actionError = L.t("comments.error.generic")
        }
    }

    // MARK: Helpers

    /// Swap in the server's copy of a comment, keeping the rest of the list.
    /// The listing-only endpoints don't echo `listing_title` / `listing_image`,
    /// so a host-feed row keeps the ones it already had.
    func replace(_ old: ListingComment, with new: ListingComment) {
        guard let index = comments.firstIndex(where: { $0.id == old.id }) else { return }
        comments[index] = new.mergingListing(from: old)
        didUpdate(comments[index])
    }
}

extension ListingComment {
    /// This comment with `listing_title` / `listing_image` (and listing id)
    /// filled from `other` where this copy lacks them.
    func mergingListing(from other: ListingComment) -> ListingComment {
        var copy = self
        if copy.listingTitle == nil { copy.listingTitle = other.listingTitle }
        if copy.listingImage == nil { copy.listingImage = other.listingImage }
        if copy.listingID.isEmpty { copy.listingID = other.listingID }
        return copy
    }
}

/// User-facing text for a failed comment call. The server's own `{ error }`
/// (contact details refused, too long, not allowed…) is shown verbatim; only a
/// missing message falls back to localized copy.
@MainActor
enum CommentErrorText {
    static func text(_ error: Error, fallbackKey: String) -> String {
        switch error as? CommentError {
        case .notSignedIn?:
            return L.t("comments.error.signIn")
        case .rateLimited?:
            return L.t("comments.error.rateLimited")
        case let .message(text)?:
            return text ?? L.t(fallbackKey)
        case let .policyWarning(_, text)?:
            return text
        case nil:
            return L.t(fallbackKey)
        }
    }
}

// MARK: - Listing view model

/// The comments on ONE listing, plus the caller's permissions on it.
@MainActor
final class ListingCommentsViewModel: CommentThreadModel {
    let listingID: String
    @Published var isHost = false
    @Published var canComment = false

    @Published var draft = ""
    @Published var isPosting = false
    @Published var postError: String?

    init(listingID: String) {
        self.listingID = listingID
    }

    override func listingID(for comment: ListingComment) -> String {
        comment.listingID.isEmpty ? listingID : comment.listingID
    }

    func load() async {
        isLoading = true
        defer { isLoading = false; hasLoaded = true }
        do {
            let page = try await ListingCommentsService.shared.fetch(listingID: listingID)
            comments = page.comments
            isHost = page.isHost
            canComment = page.canComment
            loadError = nil
        } catch {
            // Keep whatever was showing; only an empty section shows the error.
            loadError = L.t("comments.error.load")
        }
    }

    func post() async {
        let body = ListingCommentRules.trimmed(draft)
        guard ListingCommentRules.canSubmit(body), !isPosting else { return }
        isPosting = true
        postError = nil
        defer { isPosting = false }
        do {
            let created = try await ListingCommentsService.shared.post(listingID: listingID, body: body)
            comments.removeAll { $0.id == created.id }
            comments.insert(created, at: 0)
            draft = ""
        } catch let CommentError.policyWarning(id, text) {
            warning = PendingWarning(id: id, text: text)
        } catch {
            postError = CommentErrorText.text(error, fallbackKey: "comments.error.post")
        }
    }
}

// MARK: - Listing section

/// "Questions & comments" on the listing detail screen (below reviews).
///
/// - Signed out: the list plus a "Sign in to ask a question" prompt.
/// - `can_comment`: an input + Post, with the "comments are public" hint.
/// - `is_host`: no top-level input; every comment gets Reply / Edit / Delete reply.
/// - `previewAsGuest`: renders the guest's side, but every write is intercepted.
struct ListingCommentsSection: View {
    let previewAsGuest: Bool
    /// Asks the parent to present its sign-in sheet.
    let onRequireSignIn: () -> Void
    /// Asks the parent to explain that the guest preview can't write.
    let onPreviewBlocked: () -> Void

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager
    @StateObject private var model: ListingCommentsViewModel
    @State private var showsAll = false
    @FocusState private var composerFocused: Bool

    /// How many comments show before "Show all".
    private let collapsedCount = 5

    init(
        listingID: String,
        previewAsGuest: Bool = false,
        onRequireSignIn: @escaping () -> Void,
        onPreviewBlocked: @escaping () -> Void
    ) {
        self.previewAsGuest = previewAsGuest
        self.onRequireSignIn = onRequireSignIn
        self.onPreviewBlocked = onPreviewBlocked
        _model = StateObject(wrappedValue: ListingCommentsViewModel(listingID: listingID))
    }

    /// In preview the host stands in for a guest, so host powers are off.
    private var hostMode: Bool { model.isHost && !previewAsGuest }

    private var visibleComments: [ListingComment] {
        showsAll ? model.comments : Array(model.comments.prefix(collapsedCount))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header

            if let warning = model.warning, !previewAsGuest {
                PolicyWarningBanner(text: warning.text, isAcknowledging: model.isAcknowledging) {
                    Task { await model.acknowledgeWarning() }
                }
            } else if previewAsGuest || (model.canComment && auth.isAuthenticated) {
                composer
            } else if !auth.isAuthenticated {
                signInPrompt
            }

            list
        }
        .task { await model.load() }
        .onChange(of: auth.isAuthenticated) { _, _ in
            // `mine`, `is_host` and `can_comment` all depend on who is asking.
            Task { await model.load() }
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

    private var header: some View {
        HStack(spacing: 8) {
            Image(systemName: "bubble.left.and.text.bubble.right")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.qkBurgundy)
            Text(loc.t("comments.title"))
                .font(.title3).fontWeight(.semibold)
                .foregroundStyle(Color.qkInk)
            if !model.comments.isEmpty {
                Text("· \(model.comments.count)")
                    .font(.title3).fontWeight(.semibold)
                    .foregroundStyle(Color.qkMuted)
                    .monospacedDigit()
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: Composer

    private var composer: some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField(loc.t("comments.placeholder"), text: $model.draft, axis: .vertical)
                .lineLimit(2...6)
                .font(.subheadline)
                .focused($composerFocused)
                .padding(12)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(Color.qkInk.opacity(0.12), lineWidth: 1)
                )

            HStack(alignment: .top, spacing: 10) {
                Text(loc.t("comments.hint"))
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                Button {
                    if previewAsGuest { onPreviewBlocked(); return }
                    composerFocused = false
                    Task { await model.post() }
                } label: {
                    ZStack {
                        if model.isPosting {
                            ProgressView().tint(.white)
                        } else {
                            Text(loc.t("comments.post")).font(.subheadline.weight(.bold))
                        }
                    }
                    .frame(minWidth: 64)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(Color.qkBurgundy.opacity(ListingCommentRules.canSubmit(model.draft) ? 1 : 0.4))
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
                }
                .buttonStyle(.qkTap)
                .disabled(!ListingCommentRules.canSubmit(model.draft) || model.isPosting)
            }

            if ListingCommentRules.showsCounter(model.draft) {
                CommentCharacterCounter(text: model.draft)
            }

            if let error = model.postError {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(Color.qkBurgundy)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var signInPrompt: some View {
        Button(action: onRequireSignIn) {
            HStack(spacing: 10) {
                Image(systemName: "person.crop.circle.badge.questionmark")
                    .font(.system(size: 16, weight: .semibold))
                Text(loc.t("comments.signIn"))
                    .font(.subheadline.weight(.semibold))
                Spacer(minLength: 0)
                Image(systemName: "chevron.forward")
                    .font(.system(size: 13, weight: .semibold))
            }
            .foregroundStyle(Color.qkBurgundy)
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .background(Color.qkTan)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.qkTap)
    }

    // MARK: List

    @ViewBuilder
    private var list: some View {
        if model.isLoading && !model.hasLoaded {
            HStack {
                Spacer()
                ProgressView().tint(.qkBurgundy)
                Spacer()
            }
            .padding(.vertical, 8)
        } else if let error = model.loadError, model.comments.isEmpty {
            HStack(spacing: 10) {
                Text(error)
                    .font(.subheadline)
                    .foregroundStyle(Color.qkMuted)
                Button(loc.t("common.retry")) {
                    Task { await model.load() }
                }
                .font(.subheadline.weight(.semibold))
                .tint(.qkBurgundy)
            }
        } else if model.comments.isEmpty {
            Text(loc.t(hostMode ? "comments.emptyHost" : "comments.empty"))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
        } else {
            VStack(spacing: 12) {
                ForEach(visibleComments) { comment in
                    ListingCommentRow(
                        model: model,
                        comment: comment,
                        hostMode: hostMode,
                        allowsWrites: !previewAsGuest
                    )
                }
            }
            if model.comments.count > collapsedCount {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { showsAll.toggle() }
                } label: {
                    Text(showsAll
                         ? loc.t("comments.showFewer")
                         : String(format: loc.t("comments.showAll"), "\(model.comments.count)"))
                        .font(.subheadline.weight(.semibold))
                        .underline()
                        .foregroundStyle(Color.qkBurgundy)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Row

/// One comment: author, relative time, body, the host's reply indented under a
/// "Host" label, and the actions the caller is allowed (Delete on your own;
/// Reply / Edit reply / Delete reply for the host).
struct ListingCommentRow: View {
    @ObservedObject var model: CommentThreadModel
    let comment: ListingComment
    let hostMode: Bool
    var allowsWrites: Bool = true
    /// The host feed shows which listing a question is about.
    var showsListing: Bool = false
    var onOpenListing: (() -> Void)?

    @EnvironmentObject private var loc: LocalizationManager
    @State private var confirming: Confirm?
    @FocusState private var replyFocused: Bool

    private enum Confirm: Identifiable {
        case deleteComment, deleteReply
        var id: Int { self == .deleteComment ? 0 : 1 }
    }

    private var isBusy: Bool { model.busyIDs.contains(comment.id) }
    private var isReplying: Bool { model.replyingTo == comment.id }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if showsListing { listingLine }

            HStack(alignment: .top, spacing: 10) {
                QKPhotoAvatar(
                    avatarURL: comment.authorAvatar,
                    initials: ListingCommentRules.initials(comment.authorName),
                    size: 34
                )
                VStack(alignment: .leading, spacing: 3) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(comment.authorName)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.qkInk)
                            .lineLimit(1)
                        let time = QKRelativeTime.text(comment.createdAt)
                        if !time.isEmpty {
                            Text("· \(time)")
                                .font(.caption)
                                .foregroundStyle(Color.qkMuted)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                    Text(comment.body)
                        .font(.subheadline)
                        .foregroundStyle(Color.qkInk.opacity(0.9))
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)
                }
            }

            if let reply = comment.reply, !isReplying {
                replyBlock(reply)
            }

            if isReplying && allowsWrites {
                replyComposer
            } else if allowsWrites {
                actions
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .qkCard(cornerRadius: 18, lifts: false)
        .confirmationDialog(
            confirming == .deleteReply ? loc.t("comments.deleteReply.confirm") : loc.t("comments.delete.confirm"),
            isPresented: Binding(get: { confirming != nil }, set: { if !$0 { confirming = nil } }),
            titleVisibility: .visible,
            presenting: confirming
        ) { which in
            Button(loc.t(which == .deleteReply ? "comments.deleteReply" : "comments.delete"), role: .destructive) {
                Task {
                    if which == .deleteReply {
                        await model.deleteReply(comment)
                    } else {
                        await model.delete(comment)
                    }
                }
            }
            Button(loc.t("common.cancel"), role: .cancel) {}
        }
    }

    private var listingLine: some View {
        Button {
            onOpenListing?()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "house")
                    .font(.system(size: 12, weight: .semibold))
                Text(comment.listingTitle ?? loc.t("hostQuestions.listingFallback"))
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                Spacer(minLength: 0)
                if onOpenListing != nil {
                    Image(systemName: "chevron.forward")
                        .font(.system(size: 11, weight: .semibold))
                }
            }
            .foregroundStyle(Color.qkBurgundy)
        }
        .buttonStyle(.plain)
        .disabled(onOpenListing == nil)
    }

    private func replyBlock(_ reply: ListingComment.Reply) -> some View {
        HStack(alignment: .top, spacing: 10) {
            RoundedRectangle(cornerRadius: 2)
                .fill(Color.qkGold.opacity(0.7))
                .frame(width: 3)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(loc.t("comments.hostLabel"))
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Color.qkBurgundy)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(Color.qkBurgundy.opacity(0.1))
                        .clipShape(Capsule())
                    let time = QKRelativeTime.text(reply.createdAt)
                    if !time.isEmpty {
                        Text(time)
                            .font(.caption)
                            .foregroundStyle(Color.qkMuted)
                    }
                }
                Text(reply.body)
                    .font(.subheadline)
                    .foregroundStyle(Color.qkInk.opacity(0.9))
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
            }
        }
        .padding(.leading, 44)
    }

    @ViewBuilder
    private var actions: some View {
        let buttons = actionButtons
        if !buttons.isEmpty {
            HStack(spacing: 16) {
                ForEach(buttons, id: \.key) { item in
                    Button(role: item.destructive ? .destructive : nil) {
                        item.run()
                    } label: {
                        Text(loc.t(item.key))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(item.destructive ? Color.qkMuted : Color.qkBurgundy)
                    }
                    .buttonStyle(.plain)
                    .disabled(isBusy || model.warning != nil)
                }
                Spacer(minLength: 0)
                if isBusy { ProgressView().controlSize(.small).tint(.qkBurgundy) }
            }
            .padding(.leading, 44)
        }
    }

    private struct ActionItem {
        let key: String
        let destructive: Bool
        let run: () -> Void
    }

    private var actionButtons: [ActionItem] {
        var items: [ActionItem] = []
        if hostMode {
            if comment.reply == nil {
                items.append(ActionItem(key: "comments.reply", destructive: false) {
                    model.startReply(to: comment); replyFocused = true
                })
            } else {
                items.append(ActionItem(key: "comments.editReply", destructive: false) {
                    model.startReply(to: comment); replyFocused = true
                })
                items.append(ActionItem(key: "comments.deleteReply", destructive: true) {
                    confirming = .deleteReply
                })
            }
        }
        if comment.mine {
            items.append(ActionItem(key: "comments.delete", destructive: true) {
                confirming = .deleteComment
            })
        }
        return items
    }

    @ViewBuilder
    private var replyComposer: some View {
        if let warning = model.warning {
            PolicyWarningBanner(text: warning.text, isAcknowledging: model.isAcknowledging) {
                Task { await model.acknowledgeWarning() }
            }
        } else {
            VStack(alignment: .leading, spacing: 8) {
                TextField(loc.t("comments.replyPlaceholder"), text: $model.replyDraft, axis: .vertical)
                    .lineLimit(2...6)
                    .font(.subheadline)
                    .focused($replyFocused)
                    .padding(10)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .strokeBorder(Color.qkInk.opacity(0.12), lineWidth: 1)
                    )
                Text(loc.t("comments.replyHint"))
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                if ListingCommentRules.showsCounter(model.replyDraft) {
                    CommentCharacterCounter(text: model.replyDraft)
                }
                if let error = model.replyError {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(Color.qkBurgundy)
                        .fixedSize(horizontal: false, vertical: true)
                }
                HStack(spacing: 12) {
                    Spacer(minLength: 0)
                    Button(loc.t("common.cancel")) { model.cancelReply() }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.qkMuted)
                        .buttonStyle(.plain)
                    Button {
                        replyFocused = false
                        Task { await model.saveReply(for: comment) }
                    } label: {
                        ZStack {
                            if model.isSavingReply {
                                ProgressView().tint(.white)
                            } else {
                                Text(loc.t("comments.saveReply")).font(.subheadline.weight(.bold))
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Color.qkBurgundy.opacity(ListingCommentRules.canSubmit(model.replyDraft) ? 1 : 0.4))
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.qkTap)
                    .disabled(!ListingCommentRules.canSubmit(model.replyDraft) || model.isSavingReply)
                }
            }
            .padding(.leading, 44)
        }
    }
}

/// "12 characters left" — shown only near the 1000-character cap.
struct CommentCharacterCounter: View {
    let text: String

    var body: some View {
        let left = ListingCommentRules.remaining(text)
        Text(String(format: L.t("comments.charsLeft"), "\(left)"))
            .font(.caption.monospacedDigit())
            .foregroundStyle(left < 0 ? Color.qkBurgundy : Color.qkMuted)
    }
}
