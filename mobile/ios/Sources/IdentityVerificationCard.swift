import SwiftUI
import PhotosUI

/// Loads + submits the signed-in user's identity verification. Reads the current
/// status from `GET /api/local/verification`; when the user picks an ID photo it
/// downscales + encodes it (≤1024px JPEG data URL) and POSTs it, flipping the
/// status to "pending". Fails silently on load (the card just shows "unverified"
/// when offline / signed out).
@MainActor
final class IdentityVerificationModel: ObservableObject {
    @Published var status: VerificationStatus = .unverified
    @Published var hasLoaded = false
    @Published var isLoading = false

    /// True while a freshly-picked ID photo is being downscaled + uploaded.
    @Published var isSubmitting = false
    @Published var errorMessage: String?

    func refresh() async {
        isLoading = true
        defer { isLoading = false; hasLoaded = true }
        if let state = try? await TrustService.shared.fetchVerification() {
            status = state.status
        }
    }

    /// Clear back to the default so a different account never momentarily shows
    /// the previous one's verification state.
    func reset() {
        status = .unverified
        hasLoaded = false
        errorMessage = nil
    }

    /// Handle an ID photo chosen via `PhotosPicker`: load its data off the main
    /// thread, downscale to ≤1024px + JPEG-encode into a `data:` URL, then POST.
    /// On success the status becomes "pending".
    func submitPickedPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            guard
                let data = try await item.loadTransferable(type: Data.self),
                let image = UIImage(data: data),
                let dataURL = QKAvatarImage.makeDataURL(from: image, maxDimension: 1024, quality: 0.8)
            else {
                errorMessage = L.t("trust.uploadError")
                return
            }
            let state = try await TrustService.shared.submitVerification(doc: dataURL)
            status = state.status
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// "Verify your identity" card shown on the profile. Reflects the current
/// verification status (unverified / pending / verified / rejected) and, when
/// unverified or rejected, offers a `PhotosPicker` to upload an ID photo.
/// RTL-safe; DesignKit tokens throughout.
struct IdentityVerificationCard: View {
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var auth: AuthStore
    @StateObject private var model = IdentityVerificationModel()

    /// The ID photo selected in the `PhotosPicker`, processed + uploaded on change.
    @State private var photoItem: PhotosPickerItem?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header

            Text(introText)
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .fixedSize(horizontal: false, vertical: true)

            // Upload control — only when the user can act (unverified / rejected).
            if canUpload {
                uploadButton

                if let errorMessage = model.errorMessage {
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(Color.qkBurgundy)
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(Color.qkInk)
                        Spacer(minLength: 0)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .qkCard(cornerRadius: 18, lifts: false)
        .task { await model.refresh() }
        // Re-fetch when the signed-in account changes (logout → login as someone
        // else) so the card never shows the previous user's status.
        .onChange(of: auth.user?.id) { _, _ in
            model.reset()
            Task { await model.refresh() }
        }
        // Process + upload a newly-picked ID photo.
        .onChange(of: photoItem) { _, item in
            Task { await model.submitPickedPhoto(item) }
        }
    }

    // MARK: - Pieces

    /// Title row: an icon tinted by status + the title + a trailing status pill.
    private var header: some View {
        HStack(spacing: 10) {
            Image(systemName: statusIcon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(statusTint)
                .frame(width: 24)
            Text(loc.t("trust.verify"))
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.qkInk)
            Spacer(minLength: 8)
            statusPill
        }
    }

    /// Coloured status capsule (pending / verified / rejected). Hidden while the
    /// status is still loading and for plain "unverified".
    @ViewBuilder
    private var statusPill: some View {
        if model.hasLoaded, model.status != .unverified {
            HStack(spacing: 5) {
                Image(systemName: statusIcon)
                    .font(.system(size: 10, weight: .bold))
                Text(statusLabel)
                    .font(.system(size: 11, weight: .bold))
            }
            .foregroundStyle(statusTint)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(statusTint.opacity(0.12))
            .clipShape(Capsule())
        }
    }

    private var uploadButton: some View {
        PhotosPicker(
            selection: $photoItem,
            matching: .images,
            photoLibrary: .shared()
        ) {
            HStack(spacing: 8) {
                if model.isSubmitting {
                    ProgressView().tint(.qkCream)
                } else {
                    Image(systemName: "doc.viewfinder")
                        .font(.system(size: 15, weight: .semibold))
                    Text(loc.t("trust.uploadId"))
                        .font(.system(size: 15, weight: .bold))
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .foregroundStyle(Color.qkCream)
            .background(LinearGradient.qkBurgundyCTA)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .opacity(model.isSubmitting ? 0.85 : 1)
        }
        .buttonStyle(QKPressStyle())
        .disabled(model.isSubmitting)
    }

    // MARK: - Derived values

    /// Whether the upload control should be offered — i.e. the user hasn't
    /// submitted yet, or a prior submission was rejected.
    private var canUpload: Bool {
        model.status == .unverified || model.status == .rejected
    }

    /// Intro / explanatory copy that adapts to the status.
    private var introText: String {
        switch model.status {
        case .unverified: return loc.t("trust.verifyIntro")
        case .pending:    return loc.t("trust.pending")
        case .verified:   return loc.t("trust.verified")
        case .rejected:   return loc.t("trust.rejected")
        }
    }

    /// Short label for the status pill.
    private var statusLabel: String {
        switch model.status {
        case .unverified: return loc.t("trust.status.unverified")
        case .pending:    return loc.t("trust.status.pending")
        case .verified:   return loc.t("trust.status.verified")
        case .rejected:   return loc.t("trust.status.rejected")
        }
    }

    private var statusIcon: String {
        switch model.status {
        case .unverified: return "person.badge.shield.checkmark"
        case .pending:    return "clock.fill"
        case .verified:   return "checkmark.seal.fill"
        case .rejected:   return "exclamationmark.triangle.fill"
        }
    }

    private var statusTint: Color {
        switch model.status {
        case .unverified: return .qkBurgundy
        case .pending:    return .qkGoldDeep
        case .verified:   return .qkBurgundy
        case .rejected:   return .qkBurgundy
        }
    }
}
