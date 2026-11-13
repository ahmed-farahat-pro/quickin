import SwiftUI

// The stepped, role-aware first-time signup (2026-11-13). Two entry points:
//   - `AuthView`'s sign-up mode: role cards → Account → Identity →
//     (Refund | Hosting → Payout) → `POST /api/auth/signup` → the OTP screen;
//   - `CompleteAccountView` (a first Google sign-in): the same pages minus
//     Account → `POST /api/local/account/identity`.
// Everything is posted ONCE at the end; the server is the authority and its
// `400 { error, fields }` puts each message back under its field and jumps to
// the earliest page that has one. The step logic is in `SignupRoleRules.swift`.

// MARK: - Model

/// Everything the stepped signup holds. Owned by the screen that hosts the
/// flow, so Back / Next (and the role cards) never lose a value.
@MainActor
final class SignupFlowModel: ObservableObject {
    /// False on the Google completion screen (the account already exists).
    let includeAccount: Bool

    @Published var role: SignupRole = .preselected {
        didSet { if role != oldValue { errors = [:]; generalError = nil } }
    }
    /// nil while the role cards show; otherwise the index into `steps`.
    @Published var stepIndex: Int?

    /// Phone + identity document — the same draft the old one-page form used.
    let identity = IdentityDocumentDraft()

    @Published var hostType: HostType = .individual {
        didSet { if hostType != oldValue { clear("host_type", "company") } }
    }
    @Published var address = "" { didSet { if address != oldValue { clear("address") } } }
    @Published var company = "" { didSet { if company != oldValue { clear("company") } } }
    @Published var notes = "" { didSet { if notes != oldValue { clear("notes") } } }
    @Published var termsAccepted = false { didSet { if termsAccepted != oldValue { clear("terms") } } }
    @Published var payout = PayoutService.Draft()
    @Published var refund = PayoutService.Draft()

    /// Per-key messages for everything but the identity fields (those live on
    /// `identity.errors`, under each input of `IdentityDocumentFields`).
    @Published var errors: [String: String] = [:]
    /// A message with no field to sit under.
    @Published var generalError: String?
    @Published var isSubmitting = false

    init(includeAccount: Bool) {
        self.includeAccount = includeAccount
    }

    var steps: [SignupStep] { SignupRoleRules.steps(for: role, includeAccount: includeAccount) }

    var currentStep: SignupStep? {
        guard let stepIndex, steps.indices.contains(stepIndex) else { return nil }
        return steps[stepIndex]
    }

    var isLastStep: Bool {
        guard let stepIndex else { return false }
        return stepIndex == steps.count - 1
    }

    func clear(_ keys: String...) {
        for key in keys { errors[key] = nil }
    }

    // MARK: Navigation

    func start() {
        generalError = nil
        stepIndex = 0
    }

    func back() {
        generalError = nil
        guard let stepIndex else { return }
        self.stepIndex = stepIndex == 0 ? nil : stepIndex - 1
    }

    /// Local checks for one page. Messages go under the fields; true when the
    /// page may move on. `accountIsValid` is the host screen's own account check.
    func validate(_ step: SignupStep, accountIsValid: () -> Bool) -> Bool {
        generalError = nil
        switch step {
        case .account:
            clear("full_name", "name", "email", "password", "confirm_password")
            guard accountIsValid() else {
                generalError = L.t("signupFlow.error.account")
                return false
            }
            return true
        case .identity:
            return identity.validate(includePhone: true)
        case .hosting:
            clear("host_type", "address", "company", "notes", "terms")
            let problems = SignupRoleRules.hostingProblems(
                hostType: hostType.rawValue,
                address: address,
                company: company,
                notes: notes,
                termsAccepted: termsAccepted
            )
            for (key, messageKey) in problems { errors[key] = L.t(messageKey) }
            return problems.isEmpty
        case .payout:
            errors["payout"] = Self.destination(payout).problemKey.map { L.t($0) }
            return errors["payout"] == nil
        case .refund:
            let dest = Self.destination(refund)
            // Nothing typed is a skip; something typed must be complete.
            errors["refund_method"] = dest.isBlank ? nil : dest.problemKey.map { L.t($0) }
            return errors["refund_method"] == nil
        }
    }

    // MARK: Request

    /// The role half of the request body. `skipRefund` drops a guest's refund
    /// page whatever was typed on it.
    func roleBody(skipRefund: Bool) -> [String: Any] {
        SignupRoleRules.roleBody(
            role: role,
            hostType: hostType.rawValue,
            address: address,
            company: company,
            notes: notes,
            termsAccepted: termsAccepted,
            payout: role == .host ? Self.destination(payout) : nil,
            refund: role == .guest && !skipRefund ? Self.destination(refund) : nil
        )
    }

    /// Put a refusal's messages under their fields and jump to the earliest
    /// page that has one. A message with no page on this walk (or no fields at
    /// all) is shown as `generalError`.
    func applyServerErrors(message: String?, fields: [String: String]) {
        var identityErrors: [IdentityField: String] = [:]
        var other: [String: String] = [:]
        for (key, text) in fields {
            if let field = IdentityField(rawValue: key) { identityErrors[field] = text } else { other[key] = text }
        }
        identity.errors = identityErrors
        errors = other
        if let index = SignupRoleRules.firstStepWithError(keys: fields.keys, role: role, includeAccount: includeAccount) {
            stepIndex = index
            generalError = nil
        } else {
            let fallback = fields.values.sorted().first
            let text = (message ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            generalError = text.isEmpty ? (fallback ?? L.t("signupFlow.error.generic")) : text
        }
    }

    /// The payout editor's draft as the rules' destination. A retired wallet is
    /// never offered, so it can only ever read as a bank account here.
    static func destination(_ draft: PayoutService.Draft) -> SignupRoleRules.Destination {
        SignupRoleRules.Destination(
            method: draft.method == .instapay ? .instapay : .bankAccount,
            accountName: draft.accountName,
            bankName: draft.bankName,
            iban: draft.iban,
            accountNumber: draft.accountNumber,
            swiftBic: draft.swiftBic,
            branch: draft.branch,
            instapayAddress: draft.instapayAddress
        )
    }
}

/// What the host screen's submit closure reports back to the flow.
enum SignupFlowOutcome {
    /// Accepted — the host screen has already moved on (OTP, app).
    case done
    /// `400 { error, fields }` — shown under the fields.
    case invalid(message: String?, fields: [String: String])
    /// Anything else, as one sentence.
    case failed(String)
}

// MARK: - Networking

/// The two requests the stepped signup ends in. Plain URLSession, like
/// `TrustService`; bodies are `[String: Any]` because the payout / refund
/// destination is a nested object.
enum SignupFlowService {
    private static let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 60   // two ID photos ride along
        cfg.waitsForConnectivity = true
        return URLSession(configuration: cfg)
    }()

    enum SignupResult {
        case pending(email: String, devCode: String?)
        case session(AuthSuccess)
        case invalid(message: String?, fields: [String: String])
        case failed(String)
    }

    /// `POST /api/auth/signup` → `{ pending: true, email, role, host_status, devCode? }`.
    static func signup(body: [String: Any], fallbackEmail: String) async -> SignupResult {
        struct Pending: Decodable { let pending: Bool; let email: String?; let devCode: String? }
        switch await send(path: "/api/auth/signup", body: body, token: nil) {
        case .success(let data):
            if let p = try? JSONDecoder().decode(Pending.self, from: data), p.pending {
                return .pending(email: p.email ?? fallbackEmail, devCode: p.devCode)
            }
            // Tolerate a backend that answers with a session directly.
            if let session = try? JSONDecoder().decode(AuthSuccess.self, from: data) {
                return .session(session)
            }
            return .failed("Unexpected response from the server.")
        case .failure(let status, let data):
            let fields = SignupRoleRules.fieldErrors(status: status, data: data)
            if status == 400 || status == 409 || !fields.isEmpty {
                return .invalid(message: errorText(data), fields: fields)
            }
            return .failed(errorText(data) ?? "Signup failed (\(status)).")
        case .transport(let message):
            return .failed(message)
        }
    }

    enum CompleteResult {
        case saved(identity: AccountIdentity, hostStatus: HostStatus, hostType: String?)
        case invalid(message: String?, fields: [String: String])
        case notSignedIn
        case failed(String)
    }

    /// `POST /api/local/account/identity` → identity state + host state.
    static func completeAccount(body: [String: Any]) async -> CompleteResult {
        let raw = UserDefaults.standard.string(forKey: AuthStore.tokenKey)
        guard let token = raw, !token.isEmpty else { return .notSignedIn }
        switch await send(path: "/api/local/account/identity", body: body, token: token) {
        case .success(let data):
            return parseSaved(data)
        case .failure(let status, let data):
            if status == 401 { return .notSignedIn }
            // 409: already complete — the state rides along, same as a save.
            if status == 409 { return parseSaved(data) }
            if status == 400 {
                return .invalid(message: errorText(data), fields: SignupRoleRules.fieldErrors(status: status, data: data))
            }
            return .failed(errorText(data) ?? "Couldn't save your details (\(status)).")
        case .transport(let message):
            return .failed(message)
        }
    }

    private static func parseSaved(_ data: Data) -> CompleteResult {
        let identity = (try? JSONDecoder().decode(AccountIdentity.self, from: data))
            ?? AccountIdentity(required: true, complete: true, status: "pending", note: nil)
        let object = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
        let isHost = (object["is_host"] as? Bool) ?? false
        let status = isHost ? .approved : HostStatus(raw: object["host_status"] as? String)
        return .saved(identity: identity, hostStatus: status, hostType: object["host_type"] as? String)
    }

    private enum Response {
        case success(Data)
        case failure(Int, Data)
        case transport(String)
    }

    private static func send(path: String, body: [String: Any], token: String?) async -> Response {
        guard let url = URL(string: Config.apiBaseURL + path) else { return .transport("Invalid server URL.") }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { return .transport("Invalid response from the server.") }
            return (200...299).contains(http.statusCode) ? .success(data) : .failure(http.statusCode, data)
        } catch {
            return .transport(error.localizedDescription)
        }
    }

    private static func errorText(_ data: Data) -> String? {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let text = (object["error"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty else { return nil }
        return text
    }
}

// MARK: - View

/// The role cards, then one page at a time with a step indicator and Back /
/// Next. Sits inside the host screen's ScrollView. `account` is the host
/// screen's own Account page (AuthView's name / email / password fields);
/// `submit` receives the whole body minus the account fields.
struct SignupFlowView<Account: View>: View {
    @EnvironmentObject private var loc: LocalizationManager
    @ObservedObject var model: SignupFlowModel
    /// The final page's button title ("Create account", "Continue", …).
    let submitTitle: String
    /// The Account page's own check (arms its inline hints). Unused without one.
    let accountIsValid: () -> Bool
    let account: () -> Account
    /// Identity + role fields, already encoded. Account fields are the caller's.
    let submit: ([String: Any]) async -> SignupFlowOutcome

    init(
        model: SignupFlowModel,
        submitTitle: String,
        accountIsValid: @escaping () -> Bool = { true },
        @ViewBuilder account: @escaping () -> Account,
        submit: @escaping ([String: Any]) async -> SignupFlowOutcome
    ) {
        self.model = model
        self.submitTitle = submitTitle
        self.accountIsValid = accountIsValid
        self.account = account
        self.submit = submit
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            if let step = model.currentStep, let index = model.stepIndex {
                stepHeader(step: step, index: index)
                page(step)
                if let message = model.generalError {
                    errorBanner(message)
                }
                navigation(step: step)
            } else {
                roleCards
            }
        }
        .animation(.easeInOut(duration: 0.2), value: model.stepIndex)
        .animation(.easeInOut(duration: 0.2), value: model.role)
    }

    // MARK: Role cards

    private var roleCards: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(loc.t("signupFlow.role.title"))
                    .font(.system(.title3, design: .serif).weight(.bold))
                    .foregroundStyle(Color.qkInk)
                Text(loc.t("signupFlow.role.subtitle"))
                    .font(.subheadline)
                    .foregroundStyle(Color.qkMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            roleCard(.guest, icon: "suitcase.rolling.fill")
            roleCard(.host, icon: "house.fill")
            Button {
                model.start()
            } label: {
                QKPrimaryButtonLabel(title: loc.t("signupFlow.next"), systemImage: "arrow.right")
            }
            .buttonStyle(QKPressStyle())
            .padding(.top, 4)
        }
    }

    private func roleCard(_ role: SignupRole, icon: String) -> some View {
        let selected = model.role == role
        return Button {
            model.role = role
        } label: {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: icon)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(selected ? Color.qkCream : Color.qkBurgundy)
                    .frame(width: 46, height: 46)
                    .background(selected ? Color.qkBurgundy : Color.qkTan)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 4) {
                    Text(loc.t("signupFlow.role.\(role.rawValue)"))
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(Color.qkInk)
                    Text(loc.t("signupFlow.role.\(role.rawValue).body"))
                        .font(.subheadline)
                        .foregroundStyle(Color.qkMuted)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(selected ? Color.qkBurgundy : Color.qkInk.opacity(0.25))
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.qkSurface)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(selected ? Color.qkBurgundy : Color.qkInk.opacity(0.1), lineWidth: selected ? 2 : 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(QKPressStyle())
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }

    // MARK: Step header

    private func stepHeader(step: SignupStep, index: Int) -> some View {
        let (current, total) = SignupRoleRules.indicator(index: index, role: model.role, includeAccount: model.includeAccount)
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(String(format: loc.t("signupFlow.stepOf"), "\(current)", "\(total)"))
                    .font(.caption.weight(.bold))
                    .tracking(0.5)
                    .textCase(.uppercase)
                    .foregroundStyle(Color.qkBurgundy)
                Spacer()
                Text(loc.t("signupFlow.role.\(model.role.rawValue)"))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.qkMuted)
            }
            HStack(spacing: 6) {
                ForEach(0..<total, id: \.self) { i in
                    Capsule()
                        .fill(i < current ? Color.qkBurgundy : Color.qkInk.opacity(0.12))
                        .frame(height: 5)
                }
            }
            .accessibilityHidden(true)
            Text(loc.t(step.titleKey))
                .font(.system(.title3, design: .serif).weight(.bold))
                .foregroundStyle(Color.qkInk)
                .padding(.top, 2)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: Pages

    @ViewBuilder
    private func page(_ step: SignupStep) -> some View {
        switch step {
        case .account:
            VStack(alignment: .leading, spacing: 14) {
                account()
                ForEach(["full_name", "name", "email", "password", "confirm_password"], id: \.self) { key in
                    errorText(model.errors[key])
                }
            }
        case .identity:
            VStack(alignment: .leading, spacing: 14) {
                Text(loc.t("signupId.section.intro"))
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                IdentityDocumentFields(draft: model.identity, showPhone: true, disabled: model.isSubmitting)
            }
            .padding(18)
            .qkCard(lifts: false)
        case .hosting:
            hostingPage
                .padding(18)
                .qkCard(lifts: false)
        case .payout:
            destinationPage(draft: $model.payout, intro: "hostApply.payout.intro", errorKey: "payout")
        case .refund:
            destinationPage(draft: $model.refund, intro: "signupFlow.refund.intro", errorKey: "refund_method")
        }
    }

    private var hostingPage: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(loc.t("signupFlow.hosting.intro"))
                .font(.caption)
                .foregroundStyle(Color.qkMuted)
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 6) {
                fieldLabel(loc.t("hostApply.type"))
                Picker(loc.t("hostApply.type"), selection: $model.hostType) {
                    ForEach(HostType.allCases) { type in
                        Text(type.label).tag(type)
                    }
                }
                .pickerStyle(.segmented)
                errorText(model.errors["host_type"])
            }

            textInput(
                loc.t("hostApply.address"),
                placeholder: loc.t("hostApply.address.placeholder"),
                text: $model.address,
                systemImage: "mappin.and.ellipse",
                contentType: .fullStreetAddress,
                error: model.errors["address"]
            )

            if model.hostType.isBusiness {
                textInput(
                    loc.t(model.hostType == .brokerage ? "hostApply.brokerage" : "hostApply.company")
                        + " " + loc.t("signupFlow.optional"),
                    placeholder: loc.t("hostApply.company.placeholder"),
                    text: $model.company,
                    systemImage: "building.2",
                    contentType: .organizationName,
                    error: model.errors["company"]
                )
                .transition(.opacity)
            }

            textInput(
                loc.t("hostApply.notes"),
                placeholder: loc.t("hostApply.notes.placeholder"),
                text: $model.notes,
                systemImage: "text.alignleft",
                axis: .vertical,
                error: model.errors["notes"]
            )

            VStack(alignment: .leading, spacing: 6) {
                Button {
                    model.termsAccepted.toggle()
                } label: {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: model.termsAccepted ? "checkmark.square.fill" : "square")
                            .font(.system(size: 20))
                            .foregroundStyle(model.termsAccepted || model.errors["terms"] == nil
                                             ? Color.qkBurgundy : Color.qkBurgundy.opacity(0.8))
                        Text(loc.t("hostApply.terms.accept"))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.qkInk)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(model.termsAccepted ? [.isSelected] : [])
                if let url = HostApplicationRules.termsURL(webBase: AppLinks.webBase) {
                    Link(loc.t("hostApply.terms.read"), destination: url)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.qkBurgundy)
                        .padding(.leading, 30)
                }
                errorText(model.errors["terms"])
            }
        }
        .disabled(model.isSubmitting)
        .animation(.easeInOut(duration: 0.2), value: model.hostType)
    }

    private func destinationPage(draft: Binding<PayoutService.Draft>, intro: String, errorKey: String) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(loc.t(intro))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .fixedSize(horizontal: false, vertical: true)
            PayoutDraftForm(draft: draft, carded: false) { model.errors[errorKey] = nil }
                .padding(18)
                .qkCard(lifts: false)
                .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .strokeBorder(model.errors[errorKey] == nil ? .clear : Color.qkBurgundy.opacity(0.55), lineWidth: 1.5)
                )
            errorText(model.errors[errorKey])
        }
        .disabled(model.isSubmitting)
        .onChange(of: draft.wrappedValue.accountName) { _, _ in model.errors[errorKey] = nil }
        .onChange(of: draft.wrappedValue.iban) { _, _ in model.errors[errorKey] = nil }
        .onChange(of: draft.wrappedValue.accountNumber) { _, _ in model.errors[errorKey] = nil }
        .onChange(of: draft.wrappedValue.instapayAddress) { _, _ in model.errors[errorKey] = nil }
    }

    // MARK: Navigation

    private func navigation(step: SignupStep) -> some View {
        VStack(spacing: 10) {
            HStack(spacing: 12) {
                Button {
                    model.back()
                } label: {
                    Label(loc.t("signupFlow.back"), systemImage: "chevron.left")
                        .font(.system(size: 16, weight: .semibold))
                        .frame(height: 52)
                        .padding(.horizontal, 18)
                        .foregroundStyle(Color.qkBurgundy)
                        .background(Color.qkSurface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(Color.qkBurgundy.opacity(0.35), lineWidth: 1.5)
                        )
                }
                .buttonStyle(QKPressStyle())
                .disabled(model.isSubmitting)

                Button {
                    Task { await advance(from: step, skipRefund: false) }
                } label: {
                    QKPrimaryButtonLabel(
                        title: model.isLastStep ? submitTitle : loc.t("signupFlow.next"),
                        systemImage: model.isLastStep ? nil : "arrow.right",
                        isLoading: model.isSubmitting
                    )
                }
                .buttonStyle(QKPressStyle())
                .disabled(model.isSubmitting)
            }
            if step.isSkippable {
                Button {
                    Task { await advance(from: step, skipRefund: true) }
                } label: {
                    Text(loc.t("signupFlow.skip"))
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .foregroundStyle(Color.qkInk)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(model.isSubmitting)
            }
        }
    }

    private func advance(from step: SignupStep, skipRefund: Bool) async {
        if skipRefund {
            model.errors["refund_method"] = nil
        } else {
            guard model.validate(step, accountIsValid: accountIsValid) else { return }
        }
        guard model.isLastStep, let stepIndex = model.stepIndex else {
            if let stepIndex = model.stepIndex { model.stepIndex = stepIndex + 1 }
            return
        }
        // Last page: re-check every earlier page (a value could have been
        // cleared since), landing on the first that fails.
        for (i, earlier) in model.steps.enumerated() where i < stepIndex {
            if !model.validate(earlier, accountIsValid: accountIsValid) {
                model.stepIndex = i
                return
            }
        }
        guard let identity = model.identity.makePayload() else {
            model.generalError = loc.t("trust.uploadError")
            return
        }
        var body: [String: Any] = identity.body
        body.merge(model.roleBody(skipRefund: skipRefund)) { _, new in new }

        model.isSubmitting = true
        let outcome = await submit(body)
        model.isSubmitting = false
        switch outcome {
        case .done:
            break
        case .invalid(let message, let fields):
            model.applyServerErrors(message: message, fields: fields)
        case .failed(let message):
            model.generalError = message.isEmpty ? loc.t("signupFlow.error.generic") : message
        }
    }

    // MARK: Pieces

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption).fontWeight(.semibold)
            .foregroundStyle(Color.qkMuted)
    }

    @ViewBuilder
    private func errorText(_ message: String?) -> some View {
        if let message {
            Text(message)
                .font(.caption)
                .foregroundStyle(Color.qkBurgundy)
                .fixedSize(horizontal: false, vertical: true)
                .transition(.opacity)
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

    private func textInput(
        _ title: String,
        placeholder: String,
        text: Binding<String>,
        systemImage: String,
        contentType: UITextContentType? = nil,
        axis: Axis = .horizontal,
        error: String?
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            fieldLabel(title)
            HStack(alignment: axis == .vertical ? .top : .center, spacing: 10) {
                Image(systemName: systemImage)
                    .foregroundStyle(error == nil ? Color.qkMuted : Color.qkBurgundy)
                    .frame(width: 18)
                TextField(placeholder, text: text, axis: axis)
                    .lineLimit(axis == .vertical ? 3...6 : 1...1)
                    .textContentType(contentType)
                    .textInputAutocapitalization(.sentences)
                    .foregroundStyle(Color.qkInk)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(
                        error == nil ? Color.qkInk.opacity(0.1) : Color.qkBurgundy.opacity(0.55),
                        lineWidth: error == nil ? 1 : 1.5
                    )
            )
            errorText(error)
        }
        .animation(.easeInOut(duration: 0.2), value: error)
    }
}

extension SignupFlowView where Account == EmptyView {
    /// No Account page — the Google "Complete your account" screen.
    init(
        model: SignupFlowModel,
        submitTitle: String,
        submit: @escaping ([String: Any]) async -> SignupFlowOutcome
    ) {
        self.init(model: model, submitTitle: submitTitle, accountIsValid: { true }, account: { EmptyView() }, submit: submit)
    }
}
