import SwiftUI
import PhotosUI
import UIKit

// MARK: - Camera picker (UIImagePickerController wrapper)

/// Thin `UIImagePickerController` wrapper for capturing a single photo with the
/// camera. Used by the ID-verification flow when the user taps "Take photo".
private struct IDCameraPicker: UIViewControllerRepresentable {
    var onImage: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.allowsEditing = false
        picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: IDCameraPicker
        init(_ parent: IDCameraPicker) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let img = info[.originalImage] as? UIImage { parent.onImage(img) }
            parent.dismiss()
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

// MARK: - Which side is being captured

enum IDSide { case front, back }

// MARK: - View model

/// Loads + submits the signed-in user's identity verification. Reads the current
/// status from `GET /api/local/verification`; the user picks/captures a FRONT and
/// a BACK photo of their ID, which are downscaled + JPEG-encoded (≤1280px) into
/// `data:` URLs and POSTed together to `/api/local/verification` over HTTPS,
/// flipping the status to "pending". No OCR anywhere. Fails silently on load (the
/// card just shows "unverified" when offline / signed out).
@MainActor
final class IdentityVerificationModel: ObservableObject {
    @Published var status: VerificationStatus = .unverified
    @Published var hasLoaded = false
    @Published var isLoading = false

    /// Staged photos awaiting submission. Both are required to submit.
    @Published var frontImage: UIImage?
    @Published var backImage: UIImage?
    /// Optional ID number the user may type in (sent as `id_number` when present).
    @Published var idNumber = ""

    /// True while the staged photos are being encoded + uploaded.
    @Published var isSubmitting = false
    @Published var errorMessage: String?

    var canSubmit: Bool { frontImage != nil && backImage != nil && !isSubmitting }

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
        frontImage = nil
        backImage = nil
        idNumber = ""
    }

    /// Load a `PhotosPickerItem` chosen for the given side off the main thread.
    func loadPicked(_ item: PhotosPickerItem?, side: IDSide) async {
        guard let item else { return }
        errorMessage = nil
        do {
            guard
                let data = try await item.loadTransferable(type: Data.self),
                let image = UIImage(data: data)
            else {
                errorMessage = L.t("trust.uploadError")
                return
            }
            set(image, side: side)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func set(_ image: UIImage, side: IDSide) {
        switch side {
        case .front: frontImage = image
        case .back:  backImage = image
        }
    }

    /// Encode both staged photos to `data:` URLs and POST them together.
    func submit() async {
        guard let front = frontImage, let back = backImage else { return }
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }
        guard
            let frontURL = QKAvatarImage.makeDataURL(from: front, maxDimension: 1280, quality: 0.8),
            let backURL = QKAvatarImage.makeDataURL(from: back, maxDimension: 1280, quality: 0.8)
        else {
            errorMessage = L.t("trust.uploadError")
            return
        }
        do {
            let state = try await TrustService.shared.submitVerification(
                front: frontURL,
                back: backURL,
                idNumber: idNumber
            )
            status = state.status
            // Clear staged photos once accepted.
            frontImage = nil
            backImage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// "Verify your identity" card shown on the profile. Reflects the current
/// verification status (unverified / pending / verified / rejected) and, when
/// unverified or rejected, lets the user pick/capture a FRONT and a BACK photo of
/// their ID and submit them over HTTPS. RTL-safe; DesignKit tokens throughout.
struct IdentityVerificationCard: View {
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var auth: AuthStore
    @StateObject private var model = IdentityVerificationModel()

    @State private var frontPickerItem: PhotosPickerItem?
    @State private var backPickerItem: PhotosPickerItem?
    @State private var cameraSide: IDSide?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header

            Text(introText)
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .fixedSize(horizontal: false, vertical: true)

            // Upload controls — only when the user can act (unverified / rejected).
            if canUpload {
                HStack(spacing: 12) {
                    photoSlot(
                        title: loc.t("trust.front"),
                        image: model.frontImage,
                        pickerItem: $frontPickerItem,
                        side: .front
                    )
                    photoSlot(
                        title: loc.t("trust.back"),
                        image: model.backImage,
                        pickerItem: $backPickerItem,
                        side: .back
                    )
                }

                // Optional ID-number field (kept from the prior flow).
                idNumberField

                submitButton

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
        .onChange(of: auth.user?.id) { _, _ in
            model.reset()
            frontPickerItem = nil
            backPickerItem = nil
            Task { await model.refresh() }
        }
        .onChange(of: frontPickerItem) { _, item in
            Task { await model.loadPicked(item, side: .front) }
        }
        .onChange(of: backPickerItem) { _, item in
            Task { await model.loadPicked(item, side: .back) }
        }
        .fullScreenCover(item: $cameraSide) { side in
            IDCameraPicker { image in model.set(image, side: side) }
                .ignoresSafeArea()
        }
    }

    // MARK: - Pieces

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

    /// One FRONT/BACK photo slot: a thumbnail (or a placeholder) above a
    /// "Choose" (PhotosPicker) and a "Camera" button.
    private func photoSlot(
        title: String,
        image: UIImage?,
        pickerItem: Binding<PhotosPickerItem?>,
        side: IDSide
    ) -> some View {
        VStack(spacing: 8) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
                .frame(maxWidth: .infinity, alignment: .leading)

            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.qkTan)
                    .frame(height: 96)
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(height: 96)
                        .frame(maxWidth: .infinity)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                } else {
                    Image(systemName: "creditcard")
                        .font(.system(size: 26, weight: .light))
                        .foregroundStyle(Color.qkBurgundy.opacity(0.5))
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(image != nil
                ? "\(title) photo selected"
                : "No \(title) photo chosen yet")

            HStack(spacing: 6) {
                PhotosPicker(selection: pickerItem, matching: .images, photoLibrary: .shared()) {
                    Label(loc.t("trust.choose"), systemImage: "photo")
                        .labelStyle(.iconOnly)
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 36)
                        .foregroundStyle(Color.qkBurgundy)
                        .background(Color.qkTan)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(QKPressStyle())
                .accessibilityLabel("\(loc.t("trust.choose")) — \(title)")

                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button {
                        cameraSide = side
                    } label: {
                        Label(loc.t("trust.takePhoto"), systemImage: "camera.fill")
                            .labelStyle(.iconOnly)
                            .font(.system(size: 14, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .frame(height: 36)
                            .foregroundStyle(Color.qkCream)
                            .background(Color.qkBurgundy)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(QKPressStyle())
                    .accessibilityLabel("\(loc.t("trust.takePhoto")) — \(title)")
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var idNumberField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(loc.t("trust.idNumber"))
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
            TextField(loc.t("trust.idNumber.placeholder"), text: $model.idNumber)
                .textInputAutocapitalization(.characters)
                .disableAutocorrection(true)
                .foregroundStyle(Color.qkInk)
                .padding(.horizontal, 14)
                .frame(height: 44)
                .background(Color.qkTan.opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private var submitButton: some View {
        Button {
            Task { await model.submit() }
        } label: {
            HStack(spacing: 8) {
                if model.isSubmitting {
                    ProgressView().tint(.qkCream)
                } else {
                    Image(systemName: "checkmark.shield.fill")
                        .font(.system(size: 15, weight: .semibold))
                    Text(loc.t("trust.submit"))
                        .font(.system(size: 15, weight: .bold))
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .foregroundStyle(Color.qkCream)
            .background(LinearGradient.qkBurgundyCTA)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .opacity(model.canSubmit ? 1 : 0.5)
        }
        .buttonStyle(QKPressStyle())
        .disabled(!model.canSubmit)
    }

    // MARK: - Derived values

    private var canUpload: Bool {
        model.status == .unverified || model.status == .rejected
    }

    private var introText: String {
        switch model.status {
        case .unverified: return loc.t("trust.verifyIntro")
        case .pending:    return loc.t("trust.pending")
        case .verified:   return loc.t("trust.verified")
        case .rejected:   return loc.t("trust.rejected")
        }
    }

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

// `fullScreenCover(item:)` needs an Identifiable item.
extension IDSide: Identifiable {
    var id: Int { self == .front ? 0 : 1 }
}
