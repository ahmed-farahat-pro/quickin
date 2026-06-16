import SwiftUI

/// Loads the signed-in user's notifications from `GET /api/local/notifications`
/// and drives the read/mark-all mutations.
@MainActor
final class NotificationsViewModel: ObservableObject {
    @Published var items: [AppNotification] = []
    @Published var unread = 0
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var hasLoaded = false

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            let result = try await NotificationService.shared.fetchNotifications()
            items = result.items
            unread = result.unread
        } catch NotificationError.notSignedIn {
            errorMessage = "Sign in to see your notifications."
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
        hasLoaded = true
    }

    /// Mark one notification read, then reload so the badge/dot reflect it.
    func markRead(id: String) async {
        do {
            try await NotificationService.shared.markRead(id: id)
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Mark every notification read, then reload.
    func markAllRead() async {
        do {
            try await NotificationService.shared.markAllRead()
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// The in-app notifications feed. A list of rows with an unread dot, title,
/// body, and relative time; a "Mark all read" toolbar action; pull-to-refresh
/// and load-on-appear. Designed to be pushed onto an existing navigation stack
/// (e.g. from the Profile tab), so it sets a title but not its own stack.
struct NotificationsView: View {
    @StateObject private var viewModel = NotificationsViewModel()

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            content
        }
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Color.qkCream, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                if viewModel.unread > 0 {
                    Button("Mark all read") {
                        Task { await viewModel.markAllRead() }
                    }
                    .tint(.qkBurgundy)
                }
            }
        }
        .tint(.qkBurgundy)
        .task {
            if !viewModel.hasLoaded { await viewModel.load() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.items.isEmpty {
            ProgressView("Loading notifications…")
                .tint(.qkBurgundy)
                .foregroundStyle(Color.qkMuted)
        } else if let error = viewModel.errorMessage, viewModel.items.isEmpty {
            emptyState(title: "Couldn't load notifications", message: error, retry: true)
        } else if viewModel.items.isEmpty {
            emptyState(title: "No notifications yet", message: "Updates about your bookings and services will show up here.", retry: false)
        } else {
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(viewModel.items) { item in
                        Button {
                            Task { await viewModel.markRead(id: item.id) }
                        } label: {
                            NotificationRow(notification: item)
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

    private func emptyState(title: String, message: String, retry: Bool) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "bell")
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
                    Text("Retry")
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

/// A single notification card: leading icon + unread dot, title, body, time.
struct NotificationRow: View {
    let notification: AppNotification

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack(alignment: .topLeading) {
                Image(systemName: notification.systemImage)
                    .font(.system(size: 18))
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 40, height: 40)
                    .background(Color.qkTan)
                    .clipShape(Circle())

                // Burgundy unread dot, only when the row is unread.
                if !notification.read {
                    Circle()
                        .fill(Color.qkBurgundy)
                        .frame(width: 10, height: 10)
                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                        .offset(x: -2, y: -2)
                }
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(notification.title)
                    .font(.subheadline.weight(notification.read ? .semibold : .bold))
                    .foregroundStyle(Color.qkInk)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if let body = notification.body, !body.isEmpty {
                    Text(body)
                        .font(.footnote)
                        .foregroundStyle(Color.qkMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                if !notification.relativeTimeText.isEmpty {
                    Text(notification.relativeTimeText)
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted.opacity(0.8))
                        .padding(.top, 1)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
    }
}

#Preview {
    NavigationStack {
        NotificationsView()
    }
}
