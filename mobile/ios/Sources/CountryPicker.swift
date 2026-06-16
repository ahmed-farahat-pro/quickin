import SwiftUI

/// A single selectable country: its ISO region code plus the display name in the
/// **current** UI language (used for showing/searching) and the **English**
/// display name (what we store/send, matching the web which keeps English
/// country names).
struct CountryOption: Identifiable, Equatable {
    /// ISO 3166 region code, e.g. "EG". Stable identity across languages.
    let code: String
    /// Localized display name in the active app language (shown + searched).
    let localizedName: String
    /// English display name — the value persisted/sent to the backend.
    let englishName: String

    var id: String { code }
}

/// Builds and caches the localized, sorted country list from the OS region data.
///
/// Uses `Locale.Region.isoRegions` (the modern API on iOS 16+) and
/// `Locale.localizedString(forRegionCode:)` so the names match the user's
/// language, while keeping the **English** name around to store/send.
///
/// Egypt is pinned to the very top as a sensible default for this market; the
/// remaining countries follow, sorted by their localized name using the active
/// locale's collation (so Arabic sorts in Arabic order, English in English).
enum CountryCatalog {
    /// Egypt's ISO region code — pinned first.
    static let defaultCode = "EG"

    /// Region codes to skip: world/continent/grouping pseudo-regions and a few
    /// non-country codes that aren't meaningful "country you're from" choices.
    private static let excluded: Set<String> = [
        "001", "002", "003", "005", "009", "011", "013", "014", "015", "017",
        "018", "019", "021", "029", "030", "034", "035", "039", "053", "054",
        "057", "061", "142", "143", "145", "150", "151", "154", "155", "202",
        "419", "EU", "EZ", "QO", "UN", "ZZ",
    ]

    /// The English-name locale, used to resolve the stored/sent value
    /// consistently regardless of the UI language.
    private static let englishLocale = Locale(identifier: "en_US")

    /// Build the option list for `lang`. Egypt first, then the rest A→Z by
    /// localized name. Recomputed when the language changes (cheap; ~250 items).
    @MainActor
    static func options(for lang: AppLang) -> [CountryOption] {
        let uiLocale = Locale(identifier: lang.localeIdentifier)

        // Collect every two-letter ISO region that resolves to a real name.
        let codes = Locale.Region.isoRegions
            .map(\.identifier)
            .filter { $0.count == 2 && !excluded.contains($0) }

        var options: [CountryOption] = codes.compactMap { code in
            guard
                let localized = uiLocale.localizedString(forRegionCode: code),
                let english = englishLocale.localizedString(forRegionCode: code)
            else { return nil }
            return CountryOption(code: code, localizedName: localized, englishName: english)
        }

        // Sort by localized name using the UI locale's collation, then pin Egypt.
        options.sort {
            $0.localizedName.localizedCompare($1.localizedName) == .orderedAscending
        }
        if let egyptIndex = options.firstIndex(where: { $0.code == defaultCode }) {
            let egypt = options.remove(at: egyptIndex)
            options.insert(egypt, at: 0)
        }
        return options
    }

    /// Resolve the English display name for a stored value back to the localized
    /// name for display. Falls back to the stored value itself when unknown
    /// (e.g. a country saved by another client/version).
    @MainActor
    static func localizedName(forEnglish english: String, lang: AppLang) -> String? {
        let trimmed = english.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if let match = options(for: lang).first(where: {
            $0.englishName.caseInsensitiveCompare(trimmed) == .orderedSame
        }) {
            return match.localizedName
        }
        return trimmed
    }
}

/// A row-style country selector: tapping it opens a searchable sheet of all
/// countries. The selected country's **localized** name is shown inline; the
/// bound `selection` holds the **English** name to store/send.
///
/// Styled with DesignKit tokens (cream field, burgundy accents) and fully
/// RTL-safe — the app runs under `.environment(\.layoutDirection, …)`, so the
/// `Label`/`Spacer`/chevron mirror automatically in Arabic.
struct CountryPickerField: View {
    @EnvironmentObject private var loc: LocalizationManager

    /// The stored English country name (empty when nothing is picked).
    @Binding var selection: String

    /// Field title shown above the control (e.g. signup vs. settings copy).
    let title: String
    /// SF Symbol leading the title label.
    var systemImage: String = "globe"

    @State private var showSheet = false

    /// Localized name for the current selection, or the placeholder when empty.
    private var displayName: String {
        CountryCatalog.localizedName(forEnglish: selection, lang: loc.lang)
            ?? loc.t("settings.country.placeholder")
    }

    private var hasSelection: Bool {
        !selection.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: systemImage)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)

            Button {
                showSheet = true
            } label: {
                HStack(spacing: 10) {
                    Text(displayName)
                        .foregroundStyle(hasSelection ? Color.qkInk : Color.qkMuted)
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.qkMuted)
                }
                .padding(.horizontal, 14)
                .frame(height: 48)
                .frame(maxWidth: .infinity)
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(Color.qkInk.opacity(0.1), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel(title)
            .accessibilityValue(hasSelection ? displayName : "")
        }
        .sheet(isPresented: $showSheet) {
            CountryPickerSheet(selection: $selection)
                .environmentObject(loc)
        }
    }
}

/// The searchable list presented by `CountryPickerField`. Picking a country
/// writes its **English** name into `selection` and dismisses.
private struct CountryPickerSheet: View {
    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    @Binding var selection: String
    @State private var query = ""

    private var allOptions: [CountryOption] {
        CountryCatalog.options(for: loc.lang)
    }

    /// Filter by the localized name; trimmed, case/diacritic-insensitive.
    private var filtered: [CountryOption] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return allOptions }
        return allOptions.filter {
            $0.localizedName.range(of: trimmed, options: [.caseInsensitive, .diacriticInsensitive]) != nil
        }
    }

    var body: some View {
        NavigationStack {
            List(filtered) { option in
                Button {
                    selection = option.englishName
                    dismiss()
                } label: {
                    HStack(spacing: 12) {
                        Text(option.localizedName)
                            .foregroundStyle(Color.qkInk)
                        Spacer(minLength: 8)
                        if option.englishName.caseInsensitiveCompare(selection) == .orderedSame {
                            Image(systemName: "checkmark")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.qkBurgundy)
                        }
                    }
                }
                .listRowBackground(Color.qkSurface)
            }
            .scrollContentBackground(.hidden)
            .background(LinearGradient.qkPageWash.ignoresSafeArea())
            .searchable(
                text: $query,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: loc.t("settings.country.placeholder")
            )
            .navigationTitle(loc.t("settings.country"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(loc.t("common.cancel")) { dismiss() }
                        .tint(.qkBurgundy)
                }
            }
            .tint(.qkBurgundy)
        }
    }
}
