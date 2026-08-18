import SwiftUI
import PhotosUI
import UIKit

/// Ask for the ID / passport number on the profile to be changed.
///
/// This screen exists because that number stopped being editable. It used to be an
/// ordinary text field on Edit Profile, which meant any account could rewrite its own
/// identity number at any time with nobody reviewing it. A change is now a request:
/// the new number, which document it is on, and a photo of that document, decided by
/// an operator in the admin console.
///
/// The photo is not optional and not politeness — without a document the reviewer has
/// nothing to check the typed number against, and approving would be rubber-stamping.
/// The server refuses a request without one, so the submit button stays disabled here
/// rather than letting someone fill the form out and be rejected by the API.
@MainActor
final class IDChangeRequestModel: ObservableObject {
    @Published var docType: IDDocumentType = .nationalID
    @Published var newNumber = ""
    @Published var reason = ""

    /// Staged photos. The front is required; the back is offered because most ID
    /// cards carry half their detail on it.
    @Published var frontImage: UIImage?
    @Published var backImage: UIImage?

    @Published var isSubmitting = false
    @Published var errorMessage: String?

    var canSubmit: Bool {
        frontImage != nil
            && !newNumber.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !isSubmitting
    }

    /// Load a `PhotosPickerItem` off the main thread into the staged slot.
    func loadPicked(_ item: PhotosPickerItem?, isFront: Bool) async {
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
            set(image, isFront: isFront)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func set(_ image: UIImage, isFront: Bool) {
        if isFront { frontImage = image } else { backImage = image }
    }

    /// Encode the staged photos and file the request.
    ///
    /// Validation of the NUMBER is left to the server on purpose: the rules (14 digits
    /// for a national ID, alphanumeric bounds otherwise) live in one shared core that
    /// both the mobile API and the admin console read, and a second copy here would be
    /// a third place for them to drift.
    func submit() async -> IDChangeState? {
        guard let front = frontImage else { return nil }
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }

        guard let frontURL = QKAvatarImage.makeDataURL(from: front, maxDimension: 1280, quality: 0.8) else {
            errorMessage = L.t("trust.uploadError")
            return nil
        }
        let backURL = backImage.flatMap {
            QKAvatarImage.makeDataURL(from: $0, maxDimension: 1280, quality: 0.8)
        }

        do {
            return try await ProfileService.shared.requestIDChange(
                requestedValue: newNumber.trimmingCharacters(in: .whitespacesAndNewlines),
                docType: docType.rawValue,
                front: frontURL,
                back: backURL,
                reason: reason
            )
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }
}

struct IDChangeRequestView: View {
    /// The number on file, shown so the user can see what they are changing from.
    let currentValue: String
    /// Handed the server's new state on success, so the caller can update its row.
    var onSubmitted: (IDChangeState) -> Void

    @StateObject private var model = IDChangeRequestModel()
    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    @State private var frontItem: PhotosPickerItem?
    @State private var backItem: PhotosPickerItem?
    @State private var cameraFor: Bool?

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        intro
                        docTypePicker
                        numberField
                        photoSection
                        reasonField
                        if let error = model.errorMessage {
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(Color.qkBurgundy)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        submitButton
                    }
                    .padding(20)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle(loc.t("idChange.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.qkCream, for: .navigationBar)
            .tint(.qkBurgundy)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(loc.t("common.cancel")) { dismiss() }
                }
            }
            .onChange(of: frontItem) { _, item in
                Task { await model.loadPicked(item, isFront: true) }
            }
            .onChange(of: backItem) { _, item in
                Task { await model.loadPicked(item, isFront: false) }
            }
            .sheet(isPresented: Binding(
                get: { cameraFor != nil },
                set: { if !$0 { cameraFor = nil } }
            )) {
                if let isFront = cameraFor {
                    IDCameraPicker { image in model.set(image, isFront: isFront) }
                        .ignoresSafeArea()
                }
            }
        }
    }

    // MARK: - Pieces

    private var intro: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(loc.t("idChange.intro"))
                .font(.system(size: 14))
                .foregroundStyle(Color.qkInk)
                .fixedSize(horizontal: false, vertical: true)
            if !currentValue.isEmpty {
                Text(String(format: loc.t("idChange.current"), currentValue))
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .qkCard(lifts: false)
    }

    private var docTypePicker: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(loc.t("idChange.docType"))
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
            Picker(loc.t("idChange.docType"), selection: $model.docType) {
                ForEach(IDDocumentType.allCases) { type in
                    Text(loc.t(type.labelKey)).tag(type)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    private var numberField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(loc.t("idChange.newNumber"))
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
            TextField(loc.t("idChange.newNumber.placeholder"), text: $model.newNumber)
                // A national ID is digits; the other two are alphanumeric. The keyboard
                // follows the choice so the common case needs no letter keys.
                .keyboardType(model.docType == .nationalID ? .numberPad : .default)
                .textInputAutocapitalization(.characters)
                .disableAutocorrection(true)
                .foregroundStyle(Color.qkInk)
                .padding(.horizontal, 14)
                .frame(height: 46)
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(Color.qkInk.opacity(0.1), lineWidth: 1)
                )
        }
    }

    private var photoSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(loc.t("idChange.photos"))
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
            HStack(spacing: 12) {
                photoSlot(
                    title: loc.t("idChange.front"),
                    image: model.frontImage,
                    item: $frontItem,
                    isFront: true
                )
                photoSlot(
                    title: loc.t("idChange.back"),
                    image: model.backImage,
                    item: $backItem,
                    isFront: false
                )
            }
            Text(loc.t("idChange.photos.hint"))
                .font(.caption2)
                .foregroundStyle(Color.qkMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func photoSlot(
        title: String,
        image: UIImage?,
        item: Binding<PhotosPickerItem?>,
        isFront: Bool
    ) -> some View {
        VStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.qkTan.opacity(0.4))
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                } else {
                    VStack(spacing: 4) {
                        Image(systemName: "doc.viewfinder")
                            .font(.system(size: 20, weight: .semibold))
                        Text(title)
                            .font(.caption)
                    }
                    .foregroundStyle(Color.qkMuted)
                }
            }
            .frame(height: 104)
            .clipped()

            HStack(spacing: 6) {
                PhotosPicker(selection: item, matching: .images, photoLibrary: .shared()) {
                    Text(loc.t("trust.choose"))
                        .font(.system(size: 12, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 32)
                        .foregroundStyle(Color.qkBurgundy)
                        .background(Color.qkTan.opacity(0.6))
                        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                }
                // Hidden where there is no camera (the Simulator), rather than showing
                // a button that opens an empty picker.
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button {
                        cameraFor = isFront
                    } label: {
                        Image(systemName: "camera.fill")
                            .font(.system(size: 12, weight: .semibold))
                            .frame(width: 38, height: 32)
                            .foregroundStyle(Color.qkCream)
                            .background(Color.qkBurgundy)
                            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                    }
                    .buttonStyle(QKPressStyle())
                    .accessibilityLabel("\(loc.t("trust.takePhoto")) — \(title)")
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var reasonField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(loc.t("idChange.reason"))
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
            TextField(loc.t("idChange.reason.placeholder"), text: $model.reason, axis: .vertical)
                .lineLimit(2...4)
                .textInputAutocapitalization(.sentences)
                .foregroundStyle(Color.qkInk)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .frame(minHeight: 72, alignment: .topLeading)
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(Color.qkInk.opacity(0.1), lineWidth: 1)
                )
        }
    }

    private var submitButton: some View {
        Button {
            Task {
                if let state = await model.submit() {
                    onSubmitted(state)
                    dismiss()
                }
            }
        } label: {
            HStack(spacing: 8) {
                if model.isSubmitting {
                    ProgressView().tint(.qkCream)
                } else {
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 15, weight: .semibold))
                    Text(loc.t("idChange.submit"))
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
}
