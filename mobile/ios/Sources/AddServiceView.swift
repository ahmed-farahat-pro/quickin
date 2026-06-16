import SwiftUI

/// Host "Add service" form → `POST /api/local/services`. Collects the fields the
/// backend contract expects (title, category, description, location, price,
/// image URL), validates the essentials client-side, and on success dismisses
/// back to the host dashboard (which refreshes its lists). Mirrors `AddListingView`.
struct AddServiceView: View {
    /// Called after a successful create so the parent can refresh + dismiss.
    var onCreated: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var description = ""
    @State private var location = ""
    @State private var priceText = ""
    @State private var imageURL = ""

    private let categories = ["Jet Ski", "Diving", "Yacht", "Surfing", "Fishing", "Kayaking", "Sailing", "Snorkeling", "Tour", "Other"]
    @State private var category = "Jet Ski"

    @State private var isSaving = false
    @State private var errorMessage: String?

    private var price: Double { Double(priceText.trimmingCharacters(in: .whitespaces)) ?? 0 }

    private var canSubmit: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty &&
        price > 0 &&
        !isSaving
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.qkCream.ignoresSafeArea()
                Form {
                    basicsSection
                    placeSection
                    photoSection
                    if let errorMessage {
                        Section {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundStyle(Color.qkBurgundy)
                        }
                    }
                    submitSection
                }
                .scrollContentBackground(.hidden)
                .background(Color.qkCream)
            }
            .navigationTitle("Add service")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.qkCream, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .tint(.qkBurgundy)
                }
            }
        }
        .tint(.qkBurgundy)
    }

    // MARK: - Sections

    private var basicsSection: some View {
        Section("Basics") {
            TextField("Title (e.g. Sunset Jet Ski Tour)", text: $title)
            Picker("Category", selection: $category) {
                ForEach(categories, id: \.self) { Text($0).tag($0) }
            }
            TextField("Description", text: $description, axis: .vertical)
                .lineLimit(3...6)
        }
    }

    private var placeSection: some View {
        Section("Details") {
            TextField("Location (city or marina)", text: $location)
                .textInputAutocapitalization(.words)
            HStack {
                Text("Price")
                Spacer()
                Text("EGP")
                    .foregroundStyle(Color.qkMuted)
                TextField("0", text: $priceText)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 90)
            }
        }
    }

    private var photoSection: some View {
        Section {
            TextField("Image URL", text: $imageURL)
                .keyboardType(.URL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
        } header: {
            Text("Photo")
        } footer: {
            Text("Paste one image URL (e.g. an Unsplash link). Optional.")
        }
    }

    private var submitSection: some View {
        Section {
            Button {
                Task { await submit() }
            } label: {
                ZStack {
                    if isSaving {
                        ProgressView().tint(.white)
                    } else {
                        Text("Publish service").fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background(canSubmit ? Color.qkBurgundy : Color.qkBurgundy.opacity(0.4))
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .disabled(!canSubmit)
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)
        }
    }

    // MARK: - Action

    private func submit() async {
        errorMessage = nil
        isSaving = true
        defer { isSaving = false }

        let payload = ServiceService.NewService(
            title: title.trimmingCharacters(in: .whitespaces),
            description: description.trimmingCharacters(in: .whitespaces),
            category: category,
            location: location.trimmingCharacters(in: .whitespaces),
            price: price,
            imageURL: imageURL,
            lat: nil,
            lng: nil
        )

        do {
            _ = try await ServiceService.shared.createService(payload)
            onCreated()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
