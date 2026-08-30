import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

/// The one control every ownership-document upload on iOS goes through — the
/// add-listing wizard, the listing editor, and the "(Re-)upload ownership
/// document" button on a host's own listing card.
///
/// It offers TWO sources, because a deed reaches a host either way: the photo
/// library (a photographed or scanned document, downscaled like every other
/// photo the app uploads) and Files (a PDF the registry, developer or utility
/// issued, stored byte-for-byte). Both phones used to offer only the first,
/// which is the whole of the defect this fixes — the web has accepted
/// `image/*,application/pdf` since 2026-08-19.
///
/// The caller supplies the label (each of the three sites has its own styling)
/// and receives either an encoded `data:` URL that already passed
/// `OwnershipDocRules`, or a localized sentence saying why the file was refused.
/// `label` is handed the processing flag so a site can swap in its own spinner.
struct OwnershipDocPicker<Label: View>: View {
    /// A document that passed the rules, as a `data:image/jpeg` or
    /// `data:application/pdf` URL ready to send as `ownership_doc`.
    let onPicked: (String) -> Void
    /// A localized sentence for a refused file, or nil to clear the last one.
    let onProblem: (String?) -> Void
    /// The button's face. The flag is true while a pick is being encoded.
    @ViewBuilder let label: (Bool) -> Label

    @State private var photoItem: PhotosPickerItem?
    @State private var showingPhotoPicker = false
    @State private var showingFileImporter = false
    @State private var isProcessing = false

    var body: some View {
        Menu {
            Button {
                showingPhotoPicker = true
            } label: {
                SwiftUI.Label(L.t("approval.choosePhoto"), systemImage: "photo.on.rectangle")
            }
            Button {
                showingFileImporter = true
            } label: {
                SwiftUI.Label(L.t("approval.chooseFile"), systemImage: "doc.text")
            }
        } label: {
            label(isProcessing)
        }
        .disabled(isProcessing)
        .photosPicker(isPresented: $showingPhotoPicker, selection: $photoItem, matching: .images, photoLibrary: .shared())
        // `.image` alongside `.pdf` so a document saved to Files as a scan is
        // still reachable — the same pair the web's accept attribute names.
        .fileImporter(isPresented: $showingFileImporter, allowedContentTypes: [.pdf, .image]) { result in
            Task { await handleFile(result) }
        }
        .onChange(of: photoItem) { _, item in
            Task { await handlePhoto(item) }
        }
    }

    // MARK: - Picking

    private func handlePhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        onProblem(nil)
        isProcessing = true
        defer {
            isProcessing = false
            // Cleared so re-picking the same photo fires onChange again.
            photoItem = nil
        }
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            onProblem(L.t(OwnershipDocRules.Problem.unsupported.localizationKey))
            return
        }
        finish(encode(data))
    }

    private func handleFile(_ result: Result<URL, Error>) async {
        onProblem(nil)
        guard case .success(let url) = result else { return }
        isProcessing = true
        defer { isProcessing = false }
        // A file outside the app's container arrives security-scoped; without
        // this the read fails with a permission error the host cannot act on.
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else {
            onProblem(L.t(OwnershipDocRules.Problem.unsupported.localizationKey))
            return
        }
        finish(encode(data))
    }

    /// Turn picked bytes into a document we would send: a PDF is kept exactly as
    /// it was issued (there is nothing to downscale, and re-encoding a deed is
    /// how you make it illegible), anything else has to decode as an image.
    private func encode(_ data: Data) -> String? {
        if let pdf = OwnershipDocRules.pdfDataURL(from: data) { return pdf }
        guard let image = UIImage(data: data) else { return nil }
        return QKAvatarImage.makeDataURL(from: image, maxDimension: 1200, quality: 0.8)
    }

    /// Report the encoded document, or the reason it was refused. Size is judged
    /// here rather than at the API so the host is told which file to shrink.
    private func finish(_ doc: String?) {
        guard let doc else {
            onProblem(L.t(OwnershipDocRules.Problem.unsupported.localizationKey))
            return
        }
        if let problem = OwnershipDocRules.check(doc) {
            onProblem(L.t(problem.localizationKey))
            return
        }
        onPicked(doc)
    }
}
