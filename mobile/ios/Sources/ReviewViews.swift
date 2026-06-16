import SwiftUI
import PhotosUI

/// A single guest review row: a gradient initials avatar, the reviewer's name +
/// month, a row of gold stars, the comment, and (when present) a horizontal row
/// of photo thumbnails the guest attached. RTL-safe (leading alignment).
struct ReviewRow: View {
    @EnvironmentObject private var loc: LocalizationManager
    let review: Review

    /// The photo currently enlarged in the zoom sheet (nil when none).
    @State private var zoomedPhoto: ReviewPhoto?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                QKAvatar(initials: initials, size: 40, gold: true)
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

            if !review.photos.isEmpty {
                photoStrip
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .qkCard(cornerRadius: 18, lifts: false)
        .sheet(item: $zoomedPhoto) { photo in
            ReviewPhotoZoomSheet(urlString: photo.url)
                .environmentObject(loc)
        }
    }

    /// A horizontal, tappable strip of review photos. Tapping enlarges in a sheet.
    private var photoStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Array(review.photos.enumerated()), id: \.offset) { _, url in
                    Button {
                        zoomedPhoto = ReviewPhoto(url: url)
                    } label: {
                        ReviewPhotoThumbnail(urlString: url, size: 84)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(loc.t("reviews.photos"))
                }
            }
            .padding(.top, 2)
        }
    }

    /// Up to two uppercase initials from the reviewer name.
    private var initials: String {
        let source = review.reviewerName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let parts = source.split(separator: " ").prefix(2).compactMap { $0.first }
        let result = String(parts).uppercased()
        return result.isEmpty ? "G" : result
    }
}

/// A single review photo identified by its URL string (for `.sheet(item:)`).
private struct ReviewPhoto: Identifiable {
    let url: String
    var id: String { url }
}

/// A rounded photo thumbnail that decodes inline `data:` URLs via
/// `QKAvatarImage.decodeDataURL` and loads `http(s)` URLs with `AsyncImage`.
struct ReviewPhotoThumbnail: View {
    let urlString: String
    var size: CGFloat = 84

    var body: some View {
        Group {
            if let image = QKAvatarImage.decodeDataURL(urlString) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else if QKAvatarImage.isRemoteURL(urlString), let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else if phase.error != nil {
                        placeholder
                    } else {
                        ZStack {
                            Color.qkTan
                            ProgressView().tint(.qkBurgundy)
                        }
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color.qkInk.opacity(0.08), lineWidth: 1)
        )
    }

    private var placeholder: some View {
        ZStack {
            Color.qkTan
            Image(systemName: "photo")
                .foregroundStyle(Color.qkMuted)
        }
    }
}

/// A full-screen sheet that shows a single review photo, with pinch-to-zoom.
struct ReviewPhotoZoomSheet: View {
    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss
    let urlString: String

    @State private var scale: CGFloat = 1

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                image
                    .scaledToFit()
                    .scaleEffect(scale)
                    .gesture(
                        MagnificationGesture()
                            .onChanged { scale = max(1, min($0, 4)) }
                            .onEnded { _ in withAnimation(.spring()) { scale = max(1, min(scale, 4)) } }
                    )
                    .onTapGesture(count: 2) {
                        withAnimation(.spring()) { scale = scale > 1 ? 1 : 2 }
                    }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(loc.t("common.close")) { dismiss() }
                        .tint(.qkCream)
                }
            }
            .toolbarBackground(.hidden, for: .navigationBar)
        }
    }

    @ViewBuilder
    private var image: some View {
        if let uiImage = QKAvatarImage.decodeDataURL(urlString) {
            Image(uiImage: uiImage).resizable()
        } else if QKAvatarImage.isRemoteURL(urlString), let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                if let image = phase.image {
                    image.resizable()
                } else {
                    ProgressView().tint(.qkCream)
                }
            }
        } else {
            Image(systemName: "photo").foregroundStyle(Color.qkCream)
        }
    }
}

/// A static row of five gold stars filled up to `rating` (read-only display).
struct QKStarsDisplay: View {
    let rating: Int
    var size: CGFloat = 13

    var body: some View {
        HStack(spacing: 2) {
            ForEach(1...5, id: \.self) { i in
                Image(systemName: i <= rating ? "star.fill" : "star")
                    .font(.system(size: size))
                    .foregroundStyle(i <= rating ? Color.qkGold : Color.qkTan4)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(rating) out of 5 stars")
    }
}

/// An interactive 1–5 star picker (gold, springy). Binds to a 0–5 `selection`
/// (0 == none chosen). Tapping a star sets the rating; honors Reduce Motion.
struct QKStarInput: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding var selection: Int
    var size: CGFloat = 36

    var body: some View {
        HStack(spacing: 8) {
            ForEach(1...5, id: \.self) { i in
                Button {
                    if reduceMotion {
                        selection = i
                    } else {
                        withAnimation(QKAnim.press) { selection = i }
                    }
                } label: {
                    Image(systemName: i <= selection ? "star.fill" : "star")
                        .font(.system(size: size, weight: .semibold))
                        .foregroundStyle(i <= selection ? Color.qkGold : Color.qkTan4)
                        .scaleEffect(i <= selection ? 1.0 : 0.92)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(i) star\(i == 1 ? "" : "s")")
                .accessibilityAddTraits(i == selection ? .isSelected : [])
            }
        }
    }
}

/// "Leave a review" sheet: tappable 1–5 stars + an optional comment →
/// `POST /api/local/reviews { booking_id, rating, comment }`. On success it
/// shows a brief confirmation then dismisses, calling `onSubmitted`.
struct LeaveReviewSheet: View {
    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    let bookingID: String
    /// Optional stay title shown in the header for context.
    var stayTitle: String?
    /// Called after a successful submission so the caller can refresh state.
    var onSubmitted: () -> Void = {}

    @State private var rating = 0
    @State private var comment = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var submitted = false

    /// Up to 6 photos, each as a `data:image/jpeg;base64,…` URL string.
    @State private var photos: [String] = []
    /// The PhotosPicker selection (cleared once processed into `photos`).
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var isProcessingPhotos = false

    /// Max number of attachable photos (matches the backend cap).
    private let photoLimit = 6

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()
                if submitted {
                    successState
                } else {
                    form
                }
            }
            .navigationTitle(loc.t("reviews.leave.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.qkCream, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(loc.t("common.cancel")) { dismiss() }
                        .tint(.qkBurgundy)
                }
            }
        }
        .tint(.qkBurgundy)
    }

    private var form: some View {
        ScrollView {
            VStack(spacing: 22) {
                VStack(spacing: 8) {
                    if let stayTitle, !stayTitle.isEmpty {
                        Text(stayTitle)
                            .font(.system(.title3, design: .serif).weight(.semibold))
                            .foregroundStyle(Color.qkInk)
                            .multilineTextAlignment(.center)
                    }
                    Text(loc.t("reviews.leave.prompt"))
                        .font(.subheadline)
                        .foregroundStyle(Color.qkMuted)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 8)

                QKStarInput(selection: $rating)
                    .frame(maxWidth: .infinity)

                VStack(alignment: .leading, spacing: 8) {
                    Text(loc.t("reviews.leave.commentLabel"))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.qkMuted)
                    TextEditor(text: $comment)
                        .frame(minHeight: 120)
                        .scrollContentBackground(.hidden)
                        .padding(10)
                        .background(Color.qkSurface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .strokeBorder(Color.qkInk.opacity(0.1), lineWidth: 1)
                        )
                        .overlay(alignment: .topLeading) {
                            if comment.isEmpty {
                                Text(loc.t("reviews.leave.commentPlaceholder"))
                                    .font(.subheadline)
                                    .foregroundStyle(Color.qkMuted.opacity(0.7))
                                    .padding(.horizontal, 15)
                                    .padding(.vertical, 18)
                                    .allowsHitTesting(false)
                            }
                        }
                }

                photosSection

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
                        title: loc.t("reviews.leave.submit"),
                        isLoading: isSubmitting
                    )
                }
                .buttonStyle(QKPressStyle())
                .disabled(isSubmitting || rating == 0)
                .opacity(rating == 0 ? 0.6 : 1)
            }
            .padding(20)
        }
    }

    /// Photo attachment: a labelled PhotosPicker (selectionLimit 6) plus a
    /// horizontal preview row of picked thumbnails, each with a remove control.
    private var photosSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(loc.t("reviews.addPhotos"))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.qkMuted)
                Spacer()
                if !photos.isEmpty {
                    Text("\(photos.count)/\(photoLimit)")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Color.qkMuted)
                        .monospacedDigit()
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(Array(photos.enumerated()), id: \.offset) { index, url in
                        ReviewPhotoThumbnail(urlString: url, size: 78)
                            .overlay(alignment: .topTrailing) {
                                Button {
                                    photos.remove(at: index)
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.system(size: 20))
                                        .foregroundStyle(Color.qkCream, Color.qkInk.opacity(0.65))
                                        .padding(4)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(loc.t("reviews.removePhoto"))
                            }
                    }

                    if photos.count < photoLimit {
                        PhotosPicker(
                            selection: $photoItems,
                            maxSelectionCount: photoLimit - photos.count,
                            matching: .images,
                            photoLibrary: .shared()
                        ) {
                            VStack(spacing: 6) {
                                if isProcessingPhotos {
                                    ProgressView().tint(.qkBurgundy)
                                } else {
                                    Image(systemName: "plus")
                                        .font(.system(size: 20, weight: .semibold))
                                    Text(loc.t("reviews.addPhotos"))
                                        .font(.system(size: 10, weight: .semibold))
                                        .lineLimit(1)
                                }
                            }
                            .foregroundStyle(Color.qkBurgundy)
                            .frame(width: 78, height: 78)
                            .background(Color.qkTan)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .strokeBorder(Color.qkBurgundy.opacity(0.3),
                                                  style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                            )
                        }
                        .buttonStyle(.qkTap)
                        .disabled(isProcessingPhotos)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .onChange(of: photoItems) { _, items in
            guard !items.isEmpty else { return }
            Task { await processPickedPhotos(items) }
        }
    }

    private var successState: some View {
        VStack(spacing: 18) {
            QKDrawCheck(size: 84, light: true)
            Text(loc.t("reviews.leave.thanks"))
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Color.qkInk)
                .multilineTextAlignment(.center)
            Text(loc.t("reviews.leave.thanksSubtitle"))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .padding(24)
    }

    private func submit() async {
        errorMessage = nil
        guard rating > 0 else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            try await ReviewService.shared.submit(
                bookingID: bookingID,
                rating: rating,
                comment: comment.trimmingCharacters(in: .whitespacesAndNewlines),
                photos: photos
            )
            onSubmitted()
            withAnimation(QKAnim.swap) { submitted = true }
            // Auto-dismiss shortly after the thank-you appears.
            try? await Task.sleep(nanoseconds: 1_400_000_000)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Load each picked item off the main thread, downscale to ≤1024px and
    /// JPEG-encode (quality 0.7) into a `data:` URL, appending up to `photoLimit`.
    private func processPickedPhotos(_ items: [PhotosPickerItem]) async {
        isProcessingPhotos = true
        defer {
            isProcessingPhotos = false
            photoItems = []
        }
        for item in items {
            guard photos.count < photoLimit else { break }
            guard
                let data = try? await item.loadTransferable(type: Data.self),
                let image = UIImage(data: data),
                let dataURL = QKAvatarImage.makeDataURL(from: image, maxDimension: 1024, quality: 0.7)
            else { continue }
            photos.append(dataURL)
        }
    }
}
