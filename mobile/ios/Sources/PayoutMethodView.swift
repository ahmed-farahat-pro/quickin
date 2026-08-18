import SwiftUI

// MARK: - Model types

/// One of the three destinations QuickIn can send a host's earnings to.
/// Raw values match `host_payout_methods.method` on the server.
enum PayoutMethodKind: String, CaseIterable, Identifiable {
    case bankAccount = "bank_account"
    case instapay
    case wallet

    var id: String { rawValue }

    /// Localized name for the picker and the preview header.
    @MainActor var label: String { L.t("payout.method.\(rawValue)") }

    var icon: String {
        switch self {
        case .bankAccount: return "building.columns.fill"
        case .instapay:    return "arrow.left.arrow.right.circle.fill"
        case .wallet:      return "wallet.bifold.fill"
        }
    }
}

/// The mobile wallets a host can be paid into. Mirrors `WALLET_PROVIDERS` in
/// the server's payout-method-core.
enum WalletProviderKind: String, CaseIterable, Identifiable {
    case vodafoneCash = "vodafone_cash"
    case etisalatCash = "etisalat_cash"
    case orangeMoney = "orange_money"
    case wePay = "we_pay"
    case other

    var id: String { rawValue }
    @MainActor var label: String { L.t("payout.wallet.\(rawValue)") }
}

/// The saved payout method as `GET /api/local/host/payout-method` returns it.
///
/// Every field is stored and returned whole — an IBAN is meant to be handed out,
/// and a masked one is one a host cannot check. `display` is the server's
/// one-line summary; `ibanFormatted` is the IBAN in the 4-character groups banks
/// print it in.
struct HostPayoutMethod: Decodable, Equatable {
    let method: String
    let accountName: String
    let accountRef: String
    let bankName: String
    let iban: String
    let ibanFormatted: String
    let accountNumber: String
    let swiftBic: String
    let branch: String
    let provider: String
    let display: String
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case method
        case accountName = "account_name"
        case accountRef = "account_ref"
        case bankName = "bank_name"
        case iban
        case ibanFormatted = "iban_formatted"
        case accountNumber = "account_number"
        case swiftBic = "swift_bic"
        case branch
        case provider
        case display
        case updatedAt = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        method = try c.decode(String.self, forKey: .method)
        // Every other field defaults to "" so a method that doesn't carry it
        // (a wallet has no IBAN) decodes rather than throwing.
        accountName = (try c.decodeIfPresent(String.self, forKey: .accountName)) ?? ""
        accountRef = (try c.decodeIfPresent(String.self, forKey: .accountRef)) ?? ""
        bankName = (try c.decodeIfPresent(String.self, forKey: .bankName)) ?? ""
        iban = (try c.decodeIfPresent(String.self, forKey: .iban)) ?? ""
        ibanFormatted = (try c.decodeIfPresent(String.self, forKey: .ibanFormatted)) ?? ""
        accountNumber = (try c.decodeIfPresent(String.self, forKey: .accountNumber)) ?? ""
        swiftBic = (try c.decodeIfPresent(String.self, forKey: .swiftBic)) ?? ""
        branch = (try c.decodeIfPresent(String.self, forKey: .branch)) ?? ""
        provider = (try c.decodeIfPresent(String.self, forKey: .provider)) ?? ""
        display = (try c.decodeIfPresent(String.self, forKey: .display)) ?? ""
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt)
    }

    var kind: PayoutMethodKind? { PayoutMethodKind(rawValue: method) }
}

/// `{ payout_method, payout_ready }` — the whole response body.
struct HostPayoutState: Decodable {
    let payoutMethod: HostPayoutMethod?
    let payoutReady: Bool

    enum CodingKeys: String, CodingKey {
        case payoutMethod = "payout_method"
        case payoutReady = "payout_ready"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        payoutMethod = try c.decodeIfPresent(HostPayoutMethod.self, forKey: .payoutMethod)
        payoutReady = (try c.decodeIfPresent(Bool.self, forKey: .payoutReady)) ?? false
    }
}

// MARK: - Networking

/// Networking for the host's payout method. Mirrors `TrustService` — plain
/// URLSession + Codable, bearer token read straight from `UserDefaults`.
///
///   GET    {base}/api/local/host/payout-method  (Bearer) → { payout_method, payout_ready }
///   PUT    {base}/api/local/host/payout-method  (Bearer) { method, account_name, … }
///   DELETE {base}/api/local/host/payout-method  (Bearer)
struct PayoutService {
    static let shared = PayoutService()

    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 20
        cfg.waitsForConnectivity = true
        return URLSession(configuration: cfg)
    }()

    var token: String? {
        let value = UserDefaults.standard.string(forKey: AuthStore.tokenKey)
        return (value?.isEmpty == false) ? value : nil
    }

    /// What the editor sends. Fields for the other two methods are ignored by
    /// the server, so one draft type covers all three.
    struct Draft {
        var method: PayoutMethodKind = .bankAccount
        var accountName = ""
        var bankName = ""
        var iban = ""
        var accountNumber = ""
        var swiftBic = ""
        var branch = ""
        var instapayAddress = ""
        var walletProvider: WalletProviderKind = .vodafoneCash
        var walletNumber = ""
    }

    func fetch() async throws -> HostPayoutState {
        try await send(method: "GET", body: nil, failure: "Couldn't load your payout method")
    }

    @discardableResult
    func save(_ draft: Draft) async throws -> HostPayoutState {
        let body: [String: Any] = [
            "method": draft.method.rawValue,
            "account_name": draft.accountName,
            "bank_name": draft.bankName,
            "iban": draft.iban,
            "account_number": draft.accountNumber,
            "swift_bic": draft.swiftBic,
            "branch": draft.branch,
            "instapay_address": draft.instapayAddress,
            "wallet_provider": draft.walletProvider.rawValue,
            "wallet_number": draft.walletNumber,
        ]
        return try await send(method: "PUT", body: body, failure: "Couldn't save your payout method")
    }

    func remove() async throws {
        _ = try await send(method: "DELETE", body: nil, failure: "Couldn't remove your payout method")
    }

    // MARK: - Transport

    private func send(method: String, body: [String: Any]?, failure: String) async throws -> HostPayoutState {
        guard let token else { throw PayoutError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/host/payout-method")!
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw PayoutError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw PayoutError.notSignedIn }
        // The server answers 403 `{code:"not_host"}` for a guest. That is not an
        // error to show — the card simply doesn't apply to them.
        if http.statusCode == 403 { throw PayoutError.notHost }
        guard (200...299).contains(http.statusCode) else {
            throw PayoutError.message(Self.decodeError(data) ?? "\(failure) (\(http.statusCode)).")
        }
        // DELETE answers `{removed, payout_method:null}`, which decodes to the
        // same "nothing set" state, so every verb shares one return type.
        return try JSONDecoder().decode(HostPayoutState.self, from: data)
    }

    private static func decodeError(_ data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String }
        return (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
    }
}

/// Errors surfaced to the payout UI.
enum PayoutError: LocalizedError {
    case notSignedIn
    case notHost
    case message(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn:       return "Sign in to continue"
        case .notHost:           return "Only hosts have a payout method."
        case let .message(text): return text
        }
    }
}

// MARK: - View model

/// Loads and stores the signed-in host's payout method. Fails quietly on load:
/// a guest, an offline device or a database that has not run the migration all
/// land on "nothing set", which is the correct thing to show either way.
@MainActor
final class PayoutMethodModel: ObservableObject {
    @Published var saved: HostPayoutMethod?
    @Published var hasLoaded = false
    @Published var isLoading = false
    /// True when the server refused because the account is not a host — the
    /// card hides itself rather than showing an error the user cannot act on.
    @Published var isHidden = false

    func refresh() async {
        isLoading = true
        defer { isLoading = false; hasLoaded = true }
        do {
            let state = try await PayoutService.shared.fetch()
            saved = state.payoutMethod
            isHidden = false
        } catch PayoutError.notHost {
            saved = nil
            isHidden = true
        } catch {
            saved = nil
        }
    }

    /// Clear back to the default so a different account never momentarily shows
    /// the previous one's payout method.
    func reset() {
        saved = nil
        hasLoaded = false
        isHidden = false
    }
}

// MARK: - Profile card

/// "Payment information" on the host's profile: a preview of where QuickIn
/// sends their earnings, and the way in to add or change it.
///
/// Host-only — a guest has no earnings to receive, and the server refuses them
/// anyway, which `isHidden` folds into rendering nothing at all.
struct HostPayoutCard: View {
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var auth: AuthStore
    @StateObject private var model = PayoutMethodModel()
    @State private var showEditor = false

    var body: some View {
        Group {
            if model.isHidden {
                EmptyView()
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    header
                    if let saved = model.saved {
                        preview(saved)
                    } else {
                        emptyState
                    }
                    actionButton
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(18)
                .qkCard(cornerRadius: 18, lifts: false)
            }
        }
        .task { await model.refresh() }
        .onChange(of: auth.user?.id) { _, _ in
            model.reset()
            Task { await model.refresh() }
        }
        .sheet(isPresented: $showEditor) {
            PayoutMethodSheet(existing: model.saved) {
                Task { await model.refresh() }
            }
            .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Pieces

    private var header: some View {
        HStack(spacing: 10) {
            Image(systemName: model.saved?.kind?.icon ?? "banknote.fill")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Color.qkBurgundy)
                .frame(width: 24)
            Text(loc.t("payout.title"))
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.qkInk)
            Spacer(minLength: 8)
            if model.saved != nil {
                HStack(spacing: 5) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 10, weight: .bold))
                    Text(loc.t("payout.badge.added"))
                        .font(.system(size: 11, weight: .bold))
                }
                .foregroundStyle(Color.qkBurgundy)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Color.qkBurgundy.opacity(0.12))
                .clipShape(Capsule())
            }
        }
    }

    private var emptyState: some View {
        Text(loc.t("payout.subtitle.empty"))
            .font(.subheadline)
            .foregroundStyle(Color.qkMuted)
            .fixedSize(horizontal: false, vertical: true)
    }

    /// What is on file, so the host can confirm it went in correctly — which is
    /// the whole reason this section shows anything back at all.
    private func preview(_ saved: HostPayoutMethod) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(saved.kind?.label ?? saved.method)
                .font(.system(size: 11, weight: .bold))
                .tracking(0.6)
                .textCase(.uppercase)
                .foregroundStyle(Color.qkBurgundy)

            Text(saved.display)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Color.qkInk)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 0) {
                previewRow(loc.t("payout.field.accountName"), saved.accountName)
                if saved.kind == .bankAccount {
                    if !saved.bankName.isEmpty {
                        previewRow(loc.t("payout.field.bank"), saved.bankName)
                    }
                    if !saved.ibanFormatted.isEmpty {
                        previewRow(loc.t("payout.field.iban"), saved.ibanFormatted)
                    }
                    if !saved.accountNumber.isEmpty {
                        previewRow(loc.t("payout.field.accountNumber"), saved.accountNumber)
                    }
                    if !saved.swiftBic.isEmpty {
                        previewRow(loc.t("payout.field.swift"), saved.swiftBic)
                    }
                    if !saved.branch.isEmpty {
                        previewRow(loc.t("payout.field.branch"), saved.branch)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.qkTan.opacity(0.45))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func previewRow(_ label: String, _ value: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
            Spacer(minLength: 8)
            Text(value)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.qkInk)
                .multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 7)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Color.qkInk.opacity(0.08))
                .frame(height: 1)
        }
    }

    private var actionButton: some View {
        Button {
            showEditor = true
        } label: {
            HStack(spacing: 8) {
                Image(systemName: model.saved == nil ? "plus.circle.fill" : "pencil")
                    .font(.system(size: 14, weight: .semibold))
                Text(loc.t(model.saved == nil ? "payout.add" : "payout.change"))
                    .font(.system(size: 14, weight: .bold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .foregroundStyle(Color.qkCream)
            .background(LinearGradient.qkBurgundyCTA)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(QKPressStyle())
    }
}

// MARK: - Editor sheet

/// Add or replace the host's payout method. Presented from `HostPayoutCard`.
private struct PayoutMethodSheet: View {
    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    /// The current method, when there is one (drives the prefill + Remove).
    let existing: HostPayoutMethod?
    /// Called after a successful save or removal so the card can re-read.
    let onSaved: () -> Void

    @State private var draft = PayoutService.Draft()
    @State private var isSubmitting = false
    @State private var isRemoving = false
    @State private var errorMessage: String?
    @State private var didPrefill = false

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    intro
                    methodPicker
                    formCard
                    if let errorMessage {
                        errorBanner(errorMessage)
                    }
                    saveButton
                    if existing != nil {
                        removeButton
                    }
                    cancelButton
                }
                .padding(20)
                .padding(.bottom, 12)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .tint(.qkBurgundy)
        .interactiveDismissDisabled(isSubmitting || isRemoving)
        .onAppear(perform: prefill)
    }

    // MARK: - Pieces

    private var intro: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(loc.t("payout.title"))
                .font(.system(.title2, design: .serif).weight(.bold))
                .foregroundStyle(Color.qkInk)
            Text(loc.t("payout.subtitle.empty"))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 8)
    }

    private var methodPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(loc.t("payout.chooseMethod"), systemImage: "banknote.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
            HStack(spacing: 8) {
                ForEach(PayoutMethodKind.allCases) { kind in
                    QKChip(title: kind.label, isSelected: draft.method == kind) {
                        draft.method = kind
                        errorMessage = nil
                    }
                }
                Spacer(minLength: 0)
            }
        }
    }

    private var formCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            field(
                loc.t("payout.field.accountName"),
                systemImage: "person.fill",
                placeholder: loc.t("payout.placeholder.accountName"),
                text: $draft.accountName,
                contentType: .name,
                capitalization: .words
            )

            switch draft.method {
            case .bankAccount:
                Divider()
                field(
                    loc.t("payout.field.bank"),
                    systemImage: "building.columns.fill",
                    placeholder: loc.t("payout.placeholder.bank"),
                    text: $draft.bankName,
                    capitalization: .words
                )
                Divider()
                field(
                    loc.t("payout.field.iban"),
                    systemImage: "number",
                    placeholder: loc.t("payout.placeholder.iban"),
                    text: $draft.iban,
                    capitalization: .characters
                )
                Text(loc.t("payout.bankHint"))
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                Divider()
                field(
                    loc.t("payout.field.accountNumber"),
                    systemImage: "creditcard.fill",
                    placeholder: loc.t("payout.placeholder.accountNumber"),
                    text: $draft.accountNumber,
                    keyboard: .numbersAndPunctuation,
                    capitalization: .characters
                )
                Divider()
                field(
                    loc.t("payout.field.swiftOptional"),
                    systemImage: "globe",
                    placeholder: loc.t("payout.placeholder.swift"),
                    text: $draft.swiftBic,
                    capitalization: .characters
                )
                Divider()
                field(
                    loc.t("payout.field.branchOptional"),
                    systemImage: "mappin.and.ellipse",
                    placeholder: loc.t("payout.placeholder.branch"),
                    text: $draft.branch,
                    capitalization: .words
                )

            case .instapay:
                Divider()
                field(
                    loc.t("payout.field.instapayAddress"),
                    systemImage: "at",
                    placeholder: loc.t("payout.placeholder.instapayAddress"),
                    text: $draft.instapayAddress,
                    keyboard: .emailAddress,
                    capitalization: .never
                )
                Text(loc.t("payout.instapayHint"))
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
                    .fixedSize(horizontal: false, vertical: true)

            case .wallet:
                Divider()
                walletProviderPicker
                Divider()
                field(
                    loc.t("payout.field.walletNumber"),
                    systemImage: "phone.fill",
                    placeholder: loc.t("payout.placeholder.walletNumber"),
                    text: $draft.walletNumber,
                    contentType: .telephoneNumber,
                    keyboard: .phonePad,
                    capitalization: .never
                )
            }
        }
        .padding(18)
        .qkCard(lifts: false)
    }

    private var walletProviderPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(loc.t("payout.field.walletProvider"), systemImage: "wallet.bifold.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
            Picker(loc.t("payout.field.walletProvider"), selection: $draft.walletProvider) {
                ForEach(WalletProviderKind.allCases) { provider in
                    Text(provider.label).tag(provider)
                }
            }
            .pickerStyle(.menu)
            .tint(.qkBurgundy)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 10)
            .frame(height: 48)
            .background(Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.qkInk.opacity(0.1), lineWidth: 1)
            )
        }
    }

    private func field(
        _ label: String,
        systemImage: String,
        placeholder: String,
        text: Binding<String>,
        contentType: UITextContentType? = nil,
        keyboard: UIKeyboardType = .default,
        capitalization: TextInputAutocapitalization = .sentences
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(label, systemImage: systemImage)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
            TextField(placeholder, text: text)
                .textContentType(contentType)
                .keyboardType(keyboard)
                .textInputAutocapitalization(capitalization)
                .disableAutocorrection(true)
                .foregroundStyle(Color.qkInk)
                .padding(.horizontal, 14)
                .frame(height: 48)
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(Color.qkInk.opacity(0.1), lineWidth: 1)
                )
        }
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.qkBurgundy)
            Text(message)
                .font(.footnote)
                .foregroundStyle(Color.qkInk)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.qkBurgundy.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var saveButton: some View {
        Button {
            Task { await save() }
        } label: {
            QKPrimaryButtonLabel(
                title: loc.t(isSubmitting ? "payout.saving" : "payout.save"),
                systemImage: isSubmitting ? nil : "checkmark.circle.fill",
                isLoading: isSubmitting
            )
        }
        .buttonStyle(QKPressStyle())
        .disabled(isSubmitting || isRemoving)
    }

    private var removeButton: some View {
        Button(role: .destructive) {
            Task { await remove() }
        } label: {
            Text(loc.t(isRemoving ? "payout.removing" : "payout.remove"))
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .foregroundStyle(Color.qkBurgundy)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isSubmitting || isRemoving)
    }

    private var cancelButton: some View {
        Button(role: .cancel) {
            dismiss()
        } label: {
            Text(loc.t("common.cancel"))
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .foregroundStyle(Color.qkInk)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isSubmitting || isRemoving)
    }

    // MARK: - Actions

    /// Seed the form from what is already saved. Runs once so a re-appearance
    /// never overwrites typing. The IBAN is seeded in its grouped form — that is
    /// how a host reads it off a statement, and the server strips the spaces.
    private func prefill() {
        guard !didPrefill else { return }
        didPrefill = true
        guard let existing, let kind = existing.kind else { return }
        draft.method = kind
        draft.accountName = existing.accountName
        switch kind {
        case .bankAccount:
            draft.bankName = existing.bankName
            draft.iban = existing.ibanFormatted
            draft.accountNumber = existing.accountNumber
            draft.swiftBic = existing.swiftBic
            draft.branch = existing.branch
        case .instapay:
            draft.instapayAddress = existing.accountRef
        case .wallet:
            draft.walletProvider = WalletProviderKind(rawValue: existing.provider) ?? .other
            draft.walletNumber = existing.accountRef
        }
    }

    private func save() async {
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            try await PayoutService.shared.save(draft)
            onSaved()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func remove() async {
        errorMessage = nil
        isRemoving = true
        defer { isRemoving = false }
        do {
            try await PayoutService.shared.remove()
            onSaved()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
