import SwiftUI
import PhotosUI
import UIKit

// Signup identity on iOS — every new account gives a phone number and an ID
// (document type, number, front + back photos). The rules are in
// `SignupIdentityRules.swift`; this file is the UI that collects them, used in
// three places:
//   - the email sign-up form (`AuthView`), before the OTP;
//   - `CompleteAccountView`, the blocking screen a first Google sign-in lands on
//     while `identity_complete == false`;
//   - `IdentityReuploadSheet`, after the reviewer rejected the document
//     (posts to `/api/local/verification`, like the profile's verify flow).

// MARK: - Shared ID photo slot

/// One ID-photo slot: the thumbnail (or a placeholder), a "choose from library"
/// button and, where there is a camera, a "take photo" one. The same slot the
/// become-a-host form shows, so an ID looks the same wherever we ask for it.
struct IDPhotoSlot: View {
    @EnvironmentObject private var loc: LocalizationManager

    let title: String
    let image: UIImage?
    @Binding var pickerItem: PhotosPickerItem?
    let isLoading: Bool
    var isInvalid: Bool = false
    var height: CGFloat = 88
    let onCamera: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.qkTan)
                    .frame(height: height)
                if isLoading {
                    ProgressView().tint(Color.qkBurgundy)
                } else if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(height: height)
                        .frame(maxWidth: .infinity)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                } else {
                    Image(systemName: "creditcard")
                        .font(.system(size: 24, weight: .light))
                        .foregroundStyle(Color.qkBurgundy.opacity(0.5))
                }
            }
            // `.clipped()` alone leaves a scaledToFill photo's overflow hit-testable.
            .contentShape(Rectangle())
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(isInvalid ? Color.qkBurgundy : .clear, lineWidth: 1.5)
            )
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(image != nil ? "\(title) — \(loc.t("hostApply.identity.chosen"))" : title)
            HStack(spacing: 6) {
                PhotosPicker(selection: $pickerItem, matching: .images, photoLibrary: .shared()) {
                    Label(loc.t("trust.choose"), systemImage: "photo")
                        .labelStyle(.iconOnly)
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 34)
                        .foregroundStyle(Color.qkBurgundy)
                        .background(Color.qkTan)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(QKPressStyle())
                .accessibilityLabel("\(loc.t("trust.choose")) — \(title)")
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button(action: onCamera) {
                        Label(loc.t("trust.takePhoto"), systemImage: "camera.fill")
                            .labelStyle(.iconOnly)
                            .font(.system(size: 14, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .frame(height: 34)
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
}

// MARK: - Draft

/// What the identity form holds while it is being filled in, plus the
/// per-field errors (client-side checks and the server's `fields` map alike).
@MainActor
final class IdentityDocumentDraft: ObservableObject {
    /// Filtered as typed by `IdentityDocumentFields` (`PhoneRules.filterAccountInput`).
    @Published var phone = "" {
        didSet { if phone != oldValue { errors[.phone] = nil } }
    }
    @Published var docType: IDDocumentType = .nationalID {
        didSet { if docType != oldValue { errors[.docType] = nil; errors[.idNumber] = nil } }
    }
    @Published var idNumber = "" {
        didSet { if idNumber != oldValue { errors[.idNumber] = nil } }
    }
    @Published var frontImage: UIImage?
    @Published var backImage: UIImage?
    @Published var loadingSide: IDSide?
    /// A picked photo that couldn't be decoded (iCloud, Live Photo, …).
    @Published var photoError: String?
    @Published var errors: [IdentityField: String] = [:]

    func set(_ image: UIImage, side: IDSide) {
        photoError = nil
        switch side {
        case .front: frontImage = image; errors[.idFront] = nil
        case .back: backImage = image; errors[.idBack] = nil
        case .selfie: break
        }
    }

    func loadPicked(_ item: PhotosPickerItem?, side: IDSide) async {
        guard let item else { return }
        photoError = nil
        loadingSide = side
        defer { if loadingSide == side { loadingSide = nil } }
        switch await QKPhotoPickerLoader.loadImage(from: item) {
        case .success(let image): set(image, side: side)
        case .failure(let reason): photoError = L.t(reason.messageKey)
        }
    }

    /// Run the same checks the API runs, filling `errors` with localized
    /// messages. Returns true when everything is in order.
    @discardableResult
    func validate(includePhone: Bool) -> Bool {
        var found: [IdentityField: String] = [:]
        if includePhone {
            if phone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                found[.phone] = L.t("signupId.error.phoneRequired")
            } else if !PhoneRules.isValidAccountPhone(phone) {
                found[.phone] = L.t("signupId.error.phoneFormat")
            }
        }
        if let problem = IDNumberRules.problem(idNumber, docType: docType.rawValue) {
            found[.idNumber] = L.t(problem.messageKey)
        }
        if frontImage == nil { found[.idFront] = L.t("signupId.error.frontRequired") }
        if backImage == nil { found[.idBack] = L.t("signupId.error.backRequired") }
        errors = found
        return found.isEmpty
    }

    /// Whether every field has *something* in it (used to enable a button; the
    /// format checks run on submit so the user is told what's wrong).
    func isFilled(includePhone: Bool) -> Bool {
        (!includePhone || !phone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            && !idNumber.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && frontImage != nil && backImage != nil
    }

    /// The request payload with both photos downscaled + JPEG-encoded, or nil
    /// when encoding failed. Two photos at 1280px / 0.8 are a few hundred KB
    /// each; if a pair still comes out large they're re-encoded smaller so the
    /// body stays well under Vercel's ~4.5 MB request limit (and each image
    /// under the API's 3.5 MB cap).
    func makePayload() -> SignupIdentityPayload? {
        guard let front = frontImage, let back = backImage else { return nil }
        func encode(_ maxDimension: CGFloat, _ quality: CGFloat) -> (String, String)? {
            guard let f = QKAvatarImage.makeDataURL(from: front, maxDimension: maxDimension, quality: quality),
                  let b = QKAvatarImage.makeDataURL(from: back, maxDimension: maxDimension, quality: quality)
            else { return nil }
            return (f, b)
        }
        let budget = 3_000_000   // both photos together, in characters
        var pair = encode(1280, 0.8)
        if let p = pair, p.0.count + p.1.count > budget { pair = encode(1024, 0.6) }
        if let p = pair, p.0.count + p.1.count > budget { pair = encode(800, 0.5) }
        guard let (f, b) = pair else { return nil }
        return SignupIdentityPayload(
            phone: phone,
            docType: docType.rawValue,
            idNumber: idNumber,
            idFront: f,
            idBack: b
        )
    }
}

// MARK: - Fields

/// Phone (optional), document type, document number and the two ID photo
/// slots, with each field's error printed under it.
struct IdentityDocumentFields: View {
    @EnvironmentObject private var loc: LocalizationManager
    @ObservedObject var draft: IdentityDocumentDraft
    var showPhone: Bool = true
    var disabled: Bool = false

    @State private var frontItem: PhotosPickerItem?
    @State private var backItem: PhotosPickerItem?
    @State private var cameraSide: IDSide?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if showPhone {
                textField(
                    title: loc.t("signupId.phone"),
                    text: $draft.phone,
                    placeholder: loc.t("signupId.phone.placeholder"),
                    systemImage: "phone",
                    contentType: .telephoneNumber,
                    keyboard: .phonePad,
                    capitalization: .never,
                    error: draft.errors[.phone]
                )
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(loc.t("idChange.docType"))
                    .font(.caption).fontWeight(.semibold)
                    .foregroundStyle(Color.qkMuted)
                Picker(loc.t("idChange.docType"), selection: $draft.docType) {
                    ForEach(IDDocumentType.allCases) { type in
                        Text(loc.t(type.labelKey)).tag(type)
                    }
                }
                .pickerStyle(.segmented)
                errorText(draft.errors[.docType])
            }

            textField(
                title: loc.t("signupId.idNumber"),
                text: $draft.idNumber,
                placeholder: loc.t(draft.docType == .nationalID
                                   ? "signupId.idNumber.placeholderNational"
                                   : "signupId.idNumber.placeholder"),
                systemImage: "person.text.rectangle",
                contentType: nil,
                keyboard: draft.docType == .nationalID ? .numberPad : .asciiCapable,
                capitalization: .characters,
                error: draft.errors[.idNumber]
            )

            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        IDPhotoSlot(
                            title: loc.t("hostApply.identity.front"),
                            image: draft.frontImage,
                            pickerItem: $frontItem,
                            isLoading: draft.loadingSide == .front,
                            isInvalid: draft.errors[.idFront] != nil,
                            onCamera: { cameraSide = .front }
                        )
                        errorText(draft.errors[.idFront])
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        IDPhotoSlot(
                            title: loc.t("hostApply.identity.back"),
                            image: draft.backImage,
                            pickerItem: $backItem,
                            isLoading: draft.loadingSide == .back,
                            isInvalid: draft.errors[.idBack] != nil,
                            onCamera: { cameraSide = .back }
                        )
                        errorText(draft.errors[.idBack])
                    }
                }
                errorText(draft.photoError)
            }
        }
        .disabled(disabled)
        // Rewrite what's typed as it's typed — letters dropped, Arabic-Indic
        // digits folded to ASCII. Done here rather than in the model's didSet
        // so the TextField actually redraws with the filtered text.
        .onChange(of: draft.phone) { _, newValue in
            let filtered = PhoneRules.filterAccountInput(newValue)
            if filtered != newValue { draft.phone = filtered }
        }
        .onChange(of: frontItem) { _, item in
            Task { await draft.loadPicked(item, side: .front) }
        }
        .onChange(of: backItem) { _, item in
            Task { await draft.loadPicked(item, side: .back) }
        }
        .fullScreenCover(item: $cameraSide) { side in
            IDCameraPicker { image in draft.set(image, side: side) }
                .ignoresSafeArea()
        }
    }

    @ViewBuilder
    private func errorText(_ message: String?) -> some View {
        if let message {
            Text(message)
                .font(.caption)
                .foregroundStyle(Color.qkBurgundy)
                .fixedSize(horizontal: false, vertical: true)
                .transition(.opacity)
        }
    }

    /// Styled like `AuthView`'s fields so the sign-up form reads as one form.
    private func textField(
        title: String,
        text: Binding<String>,
        placeholder: String,
        systemImage: String,
        contentType: UITextContentType?,
        keyboard: UIKeyboardType,
        capitalization: TextInputAutocapitalization,
        error: String?
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption).fontWeight(.semibold)
                .foregroundStyle(Color.qkMuted)
            HStack(spacing: 10) {
                Image(systemName: systemImage)
                    .foregroundStyle(error == nil ? Color.qkMuted : Color.qkBurgundy)
                    .frame(width: 18)
                TextField(placeholder, text: text)
                    .textContentType(contentType)
                    .keyboardType(keyboard)
                    .textInputAutocapitalization(capitalization)
                    .autocorrectionDisabled(true)
                    .foregroundStyle(Color.qkInk)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(
                        error == nil ? Color.qkInk.opacity(0.1) : Color.qkBurgundy.opacity(0.55),
                        lineWidth: error == nil ? 1 : 1.5
                    )
            )
            errorText(error)
        }
        .animation(.easeInOut(duration: 0.2), value: error)
    }
}

// MARK: - Complete your account (first Google sign-in)

/// The blocking screen an account lands on while `identity_complete == false` —
/// in practice a first Google sign-in, which brings no phone or ID with it. It
/// can't be dismissed into the app; signing out is the only other way off it.
/// Posts to `POST /api/local/account/identity`.
///
/// Since 2026-11-13 it walks the same stepped, role-aware pages as the email
/// signup minus Account: role cards → Identity → (Refund | Hosting → Payout).
/// See `SignupFlow.swift`.
struct CompleteAccountView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager
    @StateObject private var flow = SignupFlowModel(includeAccount: false)
    /// Called after a successful save, for a caller that presented this itself
    /// (the root overlay simply disappears once the account is complete).
    var onFinished: (() -> Void)? = nil

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 8) {
                        Image(systemName: "person.text.rectangle.fill")
                            .font(.system(size: 30, weight: .semibold))
                            .foregroundStyle(Color.qkBurgundy)
                        Text(loc.t("complete.title"))
                            .font(.system(.title2, design: .serif).weight(.bold))
                            .foregroundStyle(Color.qkInk)
                        Text(loc.t("complete.subtitle"))
                            .font(.subheadline)
                            .foregroundStyle(Color.qkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                        if let email = auth.user?.email {
                            Label(email, systemImage: "envelope")
                                .font(.caption)
                                .foregroundStyle(Color.qkMuted)
                        }
                    }

                    SignupFlowView(model: flow, submitTitle: loc.t("complete.submit"), submit: submit)

                    Button {
                        auth.logout()
                    } label: {
                        Text(loc.t("complete.signOut"))
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .foregroundStyle(Color.qkInk)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(flow.isSubmitting)
                }
                .padding(.horizontal, 24)
                .padding(.top, 48)
                .padding(.bottom, 32)
                .frame(maxWidth: 480)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .tint(.qkBurgundy)
        .interactiveDismissDisabled(true)
    }

    /// Identity + role fields in one POST. The answer carries the identity
    /// state AND the host state: a host signup files its application, so the
    /// account reads as `pending` at once (the `/api/auth/me` re-read that
    /// `applyIdentity` triggers then confirms it).
    private func submit(_ body: [String: Any]) async -> SignupFlowOutcome {
        switch await SignupFlowService.completeAccount(body: body) {
        case .saved(let identity, let hostStatus, let hostType):
            auth.applyIdentity(identity)
            if hostStatus == .pending, auth.user?.isHost != true {
                auth.applyHostApplicationSubmitted(hostType: HostType(raw: hostType))
            }
            onFinished?()
            return .done
        case .invalid(let message, let fields):
            return .invalid(message: message, fields: fields)
        case .notSignedIn:
            auth.logout()
            return .done
        case .failed(let message):
            return .failed(message.isEmpty ? loc.t("complete.error") : message)
        }
    }
}

// MARK: - Re-upload after a rejection

/// Re-file the identity document after the reviewer rejected it. Shows the
/// reason, collects type + number + front/back (no phone — that's on file),
/// and posts to `POST /api/local/verification`, the same endpoint the
/// profile's verify flow uses. A new submission is pending again, which lifts
/// the booking block.
struct IdentityReuploadSheet: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss
    @StateObject private var draft = IdentityDocumentDraft()
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    /// A reason handed over by the caller (e.g. the booking 403's message)
    /// when the cached account doesn't carry one.
    var fallbackReason: String? = nil

    private var note: String? { auth.user?.identity.rejectionNote }

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(loc.t("reupload.title"))
                            .font(.system(.title2, design: .serif).weight(.bold))
                            .foregroundStyle(Color.qkInk)
                        Text(loc.t("reupload.subtitle"))
                            .font(.subheadline)
                            .foregroundStyle(Color.qkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.top, 8)

                    if let note {
                        IdentityReasonBox(reason: note)
                    } else if let fallbackReason, !fallbackReason.isEmpty {
                        // The server's full sentence (it already names the reason).
                        IdentityReasonBox(reason: fallbackReason, isFullMessage: true)
                    }

                    IdentityDocumentFields(draft: draft, showPhone: false, disabled: isSubmitting)
                        .padding(18)
                        .qkCard(lifts: false)

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(Color.qkBurgundy)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button {
                        Task { await submit() }
                    } label: {
                        QKPrimaryButtonLabel(title: loc.t("reupload.submit"), isLoading: isSubmitting)
                            .opacity(draft.isFilled(includePhone: false) && !isSubmitting ? 1 : 0.5)
                    }
                    .buttonStyle(QKPressStyle())
                    .disabled(isSubmitting)

                    Button(role: .cancel) {
                        dismiss()
                    } label: {
                        Text(loc.t("common.cancel"))
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .foregroundStyle(Color.qkInk)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(isSubmitting)
                }
                .padding(20)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .tint(.qkBurgundy)
        .interactiveDismissDisabled(isSubmitting)
    }

    private func submit() async {
        errorMessage = nil
        guard draft.validate(includePhone: false) else { return }
        guard let payload = draft.makePayload() else {
            errorMessage = loc.t("trust.uploadError")
            return
        }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let state = try await TrustService.shared.submitVerification(
                front: payload.idFront,
                back: payload.idBack,
                idNumber: IDNumberRules.canonical(payload.idNumber),
                docType: payload.docType
            )
            if let current = auth.user?.identity {
                auth.applyIdentity(current.updated(status: state.statusRaw, complete: true))
            }
            dismiss()
        } catch {
            let text = error.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
            errorMessage = text.isEmpty ? loc.t("trust.uploadError") : text
        }
    }
}

/// The reviewer's reason, set apart so it reads as a quote, not as our copy.
struct IdentityReasonBox: View {
    @EnvironmentObject private var loc: LocalizationManager
    let reason: String
    /// True when `reason` is already a whole sentence from the server, not the
    /// bare reviewer note.
    var isFullMessage: Bool = false

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "text.quote")
                .foregroundStyle(Color.qkBurgundy)
            Text(isFullMessage ? reason : String(format: loc.t("reupload.reason"), reason))
                .font(.footnote)
                .foregroundStyle(Color.qkInk)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.qkBurgundy.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

// MARK: - Rejection notice

/// "Your ID wasn't approved" — the reason and a re-upload button. Shown on the
/// profile and in the reserve panel while the signup document is rejected;
/// renders nothing otherwise, so callers can drop it in unconditionally.
struct IdentityRejectedNotice: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager
    @State private var showReupload = false

    var body: some View {
        if let identity = auth.user?.identity, identity.isRejected {
            VStack(alignment: .leading, spacing: 10) {
                Label(loc.t("rejected.title"), systemImage: "exclamationmark.triangle.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.qkBurgundy)
                Text(loc.t("rejected.body"))
                    .font(.subheadline)
                    .foregroundStyle(Color.qkInk)
                    .fixedSize(horizontal: false, vertical: true)
                if let note = identity.rejectionNote {
                    IdentityReasonBox(reason: note)
                }
                Button {
                    showReupload = true
                } label: {
                    Label(loc.t("rejected.action"), systemImage: "arrow.up.doc.fill")
                        .font(.system(size: 15, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 46)
                        .foregroundStyle(Color.qkCream)
                        .background(LinearGradient.qkBurgundyCTA)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(QKPressStyle())
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.qkBurgundy.opacity(0.06))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(Color.qkBurgundy.opacity(0.3), lineWidth: 1)
            )
            .sheet(isPresented: $showReupload) {
                IdentityReuploadSheet()
                    .environmentObject(auth)
                    .environmentObject(loc)
                    .presentationDragIndicator(.visible)
            }
        }
    }
}
