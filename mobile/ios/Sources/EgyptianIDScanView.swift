import SwiftUI
import PhotosUI
import UIKit

// MARK: - Camera picker (UIViewControllerRepresentable)

/// Wraps `UIImagePickerController` so SwiftUI can present the device camera.
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

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            parent.image = info[.originalImage] as? UIImage
            parent.isPresented = false
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.isPresented = false
        }
    }
}

// MARK: - EgyptianIDScanView

/// Full-screen sheet that lets the user photograph or pick an Egyptian
/// National ID card, sends it to the local OCR server, and surfaces the
/// parsed fields. Calls `onIDDetected` with the raw ID number string when
/// the user taps "Use this ID".
struct EgyptianIDScanView: View {
    /// Called when the user accepts a successfully-parsed ID number.
    var onIDDetected: (String) -> Void

    // Design tokens
    private let burgundy = Color(red: 91/255, green: 15/255, blue: 22/255)
    private let cream    = Color(red: 246/255, green: 241/255, blue: 230/255)
    private let tan      = Color(red: 239/255, green: 230/255, blue: 216/255)
    private let ink      = Color(red: 26/255, green: 18/255, blue: 11/255)
    private let muted    = Color(red: 140/255, green: 115/255, blue: 95/255)

    // State
    @State private var selectedImage: UIImage?
    @State private var photoPickerItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var isScanning = false
    @State private var scanResult: IDScanResult?
    @State private var errorMessage: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                cream.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        // Image preview / placeholder
                        imagePreviewCard

                        // Picker buttons
                        pickerButtons

                        // Result or error card
                        if isScanning {
                            scanningCard
                        } else if let result = scanResult {
                            if result.success {
                                successCard(result)
                            } else {
                                failureCard(result.message ?? "Could not read the ID. Please try again.")
                            }
                        } else if let error = errorMessage {
                            failureCard(error)
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
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(burgundy)
                }
            }
            // Camera sheet
            .fullScreenCover(isPresented: $showCamera) {
                CameraPickerView(image: $selectedImage, isPresented: $showCamera)
                    .ignoresSafeArea()
            }
            // React to a camera-captured image
            .onChange(of: selectedImage) { _, image in
                if let image {
                    handleSelectedImage(image)
                }
            }
            // React to gallery selection
            .onChange(of: photoPickerItem) { _, item in
                Task { await loadGalleryImage(item) }
            }
        }
    }

    // MARK: - Sub-views

    private var imagePreviewCard: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(tan)
                .frame(height: 220)

            if let image = selectedImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(maxWidth: .infinity)
                    .frame(height: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "creditcard.viewfinder")
                        .font(.system(size: 52, weight: .light))
                        .foregroundStyle(burgundy.opacity(0.6))
                    Text("Place the ID card in the frame")
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundStyle(muted)
                }
            }
        }
        .shadow(color: .black.opacity(0.08), radius: 10, x: 0, y: 4)
    }

    private var pickerButtons: some View {
        HStack(spacing: 12) {
            // Camera button
            Button {
                scanResult = nil
                errorMessage = nil
                showCamera = true
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 15, weight: .semibold))
                    Text("Take Photo")
                        .font(.system(size: 15, weight: .semibold))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .foregroundStyle(.white)
                .background(burgundy)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
            .buttonStyle(QKPressStyle())
            .disabled(isScanning)

            // Gallery button
            PhotosPicker(
                selection: $photoPickerItem,
                matching: .images,
                photoLibrary: .shared()
            ) {
                HStack(spacing: 8) {
                    Image(systemName: "photo.on.rectangle.angled")
                        .font(.system(size: 15, weight: .semibold))
                    Text("Choose from Library")
                        .font(.system(size: 15, weight: .semibold))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .foregroundStyle(burgundy)
                .background(tan)
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

    private var scanningCard: some View {
        HStack(spacing: 14) {
            ProgressView()
                .tint(burgundy)
                .scaleEffect(1.1)
            VStack(alignment: .leading, spacing: 3) {
                Text("Reading ID...")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(ink)
                Text("Connecting to OCR server")
                    .font(.caption)
                    .foregroundStyle(muted)
            }
            Spacer()
        }
        .padding(18)
        .background(cream)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .strokeBorder(burgundy.opacity(0.15), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 3)
    }

    private func successCard(_ result: IDScanResult) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack(spacing: 10) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(.green)
                Text("ID Detected")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(ink)
            }

            Divider()

            // Fields
            VStack(alignment: .leading, spacing: 10) {
                if let idNum = result.idNumber {
                    resultRow(label: "ID Number", value: idNum, icon: "number.square.fill")
                }
                if let bd = result.birthDate {
                    resultRow(label: "Birth Date", value: bd, icon: "calendar")
                }
                if let gov = result.governorate {
                    resultRow(label: "Governorate", value: gov, icon: "mappin.circle.fill")
                }
                if let gender = result.gender {
                    resultRow(label: "Gender", value: gender, icon: "person.fill")
                }
            }

            // "Use this ID" button
            if let idNum = result.idNumber {
                Button {
                    onIDDetected(idNum)
                    dismiss()
                } label: {
                    Text("Use this ID")
                        .font(.system(size: 16, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .foregroundStyle(.white)
                        .background(
                            LinearGradient(
                                colors: [burgundy, burgundy.opacity(0.85)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
                .buttonStyle(QKPressStyle())
            }
        }
        .padding(18)
        .background(Color(red: 236/255, green: 253/255, blue: 245/255)) // light green tint
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .strokeBorder(.green.opacity(0.3), lineWidth: 1.5)
        )
        .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 3)
    }

    private func failureCard(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(.red)
                Text("Scan Failed")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(ink)
            }
            Text(message)
                .font(.footnote)
                .foregroundStyle(muted)
                .fixedSize(horizontal: false, vertical: true)

            Button {
                scanResult = nil
                errorMessage = nil
                selectedImage = nil
                photoPickerItem = nil
            } label: {
                Text("Try Again")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(burgundy)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(tan)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
            .buttonStyle(QKPressStyle())
        }
        .padding(18)
        .background(Color(red: 255/255, green: 242/255, blue: 242/255)) // light red tint
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .strokeBorder(.red.opacity(0.25), lineWidth: 1.5)
        )
        .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 3)
    }

    private func resultRow(label: String, value: String, icon: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(burgundy)
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(muted)
                Text(value)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(ink)
            }
        }
    }

    // MARK: - Logic

    private func handleSelectedImage(_ image: UIImage) {
        scanResult = nil
        errorMessage = nil
        isScanning = true
        Task {
            do {
                let result = try await EgyptianIDScanService.scan(image: image)
                await MainActor.run {
                    scanResult = result
                    isScanning = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isScanning = false
                }
            }
        }
    }

    private func loadGalleryImage(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        scanResult = nil
        errorMessage = nil
        do {
            guard
                let data = try await item.loadTransferable(type: Data.self),
                let image = UIImage(data: data)
            else { return }
            selectedImage = image
            handleSelectedImage(image)
        } catch {
            await MainActor.run {
                errorMessage = error.localizedDescription
            }
        }
    }
}
