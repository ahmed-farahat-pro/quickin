import SwiftUI

// MARK: - Host → guest: "Review your guests"

/// Loads the host's reviewable past guests and tracks per-booking submission.
@MainActor
final class ReviewableGuestsModel: ObservableObject {
    @Published var guests: [ReviewableGuest] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var hasLoaded = false

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            guests = try await ReviewService.shared.fetchReviewableGuests()
        } catch ReviewError.notSignedIn {
            errorMessage = L.t("reviews.signInHost")
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
        hasLoaded = true
    }

    /// Remove a guest from the list once the host has reviewed them.
    func remove(bookingID: String) {
        guests.removeAll { $0.bookingId == bookingID }
    }
}

/// Host surface listing past guests eligible for a review. Each card has a star
/// picker + comment + submit; on success the guest leaves the list. Reachable
/// from the host dashboard. RTL-safe, DesignKit tokens.
struct ReviewGuestsView: View {
    @EnvironmentObject private var loc: LocalizationManager
    @StateObject private var model = ReviewableGuestsModel()

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            content
        }
        .navigationTitle(loc.t("reviews.reviewGuests"))
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Color.qkCream, for: .navigationBar)
        .task {
            if !model.hasLoaded { await model.load() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if model.isLoading && !model.hasLoaded {
            ProgressView()
                .tint(.qkBurgundy)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(loc.t("reviews.reviewGuests.subtitle"))
                        .font(.subheadline)
                        .foregroundStyle(Color.qkMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    if let error = model.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(Color.qkBurgundy)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if model.guests.isEmpty {
                        emptyState
                    } else {
                        ForEach(model.guests) { guest in
                            ReviewGuestCard(guest: guest) {
                                model.remove(bookingID: guest.bookingId)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 32)
            }
            .refreshable { await model.load() }
        }
    }

    private var emptyState: some View {
        HStack(spacing: 12) {
            Image(systemName: "person.2.slash")
                .font(.title3)
                .foregroundStyle(Color.qkBurgundy.opacity(0.6))
            Text(loc.t("reviews.reviewGuests.empty"))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .qkCard(cornerRadius: 18)
    }
}

/// One reviewable-guest card: guest name + stay title, a star picker, an
/// optional comment, and a Submit button. Posts to
/// `POST /api/local/guest-reviews`; calls `onSubmitted` on success.
struct ReviewGuestCard: View {
    @EnvironmentObject private var loc: LocalizationManager
    let guest: ReviewableGuest
    var onSubmitted: () -> Void = {}

    @State private var rating = 0
    @State private var comment = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                QKAvatar(initials: initials, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(guest.displayGuestName)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.qkInk)
                        .lineLimit(1)
                    if let title = guest.title, !title.isEmpty {
                        Text(title)
                            .font(.caption)
                            .foregroundStyle(Color.qkMuted)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 8)
            }

            Text(loc.t("reviews.yourRating"))
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
            QKStarInput(selection: $rating, size: 30)

            TextEditor(text: $comment)
                .frame(minHeight: 72)
                .scrollContentBackground(.hidden)
                .padding(10)
                .background(Color.qkSurface)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(Color.qkInk.opacity(0.1), lineWidth: 1)
                )
                .overlay(alignment: .topLeading) {
                    if comment.isEmpty {
                        Text(loc.t("reviews.guestCommentPlaceholder"))
                            .font(.subheadline)
                            .foregroundStyle(Color.qkMuted.opacity(0.7))
                            .padding(.horizontal, 15)
                            .padding(.vertical, 18)
                            .allowsHitTesting(false)
                    }
                }

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button {
                Task { await submit() }
            } label: {
                QKPrimaryButtonLabel(
                    title: loc.t("reviews.submit"),
                    isLoading: isSubmitting,
                    cornerRadius: 14,
                    height: 46
                )
                .opacity(rating == 0 ? 0.6 : 1)
            }
            .buttonStyle(QKPressStyle())
            .disabled(isSubmitting || rating == 0)
        }
        .padding(16)
        .qkCard(cornerRadius: 20)
    }

    private var initials: String {
        let source = guest.guestName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let parts = source.split(separator: " ").prefix(2).compactMap { $0.first }
        let result = String(parts).uppercased()
        return result.isEmpty ? "G" : result
    }

    private func submit() async {
        errorMessage = nil
        guard rating > 0 else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            try await ReviewService.shared.submitGuestReview(
                bookingID: guest.bookingId,
                rating: rating,
                comment: comment.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            onSubmitted()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Reviews about a guest (shown on their own profile)

/// Loads the reviews hosts have left about the signed-in user and computes the
/// average rating. Fails silently (the section just hides when empty / offline).
@MainActor
final class GuestReviewsAboutMeModel: ObservableObject {
    @Published var reviews: [GuestReview] = []
    @Published var isLoading = false
    @Published var hasLoaded = false

    func refresh(guestID: String?) async {
        guard let guestID, !guestID.isEmpty else {
            reviews = []
            hasLoaded = true
            return
        }
        isLoading = true
        defer { isLoading = false; hasLoaded = true }
        reviews = (try? await ReviewService.shared.fetchGuestReviews(guestID: guestID)) ?? []
    }

    /// Average star rating across all received reviews (0 when none).
    var average: Double {
        guard !reviews.isEmpty else { return 0 }
        let total = reviews.reduce(0) { $0 + $1.rating }
        return Double(total) / Double(reviews.count)
    }
}

/// Profile section showing the reviews a guest has received from hosts: a header
/// with the average rating + count, then a list of `GuestReviewRow`s. Renders
/// nothing until loaded; shows an empty hint when there are no reviews.
struct GuestReviewsAboutMeSection: View {
    @EnvironmentObject private var loc: LocalizationManager
    @StateObject private var model = GuestReviewsAboutMeModel()
    let guestID: String?

    var body: some View {
        Group {
            if model.hasLoaded {
                VStack(alignment: .leading, spacing: 12) {
                    header
                    if model.reviews.isEmpty {
                        Text(loc.t("reviews.noGuestReviews"))
                            .font(.subheadline)
                            .foregroundStyle(Color.qkMuted)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        ForEach(model.reviews) { review in
                            GuestReviewRow(review: review)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .task(id: guestID) { await model.refresh(guestID: guestID) }
    }

    private var header: some View {
        HStack(spacing: 8) {
            Text(loc.t("reviews.aboutYou"))
                .font(.system(.title3, design: .serif).weight(.semibold))
                .foregroundStyle(Color.qkInk)
            Spacer(minLength: 8)
            if !model.reviews.isEmpty {
                Image(systemName: "star.fill")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.qkGold)
                Text(String(format: "%.1f", model.average))
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Color.qkInk)
                    .monospacedDigit()
                Text("·")
                    .foregroundStyle(Color.qkMuted)
                Text(loc.t("reviews.guestRating"))
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
            }
        }
    }
}

/// A single "review about the guest" row: host initials avatar, host name +
/// month, gold stars, and the comment. RTL-safe.
struct GuestReviewRow: View {
    @EnvironmentObject private var loc: LocalizationManager
    let review: GuestReview

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                QKAvatar(initials: initials, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(review.displayName)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.qkInk)
                        .lineLimit(1)
                    if !review.monthText.isEmpty {
                        Text(review.monthText)
                            .font(.caption)
                            .foregroundStyle(Color.qkMuted)
                    }
                }
                Spacer(minLength: 8)
                QKStarsDisplay(rating: review.rating)
            }

            if let comment = review.comment?.trimmingCharacters(in: .whitespacesAndNewlines),
               !comment.isEmpty {
                Text(comment)
                    .font(.subheadline)
                    .foregroundStyle(Color.qkInk.opacity(0.88))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .qkCard(cornerRadius: 18, lifts: false)
    }

    private var initials: String {
        let source = review.hostName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let parts = source.split(separator: " ").prefix(2).compactMap { $0.first }
        let result = String(parts).uppercased()
        return result.isEmpty ? "H" : result
    }
}
