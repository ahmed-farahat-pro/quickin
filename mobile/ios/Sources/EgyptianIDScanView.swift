import SwiftUI
import PhotosUI
import UIKit

// MARK: - Camera picker (UIImagePickerController wrapper)

private struct CameraPickerView: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Binding var isPresented: Bool

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
        let parent: CameraPickerView
        init(_ parent: CameraPickerView) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            parent.image = info[.originalImage] as? UIImage
            parent.isPresented = false
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.isPresented = false
        }
    }
}

// MARK: - EgyptianIDScanView

struct EgyptianIDScanView: View {
    var onIDDetected: (String) -> Void

    private let burgundy = Color(red: 91/255, green: 15/255, blue: 22/255)
    private let cream    = Color(red: 246/255, green: 241/255, blue: 230/255)
    private let tan      = Color(red: 239/255, green: 230/255, blue: 216/255)
    private let ink      = Color(red: 26/255, green: 18/255, blue: 11/255)
    private let muted    = Color(red: 140/255, green: 115/255, blue: 95/255)

    @State private var selectedImage: UIImage?
    @State private var pickerItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var isScanning = false
    @State private var scanResult: IDScanResult?
    @State private var errorMessage: String?
    @State private var manualSubmitting = false
    @State private var manualSubmitted = false
    @State private var manualError: String?

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                cream.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 20) {
                        imagePreview
                        pickerButtons
                        if manualSubmitted {
                            manualSubmittedCard
                        } else if isScanning {
                            scanningCard
                        } else if let r = scanResult {
                            if r.success { successCard(r) }
                            else { failureCard(r.message, digits: r.rawDigits) }
                        } else if let err = errorMessage {
                            failureCard(err, digits: nil)
                        }
                        Spacer(minLength: 40)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Scan National ID")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(cream, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.foregroundStyle(burgundy)
                }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraPickerView(image: $selectedImage, isPresented: $showCamera)
                    .ignoresSafeArea()
            }
            .onChange(of: selectedImage) { _, img in
                if let img { scan(img) }
            }
            .onChange(of: pickerItem) { _, item in
                Task { await loadGalleryImage(item) }
            }
        }
    }

    // MARK: – Image preview

    private var imagePreview: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(tan)
                .frame(height: 220)
            if let img = selectedImage {
                Image(uiImage: img)
                    .resizable()
                    .scaledToFill()
                    .frame(maxWidth: .infinity)
                    .frame(height: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "creditcard.viewfinder")
                        .font(.system(size: 52, weight: .light))
                        .foregroundStyle(burgundy.opacity(0.55))
                    Text("Take or choose a photo of your ID card")
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundStyle(muted)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }
            }
        }
        .shadow(color: .black.opacity(0.08), radius: 10, x: 0, y: 4)
    }

    // MARK: – Picker buttons

    private var pickerButtons: some View {
        HStack(spacing: 12) {
            #if !targetEnvironment(simulator)
            Button {
                scanResult = nil; errorMessage = nil; showCamera = true
            } label: {
                Label("Take Photo", systemImage: "camera.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity).frame(height: 48)
                    .foregroundStyle(.white).background(burgundy)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
            .buttonStyle(QKPressStyle())
            .disabled(isScanning)
            #endif

            PhotosPicker(selection: $pickerItem, matching: .images, photoLibrary: .shared()) {
                Label("Choose Photo", systemImage: "photo.on.rectangle.angled")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity).frame(height: 48)
                    .foregroundStyle(burgundy).background(tan)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .strokeBorder(burgundy.opacity(0.3), lineWidth: 1.5)
                    )
            }
            .buttonStyle(QKPressStyle())
            .disabled(isScanning)
        }
    }

    // MARK: – State cards

    private var scanningCard: some View {
        HStack(spacing: 14) {
            ProgressView().tint(burgundy).scaleEffect(1.1)
            VStack(alignment: .leading, spacing: 3) {
                Text("Reading ID…")
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(ink)
                Text("Sending to EasyOCR server")
                    .font(.caption).foregroundStyle(muted)
            }
            Spacer()
        }
        .padding(18)
        .background(cream)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous)
            .strokeBorder(burgundy.opacity(0.15), lineWidth: 1))
        .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 3)
    }

    private func successCard(_ r: IDScanResult) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 10) {
                Image(systemName: "checkmark.seal.fill").font(.system(size: 20)).foregroundStyle(.green)
                Text("ID Detected").font(.system(size: 16, weight: .bold)).foregroundStyle(ink)
            }
            Divider()
            VStack(alignment: .leading, spacing: 10) {
                if let nm  = r.fullName       { row("Name",          nm,  "person.text.rectangle.fill") }
                if let id  = r.idNumber       { row("ID Number",     id,  "number.square.fill") }
                if let bd  = r.birthDate      { row("Birth Date",    bd,  "calendar") }
                if let gov = r.governorate    { row("Governorate",   gov, "mappin.circle.fill") }
                if let g   = r.gender         { row("Gender",        g,   "person.fill") }
                if let nat = r.nationality    { row("Nationality",   nat, "globe") }
                if let ad  = r.address        { row("Address",       ad,  "house.fill") }
                if let dn  = r.documentNumber { row("Document No.",  dn,  "doc.text.fill") }
            }
            if let id = r.idNumber {
                Button {
                    onIDDetected(id); dismiss()
                } label: {
                    Text("Use this ID")
                        .font(.system(size: 16, weight: .bold))
                        .frame(maxWidth: .infinity).frame(height: 52)
                        .foregroundStyle(.white)
                        .background(LinearGradient(colors: [burgundy, burgundy.opacity(0.85)],
                                                   startPoint: .leading, endPoint: .trailing))
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
                .buttonStyle(QKPressStyle())
            }
        }
        .padding(18)
        .background(Color(red: 236/255, green: 253/255, blue: 245/255))
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous)
            .strokeBorder(.green.opacity(0.3), lineWidth: 1.5))
        .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 3)
    }

    private func failureCard(_ message: String?, digits: String?) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 20)).foregroundStyle(.red)
                Text("Scan Failed").font(.system(size: 16, weight: .bold)).foregroundStyle(ink)
            }
            Text(message ?? "Could not read the ID. Please try again.")
                .font(.footnote).foregroundStyle(muted).fixedSize(horizontal: false, vertical: true)
            if let d = digits, !d.isEmpty {
                Text("Digits detected: \(d)")
                    .font(.system(size: 11, design: .monospaced)).foregroundStyle(muted.opacity(0.7))
            }
            if selectedImage != nil {
                Text("No problem — upload this photo and our team will verify it for you.")
                    .font(.footnote).foregroundStyle(muted).fixedSize(horizontal: false, vertical: true)
            }
            if manualSubmitting {
                HStack(spacing: 10) {
                    ProgressView().tint(burgundy)
                    Text("Uploading for review…").font(.footnote).foregroundStyle(muted)
                }
                .frame(maxWidth: .infinity).frame(height: 50)
            } else {
                if selectedImage != nil {
                    Button { submitManual() } label: {
                        Label("Upload for manual review", systemImage: "tray.and.arrow.up.fill")
                            .font(.system(size: 15, weight: .bold))
                            .frame(maxWidth: .infinity).frame(height: 50)
                            .foregroundStyle(.white).background(burgundy)
                            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    }
                    .buttonStyle(QKPressStyle())
                }
                Button {
                    scanResult = nil; errorMessage = nil; manualError = nil
                    selectedImage = nil; pickerItem = nil
                } label: {
                    Text("Try Again")
                        .font(.system(size: 14, weight: .semibold)).foregroundStyle(burgundy)
                        .frame(maxWidth: .infinity).frame(height: 44)
                        .background(tan)
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
                .buttonStyle(QKPressStyle())
            }
            if let manualError {
                Text(manualError).font(.caption).foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(18)
        .background(Color(red: 255/255, green: 242/255, blue: 242/255))
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous)
            .strokeBorder(.red.opacity(0.25), lineWidth: 1.5))
        .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 3)
    }

    private func row(_ label: String, _ value: String, _ icon: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon).font(.system(size: 14)).foregroundStyle(burgundy).frame(width: 20)
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.caption.weight(.semibold)).foregroundStyle(muted)
                Text(value).font(.system(size: 15, weight: .medium)).foregroundStyle(ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
    }

    private var manualSubmittedCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Image(systemName: "clock.badge.checkmark.fill").font(.system(size: 20)).foregroundStyle(.green)
                Text("Submitted for review").font(.system(size: 16, weight: .bold)).foregroundStyle(ink)
            }
            Text("Thanks! We've received your ID. Our team will verify it shortly — you'll be notified once it's approved.")
                .font(.footnote).foregroundStyle(muted).fixedSize(horizontal: false, vertical: true)
            Button { dismiss() } label: {
                Text("Done")
                    .font(.system(size: 16, weight: .bold))
                    .frame(maxWidth: .infinity).frame(height: 50)
                    .foregroundStyle(.white).background(burgundy)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
            .buttonStyle(QKPressStyle())
        }
        .padding(18)
        .background(Color(red: 236/255, green: 253/255, blue: 245/255))
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous)
            .strokeBorder(.green.opacity(0.3), lineWidth: 1.5))
        .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 3)
    }

    // MARK: – Scan logic

    /// Manual fallback: upload the captured photo to the backend for admin review.
    private func submitManual() {
        guard let img = selectedImage,
              let dataURL = QKAvatarImage.makeDataURL(from: img, maxDimension: 1400, quality: 0.85) else {
            manualError = "Couldn't prepare the image. Please choose another photo."
            return
        }
        manualError = nil; manualSubmitting = true
        Task {
            do {
                _ = try await TrustService.shared.submitVerification(doc: dataURL)
                await MainActor.run { manualSubmitting = false; manualSubmitted = true }
            } catch {
                await MainActor.run { manualSubmitting = false; manualError = error.localizedDescription }
            }
        }
    }

    private func scan(_ image: UIImage) {
        scanResult = nil; errorMessage = nil; isScanning = true
        Task {
            do {
                let r = try await EgyptianIDScanService.scan(image: image)
                await MainActor.run { scanResult = r; isScanning = false }
            } catch {
                await MainActor.run { errorMessage = error.localizedDescription; isScanning = false }
            }
        }
    }

    private func loadGalleryImage(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        scanResult = nil; errorMessage = nil
        do {
            guard let data = try await item.loadTransferable(type: Data.self),
                  let img  = UIImage(data: data) else { return }
            selectedImage = img
            scan(img)
        } catch {
            await MainActor.run { errorMessage = error.localizedDescription }
        }
    }
}
