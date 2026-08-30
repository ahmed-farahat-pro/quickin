import SwiftUI
import CoreLocation
import PhotosUI

// MARK: - Shared listing-form vocabulary

/// The option lists the host listing forms offer. One copy, used by both the
/// "Add listing" wizard and the "Edit listing" editor, so the two can never
/// drift apart (and both stay matched to the backend's accepted values).
enum ListingFormOptions {
    /// Property types the picker offers. The stored value stays English — only
    /// the label is ever localized — so it round-trips through the API.
    static let propertyTypes = ["Apartment", "House", "Villa", "Cabin", "Studio", "Loft", "Cottage"]

    /// What a listing gets when nothing else is chosen — the same default the
    /// backend falls back to when `property_type` is omitted on create.
    static let defaultPropertyType = "Apartment"

    /// Curated areas a host picks from before dropping the precise pin. Matched
    /// 1:1 with the Explore region chips and the backend's accepted regions.
    static let regions = ["North Coast", "Ain Sokhna", "El Gouna", "Cairo"]

    /// The picker list for an existing listing: the standard types plus whatever
    /// the listing already carries (a type set elsewhere, e.g. "Chalet"), so
    /// opening the editor can never silently rewrite the host's choice.
    static func propertyTypes(including current: String?) -> [String] {
        guard let current = current?.trimmingCharacters(in: .whitespaces), !current.isEmpty,
              !propertyTypes.contains(current) else { return propertyTypes }
        return propertyTypes + [current]
    }
}

// MARK: - Shared listing title rule

/// Whether a title reads as a title.
///
/// The wizard gated step 1 on `!title.isEmpty`, so `12345`, `@@@@@` and `-----`
/// walked past Basics, through Location and Details, and were refused by the API
/// on step 4 — three steps after the field that was wrong, with no way back to
/// it but the Back button. The website never had the bug because `/host/new` is
/// a single page whose only gate already runs this rule; a four-step wizard is
/// where "validate on submit" turns into "validate three steps too late".
///
/// This is the Swift translation of `src/lib/local/listing-title-policy.ts`,
/// which both web projects carry byte-identical (a parity script guards those
/// two) and which the API runs on create and on PATCH. Android carries the same
/// rule again in `ListingTitlePolicy.kt`. Both mobile copies are updated by
/// hand, so the two numbers below are the thing to keep in step.
///
/// The rule that does the work is `letters`: a title must contain letters. Not
/// "must be Latin", not "must not contain punctuation" — `Nile-view flat (2BR)`
/// and `شقة بإطلالة على النيل` are both real titles, and Franco-Arabic writes
/// real words with numerals (`Sa7el chalet`). What it refuses is a title with no
/// letters *at all*.
enum ListingTitlePolicy {
    /// Enough letters to be a word. `A5` is a door number, not a listing title.
    static let minLetters = 3

    /// What the edit path has always capped titles at — refused, not truncated.
    static let maxLength = 200

    /// Why a title was refused. Mirrors `ListingTitleProblemCode` one-for-one.
    enum Problem {
        case required
        case letters
        case tooShort
        case tooLong

        /// The localization key for the sentence a host reads. The same four
        /// sentences the website shows, in the same four languages.
        var messageKey: String {
            switch self {
            case .required: return "listing.title.required"
            case .letters:  return "listing.title.letters"
            case .tooShort: return "listing.title.tooShort"
            case .tooLong:  return "listing.title.tooLong"
            }
        }
    }

    /// Invisible characters people paste in without meaning to: the soft hyphen,
    /// the Mongolian vowel separator, the zero-width spaces and bidi marks, the
    /// BOM. They survive a `.trimmingCharacters` and render as nothing, so a
    /// title made only of them would otherwise read as non-empty.
    private static func isInvisible(_ scalar: Unicode.Scalar) -> Bool {
        switch scalar.value {
        case 0x00AD, 0x180E, 0xFEFF:      return true
        case 0x200B...0x200F:             return true
        case 0x202A...0x202E:             return true
        case 0x2060...0x2064:             return true
        default:                          return false
        }
    }

    /// What gets stored: invisibles dropped, every run of whitespace collapsed to
    /// one space, ends trimmed. `  Nile   view  ` and `Nile view` are one title,
    /// and storing the first means the explore grid renders a gap nobody typed.
    static func normalize(_ title: String) -> String {
        let stripped = String(String.UnicodeScalarView(title.unicodeScalars.filter { !isInvisible($0) }))
        return stripped.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
    }

    /// How many letters the title actually contains, in any script — the Swift
    /// counterpart of the policy's `\p{L}` count.
    private static func letterCount(_ title: String) -> Int {
        title.reduce(into: 0) { total, ch in if ch.isLetter { total += 1 } }
    }

    /// Decide a title. Returns the first problem, or nil when it is acceptable.
    ///
    /// Order matters: `letters` is checked before `tooShort` so `@@@@@` is told
    /// the thing that is actually wrong with it ("a title needs words") rather
    /// than being sent back to add a sixth `@`.
    static func check(_ title: String) -> Problem? {
        let value = normalize(title)
        if value.isEmpty { return .required }
        // Count Unicode scalars, not Characters: the policy counts code points,
        // and a Swift grapheme cluster can be several of them, so counting
        // Characters would accept a title the API then refuses as too long.
        if value.unicodeScalars.count > maxLength { return .tooLong }

        let letters = letterCount(value)
        if letters == 0 { return .letters }
        if letters < minLetters { return .tooShort }
        return nil
    }

    /// True when `check` has nothing to say — the gate on a Next button.
    static func isValid(_ title: String) -> Bool {
        check(title) == nil
    }

    /// The localized sentence for a problem, with the floors filled in.
    @MainActor
    static func message(_ problem: Problem) -> String {
        switch problem {
        case .tooShort:
            return String(format: L.t(problem.messageKey), "\(minLetters)")
        case .tooLong:
            return String(format: L.t(problem.messageKey), "\(maxLength)")
        case .required, .letters:
            return L.t(problem.messageKey)
        }
    }
}

// MARK: - Shared listing capacity rule
//
// Moved to Sources/ListingCapacityPolicy.swift: the rule grew a per-property-type
// bedroom table and is now large enough to want its own tests, and a file that
// imports SwiftUI cannot be compiled by Tests/run.sh. Same enum, same name.

// MARK: - Shared listing photo model

/// One photo in a host photo editor. A photo already on the listing carries its
/// `listing_images.id` (what the delete / reorder endpoints address); a photo
/// the host just picked has none until it's uploaded. The add-listing wizard
/// only ever holds new ones; the editor holds a mix.
struct ListingPhotoDraft: Identifiable, Hashable {
    /// `listing_images.id`, or `nil` for a photo picked in this session.
    let imageID: String?
    /// A `data:image/*;base64,…` URL (fresh pick) or the stored photo URL.
    let url: String
    /// Stable `ForEach` identity — the row id when there is one, else a token
    /// minted per pick so two identical photos stay two rows.
    let id: String

    init(imageID: String? = nil, url: String) {
        self.imageID = imageID
        self.url = url
        self.id = imageID ?? "new:\(UUID().uuidString)"
    }

    /// Seed from a photo already on the listing.
    init(_ image: ListingImage) {
        self.init(imageID: image.id, url: image.url)
    }

    /// `true` for a photo that already exists server-side.
    var isExisting: Bool { imageID != nil }

    /// Downscale + JPEG-encode photos picked with `PhotosPicker` into `data:`
    /// URL drafts, at most `limit` of them. Unreadable items are skipped. Shared
    /// by the add wizard and the editor so both produce identical payloads.
    static func encode(_ items: [PhotosPickerItem], limit: Int) async -> [ListingPhotoDraft] {
        var out: [ListingPhotoDraft] = []
        for item in items {
            guard out.count < limit else { break }
            guard
                let data = try? await item.loadTransferable(type: Data.self),
                let image = UIImage(data: data),
                let dataURL = QKAvatarImage.makeDataURL(from: image, maxDimension: 1600, quality: 0.8)
            else { continue }
            out.append(ListingPhotoDraft(url: dataURL))
        }
        return out
    }
}

/// Host "Add listing" flow → `POST /api/local/listings`. Restructured as a
/// 4-step wizard (Basics → Location → Details → Review) over the same field set
/// and the same create-listing networking the single-form version used.
///
/// • Step 1 — Basics: title, property type and description — all three
///   marked required, because the step gates on the title and the
///   description and the API refuses a listing with no property type.
/// • Step 2 — Location: Google Maps draggable pin-picker + place search that
///   geocodes free text via the Google Geocoding HTTP API and recenters the map.
///   The area, the address and a pin are all required to advance.
/// • Step 3 — Details: capacity steppers + price (required) + at least one photo
///   (required) + cancellation policy + an ownership / proof-of-ownership
///   document (PhotosPicker, optional).
///
/// Title and price used to be the only two of those the flow insisted on, which
/// is how listings reached the database with nothing a guest could read, find or
/// look at. The per-step gates below are the same rule the web enforces in
/// `listing-completeness-policy.ts` and the API enforces in `createListing`.
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
    @State private var country = "Egypt"
    @State private var priceText = ""

    /// Device photos the host picked for the listing, each encoded as a
    /// `data:image/jpeg;base64,…` URL. Order is display order — the first is the
    /// cover. Sent to the backend as `images`; optional (zero photos is allowed).
    @State private var photos: [ListingPhotoDraft] = []
    /// The multi-photo `PhotosPicker` selection; encoded into `photos` on change
    /// then cleared so the next pick starts fresh.
    @State private var photoItems: [PhotosPickerItem] = []
    /// True while freshly-picked listing photos are being downscaled + encoded.
    @State private var encodingPhotos = false

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
    /// is the EGP weekend nightly-rate text (empty = none); `weekendDays` are the
    /// weekdays that rate is charged on (`0`=Sun … `6`=Sat, pre-filled with the
    /// default weekend); `monthlyPrices` maps month "1".."12" → nightly-rate text
    /// (only filled months are sent). Sent as `weekend_price` / `weekend_days` /
    /// `monthly_prices`.
    @State private var weekendPrice = ""
    @State private var weekendDays: Set<Int> = Set(WeekendSchedule.defaultDays)
    @State private var monthlyPrices: [String: String] = [:]

    /// The ownership / proof document the host attaches in the Details step, as a
    /// `data:image/*;base64,…` or `data:application/pdf;base64,…` URL (sent as
    /// `ownership_doc`). Empty until a photo or PDF is picked + encoded by
    /// `OwnershipDocPicker`, which owns the picking and the size check.
    @State private var ownershipDoc = ""

    private let propertyTypes = ListingFormOptions.propertyTypes
    @State private var propertyType = ListingFormOptions.defaultPropertyType

    /// Curated areas a host picks from before dropping the precise pin. Sent as
    /// `region` and matched 1:1 with the Explore region chips / backend regions.
    private let regions = ListingFormOptions.regions
    /// Chosen region (nil until the host taps one). Required to advance.
    @State private var region: String?

    /// The resort / compound the place sits in. `.none` until the host says
    /// otherwise, which is a complete answer — plenty of places are not in one.
    @State private var resort: ResortChoice.Selection = .none
    /// The free text that goes with `.other`.
    @State private var resortName = ""
    /// The catalog for the chosen area (`GET /api/local/resorts?region=`),
    /// refetched whenever the area changes.
    @State private var resorts: [ResortOption] = []
    @State private var isLoadingResorts = false

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
    /// The platform commission, so the price fields can show the host what a
    /// guest will actually pay. Advisory only — the server prices the listing
    /// either way — so a failed fetch just leaves the hint hidden.
    @State private var commission: CommissionInfo?
    /// Whether this host may list at all. Defaults to allowed so a failed fetch
    /// never locks a legitimate host out of their own app — the server refuses
    /// the write regardless, and returns the same message.
    @State private var listingGate: ListingGate = .unknown

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

    /// Enough letters to be words, in any script — `@@@@@@` and `12345` are not a
    /// description however long they are. Mirrors the web's
    /// `listing-completeness-policy.ts`, which counts letters for the same reason.
    private func letterCount(_ text: String) -> Int {
        text.reduce(into: 0) { total, ch in if ch.isLetter { total += 1 } }
    }

    /// Enough letters to be a description. Same floor as the web (and as the
    /// dashboard wizard's zod schema before it).
    static let minDescriptionLetters = 20
    /// Enough letters to be a place name. `12` is a door number, not an address.
    static let minLocationLetters = 3

    /// What is wrong with the title, if anything. `ListingTitlePolicy` is the
    /// same rule the API runs, so a title the wizard accepts is one the create
    /// call accepts — `12345` used to clear this step and come back as a 400 on
    /// step 4, which is the bug this property exists to end.
    private var titleProblem: ListingTitlePolicy.Problem? {
        ListingTitlePolicy.check(title)
    }

    /// The title on its own. Kept apart from `step1Valid` because it is also what
    /// gates the AI description writer — folding the description requirement into
    /// that gate would lock the host out of the button that writes it for them.
    /// (It also means the writer is no longer handed `12345` as the title to
    /// compose a description from.)
    private var titleValid: Bool { titleProblem == nil }

    // A listing needed only a title and a price to be created: no description, no
    // address, no photo. See listing-completeness-policy.ts on the web — these
    // three gates are the same rule, said in the order the steps are laid out.
    //
    // Each step answers with the SENTENCE that blocks it rather than a bare
    // Bool, and `stepNValid` is derived from the sentence being nil. A greyed
    // Next that will not say why is the other half of the reported bug — the
    // host is left guessing which of five fields the app disagrees with — and
    // deriving the gate from the reason is what stops the two from ever drifting
    // apart. Each returns the FIRST unmet requirement, in the order the fields
    // are laid out on the step, so a host who skipped several is pointed at the
    // topmost one rather than at whichever the code looked at first (the web
    // form orders its own checks the same way, for the same reason).
    private var step1Blocker: String? {
        // The title is the exception: when the host has typed something that is
        // not a title, BasicsStep says so under the field itself, where the
        // offending text is. Repeating it here would print the same sentence
        // twice on one screen. An EMPTY title has nothing to sit under, so it is
        // reported here like every other missing field.
        if let problem = titleProblem, problem == .required {
            return ListingTitlePolicy.message(problem)
        }
        if titleProblem != nil { return L.t("listing.blocked.title") }
        if letterCount(description) < Self.minDescriptionLetters {
            return String(format: L.t("listing.blocked.description"), "\(Self.minDescriptionLetters)")
        }
        return nil
    }
    private var step2Blocker: String? {
        if region == nil { return L.t("listing.blocked.region") }
        // Only "Other" with no usable name is refused. Picking it and leaving the
        // box blank is not "no resort": the server cannot tell the two apart, so
        // it would save the listing with none at all and throw the host's answer
        // away silently. See ResortChoice.
        if let resortProblem = ResortChoice.blocker(resort, typedName: resortName) {
            return resortProblem
        }
        if letterCount(location) < Self.minLocationLetters {
            return String(format: L.t("listing.blocked.location"), "\(Self.minLocationLetters)")
        }
        if coordinate == nil { return L.t("listing.blocked.pin") }
        return nil
    }
    /// Why the capacity counts will not let the host continue, or nil.
    ///
    /// Shared by the create wizard and the edit screen so the two cannot drift,
    /// and `static` so the edit screen (a separate View) can call it. The rule
    /// itself is `ListingCapacityPolicy`; this is only which sentence explains
    /// which half of it.
    ///
    /// Three distinct things can be wrong and they need different sentences: a
    /// count below the floor (the pre-existing rule), a bedroom count above what
    /// this property type allows (the per-type table), and — reachable only from
    /// a value some other client stored, since the steppers clamp — one of the
    /// other three counts above its blanket ceiling.
    static func capacityBlocker(
        maxGuests: Int,
        bedrooms: Int,
        beds: Int,
        bathrooms: Int,
        propertyType: String,
        t: (String) -> String
    ) -> String? {
        if ListingCapacityPolicy.isBelowFloor(
            maxGuests: maxGuests, bedrooms: bedrooms, beds: beds, bathrooms: bathrooms
        ) {
            return String(format: t("listing.blocked.capacity"), "\(ListingCapacityPolicy.minimum)")
        }
        if ListingCapacityPolicy.exceedsBedroomCeiling(bedrooms, propertyType: propertyType) {
            let max = ListingCapacityPolicy.maxBedrooms(for: propertyType)
            // A type product's table does not name is refused impersonally —
            // naming it would state a per-type rule that does not exist.
            guard let named = ListingCapacityPolicy.namedType(propertyType) else {
                return String(format: t("listing.blocked.bedroomsMaxAny"), "\(max)")
            }
            // A studio's ceiling equals the floor, so "at most 1" is true but
            // reads like room to manoeuvre. Say the shape of the place instead.
            let key = max == ListingCapacityPolicy.minimum
                ? "listing.blocked.bedroomsExact"
                : "listing.blocked.bedroomsMax"
            return String(format: t(key), named, "\(max)")
        }
        if ListingCapacityPolicy.exceedsOtherCeiling(
            maxGuests: maxGuests, beds: beds, bathrooms: bathrooms
        ) {
            return String(format: t("listing.blocked.capacityMax"),
                          "\(ListingCapacityPolicy.maxGuestsCeiling)",
                          "\(ListingCapacityPolicy.bedsCeiling)",
                          "\(ListingCapacityPolicy.bathroomsCeiling)")
        }
        return nil
    }

    private var step3Blocker: String? {
        if let capacityProblem = Self.capacityBlocker(
            maxGuests: maxGuests, bedrooms: bedrooms, beds: beds, bathrooms: bathrooms,
            propertyType: propertyType, t: { L.t($0) }
        ) {
            return capacityProblem
        }
        if price <= 0 { return L.t("listing.blocked.price") }
        if photos.isEmpty { return L.t("listing.blocked.photo") }
        return nil
    }

    private var step1Valid: Bool { step1Blocker == nil }
    private var step2Valid: Bool { step2Blocker == nil }
    private var step3Valid: Bool { step3Blocker == nil }

    /// Why the current step will not let the host continue, or nil when it will.
    /// Rendered above the Next button so it is on screen without scrolling —
    /// a reason a host has to go looking for is not much better than no reason.
    private var currentStepBlocker: String? {
        switch step {
        case 1:  return step1Blocker
        case 2:  return step2Blocker
        case 3:  return step3Blocker
        default: return nil
        }
    }

    /// Whether the current step's required fields are satisfied (gates Next).
    private var currentStepValid: Bool { currentStepBlocker == nil }

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
                            titleProblem: titleProblem,
                            isWritingDescription: isWritingDescription,
                            canWrite: titleValid,
                            writerError: writerError,
                            onWriteWithAI: { Task { await writeDescription() } }
                        ) }
                        .tag(1)

                        stepCard { LocationStep(
                            region: $region,
                            regions: regions,
                            resort: $resort,
                            resortName: $resortName,
                            resorts: resorts,
                            resortsLoading: isLoadingResorts,
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
                            propertyType: propertyType,
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
                            weekendDays: $weekendDays,
                            monthlyPrices: $monthlyPrices,
                            ownershipDoc: $ownershipDoc,
                            photos: $photos,
                            photoItems: $photoItems,
                            encodingPhotos: encodingPhotos,
                            commission: commission
                        ) }
                        .tag(3)

                        stepCard { ReviewStep(
                            title: title,
                            propertyType: propertyType,
                            region: region,
                            resort: resortSummary,
                            location: location,
                            country: country,
                            price: price,
                            maxGuests: maxGuests,
                            bedrooms: bedrooms,
                            beds: beds,
                            bathrooms: bathrooms,
                            coordinate: coordinate,
                            photoCount: photos.count,
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

                    StepBlockerNote(message: currentStepBlocker)
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
        .task { commission = try? await HostService.shared.fetchCommission() }
        .task { if let g = try? await HostService.shared.fetchListingGate() { listingGate = g } }
        // The catalog belongs to the area, so it is refetched whenever the area
        // changes — and a resort that isn't in the new area's list is dropped
        // rather than left showing under a region it doesn't belong to.
        .task(id: region) { await loadResorts() }
        // Covers the wizard entirely when the host may not list. The editor is
        // deliberately NOT gated this way — a host must still be able to fix a
        // listing they already have.
        .overlay {
            if !listingGate.allowed {
                ZStack {
                    LinearGradient.qkPageWash.ignoresSafeArea()
                    ListingGateBlockedView(gate: listingGate)
                }
            }
        }
        // Downscale + encode freshly-picked listing photos into data URLs.
        .onChange(of: photoItems) { _, items in
            guard !items.isEmpty else { return }
            Task { await processPickedPhotos(items) }
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
            apply(coordinate: coord, address: place?.address, country: place?.country)
        }
    }

    /// Apply a search result the host picked: recenter the map, move the pin,
    /// fill the address / country, and clear the result list.
    private func applyPlace(_ place: PlaceResult) {
        apply(coordinate: place.coordinate, address: place.address, country: place.country)
        locationSearch.clearResults()
    }

    /// Shared "place a pin at this coordinate + fill the text" routine used by
    /// both search-result selection and the current-location fix. Always
    /// recenters the map; fills address / country only when those fields are
    /// empty so it never clobbers what the host already typed.
    ///
    /// `address` is the street / landmark line, not the city — see
    /// `PlaceResult.address`. Filling the city here is what used to echo the
    /// chosen area straight back into the field below it.
    private func apply(coordinate coord: CLLocationCoordinate2D, address: String?, country countryName: String?) {
        self.coordinate = coord
        recenterTarget = coord
        recenterToken += 1

        if location.trimmingCharacters(in: .whitespaces).isEmpty,
           let address, !address.isEmpty {
            location = address
        }
        if country.trimmingCharacters(in: .whitespaces).isEmpty,
           let countryName, !countryName.isEmpty {
            country = countryName
        }
    }

    // MARK: - Listing photos

    /// Process listing photos chosen via `PhotosPicker` — `ListingPhotoDraft`
    /// downscales + encodes each into a `data:` URL off the main thread — and
    /// append them (in pick order, up to `HostService.maxListingPhotos`). The
    /// picker selection is cleared when done; unreadable items are skipped.
    private func processPickedPhotos(_ items: [PhotosPickerItem]) async {
        errorMessage = nil
        encodingPhotos = true
        defer {
            encodingPhotos = false
            photoItems = []
        }
        let room = HostService.maxListingPhotos - photos.count
        guard room > 0 else { return }
        photos.append(contentsOf: await ListingPhotoDraft.encode(items, limit: room))
    }

    // MARK: - Resort catalog

    /// Load the compounds for the chosen area. Best-effort: a failure leaves the
    /// list empty and the picker still offers "Other", because a catalog that
    /// didn't load must never be the reason a host can't finish a listing.
    private func loadResorts() async {
        guard let region, !region.isEmpty else {
            resorts = []
            if case .catalog = resort { resort = .none }
            return
        }
        isLoadingResorts = true
        defer { isLoadingResorts = false }
        let loaded = await SupabaseService.shared.fetchResorts(region: region)
        resorts = loaded
        // A resort chosen under a different area is not this area's resort — and
        // the server would derive the region back from it, quietly overruling the
        // chip the host just tapped.
        if case .catalog(let id) = resort, !loaded.contains(where: { $0.id == id }) {
            resort = .none
        }
    }

    /// What the review step shows for the resort: the catalog name, the text the
    /// host typed, or nothing when they aren't in one.
    private var resortSummary: String? {
        switch resort {
        case .none:
            return nil
        case .other:
            return ResortChoice.normalizeName(resortName)
        case .catalog(let id):
            return resorts.first { $0.id == id }?.name
        }
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

        // The seasonal rates, judged by the same rules the API runs — so a wizard
        // that would come back 400 stops on the step that holds those fields
        // instead of at the very end.
        //
        // The rate FIRST, and on its own: a `0` was parsed to nil here, sent as
        // `weekend_price: null`, and stored as no weekend rate at all. The host
        // finished the wizard, and their weekend pricing was simply not there.
        let weekendCheck = ListingPricingRules.checkPrice(weekendPrice)
        guard case .success(let weekendRate) = weekendCheck else {
            if case .failure(let problem) = weekendCheck {
                errorMessage = L.t(problem.weekendKey)
                withAnimation(QKAnim.swap) { step = 3 }
            }
            return
        }
        // …and the twelve months under it, named one at a time.
        let monthsCheck = ListingPricingRules.checkMonths(monthlyPrices)
        guard case .success(let checkedMonths) = monthsCheck else {
            if case .failure(let failure) = monthsCheck {
                errorMessage = String(format: L.t(failure.problem.monthKey),
                                      qkShortMonthSymbols(LocalizationManager.shared)[failure.month - 1])
                withAnimation(QKAnim.swap) { step = 3 }
            }
            return
        }
        // The weekend rate and the days it applies to are one field, so the pair
        // is judged together once both halves are known to be well-formed.
        let schedule = WeekendSchedule.resolve(price: weekendRate, days: Array(weekendDays))
        guard case .success(let weekendSchedule) = schedule else {
            if case .failure(let problem) = schedule {
                errorMessage = L.t(problem == .wholeWeek
                                   ? "pricing.weekendDays.wholeWeek"
                                   : "pricing.weekendDays.noDaysChosen")
                withAnimation(QKAnim.swap) { step = 3 }
            }
            return
        }

        let resortPayload = ResortChoice.payload(resort, typedName: resortName)
        let payload = HostService.NewListing(
            title: title.trimmingCharacters(in: .whitespaces),
            description: description.trimmingCharacters(in: .whitespaces),
            location: location.trimmingCharacters(in: .whitespaces),
            country: country.trimmingCharacters(in: .whitespaces),
            region: region,
            resortId: resortPayload.resortId,
            resortName: resortPayload.resortName,
            pricePerNight: price,
            bedrooms: bedrooms,
            beds: beds,
            bathrooms: bathrooms,
            maxGuests: maxGuests,
            propertyType: propertyType,
            images: photos.map(\.url),
            amenities: orderedAmenities,
            cancellationPolicy: cancellationPolicy,
            weeklyDiscount: weeklyDiscount,
            monthlyDiscount: monthlyDiscount,
            weekendPrice: weekendRate,
            weekendDays: weekendSchedule ?? WeekendSchedule.defaultDays,
            monthlyPrices: checkedMonths,
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

// MARK: - The reason a step will not advance

/// One line above the Next button naming the first thing the current step is
/// still waiting for, or nothing at all once the step is satisfied.
///
/// The wizard used to dim Next and say nothing, so a host whose title was
/// `12345` — or whose description was nineteen letters — had a greyed button and
/// no way to learn which field it was unhappy about. Both host wizards render
/// this, and the sentence is the same value their `stepNBlocker` gates on, so
/// the button and the explanation cannot disagree.
struct StepBlockerNote: View {
    let message: String?

    var body: some View {
        if let message {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Image(systemName: "exclamationmark.circle.fill")
                    .font(.footnote)
                    .foregroundStyle(Color.qkBurgundy)
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(Color.qkInk)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .transition(.opacity)
            .animation(QKAnim.swap, value: message)
            .accessibilityAddTraits(.isStaticText)
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

    /// What is wrong with the title, decided by the parent via
    /// `ListingTitlePolicy`. Rendered under the field — but only once the host
    /// has typed something, so an untouched form is not scolded for being empty.
    var titleProblem: ListingTitlePolicy.Problem? = nil

    /// Section 10 — AI writer wiring (owned by the parent `AddListingView`).
    var isWritingDescription: Bool = false
    /// Whether enough is entered (a title) to compose a description.
    var canWrite: Bool = false
    var writerError: String? = nil
    var onWriteWithAI: () -> Void = {}

    var body: some View {
        // Every field on this step is marked, and every mark is honest: the step
        // gates on the title AND the description (`step1Valid`), and the API's
        // `checkListingCompleteness` refuses a listing with no property type.
        //
        // The description used to be the one that carried no asterisk while the
        // create flow was the only caller that left `descriptionRequired` at its
        // default — the host was stopped by a rule the form never stated, which
        // is precisely the shape of bug listing-completeness-policy.ts exists to
        // end. There is no flag any more, so no caller can opt back out of it.
        FieldLabel(loc.t("listing.form.title"), required: true)
        WizardTextField(loc.t("listing.form.titlePlaceholder"), text: $title)
        // Said here, under the offending text, rather than three steps later in
        // the API's reply. `.required` is deliberately excluded: an empty field
        // has nothing to correct yet, and the step's blocker note above Next
        // already asks for a title.
        if let titleProblem, titleProblem != .required {
            Text(ListingTitlePolicy.message(titleProblem))
                .font(.footnote)
                .foregroundStyle(Color.qkBurgundy)
                .fixedSize(horizontal: false, vertical: true)
                .transition(.opacity)
        }

        FieldLabel(loc.t("listing.form.propertyType"), required: true)
        Menu {
            Picker(loc.t("listing.form.propertyType"), selection: $propertyType) {
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

        FieldLabel(loc.t("listing.form.description"), required: true)
        WizardTextField(loc.t("listing.form.descriptionPlaceholder"),
                        text: $description, axis: .vertical, lineLimit: 4...8)

        // The same footnote LocationStep carries, for the same reason: an
        // asterisk says a field is required, it does not say a description of
        // nineteen letters still is not one. Naming the floor is what keeps a
        // host from staring at a Next they have no way to un-grey.
        Text(String(format: loc.t("listing.form.basicsHint"),
                    "\(AddListingView.minDescriptionLetters)"))
            .font(.footnote)
            .foregroundStyle(Color.qkMuted)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 2)
    }
}

// MARK: - Step 2: Location

private struct LocationStep: View {
    @Binding var region: String?
    let regions: [String]
    /// The host's resort / compound answer, and the free text that goes with
    /// `.other`. Optional by design — "not in a resort" is a real answer.
    @Binding var resort: ResortChoice.Selection
    @Binding var resortName: String
    /// The catalog for the chosen area, from `GET /api/local/resorts?region=`.
    /// Empty while it loads, and empty for good if the fetch failed — the picker
    /// then offers "Other", so a catalog that didn't arrive can't block a listing.
    let resorts: [ResortOption]
    let resortsLoading: Bool
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
        // Area first: the host picks the browse area, then names the street and
        // drops the precise pin. Three rungs of one ladder, widest first.
        FieldLabel("Area", required: true)
        regionPicker
        Text("The curated areas guests browse by. Pick the one your place belongs to — the exact address goes below.")
            .font(.footnote)
            .foregroundStyle(Color.qkMuted)

        // The compound, directly under the area it belongs to. The web listing
        // form has asked this since the catalog shipped and both apps never did,
        // so every listing created on a phone reached the database with no
        // resort at all — invisible to the resort filters, and findable only by
        // whatever the host happened to write on the address line.
        //
        // The options are narrowed to the chosen area, because picking a resort
        // also SETS the region server-side and the two must not be able to
        // disagree. Not marked required: a standalone flat is not in a compound,
        // and the only answer that is ever refused is "Other" with no name.
        FieldLabel("Resort / compound")
        resortPicker
        if resort == .other {
            WizardTextField("Type the resort or compound name", text: $resortName)
                .textInputAutocapitalization(.words)
            // Said under the box the offending text is in — but not while it is
            // still empty, which the blocker note above Next already asks for.
            if let problem = ResortChoice.check(resortName), problem.code != .required {
                Text(ResortChoice.message(problem))
                    .font(.footnote)
                    .foregroundStyle(Color.qkBurgundy)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        Text(resort == .other
             ? "We'll show what you type to guests, and our team will add it to the list."
             : "Pick the compound your place is in. Choosing one also sets the area.")
            .font(.footnote)
            .foregroundStyle(Color.qkMuted)
            .fixedSize(horizontal: false, vertical: true)

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

        // The pin and the words above it used to be independent: a host could pick
        // Egypt → North Coast and drop the pin in Germany, and it saved silently.
        // This says so — and deliberately does not block the step, because a
        // bounding box must never be the reason a real property can't be listed.
        // An ignored warning is badged for the operator in /ops. See
        // ListingGeoPolicy.swift.
        if let pinProblem = ListingGeoPolicy.check(
            coordinate: coordinate,
            country: country,
            region: region
        ) {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(Color.qkBurgundy)
                Text(pinProblem.message)
                    .font(.footnote)
                    .foregroundStyle(Color.qkBurgundy)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .padding(12)
            .background(Color.qkBurgundy.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }

        // The rung BELOW the area: the street / compound / landmark, NOT the city.
        // Two of the four areas are city-shaped names ("Cairo", "El Gouna"), so a
        // field labelled "City" under them read as the same question asked twice.
        // Marked required because the step gates on it (see `step2Valid`) — an
        // unexplained greyed-out Next is worse than an asterisk.
        FieldLabel("Address", required: true)
        WizardTextField("Street, compound or landmark", text: $location)
            .textInputAutocapitalization(.words)

        CountryPickerField(selection: $country, title: "Country")

        Text("Pick your area, then search or drag the pin to the exact spot. An area, an address and a pin are all required to continue.")
            .font(.footnote)
            .foregroundStyle(Color.qkMuted)
            .padding(.top, 2)
    }

    // MARK: - Pieces

    /// A wrapping grid of area chips. Tapping one selects it (burgundy fill);
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

    /// The resort dropdown: "not in one", the catalog for this area, and the
    /// free-text escape hatch. Same three-part shape as the web `<select>`.
    private var resortPicker: some View {
        Menu {
            Button("Not in a resort or compound") { resort = .none }
            ForEach(resorts) { option in
                Button(option.name) { resort = .catalog(id: option.id) }
            }
            Button("Other — not listed") { resort = .other }
        } label: {
            HStack(spacing: 8) {
                Text(resortLabel)
                    .foregroundStyle(resort == .none ? Color.qkMuted : Color.qkInk)
                    .lineLimit(1)
                Spacer(minLength: 0)
                if resortsLoading {
                    ProgressView().controlSize(.small)
                }
                Image(systemName: "chevron.up.chevron.down")
                    .font(.footnote)
                    .foregroundStyle(Color.qkMuted)
            }
            .padding(.horizontal, 14)
            .frame(height: 48)
            .background(Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .accessibilityLabel("Resort or compound")
    }

    /// What the closed picker reads. A catalog id whose row isn't in the list —
    /// an area switched under a chosen resort — falls back to the neutral
    /// wording rather than to a blank field.
    private var resortLabel: String {
        switch resort {
        case .none:
            return "Not in a resort or compound"
        case .other:
            return "Other — not listed"
        case .catalog(let id):
            return resorts.first { $0.id == id }?.name ?? "Selected resort"
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
                        .accessibilityLabel(L.t("common.search"))
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
    /// The type picked back on step 1. Read-only here — it sizes the bedroom
    /// stepper and names the type in the sentence under the box.
    let propertyType: String
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
    @Binding var weekendDays: Set<Int>
    @Binding var monthlyPrices: [String: String]
    @Binding var ownershipDoc: String
    @Binding var photos: [ListingPhotoDraft]
    @Binding var photoItems: [PhotosPickerItem]
    let encodingPhotos: Bool
    /// Drives the "guests will see EGP X" hints. nil until the rate loads.
    let commission: CommissionInfo?
    /// Why the last picked document was refused (too large, not a shape we
    /// store), or nil. Shown under the picker — the wizard's own error line only
    /// appears on Review, two steps after the host picked the file.
    @State private var docProblem: String?
    @EnvironmentObject private var loc: LocalizationManager

    /// How high the bedroom stepper goes for this kind of place. A Cabin stops
    /// at 3, a Villa at 8 — the control itself refuses what the rule refuses,
    /// rather than scrolling to 20 and failing on Next.
    private var bedroomsCeiling: Int {
        ListingCapacityPolicy.maxBedrooms(for: propertyType)
    }

    var body: some View {
        FieldLabel("Capacity", required: true)
        // Every count floors at 1 and stops at a ceiling. Bedrooms, beds and
        // bathrooms used to floor at 0, so "0 bedrooms · 0 beds · 0 baths" was a
        // publishable listing; the bedroom stepper used to run to 20 whatever the
        // place was, so a Cabin could claim 12. The bedroom ceiling now comes
        // from the property type picked on step 1 — see `ListingCapacityPolicy`.
        VStack(spacing: 0) {
            WizardStepper("Max guests", value: $maxGuests,
                          range: ListingCapacityPolicy.minimum...ListingCapacityPolicy.maxGuestsCeiling)
            Divider()
            WizardStepper("Bedrooms", value: $bedrooms,
                          range: ListingCapacityPolicy.minimum...bedroomsCeiling)
            Divider()
            WizardStepper("Beds", value: $beds,
                          range: ListingCapacityPolicy.minimum...ListingCapacityPolicy.bedsCeiling)
            Divider()
            WizardStepper("Bathrooms", value: $bathrooms,
                          range: ListingCapacityPolicy.minimum...ListingCapacityPolicy.bathroomsCeiling)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 4)
        .background(Color.qkCream)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        // The stepper clamps new taps but cannot lower a value it was handed, so
        // two things reach here: a listing created before this rule (a stored 0,
        // or a Studio holding 27,373 bedrooms), and a host who set 6 bedrooms as
        // a Villa and then walked back to step 1 and chose Cabin. Say what has to
        // change rather than leaving Next greyed out with no reason.
        if let problem = AddListingView.capacityBlocker(
            maxGuests: maxGuests, bedrooms: bedrooms, beds: beds, bathrooms: bathrooms,
            propertyType: propertyType, t: { loc.t($0) }
        ) {
            Text(problem)
                .font(.footnote)
                .foregroundStyle(Color.qkBurgundy)
                .fixedSize(horizontal: false, vertical: true)
        }

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
        GuestPriceHint(priceText: priceText, commission: commission)

        // Marked because `step3Valid` gates on it — a listing with no photo is
        // refused by `checkListingPhotos` too. Same omission the description
        // carried on the step before this one.
        FieldLabel(L.t("listing.photos"), required: true)
        Text(L.t("listing.photosIntro"))
            .font(.footnote)
            .foregroundStyle(Color.qkMuted)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.bottom, -4)
        ListingPhotosField(photos: $photos, pickerItems: $photoItems, isEncoding: encodingPhotos)

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
        SeasonalPricingFields(weekend: $weekendPrice, weekendDays: $weekendDays, months: $monthlyPrices)
        GuestPriceHint(priceText: weekendPrice, commission: commission)

        FieldLabel(L.t("approval.ownershipDoc"))
        Text(L.t("approval.ownershipIntro"))
            .font(.footnote)
            .foregroundStyle(Color.qkMuted)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.bottom, -4)
        ownershipDocPicker
        if let docProblem {
            Text(docProblem)
                .font(.footnote)
                .foregroundStyle(Color.qkBurgundy)
                .fixedSize(horizontal: false, vertical: true)
        }

        Text(L.t("listing.form.detailsHint"))
            .font(.footnote)
            .foregroundStyle(Color.qkMuted)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 2)
    }

    /// Photo-or-PDF picker for the ownership document. Shows a "document
    /// attached" confirmation row once a pick has been encoded into
    /// `ownershipDoc`; a PDF stays a PDF, so the row names the format rather
    /// than pretending there is a thumbnail to show.
    private var ownershipDocPicker: some View {
        let attached = !ownershipDoc.isEmpty
        let isPdf = OwnershipDocRules.isPdfDataURL(ownershipDoc)
        return OwnershipDocPicker(
            onPicked: { ownershipDoc = $0; docProblem = nil },
            onProblem: { docProblem = $0 }
        ) { isProcessing in
            HStack(spacing: 8) {
                if isProcessing {
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
                if attached, !isProcessing {
                    if isPdf {
                        Text("PDF")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.qkSuccess.opacity(0.15))
                            .clipShape(Capsule())
                    }
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
    }
}

// MARK: - Shared listing photo manager

/// The host photo manager: add, remove, reorder, and set the cover. Used by the
/// add-listing wizard (all photos are new) and by the listing editor (a mix of
/// photos already on the listing and fresh picks), so both offer exactly the
/// same controls and the same cap.
///
/// The list order **is** the display order — index 0 is the cover — and the
/// editor turns the final order into the server calls when the host saves.
/// Reorder / remove controls follow the stay-guide editor's row pattern.
struct ListingPhotosField: View {
    @EnvironmentObject private var loc: LocalizationManager
    @Binding var photos: [ListingPhotoDraft]
    /// The multi-select `PhotosPicker` selection; the owner encodes it into
    /// `photos` on change and clears it.
    @Binding var pickerItems: [PhotosPickerItem]
    /// True while freshly-picked photos are being downscaled + encoded.
    let isEncoding: Bool

    /// Explicit init: the `private` environment object would otherwise make the
    /// synthesized memberwise initializer private (unusable from other files).
    init(photos: Binding<[ListingPhotoDraft]>, pickerItems: Binding<[PhotosPickerItem]>, isEncoding: Bool) {
        _photos = photos
        _pickerItems = pickerItems
        self.isEncoding = isEncoding
    }

    private var isFull: Bool { photos.count >= HostService.maxListingPhotos }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(photos.enumerated()), id: \.element.id) { index, photo in
                photoRow(photo, index: index)
            }

            addButton

            Text(String(format: loc.t("listing.photoCap"), "\(HostService.maxListingPhotos)"))
                .font(.caption)
                .foregroundStyle(Color.qkMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Pieces

    /// One photo: thumbnail, a "Cover" capsule on the first, then set-cover /
    /// move-up / move-down / remove controls.
    private func photoRow(_ photo: ListingPhotoDraft, index: Int) -> some View {
        HStack(spacing: 8) {
            ReviewPhotoThumbnail(urlString: photo.url, size: 52)

            if index == 0 {
                Text(loc.t("listing.photoCover"))
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(Color.qkBurgundy)
                    .clipShape(Capsule())
            }
            Spacer(minLength: 0)

            rowControl(systemImage: "star", label: loc.t("listing.setCover"), disabled: index == 0) {
                move(from: index, to: 0)
            }
            rowControl(systemImage: "chevron.up", label: loc.t("listing.movePhotoUp"), disabled: index == 0) {
                move(from: index, to: index - 1)
            }
            rowControl(systemImage: "chevron.down",
                       label: loc.t("listing.movePhotoDown"),
                       disabled: index >= photos.count - 1) {
                move(from: index, to: index + 1)
            }
            rowControl(systemImage: "trash", label: loc.t("listing.removePhoto"), disabled: false) {
                withAnimation(QKAnim.swap) { _ = photos.remove(at: index) }
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color.qkCream)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    /// A small square icon control, matching the stay-guide editor's rows.
    private func rowControl(
        systemImage: String,
        label: String,
        disabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(disabled ? Color.qkTan4 : Color.qkBurgundy)
                .frame(width: 30, height: 30)
                .background(Color.qkSurface)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .accessibilityLabel(label)
    }

    /// Full-width dashed "Add photos" tile. Hidden once the cap is reached, so
    /// the host is never offered a pick that would be silently dropped.
    @ViewBuilder
    private var addButton: some View {
        if !isFull {
            // Hoisted out of the picker's label closure, which isn't main-actor
            // isolated (calling `loc.t` inside it warns).
            let addTitle = loc.t("listing.addPhotos")
            PhotosPicker(
                selection: $pickerItems,
                maxSelectionCount: HostService.maxListingPhotos - photos.count,
                matching: .images,
                photoLibrary: .shared()
            ) {
                HStack(spacing: 8) {
                    if isEncoding {
                        ProgressView().controlSize(.small).tint(.qkBurgundy)
                    } else {
                        Image(systemName: "plus")
                            .font(.system(size: 15, weight: .semibold))
                    }
                    Text(addTitle)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }
                .foregroundStyle(Color.qkBurgundy)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(Color.qkTan)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(Color.qkBurgundy.opacity(0.3),
                                      style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                )
            }
            .buttonStyle(.qkTap)
            .disabled(isEncoding)
        }
    }

    /// Move one photo within the list, clamping to the valid range.
    private func move(from: Int, to: Int) {
        guard photos.indices.contains(from) else { return }
        let target = max(0, min(to, photos.count - 1))
        guard target != from else { return }
        withAnimation(QKAnim.swap) {
            let photo = photos.remove(at: from)
            photos.insert(photo, at: target)
        }
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
    /// The curated browse area. Listed above the address so the summary reads as
    /// the hierarchy the step asked for — area, then the street inside it.
    let region: String?
    /// The resort / compound as it will be stored — the catalog name or the
    /// host's own text. `nil` when the place isn't in one, and the row is then
    /// skipped rather than showing an em dash for a question with no answer.
    let resort: String?
    let location: String
    let country: String
    let price: Double
    let maxGuests: Int
    let bedrooms: Int
    let beds: Int
    let bathrooms: Int
    let coordinate: CLLocationCoordinate2D?
    let photoCount: Int
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

    private var regionText: String {
        let trimmed = region?.trimmingCharacters(in: .whitespaces) ?? ""
        return trimmed.isEmpty ? "—" : trimmed
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
            SummaryRow(label: "Area", value: regionText)
            if let resort, !resort.isEmpty {
                Divider()
                SummaryRow(label: "Resort / compound", value: resort)
            }
            Divider()
            SummaryRow(label: "Address", value: placeText)
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
            SummaryRow(label: L.t("listing.photos"),
                       value: photoCount == 0 ? "None" : "\(photoCount)")
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

/// Why a host can't add a listing yet, and what to do about it.
///
/// Shown instead of the wizard rather than beside it: letting someone fill in
/// four steps of a listing they cannot submit wastes their time and turns a
/// known rule into a 403 at the end. The wording is the server's, shared with
/// the website; only the call to action is chosen locally, by `gate.code`.
struct ListingGateBlockedView: View {
    let gate: ListingGate

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: gate.code == "verification_pending" ? "clock.badge.checkmark" : "person.badge.shield.checkmark")
                .font(.system(size: 42, weight: .light))
                .foregroundStyle(Color.qkBurgundy)

            Text(gate.title)
                .font(.title3.weight(.bold))
                .foregroundStyle(Color.qkInk)
                .multilineTextAlignment(.center)

            Text(gate.message)
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            if gate.code == "verification_rejected", let reason = gate.reason, !reason.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Reason given by our team")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Color.qkInk)
                    Text(reason)
                        .font(.footnote)
                        .foregroundStyle(Color.qkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }

            Text("Your existing listings are not affected by this.")
                .font(.caption)
                .foregroundStyle(Color.qkMuted)
                .padding(.top, 2)
        }
        .padding(26)
        .frame(maxWidth: 460)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: Color.black.opacity(0.07), radius: 18, y: 6)
        .padding(24)
    }
}

// MARK: - Reusable wizard building blocks

/// "Guests will see EGP X" — shown under every price field in the host forms.
///
/// Hosts type the amount they want to RECEIVE. Guests are quoted that amount
/// plus the platform commission, so without this a host has no idea what their
/// listing actually costs to book. Says nothing until there is a real price: an
/// empty field isn't an error, and "Guests will see EGP 0" is worse than silence.
struct GuestPriceHint: View {
    /// The raw text straight out of the field — may be blank or junk mid-typing.
    let priceText: String
    /// nil while the rate is still loading, or if the fetch failed.
    let commission: CommissionInfo?

    var body: some View {
        if let commission,
           let raw = Double(priceText.trimmingCharacters(in: .whitespaces)),
           let guest = commission.guestPrice(for: raw) {
            (Text("Guests will see ")
                .foregroundStyle(Color.qkMuted)
             + Text("EGP \(Int(guest))")
                .foregroundStyle(Color.qkBurgundy)
                .fontWeight(.semibold)
             + Text(commission.rate > 0
                    ? " · includes QuickIn's \(commission.percentText)% commission — you receive the price you entered"
                    : "")
                .foregroundStyle(Color.qkMuted))
                .font(.footnote)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, -4)
        }
    }
}

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

// MARK: - Edit listing (host)

/// Host "Edit listing" flow → `PATCH /api/local/listings/:id` (+ the `/images`
/// endpoints for photos). It is the add-listing wizard with the fields seeded
/// from the live listing: the very same `BasicsStep` / `LocationStep` /
/// `DetailsStep` and the very same option lists and validation, so there is only
/// one set of listing rules on iOS.
///
/// • Steps 1–3 — every field of the listing: title, description, property type,
///   region, city, country, map pin, capacity, price, photos (add / remove /
///   reorder / set cover), amenities, cancellation policy, length-of-stay
///   discounts, seasonal pricing, and a replacement ownership document.
/// • Step 4 — "Review changes": the summary, the listing's current status, and
///   the **re-review warning**, because saving is a destructive-feeling side
///   effect: the listing goes back into the admin queue and is hidden from
///   guests until it's approved. The host confirms that once more in a dialog
///   before anything is sent.
///
/// Two rules the backend applies that the create form doesn't: `description` and
/// `location` must be non-blank on an edit, so both are marked required here.
struct EditListingView: View {
    /// The listing being edited, as the host listings screen has it.
    let listing: Listing
    /// Called with the saved listing — already `approval_status = "pending"` —
    /// so the caller can show "Under review" immediately and refetch.
    var onSaved: (Listing) -> Void

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var loc: LocalizationManager

    // MARK: Wizard state

    private static let totalSteps = 4
    @State private var step = 1

    // MARK: Fields (the add wizard's set, seeded from `listing`)

    /// Everything that goes into the PATCH body. Held as one value so each step
    /// can bind straight into it (`$draft.title`, …).
    @State private var draft: HostService.ListingEdit
    /// Nightly price as text, matching the wizard's numeric field.
    @State private var priceText: String
    @State private var selectedAmenities: Set<String>
    /// Seasonal pricing as the text the fields edit; parsed back on save.
    @State private var weekendPriceText: String
    /// Which weekdays the weekend rate applies to (`0`=Sun … `6`=Sat), seeded
    /// from the listing so opening the editor and saving cannot move a weekend
    /// the host set somewhere else.
    @State private var weekendDays: Set<Int>
    @State private var monthlyPriceTexts: [String: String]
    /// Map coordinate; mirrored into `draft.lat` / `draft.lng` on save.
    @State private var coordinate: CLLocationCoordinate2D?

    /// The resort / compound, seeded from the listing, plus the free text that
    /// goes with "Other" and the catalog for the current area.
    @State private var resort: ResortChoice.Selection
    @State private var resortName: String
    @State private var resorts: [ResortOption] = []
    @State private var isLoadingResorts = false
    /// What the listing arrived with — the baseline the save diffs against, so
    /// an edit to the price never rewrites a resort the host chose on the web.
    private let seededResort: ResortChoice.Selection
    private let seededResortName: String

    /// The desired final photo set (order = display order, first = cover). A mix
    /// of photos already on the listing and fresh picks.
    @State private var photos: [ListingPhotoDraft]
    /// What the server currently holds — the baseline the save diffs against, so
    /// untouched photos are never re-uploaded. Re-seeded from each response as
    /// the save progresses, so retrying after a mid-way failure doesn't repeat
    /// work that already landed.
    @State private var serverPhotos: [ListingPhotoDraft]
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var encodingPhotos = false


    /// Property types offered — the standard list plus whatever this listing
    /// already carries, so an edit can't silently rewrite it.
    private let propertyTypes: [String]

    // MARK: Location search (step 2)

    @State private var searchQuery = ""
    @StateObject private var locationSearch = LocationSearchManager()
    @State private var recenterTarget: CLLocationCoordinate2D?
    @State private var recenterToken = 0

    // MARK: Saving

    @State private var isSaving = false
    @State private var errorMessage: String?
    /// The platform commission, so the price fields can show the host what a
    /// guest will actually pay. Advisory only — the server prices the listing
    /// either way — so a failed fetch just leaves the hint hidden.
    @State private var commission: CommissionInfo?
    /// Drives the "this sends your listing back for review" confirmation.
    @State private var showingConfirm = false
    /// Set once the save succeeded — shows the "Under review" confirmation.
    @State private var savedListing: Listing?

    init(listing: Listing, onSaved: @escaping (Listing) -> Void) {
        self.listing = listing
        self.onSaved = onSaved

        var seeded = HostService.ListingEdit(listing: listing)
        // A listing with no property type on file (only possible on very old
        // rows) would otherwise open with an empty picker and fail validation.
        if seeded.propertyType.trimmingCharacters(in: .whitespaces).isEmpty {
            seeded.propertyType = ListingFormOptions.defaultPropertyType
        }
        _draft = State(initialValue: seeded)

        // The listing points at a catalog row, carries free text, or neither.
        let typedResort = listing.resortId == nil ? (ResortChoice.normalizeName(listing.resort) ?? "") : ""
        let selection: ResortChoice.Selection
        if let id = listing.resortId, !id.isEmpty {
            selection = .catalog(id: id)
        } else if !typedResort.isEmpty {
            selection = .other
        } else {
            selection = .none
        }
        _resort = State(initialValue: selection)
        _resortName = State(initialValue: typedResort)
        seededResort = selection
        seededResortName = typedResort

        _priceText = State(initialValue: listing.pricePerNight > 0 ? String(Int(listing.pricePerNight.rounded())) : "")
        _selectedAmenities = State(initialValue: Set(listing.amenities))
        _weekendPriceText = State(initialValue: listing.weekendPrice.map { String(Int($0.rounded())) } ?? "")
        _weekendDays = State(initialValue: SeasonalPricingFields.seedWeekendDays(from: listing))
        _monthlyPriceTexts = State(initialValue: SeasonalPricingFields.seedMonths(from: listing.monthlyPrices))
        _coordinate = State(initialValue: listing.coordinate)

        let existing = listing.sortedImages.map(ListingPhotoDraft.init)
        _photos = State(initialValue: existing)
        _serverPhotos = State(initialValue: existing)
        propertyTypes = ListingFormOptions.propertyTypes(including: listing.propertyType)
    }

    private var price: Double { Double(priceText.trimmingCharacters(in: .whitespaces)) ?? 0 }

    /// Selected amenities in the catalog's display order, with any the catalog
    /// doesn't know about (set on another surface) kept at the end rather than
    /// silently dropped by the edit.
    private var orderedAmenities: [String] {
        Amenities.all.filter { selectedAmenities.contains($0) }
            + selectedAmenities.subtracting(Amenities.all).sorted()
    }

    // MARK: - Per-step validation (the wizard's rules + the two PATCH requires)

    /// The same floors the create wizard and the API hold — a non-empty check
    /// passed `ok` as a description and `12` as an address, and the API refuses
    /// both now, so gating on "not empty" here would just turn a rule the host
    /// could have been shown into a 400 after they pressed Save.
    private func letterCount(_ text: String) -> Int {
        text.reduce(into: 0) { total, ch in if ch.isLetter { total += 1 } }
    }

    /// What is wrong with the title, if anything — the same `ListingTitlePolicy`
    /// the create wizard and the PATCH run. A rename to `@@@@@` used to clear
    /// this step and bounce off the API after Save.
    private var titleProblem: ListingTitlePolicy.Problem? {
        ListingTitlePolicy.check(draft.title)
    }

    // Each step answers with the sentence that blocks it and derives its Bool
    // from that, for the reason the create wizard does — see `step1Blocker`
    // there. Every field is checked in the order it is laid out on the step.
    private var step1Blocker: String? {
        if let problem = titleProblem, problem == .required {
            return ListingTitlePolicy.message(problem)
        }
        if titleProblem != nil { return loc.t("listing.blocked.title") }
        if letterCount(draft.description) < AddListingView.minDescriptionLetters {
            return String(format: loc.t("listing.blocked.description"),
                          "\(AddListingView.minDescriptionLetters)")
        }
        return nil
    }
    /// The region has to be one the backend accepts — a listing carrying an
    /// older/unknown area has to be re-picked rather than 400 on save.
    private var step2Blocker: String? {
        let region = draft.region?.trimmingCharacters(in: .whitespaces) ?? ""
        let known = ListingFormOptions.regions.contains { $0.caseInsensitiveCompare(region) == .orderedSame }
        if !known { return loc.t("listing.blocked.region") }
        if let resortProblem = ResortChoice.blocker(resort, typedName: resortName) {
            return resortProblem
        }
        if letterCount(draft.location) < AddListingView.minLocationLetters {
            return String(format: loc.t("listing.blocked.location"),
                          "\(AddListingView.minLocationLetters)")
        }
        if coordinate == nil { return loc.t("listing.blocked.pin") }
        return nil
    }
    /// Photos are not on this list (they travel through the /images routes), but
    /// the capacity counts are: an edit may not take a listing below the floor,
    /// and a row created before that floor existed can open here holding a 0.
    private var step3Blocker: String? {
        if let capacityProblem = AddListingView.capacityBlocker(
            maxGuests: draft.maxGuests,
            bedrooms: draft.bedrooms,
            beds: draft.beds,
            bathrooms: draft.bathrooms,
            propertyType: draft.propertyType,
            t: { loc.t($0) }
        ) {
            return capacityProblem
        }
        if price <= 0 { return loc.t("listing.blocked.price") }
        return nil
    }

    private var step1Valid: Bool { step1Blocker == nil }
    private var step2Valid: Bool { step2Blocker == nil }
    private var step3Valid: Bool { step3Blocker == nil }

    /// Why the current step will not advance, or nil when it will. Rendered above
    /// Next / Save changes.
    private var currentStepBlocker: String? {
        switch step {
        case 1:  return step1Blocker
        case 2:  return step2Blocker
        case 3:  return step3Blocker
        default: return nil
        }
    }

    private var currentStepValid: Bool {
        switch step {
        case 1:  return step1Valid
        case 2:  return step2Valid
        case 3:  return step3Valid
        default: return true
        }
    }

    private var canSave: Bool {
        step1Valid && step2Valid && step3Valid && !isSaving && savedListing == nil
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
                            title: $draft.title,
                            description: $draft.description,
                            propertyType: $draft.propertyType,
                            propertyTypes: propertyTypes,
                            titleProblem: titleProblem
                        ) }
                        .tag(1)

                        stepCard { LocationStep(
                            region: $draft.region,
                            regions: ListingFormOptions.regions,
                            resort: $resort,
                            resortName: $resortName,
                            resorts: resorts,
                            resortsLoading: isLoadingResorts,
                            location: $draft.location,
                            country: $draft.country,
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
                            propertyType: draft.propertyType,
                            maxGuests: $draft.maxGuests,
                            bedrooms: $draft.bedrooms,
                            beds: $draft.beds,
                            bathrooms: $draft.bathrooms,
                            priceText: $priceText,
                            selectedAmenities: $selectedAmenities,
                            cancellationPolicy: $draft.cancellationPolicy,
                            weeklyDiscount: $draft.weeklyDiscount,
                            monthlyDiscount: $draft.monthlyDiscount,
                            weekendPrice: $weekendPriceText,
                            weekendDays: $weekendDays,
                            monthlyPrices: $monthlyPriceTexts,
                            ownershipDoc: $draft.ownershipDoc,
                            photos: $photos,
                            photoItems: $photoItems,
                            encodingPhotos: encodingPhotos,
                            commission: commission
                        ) }
                        .tag(3)

                        stepCard { EditReviewStep(
                            region: draft.region,
                            resort: resortSummary,
                            title: draft.title,
                            propertyType: draft.propertyType,
                            location: draft.location,
                            country: draft.country,
                            price: price,
                            maxGuests: draft.maxGuests,
                            bedrooms: draft.bedrooms,
                            beds: draft.beds,
                            bathrooms: draft.bathrooms,
                            coordinate: coordinate,
                            photoCount: photos.count,
                            amenities: orderedAmenities,
                            cancellationPolicy: draft.cancellationPolicy,
                            weeklyDiscount: draft.weeklyDiscount,
                            monthlyDiscount: draft.monthlyDiscount,
                            hasNewOwnershipDoc: !draft.ownershipDoc.isEmpty,
                            currentStatus: listing.approval,
                            errorMessage: errorMessage
                        ) }
                        .tag(4)
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    .animation(.easeInOut(duration: 0.3), value: step)

                    StepBlockerNote(message: currentStepBlocker)
                    navBar
                }

                if let saved = savedListing {
                    savedOverlay(saved)
                }
            }
            .navigationTitle(loc.t("listing.edit.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.qkCream, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(loc.t("common.cancel")) { dismiss() }
                        .tint(.qkBurgundy)
                        .disabled(isSaving)
                }
            }
        }
        .tint(.qkBurgundy)
        .interactiveDismissDisabled(isSaving)
        .onAppear { bindLocationCallback() }
        .task { commission = try? await HostService.shared.fetchCommission() }
        .task(id: draft.region) { await loadResorts() }
        .onChange(of: photoItems) { _, items in
            guard !items.isEmpty else { return }
            Task { await processPickedPhotos(items) }
        }
        // The one thing a host must not be surprised by: saving takes the
        // listing offline until an admin approves it again.
        .alert(loc.t("listing.edit.confirmTitle"), isPresented: $showingConfirm) {
            Button(loc.t("common.cancel"), role: .cancel) {}
            Button(loc.t("listing.edit.confirmSave")) { Task { await save() } }
        } message: {
            Text(loc.t("listing.edit.reviewNotice"))
        }
    }

    // MARK: - Chrome

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
                Text(String(format: loc.t("listing.edit.stepOf"), "\(step)", "\(Self.totalSteps)"))
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
        case 1:  return loc.t("listing.edit.step.basics")
        case 2:  return loc.t("listing.edit.step.location")
        case 3:  return loc.t("listing.edit.step.details")
        default: return loc.t("listing.edit.step.review")
        }
    }

    /// Bottom Back / Next (or Save changes) bar.
    private var navBar: some View {
        HStack(spacing: 12) {
            if step > 1 {
                Button { goBack() } label: {
                    Text(loc.t("listing.edit.back"))
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
                .disabled(isSaving)
            }

            if step < Self.totalSteps {
                Button { goNext() } label: {
                    QKPrimaryButtonLabel(title: loc.t("listing.edit.next"))
                        .opacity(currentStepValid ? 1 : 0.45)
                }
                .buttonStyle(QKPressStyle())
                .disabled(!currentStepValid)
            } else {
                Button { showingConfirm = true } label: {
                    QKPrimaryButtonLabel(title: loc.t("listing.edit.save"), isLoading: isSaving)
                        .opacity(canSave ? 1 : 0.45)
                }
                .buttonStyle(QKPressStyle())
                .disabled(!canSave)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 12)
        .background(Color.qkCream)
    }

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

    /// Post-save confirmation: the listing's new state, shown with the same
    /// approval chip the host listings screen uses.
    private func savedOverlay(_ saved: Listing) -> some View {
        ZStack {
            Color.qkInk.opacity(0.35).ignoresSafeArea()
            VStack(spacing: 14) {
                HostApprovalBadge(status: saved.approval)
                Text(loc.t("listing.edit.saved"))
                    .font(.system(.title3, design: .serif).weight(.semibold))
                    .foregroundStyle(Color.qkInk)
                Text(loc.t("listing.edit.savedBody"))
                    .font(.footnote)
                    .foregroundStyle(Color.qkMuted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                Button { dismiss() } label: {
                    QKPrimaryButtonLabel(title: loc.t("common.done"), cornerRadius: 14, height: 46)
                }
                .buttonStyle(QKPressStyle())
            }
            .padding(24)
            .frame(maxWidth: 340)
            .background(Color.qkSurface)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .padding(.horizontal, 24)
        }
        .transition(.opacity)
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

    private func bindLocationCallback() {
        locationSearch.onLocation = { coord, place in
            apply(coordinate: coord, address: place?.address, country: place?.country)
        }
    }

    private func applyPlace(_ place: PlaceResult) {
        apply(coordinate: place.coordinate, address: place.address, country: place.country)
        locationSearch.clearResults()
    }

    /// Place the pin and fill address / country only when they're still empty, so
    /// a search never clobbers what the listing already says.
    private func apply(coordinate coord: CLLocationCoordinate2D, address: String?, country countryName: String?) {
        coordinate = coord
        recenterTarget = coord
        recenterToken += 1

        if draft.location.trimmingCharacters(in: .whitespaces).isEmpty,
           let address, !address.isEmpty {
            draft.location = address
        }
        if draft.country.trimmingCharacters(in: .whitespaces).isEmpty,
           let countryName, !countryName.isEmpty {
            draft.country = countryName
        }
    }

    // MARK: - Pickers

    /// Append freshly-picked photos, up to the shared cap.
    private func processPickedPhotos(_ items: [PhotosPickerItem]) async {
        errorMessage = nil
        encodingPhotos = true
        defer {
            encodingPhotos = false
            photoItems = []
        }
        let room = HostService.maxListingPhotos - photos.count
        guard room > 0 else { return }
        photos.append(contentsOf: await ListingPhotoDraft.encode(items, limit: room))
    }

    // MARK: - Save

    /// Save every field, then bring the photo set in line. Each call re-queues
    /// the listing for review server-side and echoes the updated listing, so the
    /// last response is the authoritative one we hand back.
    private func save() async {
        errorMessage = nil
        isSaving = true
        defer { isSaving = false }

        // The seasonal rates, judged before anything is sent — the API refuses the
        // same values, and a host is owed the reason beside the field rather than
        // as a server error after a four-step wizard.
        let weekendCheck = ListingPricingRules.checkPrice(weekendPriceText)
        guard case .success(let weekendRate) = weekendCheck else {
            if case .failure(let problem) = weekendCheck {
                errorMessage = loc.t(problem.weekendKey)
                withAnimation(QKAnim.swap) { step = 3 }
            }
            return
        }
        let monthsCheck = ListingPricingRules.checkMonths(monthlyPriceTexts)
        guard case .success(let checkedMonths) = monthsCheck else {
            if case .failure(let failure) = monthsCheck {
                errorMessage = String(format: loc.t(failure.problem.monthKey),
                                      qkShortMonthSymbols(loc)[failure.month - 1])
                withAnimation(QKAnim.swap) { step = 3 }
            }
            return
        }
        // The rate and the days it applies to are one field, judged as a pair.
        let schedule = WeekendSchedule.resolve(price: weekendRate, days: Array(weekendDays))
        guard case .success(let resolvedDays) = schedule else {
            if case .failure(let problem) = schedule {
                errorMessage = loc.t(problem == .wholeWeek
                                     ? "pricing.weekendDays.wholeWeek"
                                     : "pricing.weekendDays.noDaysChosen")
                withAnimation(QKAnim.swap) { step = 3 }
            }
            return
        }

        draft.pricePerNight = price
        draft.weekendPrice = weekendRate
        draft.weekendDays = resolvedDays ?? WeekendSchedule.defaultDays
        draft.monthlyPrices = checkedMonths
        draft.amenities = orderedAmenities
        draft.lat = coordinate?.latitude
        draft.lng = coordinate?.longitude

        // The resort columns are only written when the host actually changed the
        // answer — see `ListingEdit.resortEdited`.
        let resortPayload = ResortChoice.payload(resort, typedName: resortName)
        draft.resortId = resortPayload.resortId
        draft.resortName = resortPayload.resortName
        draft.resortEdited = resortChanged

        do {
            var updated = try await HostService.shared.updateListing(id: listing.id, draft)
            updated = try await syncPhotos(from: updated)
            withAnimation(QKAnim.swap) { savedListing = updated }
            onSaved(updated)
        } catch {
            errorMessage = error.localizedDescription
            // Surface the failure on the step that carries the error line.
            withAnimation(.easeInOut(duration: 0.3)) { step = Self.totalSteps }
        }
    }

    /// Whether the resort answer differs from what the listing arrived with. A
    /// host who never opened the picker leaves both columns untouched.
    private var resortChanged: Bool {
        if resort != seededResort { return true }
        guard resort == .other else { return false }
        return ResortChoice.normalizeName(resortName) != ResortChoice.normalizeName(seededResortName)
    }

    /// Load the compounds for the current area. The listing's OWN resort is kept
    /// in the list even when the area's catalog doesn't carry it — an admin may
    /// have deactivated it since, and the picker must still be able to name what
    /// the listing says today rather than showing a blank field.
    private func loadResorts() async {
        let region = draft.region?.trimmingCharacters(in: .whitespaces) ?? ""
        isLoadingResorts = true
        defer { isLoadingResorts = false }
        var loaded = region.isEmpty ? [] : await SupabaseService.shared.fetchResorts(region: region)
        if case .catalog(let id) = seededResort, !loaded.contains(where: { $0.id == id }) {
            loaded.append(ResortOption(id: id, name: listing.resort ?? "", region: listing.region ?? region))
        }
        resorts = loaded
        // A resort the host picked under a different area is dropped, as in the
        // create wizard — its region would otherwise overrule the chip they just
        // tapped. The listing's own resort survives, because it is in the list.
        if case .catalog(let id) = resort, !loaded.contains(where: { $0.id == id }) {
            resort = .none
        }
    }

    /// What the review step shows for the resort — the catalog name, the typed
    /// text, or nothing when the place isn't in one.
    private var resortSummary: String? {
        switch resort {
        case .none:
            return nil
        case .other:
            return ResortChoice.normalizeName(resortName)
        case .catalog(let id):
            return resorts.first { $0.id == id }?.name
        }
    }

    /// Apply the photo edits the host made: delete what they removed, upload
    /// what they added, then set the final order (which is also how "set as
    /// cover" is expressed). Photos that didn't change are never re-uploaded.
    ///
    /// Each step re-seeds `serverPhotos` from the response — and an upload also
    /// swaps the uploaded drafts for their server-backed twins — so if a later
    /// call fails, tapping Save again resumes rather than repeating.
    private func syncPhotos(from listingAfterFields: Listing) async throws -> Listing {
        var current = listingAfterFields

        // 1. Photos the host removed.
        let keptIDs = Set(photos.compactMap(\.imageID))
        for imageID in serverPhotos.compactMap(\.imageID) where !keptIDs.contains(imageID) {
            current = try await HostService.shared.deleteListingPhoto(listingID: listing.id, imageID: imageID)
            serverPhotos = current.sortedImages.map(ListingPhotoDraft.init)
        }

        // 2. Photos the host added — uploaded once, in display order.
        let addedURLs = photos.filter { !$0.isExisting }.map(\.url)
        if !addedURLs.isEmpty {
            let knownIDs = Set(serverPhotos.compactMap(\.imageID))
            current = try await HostService.shared.addListingPhotos(listingID: listing.id, urls: addedURLs)
            // The rows the listing just gained, in the order they were sent.
            var freshIDs = current.sortedImages.compactMap(\.id).filter { !knownIDs.contains($0) }
            photos = photos.map { photo in
                guard photo.imageID == nil, !freshIDs.isEmpty else { return photo }
                return ListingPhotoDraft(imageID: freshIDs.removeFirst(), url: photo.url)
            }
            serverPhotos = current.sortedImages.map(ListingPhotoDraft.init)
        }

        // 3. The final order (index 0 = cover). Only when every photo is
        //    addressable and the order actually moved.
        let serverIDs = current.sortedImages.compactMap(\.id)
        let desiredIDs = photos.compactMap(\.imageID)
        guard desiredIDs.count == serverIDs.count, desiredIDs != serverIDs else { return current }
        current = try await HostService.shared.setListingPhotoOrder(listingID: listing.id, imageIDs: desiredIDs)
        serverPhotos = current.sortedImages.map(ListingPhotoDraft.init)
        return current
    }
}

// MARK: - Edit step 4: Review changes

/// Read-only summary of the edited listing, its current moderation state, and
/// the warning that saving sends it back for review. The same `SummaryRow`
/// layout the add wizard's review step uses.
private struct EditReviewStep: View {
    @EnvironmentObject private var loc: LocalizationManager
    /// The curated browse area, shown above the address for the same reason as
    /// in `ReviewStep`.
    let region: String?
    /// The resort / compound as it will be stored; the row is skipped when the
    /// place isn't in one. See `ReviewStep.resort`.
    let resort: String?
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
    let photoCount: Int
    let amenities: [String]
    let cancellationPolicy: CancellationPolicy
    let weeklyDiscount: Int
    let monthlyDiscount: Int
    let hasNewOwnershipDoc: Bool
    let currentStatus: ApprovalStatus
    let errorMessage: String?

    private var placeText: String {
        let parts = [location, country].map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        return parts.isEmpty ? "—" : parts.joined(separator: ", ")
    }

    private var regionText: String {
        let trimmed = region?.trimmingCharacters(in: .whitespaces) ?? ""
        return trimmed.isEmpty ? "—" : trimmed
    }

    private var coordText: String {
        guard let coordinate else { return loc.t("listing.edit.notSet") }
        return String(format: "%.5f, %.5f", coordinate.latitude, coordinate.longitude)
    }

    /// "2 bedrooms · 3 beds · 1 baths", reusing the detail screen's spec words.
    private var roomsText: String {
        [
            "\(bedrooms) \(loc.t("detail.spec.bedrooms"))",
            "\(beds) \(loc.t("detail.spec.beds"))",
            "\(bathrooms) \(loc.t("detail.spec.baths"))",
        ].joined(separator: " · ")
    }

    private var discountSummary: String {
        var parts: [String] = []
        if weeklyDiscount > 0 {
            parts.append(String(format: loc.t("growth.weeklyShort"), "\(weeklyDiscount)"))
        }
        if monthlyDiscount > 0 {
            parts.append(String(format: loc.t("growth.monthlyShort"), "\(monthlyDiscount)"))
        }
        return parts.isEmpty ? loc.t("growth.noDiscounts") : parts.joined(separator: " · ")
    }

    var body: some View {
        Text(loc.t("listing.edit.summary"))
            .font(.title3.weight(.semibold))
            .foregroundStyle(Color.qkInk)

        Text(loc.t("listing.edit.summaryIntro"))
            .font(.footnote)
            .foregroundStyle(Color.qkMuted)
            .fixedSize(horizontal: false, vertical: true)

        HStack(spacing: 8) {
            Text(loc.t("listing.edit.currentStatus"))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
            Spacer(minLength: 12)
            HostApprovalBadge(status: currentStatus)
        }

        VStack(spacing: 0) {
            SummaryRow(label: loc.t("listing.edit.field.title"), value: title.isEmpty ? "—" : title)
            Divider()
            SummaryRow(label: loc.t("listing.edit.field.type"), value: propertyType.isEmpty ? "—" : propertyType)
            Divider()
            SummaryRow(label: loc.t("listing.edit.field.area"), value: regionText)
            if let resort, !resort.isEmpty {
                Divider()
                SummaryRow(label: loc.t("listing.edit.field.resort"), value: resort)
            }
            Divider()
            SummaryRow(label: loc.t("listing.edit.field.location"), value: placeText)
            Divider()
            SummaryRow(label: loc.t("listing.edit.field.price"),
                       value: price > 0 ? "EGP \(formatted(price)) / \(loc.t("common.night"))" : "—")
            Divider()
            SummaryRow(label: loc.t("listing.edit.field.guests"), value: "\(maxGuests)")
            Divider()
            SummaryRow(label: loc.t("listing.edit.field.rooms"), value: roomsText)
            Divider()
            SummaryRow(label: loc.t("listing.edit.field.coordinates"), value: coordText, monospaced: true)
            Divider()
            SummaryRow(label: loc.t("listing.photos"),
                       value: photoCount == 0 ? loc.t("listing.edit.none") : "\(photoCount)")
            Divider()
            SummaryRow(label: loc.t("listing.edit.field.amenities"),
                       value: amenities.isEmpty ? loc.t("listing.edit.none")
                                                : amenities.joined(separator: ", "))
            Divider()
            SummaryRow(label: loc.t("cancel.policyLabel"), value: cancellationPolicy.name)
            Divider()
            SummaryRow(label: loc.t("growth.lengthOfStayDiscounts"), value: discountSummary)
            Divider()
            SummaryRow(
                label: loc.t("approval.ownershipDoc"),
                value: hasNewOwnershipDoc ? loc.t("listing.edit.docReplaced") : loc.t("listing.edit.docUnchanged")
            )
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 4)
        .background(Color.qkCream)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

        // The one thing the host must read before saving.
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.qkGoldDeep)
            Text(loc.t("listing.edit.reviewNotice"))
                .font(.footnote.weight(.medium))
                .foregroundStyle(Color.qkInk)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(Color.qkGoldDeep.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.qkGoldDeep.opacity(0.28), lineWidth: 1)
        )

        if let errorMessage {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(Color.qkBurgundy)
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(Color.qkBurgundy)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
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
