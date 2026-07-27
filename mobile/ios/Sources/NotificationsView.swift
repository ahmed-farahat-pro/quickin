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
        .task { await viewModel.load() }
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

    /// Compact "5m ago" / "3 Jul" label for `created_at`. Empty string when the
    /// server sent no usable timestamp, which hides the label entirely.
    @MainActor
    private var timeText: String { QKRelativeTime.text(notification.createdAt) }

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
                // Title + relative time on one line, the time pinned trailing
                // (mirrors the Messages inbox row). `firstTextBaseline` keeps
                // the time aligned to the first line of a wrapping title.
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(notification.title)
                        .font(.subheadline.weight(notification.read ? .semibold : .bold))
                        .foregroundStyle(Color.qkInk)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if !timeText.isEmpty {
                        Text(timeText)
                            .font(.system(size: 12))
                            .foregroundStyle(Color.qkMuted)
                            .lineLimit(1)
                            .fixedSize(horizontal: true, vertical: false)
                    }
                }
                if let body = notification.body, !body.isEmpty {
                    Text(body)
                        .font(.footnote)
                        .foregroundStyle(Color.qkMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
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

// MARK: - Relative time

/// Compact "time ago" text for the notification rows.
///
/// Hand-rolled rather than `RelativeDateTimeFormatter` so the output stays short
/// and predictable next to a title ("5m ago", "2h ago", "3d ago") instead of the
/// formatter's chattier "2 hr. ago" / "3 mo. ago", and so anything older than a
/// week degrades to a short absolute date.
private enum QKRelativeTime {
    private static let minute: TimeInterval = 60
    private static let hour: TimeInterval = 60 * 60
    private static let day: TimeInterval = 24 * 60 * 60
    private static let week: TimeInterval = 7 * 24 * 60 * 60

    /// Localized relative time for an ISO-8601 timestamp:
    /// `< 1m` → "Just now", `< 1h` → "5m ago", `< 24h` → "2h ago",
    /// `< 7d` → "3d ago", otherwise "3 Jul" (or "3 Jul 2024").
    ///
    /// Returns "" when the timestamp is missing or unparseable so the caller can
    /// hide the label — a raw server string must never reach the UI.
    @MainActor
    static func text(_ raw: String?) -> String {
        guard let raw, let date = parse(raw) else { return "" }
        let now = Date()
        // Clamp: a server clock slightly ahead of the device would otherwise
        // yield a negative interval and a nonsense "-1m ago".
        let elapsed = max(0, now.timeIntervalSince(date))

        if elapsed < minute { return L.t("time.justNow") }
        if elapsed < hour {
            return String(format: L.t("time.minutesAgo"), "\(Int(elapsed / minute))")
        }
        if elapsed < day {
            return String(format: L.t("time.hoursAgo"), "\(Int(elapsed / hour))")
        }
        if elapsed < week {
            return String(format: L.t("time.daysAgo"), "\(Int(elapsed / day))")
        }
        return absoluteText(for: date, now: now)
    }

    /// Parse an ISO-8601 timestamp, tolerating both with- and without-fractional
    /// seconds: the web API emits `2026-07-27T09:15:00Z` via `to_char`, while a
    /// plain JSON-serialized Postgres `timestamptz` arrives as `…:00.123Z`.
    private static func parse(_ raw: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: raw) { return date }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: raw)
    }

    /// "3 Jul" within the current year, "3 Jul 2024" for any earlier one. Month
    /// names follow the in-app language rather than the device locale so the
    /// label matches the rest of the screen.
    @MainActor
    private static func absoluteText(for date: Date, now: Date) -> String {
        let calendar = Calendar.current
        let sameYear = calendar.component(.year, from: date) == calendar.component(.year, from: now)
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: LocalizationManager.shared.lang.localeIdentifier)
        formatter.dateFormat = sameYear ? "d MMM" : "d MMM yyyy"
        return formatter.string(from: date)
    }
}

#Preview {
    NavigationStack {
        NotificationsView()
    }
}
