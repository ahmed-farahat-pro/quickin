import SwiftUI
import CoreLocation
import PhotosUI

/// Host "Add listing" flow → `POST /api/local/listings`. Restructured as a
/// 4-step wizard (Basics → Location → Details → Review) over the same field set
/// and the same create-listing networking the single-form version used.
///
/// • Step 1 — Basics: title (required), property type, description.
/// • Step 2 — Location: Google Maps draggable pin-picker + place search that
///   geocodes free text via the Google Geocoding HTTP API and recenters the map.
///   A pin is required to advance.
/// • Step 3 — Details: capacity steppers + price (required) + cancellation
///   policy + an ownership / proof-of-ownership document (PhotosPicker).
/// • Step 4 — Review: a read-only summary and the "Submit for review" button.
///   New listings are created pending + unpublished until an admin approves —
///   the success copy reflects that, and the host tracks status on their
///   dashboard.
struct AddListingView: View {
    /// Called after a successful create so the parent can refresh + dismiss.
    var onCreated: () -> Void

    @Environment(\.dismiss) private var dismiss

    // MARK: Wizard state

    private static let totalSteps = 4
    /// Current step, 1...4. Animated transitions are driven by changing this.
    @State private var step = 1

    // MARK: Fields (identical set to the original form)

    @State private var title = ""
    @State private var description = ""
    @State private var location = ""
    @State private var country = ""
    @State private var priceText = ""
    @State private var imageURL = ""

    @State private var maxGuests = 2
    @State private var bedrooms = 1
    @State private var beds = 1
    @State private var bathrooms = 1

    /// Amenities the host toggled on in the Details step (sent as `amenities`).
    @State private var selectedAmenities: Set<String> = []

    /// The cancellation policy the host picks in the Details step (sent as
    /// `cancellation_policy`). Defaults to moderate.
    @State private var cancellationPolicy: CancellationPolicy = .moderate

    /// Length-of-stay discounts the host sets in the Details step (sent as
    /// `weekly_discount` / `monthly_discount`). `0` means no discount.
    @State private var weeklyDiscount = 0
    @State private var monthlyDiscount = 0

    /// Optional seasonal pricing the host sets in the Details step. `weekendPrice`
    /// is the EGP weekend nightly-rate text (empty = none); `monthlyPrices` maps
    /// month "1".."12" → nightly-rate text (only filled months are sent). Sent as
    /// `weekend_price` / `monthly_prices`.
    @State private var weekendPrice = ""
    @State private var monthlyPrices: [String: String] = [:]

    /// The ownership / proof document the host attaches in the Details step,
    /// encoded as a `data:image/*;base64,…` URL (sent as `ownership_doc`). Empty
    /// until a photo is picked + processed.
    @State private var ownershipDoc = ""
    /// The PhotosPicker selection for the ownership document; processed into
    /// `ownershipDoc` on change.
    @State private var ownershipDocItem: PhotosPickerItem?
    /// True while a freshly-picked ownership doc is being downscaled + encoded.
    @State private var isProcessingDoc = false

    private let propertyTypes = ["Apartment", "House", "Villa", "Cabin", "Studio", "Loft", "Cottage"]
    @State private var propertyType = "Apartment"

    /// Curated areas a host picks from before dropping the precise pin. Sent as
    /// `region` and matched 1:1 with the Explore region chips / backend regions.
    private let regions = ["North Coast", "Ain Sokhna", "El Gouna", "Cairo"]
    /// Chosen region (nil until the host taps one). Required to advance.
    @State private var region: String?

    /// Map coordinate chosen via the pin-picker / search (nil until placed).
    @State private var coordinate: CLLocationCoordinate2D?

    // MARK: Location search (step 2)

    @State private var searchQuery = ""
    /// Owns CLLocationManager (current location) + MKLocalSearch (place search).
    @StateObject private var locationSearch = LocationSearchManager()
    /// "Move the map here" target + monotonic trigger for LocationPickerMap.
    @State private var recenterTarget: CLLocationCoordinate2D?
    @State private var recenterToken = 0

    // MARK: Submission

    @State private var isSaving = false
    @State private var errorMessage: String?

    // MARK: AI description writer (Section 10)

    /// True while the AI writer is composing a description (disables the button +
    /// the field, shows a spinner).
    @State private var isWritingDescription = false
    /// A writer-specific error surfaced inline under the description field.
    @State private var writerError: String?

    private var price: Double { Double(priceText.trimmingCharacters(in: .whitespaces)) ?? 0 }

    /// Selected amenities in the catalog's display order (stable for the body +
    /// the review summary), rather than `Set`'s undefined ordering.
    private var orderedAmenities: [String] {
        Amenities.all.filter { selectedAmenities.contains($0) }
    }

    // MARK: - Per-step validation

    private var step1Valid: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
    }
    private var step2Valid: Bool { region != nil && coordinate != nil }
    private var step3Valid: Bool { price > 0 }

    /// Whether the current step's required fields are satisfied (gates Next).
    private var currentStepValid: Bool {
        switch step {
        case 1:  return step1Valid
        case 2:  return step2Valid
        case 3:  return step3Valid
        default: return true
        }
    }

    private var canPublish: Bool {
        step1Valid && step2Valid && step3Valid && !isSaving
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()

                VStack(spacing: 0) {
                    progressHeader

                    TabView(selection: $step) {
                        stepCard { BasicsStep(
                            title: $title,
                            description: $description,
                            propertyType: $propertyType,
                            propertyTypes: propertyTypes,
                            isWritingDescription: isWritingDescription,
                            canWrite: step1Valid,
                            writerError: writerError,
                            onWriteWithAI: { Task { await writeDescription() } }
                        ) }
                        .tag(1)

                        stepCard { LocationStep(
                            region: $region,
                            regions: regions,
                            location: $location,
                            country: $country,
                            coordinate: $coordinate,
                            searchQuery: $searchQuery,
                            recenterTarget: $recenterTarget,
                            recenterToken: $recenterToken,
                            search: locationSearch,
                            onSearch: { Task { await locationSearch.search(searchQuery) } },
                            onSelect: { applyPlace($0) },
                            onUseCurrentLocation: { locationSearch.requestCurrentLocation() }
                        ) }
                        .tag(2)

                        stepCard { DetailsStep(
                            maxGuests: $maxGuests,
                            bedrooms: $bedrooms,
                            beds: $beds,
                            bathrooms: $bathrooms,
                            priceText: $priceText,
                            selectedAmenities: $selectedAmenities,
                            cancellationPolicy: $cancellationPolicy,
                            weeklyDiscount: $weeklyDiscount,
                            monthlyDiscount: $monthlyDiscount,
                            weekendPrice: $weekendPrice,
                            monthlyPrices: $monthlyPrices,
                            ownershipDoc: $ownershipDoc,
                            ownershipDocItem: $ownershipDocItem,
                            isProcessingDoc: isProcessingDoc
                        ) }
                        .tag(3)

                        stepCard { ReviewStep(
                            title: title,
                            propertyType: propertyType,
                            location: location,
                            country: country,
                            price: price,
                            maxGuests: maxGuests,
                            bedrooms: bedrooms,
                            beds: beds,
                            bathrooms: bathrooms,
                            coordinate: coordinate,
                            imageURL: imageURL,
                            amenities: orderedAmenities,
                            cancellationPolicy: cancellationPolicy,
                            weeklyDiscount: weeklyDiscount,
                            monthlyDiscount: monthlyDiscount,
                            hasOwnershipDoc: !ownershipDoc.isEmpty,
                            errorMessage: errorMessage
                        ) }
                        .tag(4)
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    .animation(.easeInOut(duration: 0.3), value: step)

                    navBar
                }
            }
            .navigationTitle("Add listing")
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
        .onAppear { bindLocationCallback() }
        // Downscale + encode a freshly-picked ownership document into a data URL.
        .onChange(of: ownershipDocItem) { _, item in
            Task { await processOwnershipDoc(item) }
        }
    }

    // MARK: - Chrome

    /// Progress dots + "Step X of 4" + the step title.
    private var progressHeader: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                ForEach(1...Self.totalSteps, id: \.self) { index in
                    Capsule()
                        .fill(index <= step ? Color.qkBurgundy : Color.qkBurgundy.opacity(0.18))
                        .frame(width: index == step ? 26 : 9, height: 9)
                        .animation(.easeInOut(duration: 0.3), value: step)
                }
            }
            HStack {
                Text(stepTitle)
                    .font(.headline)
                    .foregroundStyle(Color.qkInk)
                Spacer()
                Text("Step \(step) of \(Self.totalSteps)")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Color.qkMuted)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }

    private var stepTitle: String {
        switch step {
        case 1:  return "Basics"
        case 2:  return "Location"
        case 3:  return "Details"
        default: return "Review"
        }
    }

    /// Bottom Back / Next (or Publish) bar.
    private var navBar: some View {
        HStack(spacing: 12) {
            if step > 1 {
                Button { goBack() } label: {
                    Text("Back")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .foregroundStyle(Color.qkBurgundy)
                        .background(Color.white)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(Color.qkBurgundy.opacity(0.25), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
            }

            if step < Self.totalSteps {
                Button { goNext() } label: {
                    QKPrimaryButtonLabel(title: "Next")
                        .opacity(currentStepValid ? 1 : 0.45)
                }
                .buttonStyle(QKPressStyle())
                .disabled(!currentStepValid)
            } else {
                Button { Task { await submit() } } label: {
                    QKPrimaryButtonLabel(title: L.t("approval.submitForReview"), isLoading: isSaving)
                        .opacity(canPublish ? 1 : 0.45)
                }
                .buttonStyle(QKPressStyle())
                .disabled(!canPublish)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 12)
        .background(Color.qkCream)
    }

    /// Wraps each step's content in a scrollable white "card" on the cream bg.
    private func stepCard<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                content()
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: - Navigation actions

    private func goNext() {
        guard currentStepValid else { return }
        withAnimation(.easeInOut(duration: 0.3)) {
            step = min(step + 1, Self.totalSteps)
        }
    }

    private func goBack() {
        withAnimation(.easeInOut(duration: 0.3)) {
            step = max(step - 1, 1)
        }
    }

    // MARK: - Applying a chosen place / current location

    /// Wires the location manager's one-shot current-location callback. Called
    /// once when the view appears so a fix recenters the map + fills the form.
    private func bindLocationCallback() {
        locationSearch.onLocation = { coord, place in
            apply(coordinate: coord, city: place?.city, country: place?.country)
        }
    }

    /// Apply a search result the host picked: recenter the map, move the pin,
    /// fill the city / country, and clear the result list.
    private func applyPlace(_ place: PlaceResult) {
        apply(coordinate: place.coordinate, city: place.city, country: place.country)
        locationSearch.clearResults()
    }

    /// Shared "place a pin at this coordinate + fill the text" routine used by
    /// both search-result selection and the current-location fix. Always
    /// recenters the map; fills city / country only when those fields are empty
    /// so it never clobbers what the host already typed.
    private func apply(coordinate coord: CLLocationCoordinate2D, city: String?, country countryName: String?) {
        self.coordinate = coord
        recenterTarget = coord
        recenterToken += 1

        if location.trimmingCharacters(in: .whitespaces).isEmpty,
           let city, !city.isEmpty {
            location = city
        }
        if country.trimmingCharacters(in: .whitespaces).isEmpty,
           let countryName, !countryName.isEmpty {
            country = countryName
        }
    }

    // MARK: - Ownership document

    /// Process an ownership document chosen via `PhotosPicker`: load its data off
    /// the main thread, downscale to ≤1200px + JPEG-encode into a `data:` URL,
    /// and stash it in `ownershipDoc` for the create request. On failure the
    /// field stays empty and an inline error is shown on the Review step.
    private func processOwnershipDoc(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        errorMessage = nil
        isProcessingDoc = true
        defer { isProcessingDoc = false }
        guard
            let data = try? await item.loadTransferable(type: Data.self),
            let image = UIImage(data: data),
            let dataURL = QKAvatarImage.makeDataURL(from: image, maxDimension: 1200, quality: 0.8)
        else {
            errorMessage = L.t("trust.uploadError")
            return
        }
        ownershipDoc = dataURL
    }

    // MARK: - AI description writer

    /// Compose a description from the listing's current fields via
    /// `POST /api/local/ai/listing-description` and drop it into the editable
    /// `description` field. Pulls fields from across the wizard (title +
    /// property type from Basics, region/location from Location, capacity +
    /// amenities from Details) so the writer works even on step 1.
    private func writeDescription() async {
        writerError = nil
        isWritingDescription = true
        defer { isWritingDescription = false }

        let input = AIService.ListingDescriptionInput(
            title: title.trimmingCharacters(in: .whitespaces),
            location: location.trimmingCharacters(in: .whitespaces),
            region: region,
            propertyType: propertyType,
            bedrooms: bedrooms,
            maxGuests: maxGuests,
            amenities: orderedAmenities,
            notes: description.trimmingCharacters(in: .whitespaces)
        )
        do {
            let text = try await AIService.shared.generateListingDescription(input)
            withAnimation(QKAnim.swap) { description = text }
        } catch let error as AIServiceError {
            writerError = error.localizedMessage
        } catch {
            writerError = error.localizedDescription
        }
    }

    // MARK: - Create action

    private func submit() async {
        errorMessage = nil
        isSaving = true
        defer { isSaving = false }

        let payload = HostService.NewListing(
            title: title.trimmingCharacters(in: .whitespaces),
            description: description.trimmingCharacters(in: .whitespaces),
            location: location.trimmingCharacters(in: .whitespaces),
            country: country.trimmingCharacters(in: .whitespaces),
            region: region,
            pricePerNight: price,
            bedrooms: bedrooms,
            beds: beds,
            bathrooms: bathrooms,
            maxGuests: maxGuests,
            propertyType: propertyType,
            imageURL: imageURL,
            amenities: orderedAmenities,
            cancellationPolicy: cancellationPolicy,
            weeklyDiscount: weeklyDiscount,
            monthlyDiscount: monthlyDiscount,
            weekendPrice: SeasonalPricingFields.parseWeekend(weekendPrice),
            monthlyPrices: SeasonalPricingFields.parseMonths(monthlyPrices),
            ownershipDoc: ownershipDoc,
            lat: coordinate?.latitude,
            lng: coordinate?.longitude
        )

        do {
            _ = try await HostService.shared.createListing(payload)
            onCreated()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Step 1: Basics

private struct BasicsStep: View {
    @EnvironmentObject private var loc: LocalizationManager
    @Binding var title: String
    @Binding var description: String
    @Binding var propertyType: String
    let propertyTypes: [String]

    /// Section 10 — AI writer wiring (owned by the parent `AddListingView`).
    var isWritingDescription: Bool = false
    /// Whether enough is entered (a title) to compose a description.
    var canWrite: Bool = false
    var writerError: String? = nil
    var onWriteWithAI: () -> Void = {}

    var body: some View {
        FieldLabel("Title", required: true)
        WizardTextField("e.g. Sea-view boutique apartment", text: $title)

        FieldLabel("Property type")
        Menu {
            Picker("Property type", selection: $propertyType) {
                ForEach(propertyTypes, id: \.self) { Text($0).tag($0) }
            }
        } label: {
            HStack {
                Text(propertyType)
                    .foregroundStyle(Color.qkInk)
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.footnote)
                    .foregroundStyle(Color.qkMuted)
            }
            .padding(.horizontal, 14)
            .frame(height: 48)
            .background(Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }

        // Description header row with the "Write with AI" action trailing.
        HStack(alignment: .firstTextBaseline) {
            FieldLabel("Description")
            Spacer()
            writeWithAIButton
        }
        WizardTextField("Tell guests what makes your place special…",
                        text: $description, axis: .vertical, lineLimit: 4...8)

        if let writerError {
            HStack(alignment: .top, spacing: 6) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(Color.qkBurgundy)
                Text(writerError)
                    .font(.footnote)
                    .foregroundStyle(Color.qkInk)
                Spacer(minLength: 0)
            }
        }

        Text(loc.t("ai.writerHint"))
            .font(.footnote)
            .foregroundStyle(Color.qkMuted)
            .padding(.top, 2)
    }

    /// "✨ Write with AI" pill. Disabled (greyed) until a title is entered, and
    /// shows a spinner + "Writing…" while the request is in flight.
    private var writeWithAIButton: some View {
        Button(action: onWriteWithAI) {
            HStack(spacing: 6) {
                if isWritingDescription {
                    ProgressView().controlSize(.mini).tint(.qkBurgundy)
                } else {
                    Image(systemName: "sparkles")
                        .font(.system(size: 12, weight: .bold))
                }
                Text(loc.t(isWritingDescription ? "ai.writing" : "ai.writeWithAI"))
                    .font(.system(size: 12, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(Color.qkBurgundy)
            .padding(.horizontal, 11)
            .frame(height: 32)
            .background(Color.qkTan)
            .clipShape(Capsule())
            .overlay(
                Capsule().strokeBorder(Color.qkBurgundy.opacity(0.18), lineWidth: 1)
            )
            .opacity((canWrite && !isWritingDescription) ? 1 : 0.55)
        }
        .buttonStyle(.qkTap)
        .disabled(!canWrite || isWritingDescription)
        .accessibilityLabel(loc.t("ai.writeWithAI"))
    }
}

// MARK: - Step 2: Location

private struct LocationStep: View {
    @Binding var region: String?
    let regions: [String]
    @Binding var location: String
    @Binding var country: String
    @Binding var coordinate: CLLocationCoordinate2D?
    @Binding var searchQuery: String
    @Binding var recenterTarget: CLLocationCoordinate2D?
    @Binding var recenterToken: Int
    @ObservedObject var search: LocationSearchManager
    var onSearch: () -> Void
    var onSelect: (PlaceResult) -> Void
    var onUseCurrentLocation: () -> Void

    var body: some View {
        // Region first: the host picks the area, then drops the precise pin.
        FieldLabel("Region", required: true)
        regionPicker

        FieldLabel("Search for a place")
        searchField

        // Place-search results: tap one to drop the pin + fill the form.
        if !search.results.isEmpty {
            VStack(spacing: 0) {
                ForEach(Array(search.results.enumerated()), id: \.element.id) { index, place in
                    if index > 0 { Divider() }
                    Button { onSelect(place) } label: {
                        resultRow(place)
                    }
                    .buttonStyle(.plain)
                }
            }
            .background(Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }

        if let error = search.errorMessage {
            Text(error)
                .font(.footnote)
                .foregroundStyle(Color.qkBurgundy)
        }

        // "Use my current location" — CLLocationManager one-shot fix.
        currentLocationButton

        // The Google Maps draggable pin-picker.
        LocationPickerMap(
            selection: $coordinate,
            recenterTo: recenterTarget,
            recenterToken: recenterToken
        )
        .frame(height: 260)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

        // Chosen-coordinate readout.
        HStack(spacing: 8) {
            Image(systemName: coordinate == nil ? "mappin.slash" : "mappin.circle.fill")
                .foregroundStyle(coordinate == nil ? Color.qkMuted : Color.qkBurgundy)
            if let coordinate {
                Text(String(format: "%.5f, %.5f", coordinate.latitude, coordinate.longitude))
                    .font(.footnote.monospacedDigit())
                    .foregroundStyle(Color.qkInk)
                Spacer()
                Button("Clear") { self.coordinate = nil }
                    .font(.footnote)
                    .tint(.qkBurgundy)
            } else {
                Text("Tap the map, search, or use your location to place a pin")
                    .font(.footnote)
                    .foregroundStyle(Color.qkMuted)
                Spacer()
            }
        }

        FieldLabel("Location (city)")
        WizardTextField("City", text: $location)
            .textInputAutocapitalization(.words)

        FieldLabel("Country")
        WizardTextField("Country", text: $country)
            .textInputAutocapitalization(.words)

        Text("Pick a region, then drag the pin to fine-tune the exact spot. A region and a pin are both required to continue.")
            .font(.footnote)
            .foregroundStyle(Color.qkMuted)
            .padding(.top, 2)
    }

    // MARK: - Pieces

    /// A wrapping grid of region chips. Tapping one selects it (burgundy fill);
    /// the selection is required before the host can advance to Details.
    private var regionPicker: some View {
        let columns = [GridItem(.adaptive(minimum: 110), spacing: 10, alignment: .leading)]
        return LazyVGrid(columns: columns, alignment: .leading, spacing: 10) {
            ForEach(regions, id: \.self) { name in
                let isOn = region == name
                Button {
                    region = name
                } label: {
                    Text(name)
                        .font(.subheadline.weight(.medium))
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                        .foregroundStyle(isOn ? .white : Color.qkInk)
                        .padding(.horizontal, 12)
                        .frame(height: 40)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .background(isOn ? Color.qkBurgundy : Color.qkCream)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .strokeBorder(isOn ? Color.clear : Color.qkBurgundy.opacity(0.18), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(name)
                .accessibilityAddTraits(isOn ? .isSelected : [])
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Color.qkMuted)
            TextField("Address, city, or landmark", text: $searchQuery)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .onSubmit(onSearch)
            if search.isSearching {
                ProgressView().controlSize(.small)
            } else if !searchQuery.isEmpty {
                Button { onSearch() } label: {
                    Image(systemName: "arrow.right.circle.fill")
                        .foregroundStyle(Color.qkBurgundy)
                }
            }
        }
        .padding(.horizontal, 14)
        .frame(height: 48)
        .background(Color.qkCream)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func resultRow(_ place: PlaceResult) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "mappin.circle.fill")
                .foregroundStyle(Color.qkBurgundy)
            VStack(alignment: .leading, spacing: 2) {
                Text(place.title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.qkInk)
                    .lineLimit(1)
                if !place.subtitle.isEmpty {
                    Text(place.subtitle)
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                        .lineLimit(1)
                }
            }
            Spacer()
            Image(systemName: "arrow.up.left")
                .font(.caption)
                .foregroundStyle(Color.qkMuted)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }

    private var currentLocationButton: some View {
        Button { onUseCurrentLocation() } label: {
            HStack(spacing: 8) {
                if search.isLocating {
                    ProgressView().controlSize(.small).tint(.qkBurgundy)
                } else {
                    Image(systemName: "location.fill")
                }
                Text(search.isLocating ? "Locating…" : "Use my current location")
                    .font(.subheadline.weight(.semibold))
            }
            .foregroundStyle(Color.qkBurgundy)
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .background(Color.qkTan)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color.qkBurgundy.opacity(0.18), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(search.isLocating)
    }
}

// MARK: - Step 3: Details

private struct DetailsStep: View {
    @Binding var maxGuests: Int
    @Binding var bedrooms: Int
    @Binding var beds: Int
    @Binding var bathrooms: Int
    @Binding var priceText: String
    @Binding var selectedAmenities: Set<String>
    @Binding var cancellationPolicy: CancellationPolicy
    @Binding var weeklyDiscount: Int
    @Binding var monthlyDiscount: Int
    @Binding var weekendPrice: String
    @Binding var monthlyPrices: [String: String]
    @Binding var ownershipDoc: String
    @Binding var ownershipDocItem: PhotosPickerItem?
    let isProcessingDoc: Bool

    var body: some View {
        FieldLabel("Capacity")
        VStack(spacing: 0) {
            WizardStepper("Max guests", value: $maxGuests, range: 1...32)
            Divider()
            WizardStepper("Bedrooms", value: $bedrooms, range: 0...20)
            Divider()
            WizardStepper("Beds", value: $beds, range: 0...30)
            Divider()
            WizardStepper("Bathrooms", value: $bathrooms, range: 0...20)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 4)
        .background(Color.qkCream)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

        FieldLabel("Price per night", required: true)
        HStack {
            Text("EGP")
                .font(.headline)
                .foregroundStyle(Color.qkMuted)
            TextField("0", text: $priceText)
                .keyboardType(.numberPad)
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.qkInk)
            Text("/ night")
                .font(.footnote)
                .foregroundStyle(Color.qkMuted)
        }
        .padding(.horizontal, 14)
        .frame(height: 52)
        .background(Color.qkCream)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

        FieldLabel("Amenities")
        AmenitiesPicker(selected: $selectedAmenities)

        FieldLabel(L.t("cancel.choosePolicy"))
        CancellationPolicyPicker(selection: $cancellationPolicy)

        FieldLabel(L.t("growth.lengthOfStayDiscounts"))
        Text(L.t("growth.discountsIntro"))
            .font(.footnote)
            .foregroundStyle(Color.qkMuted)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.bottom, -4)
        LengthOfStayDiscountFields(weekly: $weeklyDiscount, monthly: $monthlyDiscount)

        FieldLabel(L.t("pricing.seasonal"))
        Text(L.t("pricing.seasonalIntro"))
            .font(.footnote)
            .foregroundStyle(Color.qkMuted)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.bottom, -4)
        SeasonalPricingFields(weekend: $weekendPrice, months: $monthlyPrices)

        FieldLabel(L.t("approval.ownershipDoc"))
        Text(L.t("approval.ownershipIntro"))
            .font(.footnote)
            .foregroundStyle(Color.qkMuted)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.bottom, -4)
        ownershipDocPicker

        Text("Set a nightly price in your local currency. You can change it later.")
            .font(.footnote)
            .foregroundStyle(Color.qkMuted)
            .padding(.top, 2)
    }

    /// PhotosPicker for the ownership document. Shows a "document attached"
    /// confirmation row once a photo has been processed into `ownershipDoc`.
    private var ownershipDocPicker: some View {
        let attached = !ownershipDoc.isEmpty
        return PhotosPicker(
            selection: $ownershipDocItem,
            matching: .images,
            photoLibrary: .shared()
        ) {
            HStack(spacing: 8) {
                if isProcessingDoc {
                    ProgressView().controlSize(.small).tint(.qkBurgundy)
                } else {
                    Image(systemName: attached ? "checkmark.circle.fill" : "doc.viewfinder")
                        .font(.system(size: 15, weight: .semibold))
                }
                Text(attached ? L.t("approval.docAttached") : L.t("approval.uploadDoc"))
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                Spacer(minLength: 0)
                if attached, !isProcessingDoc {
                    Text(L.t("approval.changeDoc"))
                        .font(.footnote.weight(.medium))
                }
            }
            .foregroundStyle(attached ? Color.qkSuccess : Color.qkBurgundy)
            .padding(.horizontal, 14)
            .frame(height: 50)
            .frame(maxWidth: .infinity)
            .background((attached ? Color.qkSuccess : Color.qkBurgundy).opacity(0.10))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder((attached ? Color.qkSuccess : Color.qkBurgundy).opacity(0.30), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(isProcessingDoc)
    }
}

/// A wrapping grid of selectable amenity chips. Tapping a chip toggles it in the
/// bound selection. Selected chips fill burgundy; unselected sit on the cream
/// field background. Uses an adaptive `LazyVGrid` so chips wrap to fit the card.
private struct AmenitiesPicker: View {
    @Binding var selected: Set<String>

    private let columns = [GridItem(.adaptive(minimum: 110), spacing: 10, alignment: .leading)]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 10) {
            ForEach(Amenities.all, id: \.self) { amenity in
                let isOn = selected.contains(amenity)
                Button {
                    if isOn { selected.remove(amenity) } else { selected.insert(amenity) }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: Amenities.icon(for: amenity))
                            .font(.footnote)
                        Text(amenity)
                            .font(.subheadline.weight(.medium))
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                    }
                    .foregroundStyle(isOn ? .white : Color.qkInk)
                    .padding(.horizontal, 12)
                    .frame(height: 40)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(isOn ? Color.qkBurgundy : Color.qkCream)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .strokeBorder(isOn ? Color.clear : Color.qkBurgundy.opacity(0.18), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(amenity)
                .accessibilityAddTraits(isOn ? .isSelected : [])
            }
        }
    }
}

// MARK: - Step 4: Review

private struct ReviewStep: View {
    let title: String
    let propertyType: String
    let location: String
    let country: String
    let price: Double
    let maxGuests: Int
    let bedrooms: Int
    let beds: Int
    let bathrooms: Int
    let coordinate: CLLocationCoordinate2D?
    let imageURL: String
    let amenities: [String]
    let cancellationPolicy: CancellationPolicy
    let weeklyDiscount: Int
    let monthlyDiscount: Int
    let hasOwnershipDoc: Bool
    let errorMessage: String?

    private var placeText: String {
        let parts = [location, country].map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        return parts.isEmpty ? "—" : parts.joined(separator: ", ")
    }

    private var coordText: String {
        guard let coordinate else { return "Not set" }
        return String(format: "%.5f, %.5f", coordinate.latitude, coordinate.longitude)
    }

    /// "Weekly −10% · Monthly −20%", omitting either when zero; "None" if both 0.
    private var discountSummary: String {
        var parts: [String] = []
        if weeklyDiscount > 0 {
            parts.append(String(format: L.t("growth.weeklyShort"), "\(weeklyDiscount)"))
        }
        if monthlyDiscount > 0 {
            parts.append(String(format: L.t("growth.monthlyShort"), "\(monthlyDiscount)"))
        }
        return parts.isEmpty ? L.t("growth.noDiscounts") : parts.joined(separator: " · ")
    }

    var body: some View {
        Text("Review your listing")
            .font(.title3.weight(.semibold))
            .foregroundStyle(Color.qkInk)

        Text("Make sure everything looks right before submitting it for review.")
            .font(.footnote)
            .foregroundStyle(Color.qkMuted)

        VStack(spacing: 0) {
            SummaryRow(label: "Title", value: title.isEmpty ? "—" : title)
            Divider()
            SummaryRow(label: "Type", value: propertyType)
            Divider()
            SummaryRow(label: "Location", value: placeText)
            Divider()
            SummaryRow(label: "Price", value: price > 0 ? "EGP \(formatted(price)) / night" : "—")
            Divider()
            SummaryRow(label: "Guests", value: "\(maxGuests)")
            Divider()
            SummaryRow(label: "Rooms",
                       value: "\(bedrooms) bd · \(beds) beds · \(bathrooms) ba")
            Divider()
            SummaryRow(label: "Coordinates", value: coordText, monospaced: true)
            Divider()
            SummaryRow(label: "Amenities",
                       value: amenities.isEmpty ? "None" : amenities.joined(separator: ", "))
            Divider()
            SummaryRow(label: L.t("cancel.policyLabel"), value: cancellationPolicy.name)
            Divider()
            SummaryRow(label: L.t("growth.lengthOfStayDiscounts"), value: discountSummary)
            Divider()
            SummaryRow(
                label: L.t("approval.ownershipDoc"),
                value: hasOwnershipDoc ? L.t("approval.docAttached") : L.t("approval.docMissing")
            )
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 4)
        .background(Color.qkCream)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

        // Pending-review notice: makes clear the listing isn't instantly live.
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "clock.badge.checkmark")
                .foregroundStyle(Color.qkGoldDeep)
            Text(L.t("approval.reviewNotice"))
                .font(.footnote)
                .foregroundStyle(Color.qkMuted)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(.top, 2)

        if let errorMessage {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(Color.qkBurgundy)
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(Color.qkBurgundy)
            }
            .padding(.top, 2)
        }
    }

    private func formatted(_ value: Double) -> String {
        value == value.rounded()
            ? String(Int(value))
            : String(format: "%.2f", value)
    }
}

// MARK: - Reusable wizard building blocks

/// A small uppercase-ish field label, with an optional required asterisk.
private struct FieldLabel: View {
    let text: String
    let required: Bool
    init(_ text: String, required: Bool = false) {
        self.text = text
        self.required = required
    }
    var body: some View {
        HStack(spacing: 4) {
            Text(text)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.qkInk)
            if required {
                Text("*").foregroundStyle(Color.qkBurgundy)
            }
        }
        .padding(.bottom, -8)
    }
}

/// A cream-filled rounded text field matching the boutique look.
private struct WizardTextField: View {
    let placeholder: String
    @Binding var text: String
    var axis: Axis = .horizontal
    var lineLimit: ClosedRange<Int>? = nil

    init(_ placeholder: String, text: Binding<String>,
         axis: Axis = .horizontal, lineLimit: ClosedRange<Int>? = nil) {
        self.placeholder = placeholder
        self._text = text
        self.axis = axis
        self.lineLimit = lineLimit
    }

    var body: some View {
        Group {
            if axis == .vertical {
                TextField(placeholder, text: $text, axis: .vertical)
                    .lineLimit(lineLimit ?? 3...6)
            } else {
                TextField(placeholder, text: $text)
            }
        }
        .foregroundStyle(Color.qkInk)
        .padding(.horizontal, 14)
        .padding(.vertical, axis == .vertical ? 12 : 0)
        .frame(minHeight: 48)
        .background(Color.qkCream)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

/// A labeled +/- stepper row used in the Details step.
///
/// Built from explicit minus / value / plus controls rather than SwiftUI's
/// `Stepper`: the native `Stepper`'s number lived in its *label*, and the row
/// applied `.labelsHidden()`, which hid the value entirely (the reported
/// "not showing numbers" bug). Here the value sits between two round buttons
/// that clamp to `range`, so +/- always change the number and it's always
/// visible.
private struct WizardStepper: View {
    let title: String
    @Binding var value: Int
    let range: ClosedRange<Int>

    init(_ title: String, value: Binding<Int>, range: ClosedRange<Int>) {
        self.title = title
        self._value = value
        self.range = range
    }

    private var canDecrement: Bool { value > range.lowerBound }
    private var canIncrement: Bool { value < range.upperBound }

    var body: some View {
        HStack {
            Text(title)
                .foregroundStyle(Color.qkInk)
            Spacer()

            HStack(spacing: 14) {
                stepButton(systemName: "minus", enabled: canDecrement) {
                    if canDecrement { value -= 1 }
                }

                Text("\(value)")
                    .font(.body.monospacedDigit().weight(.semibold))
                    .foregroundStyle(Color.qkInk)
                    .frame(minWidth: 28)
                    .contentTransition(.numericText())
                    .animation(.easeInOut(duration: 0.15), value: value)

                stepButton(systemName: "plus", enabled: canIncrement) {
                    if canIncrement { value += 1 }
                }
            }
        }
        .frame(height: 48)
    }

    private func stepButton(systemName: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(enabled ? Color.qkBurgundy : Color.qkMuted.opacity(0.5))
                .frame(width: 32, height: 32)
                .background(
                    Circle()
                        .stroke(enabled ? Color.qkBurgundy.opacity(0.4) : Color.qkMuted.opacity(0.25),
                                lineWidth: 1.5)
                )
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

/// A label/value row in the Review summary.
private struct SummaryRow: View {
    let label: String
    let value: String
    var monospaced: Bool = false

    var body: some View {
        HStack(alignment: .top) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
            Spacer(minLength: 16)
            Text(value)
                .font(monospaced ? .subheadline.monospacedDigit() : .subheadline.weight(.medium))
                .foregroundStyle(Color.qkInk)
                .multilineTextAlignment(.trailing)
        }
        .frame(minHeight: 44)
    }
}
