import SwiftUI
import PhotosUI

/// A thumbnail for a `data:image/…;base64,…` string.
///
/// `AsyncImage` can't load a data: URL, and these bytes are already in memory —
/// there is nothing to fetch. Decoding is done once in `init` rather than per
/// render pass, because a base64 decode of a 1600px JPEG in `body` would run on
/// every layout.
private struct DataURLThumbnail: View {
    private let image: UIImage?

    init(dataURL: String) {
        guard
            let comma = dataURL.firstIndex(of: ","),
            let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...]))
        else {
            self.image = nil
            return
        }
        self.image = UIImage(data: data)
    }

    var body: some View {
        if let image {
            Image(uiImage: image).resizable().scaledToFill()
        } else {
            // A photo we can't decode still needs to occupy its slot, so the
            // remove button beside it stays where the guest expects.
            Color.qkTan.overlay(Image(systemName: "photo").foregroundStyle(Color.qkMuted))
        }
    }
}

/// Raising an issue about a stay, and following one already raised.
///
/// Pushed from a reservation. Which state it shows is decided by whether the
/// booking already has a dispute — a guest who has raised one wants its status,
/// not a second form.
///
/// Photos are downscaled and JPEG-encoded into `data:` URLs before upload, the
/// same path the add-listing wizard uses: an unmodified phone photo is several
/// MB of base64 and would be refused by the request-body limit.
@MainActor
final class DisputeViewModel: ObservableObject {
    @Published var categories: [DisputeCategory] = DisputeCategory.fallback
    @Published var category: String = ""
    @Published var text: String = ""
    @Published var photos: [String] = []
    @Published var isSending = false
    @Published var errorMessage: String?

    /// Set once filed (or when the booking already had one) — the view switches
    /// to the status card.
    @Published var filed: Dispute?
    @Published var events: [DisputeEvent] = []
    @Published var isLoadingHistory = false

    let bookingID: String

    init(bookingID: String, existing: Dispute? = nil) {
        self.bookingID = bookingID
        self.filed = existing
    }

    /// Minimum useful description — mirrors MIN_DESCRIPTION_CHARS server-side.
    /// The server re-checks; this only spares the guest a round trip.
    static let minCharacters = 20
    static let maxPhotos = 6

    var canSend: Bool {
        !category.isEmpty
            && text.trimmingCharacters(in: .whitespacesAndNewlines).count >= Self.minCharacters
            && !isSending
    }

    func loadCategories() async {
        // A failure here is not worth showing: the fallback list is already
        // correct, and the guest came here to complain, not to be told the
        // category list is unavailable.
        if let fetched = try? await DisputeService.fetch().categories, !fetched.isEmpty {
            categories = fetched
        }
    }

    func loadHistory() async {
        guard let id = filed?.id, events.isEmpty else { return }
        isLoadingHistory = true
        defer { isLoadingHistory = false }
        if let detail = try? await DisputeService.detail(id: id) {
            filed = detail.dispute
            events = detail.events
        }
    }

    func addPhotos(_ items: [PhotosPickerItem]) async {
        for item in items {
            guard photos.count < Self.maxPhotos else { break }
            guard
                let data = try? await item.loadTransferable(type: Data.self),
                let image = UIImage(data: data),
                let url = QKAvatarImage.makeDataURL(from: image, maxDimension: 1600, quality: 0.75)
            else { continue }
            photos.append(url)
        }
    }

    func send() async {
        guard canSend else { return }
        isSending = true
        errorMessage = nil
        defer { isSending = false }
        do {
            let dispute = try await DisputeService.file(
                bookingID: bookingID,
                category: category,
                description: text.trimmingCharacters(in: .whitespacesAndNewlines),
                photos: photos
            )
            filed = dispute
            await loadHistory()
        } catch {
            // The server's validation messages are written for the guest, so they
            // surface verbatim rather than being replaced with a generic failure.
            errorMessage = error.localizedDescription
        }
    }
}

struct DisputeView: View {
    @StateObject private var viewModel: DisputeViewModel
    @State private var pickerItems: [PhotosPickerItem] = []
    @Environment(\.dismiss) private var dismiss

    /// Shown above the form so the guest can see which stay they're reporting.
    let stayTitle: String?

    init(bookingID: String, stayTitle: String?, existing: Dispute? = nil) {
        _viewModel = StateObject(wrappedValue: DisputeViewModel(bookingID: bookingID, existing: existing))
        self.stayTitle = stayTitle
    }

    var body: some View {
        Group {
            if let dispute = viewModel.filed {
                status(dispute)
            } else {
                form
            }
        }
        .navigationTitle(viewModel.filed == nil ? "Report an issue" : "Your issue")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color.qkCream.ignoresSafeArea())
        .task {
            await viewModel.loadCategories()
            await viewModel.loadHistory()
        }
    }

    // MARK: - Already raised

    private func status(_ dispute: Dispute) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text(dispute.reference).font(.subheadline.weight(.bold))
                    Spacer()
                    Text(dispute.statusLabel)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(Color.qkBurgundy)
                }
                Text(dispute.categoryLabel).font(.callout).foregroundStyle(Color.qkMuted)

                Text(dispute.description)
                    .font(.callout)
                    .frame(maxWidth: .infinity, alignment: .leading)

                if let resolution = dispute.resolution, !resolution.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Outcome").font(.subheadline.weight(.bold))
                        Text(resolution).font(.callout)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }

                Text("History").font(.subheadline.weight(.bold)).padding(.top, 4)
                if viewModel.isLoadingHistory && viewModel.events.isEmpty {
                    ProgressView()
                } else {
                    ForEach(viewModel.events) { event in
                        VStack(alignment: .leading, spacing: 3) {
                            Text(event.summary).font(.footnote.weight(.semibold))
                            if let note = event.note, !note.isEmpty {
                                Text(note).font(.footnote)
                            }
                            Text(event.createdAt.prefix(10)).font(.caption).foregroundStyle(Color.qkMuted)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
            }
            .padding(16)
        }
    }

    // MARK: - The form

    private var form: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let stayTitle {
                    Text(stayTitle).font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("What is the issue about?").font(.subheadline.weight(.bold))
                    Picker("Category", selection: $viewModel.category) {
                        Text("Choose one…").tag("")
                        ForEach(viewModel.categories) { c in
                            Text(c.label).tag(c.key)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(Color.qkBurgundy)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("What happened?").font(.subheadline.weight(.bold))
                    TextEditor(text: $viewModel.text)
                        .frame(minHeight: 130)
                        .padding(6)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    let count = viewModel.text.trimmingCharacters(in: .whitespacesAndNewlines).count
                    if count > 0 && count < DisputeViewModel.minCharacters {
                        Text("A little more detail, please — at least \(DisputeViewModel.minCharacters) characters.")
                            .font(.caption).foregroundStyle(Color.qkMuted)
                    }
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Photos (optional)").font(.subheadline.weight(.bold))
                    if !viewModel.photos.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(Array(viewModel.photos.enumerated()), id: \.offset) { index, url in
                                    ZStack(alignment: .topTrailing) {
                                        DataURLThumbnail(dataURL: url)
                                            .frame(width: 72, height: 72)
                                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                        Button {
                                            viewModel.photos.remove(at: index)
                                        } label: {
                                            Image(systemName: "xmark.circle.fill")
                                                .foregroundStyle(.white, Color.qkInk)
                                        }
                                        .offset(x: 5, y: -5)
                                        .accessibilityLabel("Remove photo \(index + 1)")
                                    }
                                }
                            }
                        }
                    }
                    if viewModel.photos.count < DisputeViewModel.maxPhotos {
                        PhotosPicker(
                            selection: $pickerItems,
                            maxSelectionCount: DisputeViewModel.maxPhotos - viewModel.photos.count,
                            matching: .images
                        ) {
                            Label("Add photos", systemImage: "photo.on.rectangle")
                                .font(.subheadline.weight(.semibold))
                        }
                        .tint(Color.qkBurgundy)
                        .onChange(of: pickerItems) { _, items in
                            guard !items.isEmpty else { return }
                            Task {
                                await viewModel.addPhotos(items)
                                pickerItems = []
                            }
                        }
                    }
                }

                if let error = viewModel.errorMessage {
                    Text(error).font(.footnote).foregroundStyle(Color.qkBurgundy)
                }

                Button {
                    Task { await viewModel.send() }
                } label: {
                    ZStack {
                        if viewModel.isSending { ProgressView().tint(.white) }
                        else { Text("Send to QuickIn").font(.headline) }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(viewModel.canSend ? Color.qkBurgundy : Color.qkBurgundy.opacity(0.4))
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .disabled(!viewModel.canSend)

                Text("This goes to the QuickIn team, not to your host.")
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
            .padding(16)
        }
    }
}
