import SwiftUI
import PhotosUI
import UIKit

/// The payment sheet for QuickIn — a **manual transfer** flow that mirrors the
/// website and the Android app. There is no card gateway (Paymob was removed): the
/// guest sends the booking amount to one of QuickIn's accounts, uploads a
/// screenshot of the transfer, and it is confirmed after being checked.
///
/// There are two destinations — **Instapay** and a **bank account** — each with its
/// own admin toggle. Which of them appear comes from `availableMethods` on the
/// config, never from a list hardcoded here; the picker is hidden entirely when
/// only one is offered, because a single-option choice is not a choice.
///
/// Lifecycle:
///   • **form** — the amount to transfer, the method picker, the chosen destination
///     (from `GET /api/local/payment-config`), a transfer-screenshot picker, and an
///     "I've paid — submit screenshot" CTA.
///   • **submitting** — the CTA spins while the screenshot uploads via
///     `POST /api/local/bookings/:id/payment-proof { image, method }` — `method`
///     being the destination the guest picked, so the reviewer knows which account
///     to check.
///   • **submitted** — an "Awaiting host approval" confirmation; Done calls `onDone`
///     and dismisses (the caller reloads the reservation).
///
/// All copy is localized (en + ar + fr + es) and leading/trailing based, so it
/// mirrors correctly under RTL.
struct PaymentSheet: View {
    /// The booking to pay for (target of `payment-proof`).
    let bookingID: String
    /// Whole nights in the stay — for the "for N nights" caption.
    let nights: Int
    /// The booking total in EGP the guest should transfer (shown as the amount).
    let total: Int

    /// Called once the guest has submitted their transfer screenshot (the booking is
    /// now awaiting the host's approval). The caller dismisses + reloads the booking.
    var onDone: () -> Void

    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    private enum Phase: Equatable { case form, submitting, submitted }
    @State private var phase: Phase = .form

    // MARK: - Transfer destination (Instapay handle + instructions)

    @State private var config: PaymentConfig?
    @State private var isLoadingConfig = false
    @State private var configFailed = false
    /// The destination the guest tapped. `nil` until they choose, so `method`
    /// below can fall back to whatever the server offers first — that way
    /// "the admin switched Instapay off" needs no special case here.
    @State private var pickedMethod: PaymentMethod?
    /// The QR to show: the admin's uploaded image, or one drawn from `qrPayload`.
    /// Resolved once in `loadConfig()` so the body never regenerates it.
    @State private var qrImage: UIImage?

    // MARK: - Picked screenshot

    @State private var pickerItem: PhotosPickerItem?
    @State private var screenshot: UIImage?
    /// True while the picked photo is being decoded off the main thread.
    @State private var isEncoding = false

    @State private var errorMessage: String?
    /// Which value was last copied, so only that row's button says "Copied".
    @State private var copiedField: String?

    /// The signed-in bearer token drives whether we can load the config / submit.
    private var isSignedIn: Bool { BookingService.shared.token != nil }

    /// The Instapay handle (trimmed), or empty when unset by the host/admin.
    private var handle: String {
        config?.handle.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }
    /// The host's transfer instructions (trimmed), or empty.
    private var instructions: String {
        config?.instructions.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }
    /// The admin's Instapay deep link, when they set a well-formed http(s) one.
    private var linkURL: URL? { config?.linkURL }
    /// True once there is somewhere to send money by any method.
    private var isConfigured: Bool { config?.isConfigured ?? false }
    /// What the server offers, in its order.
    private var methods: [PaymentMethod] { config?.availableMethods ?? [] }
    /// The destination on screen: the guest's pick when it is still on offer,
    /// otherwise the first one the server lists.
    private var method: PaymentMethod? {
        if let pickedMethod, methods.contains(pickedMethod) { return pickedMethod }
        return methods.first
    }
    /// The bank destination (empty when the server never sent one).
    private var bank: BankTransferConfig { config?.bank ?? .empty }
    /// Pluralized "night" / "nights".
    private var nightsWord: String {
        loc.t(nights == 1 ? "common.night" : "common.nights")
    }

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 20) {
                    switch phase {
                    case .form, .submitting:
                        formContent
                    case .submitted:
                        submittedContent
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 22)
                .padding(.bottom, 32)
                .frame(maxWidth: .infinity)
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(phase == .submitting)
        .task { await loadConfig() }
        .onChange(of: pickerItem) { _, item in
            Task { await loadPicked(item) }
        }
    }

    // MARK: - Form (pre-submission)

    private var formContent: some View {
        VStack(spacing: 20) {
            header

            if isSignedIn {
                amountCard
                destinationCard
                screenshotCard

                if let errorMessage {
                    errorLine(errorMessage)
                }

                submitButton
                secureNote
            } else {
                errorLine(loc.t("instapay.signIn"))
            }
        }
    }

    /// "Payment" title + the Instapay subtitle.
    private var header: some View {
        VStack(spacing: 6) {
            Text(loc.t("pay.title"))
                .font(.system(.title2, design: .serif).weight(.bold))
                .foregroundStyle(Color.qkInk)
            Text(loc.t("payMethods.subtitle"))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    /// The amount the guest should transfer, prominently.
    private var amountCard: some View {
        VStack(spacing: 4) {
            Text(loc.t("instapay.amountToSend"))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
            Text("EGP \(total)")
                .font(.system(size: 30, weight: .heavy))
                .foregroundStyle(Color.qkBurgundy)
            Text(String(format: loc.t("instapay.forNights"), "\(nights)", nightsWord))
                .font(.footnote)
                .foregroundStyle(Color.qkMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 18)
        .padding(.horizontal, 16)
        .qkCard()
    }

    /// Transfer destination: the method picker (only when there is a real choice)
    /// and the details for whichever one is selected.
    private var destinationCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            if methods.count > 1 {
                methodPicker
                Divider()
            }

            Text(loc.t("instapay.sendTo"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.qkInk)
                .frame(maxWidth: .infinity, alignment: .leading)

            if isLoadingConfig || (config == nil && !configFailed) {
                HStack(spacing: 10) {
                    ProgressView().tint(.qkBurgundy)
                    Text(loc.t("instapay.loading"))
                        .font(.subheadline)
                        .foregroundStyle(Color.qkMuted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else if configFailed {
                errorLine(loc.t("instapay.loadError"))
            } else if !isConfigured {
                Text(loc.t("instapay.noHandle"))
                    .font(.subheadline)
                    .foregroundStyle(Color.qkInk)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else if method == .bankTransfer {
                bankDestination
            } else {
                instapayDestination
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .qkCard()
    }

    /// Segmented pills, one per offered method. Rendered from the server's list,
    /// so a method the admin switched off simply isn't here.
    private var methodPicker: some View {
        HStack(spacing: 8) {
            ForEach(methods, id: \.self) { m in
                let on = m == method
                Button {
                    withAnimation(QKAnim.swap) { pickedMethod = m }
                } label: {
                    Text(loc.t(m.titleKey))
                        .font(.system(size: 14, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 42)
                        .background(on ? Color.qkBurgundy : Color.qkSurface)
                        .foregroundStyle(on ? Color.qkCream : Color.qkInk)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .strokeBorder(on ? Color.clear : Color.qkTan, lineWidth: 1)
                        )
                }
                .buttonStyle(QKPressStyle())
                .accessibilityAddTraits(on ? [.isSelected, .isButton] : .isButton)
            }
        }
        .frame(maxWidth: .infinity)
    }

    /// The Instapay destination: QR, the handle (copyable), the deep link.
    @ViewBuilder
    private var instapayDestination: some View {
        if let qrImage {
            qrBlock(qrImage)
        }
        // A link-only destination is valid, so the handle row is conditional.
        if !handle.isEmpty {
            HStack(spacing: 10) {
                Text(handle)
                    .font(.system(.body, design: .monospaced).weight(.bold))
                    .foregroundStyle(Color.qkInk)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                copyButton(handle, field: "handle")
            }
        }
        if let linkURL {
            openInstapayButton(linkURL)
        }
        if !instructions.isEmpty {
            Divider()
            Text(instructions)
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// The bank destination: the four fields a guest types into their banking app.
    /// Nothing is masked — a masked account number is one nobody can send money to.
    @ViewBuilder
    private var bankDestination: some View {
        bankRow(loc.t("payMethods.bankName"), value: bank.bankName)
        bankRow(loc.t("payMethods.accountName"), value: bank.accountName)
        bankRow(loc.t("payMethods.accountNumber"), value: bank.accountNumber,
                mono: true, copy: bank.accountNumber, field: "account")
        // Shown in groups of four the way a bank prints one, but copied compact —
        // that is the form a banking app's field wants.
        bankRow(loc.t("payMethods.iban"), value: bank.ibanFormatted,
                mono: true, copy: bank.iban, field: "iban")
        if !bank.instructions.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            Divider()
            Text(bank.instructions)
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// One "label / value / Copy" line. Renders nothing for an empty value, so the
    /// optional IBAN simply doesn't appear when the admin left it blank.
    @ViewBuilder
    private func bankRow(
        _ label: String,
        value: String,
        mono: Bool = false,
        copy: String? = nil,
        field: String? = nil
    ) -> some View {
        if !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            VStack(alignment: .leading, spacing: 3) {
                Text(label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.qkMuted)
                HStack(spacing: 10) {
                    Text(value)
                        .font(mono ? .system(.callout, design: .monospaced).weight(.bold)
                                   : .callout.weight(.semibold))
                        .foregroundStyle(Color.qkInk)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if let copy, let field, !copy.isEmpty {
                        copyButton(copy, field: field)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// The scannable QR: the admin's uploaded image when there is one, otherwise
    /// the one drawn from `qr_payload` (the link if set, else the handle).
    private func qrBlock(_ image: UIImage) -> some View {
        VStack(spacing: 8) {
            Image(uiImage: image)
                .resizable()
                .interpolation(.none)          // keep the modules square, never blurred
                .scaledToFit()
                .frame(width: 148, height: 148)
                .padding(8)
                .background(Color.white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(Color.qkTan, lineWidth: 1)
                )
            Text(loc.t("instapay.scanHint"))
                .font(.caption)
                .foregroundStyle(Color.qkMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    /// Hands the deep link to the system so Instapay opens when it claims the
    /// domain (universal link), falling back to Safari when it doesn't. Nothing
    /// reports back — the guest still uploads a screenshot afterwards.
    private func openInstapayButton(_ url: URL) -> some View {
        Link(destination: url) {
            Label(loc.t("instapay.openInstapay"), systemImage: "arrow.up.forward.app")
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .frame(height: 46)
                .background(LinearGradient.qkBurgundyCTA)
                .foregroundStyle(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    /// A Copy button beside one value — copies to the pasteboard and briefly flips
    /// its own label to "Copied". `field` scopes that to this row, so copying the
    /// IBAN doesn't make the account number claim to have been copied too.
    private func copyButton(_ value: String, field: String) -> some View {
        let done = copiedField == field
        return Button {
            UIPasteboard.general.string = value
            withAnimation(QKAnim.swap) { copiedField = field }
            Task {
                try? await Task.sleep(nanoseconds: 1_600_000_000)
                await MainActor.run {
                    withAnimation(QKAnim.swap) {
                        if copiedField == field { copiedField = nil }
                    }
                }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: done ? "checkmark" : "doc.on.doc")
                    .font(.system(size: 13, weight: .semibold))
                Text(loc.t(done ? "instapay.copied" : "instapay.copy"))
                    .font(.system(size: 14, weight: .bold))
            }
            .foregroundStyle(Color.qkBurgundy)
            .padding(.horizontal, 14)
            .frame(height: 40)
            .background(Color.qkTan)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(QKPressStyle())
        .accessibilityLabel(loc.t("instapay.copy"))
    }

    /// The transfer-screenshot picker: a tappable tile showing the picked image (or
    /// a prompt), with a change button once one is chosen.
    private var screenshotCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            PhotosPicker(selection: $pickerItem, matching: .images, photoLibrary: .shared()) {
                ZStack {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color.qkSurface)
                        .frame(height: 168)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .strokeBorder(screenshot != nil ? Color.qkGoldDeep : Color.qkInk.opacity(0.12),
                                              lineWidth: 1)
                        )
                    if let screenshot {
                        Image(uiImage: screenshot)
                            .resizable()
                            .scaledToFill()
                            .frame(height: 168)
                            .frame(maxWidth: .infinity)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        if isEncoding {
                            ZStack {
                                Color.black.opacity(0.25)
                                ProgressView().tint(.white)
                            }
                            .frame(height: 168)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                    } else {
                        VStack(spacing: 8) {
                            Image(systemName: "photo.badge.plus")
                                .font(.system(size: 26, weight: .light))
                                .foregroundStyle(Color.qkBurgundy)
                            Text(loc.t("instapay.addScreenshot"))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color.qkInk)
                        }
                    }
                }
            }
            .buttonStyle(.plain)
            .disabled(phase == .submitting)
            .accessibilityLabel(loc.t(screenshot == nil ? "instapay.addScreenshot" : "instapay.changeScreenshot"))

            if screenshot != nil {
                Text(loc.t("instapay.changeScreenshot"))
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        }
    }

    /// "I've paid — submit screenshot" CTA; spins while the upload is in flight.
    private var submitButton: some View {
        Button {
            Task { await submitProof() }
        } label: {
            QKPrimaryButtonLabel(
                title: phase == .submitting ? loc.t("instapay.submitting") : loc.t("instapay.submit"),
                systemImage: phase == .submitting ? nil : "checkmark.seal.fill",
                isLoading: phase == .submitting
            )
        }
        .buttonStyle(QKPressStyle())
        // Require a loaded, offered destination too — don't let the guest "submit a
        // transfer" when the config never loaded, or when the admin has switched
        // every method off. `method` is nil in exactly those cases.
        .disabled(phase == .submitting || screenshot == nil || isEncoding || method == nil)
        .opacity((screenshot == nil || isEncoding || method == nil) ? 0.6 : 1)
    }

    /// A reassuring "confirmed after the host verifies your transfer" banner.
    private var secureNote: some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark.shield.fill")
                .font(.system(size: 16))
                .foregroundStyle(Color.qkGoldDeep)
            Text(loc.t("instapay.note"))
                .font(.footnote.weight(.medium))
                .foregroundStyle(Color.qkInk)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity)
        .background(Color.qkTan.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    /// A leading-aligned burgundy error/info line.
    private func errorLine(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.qkBurgundy)
            Text(text)
                .font(.footnote)
                .foregroundStyle(Color.qkInk)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Submitted (awaiting host approval)

    private var submittedContent: some View {
        VStack(spacing: 18) {
            ZStack {
                Circle()
                    .fill(Color.qkGoldDeep.opacity(0.14))
                    .frame(width: 84, height: 84)
                Image(systemName: "hourglass")
                    .font(.system(size: 38, weight: .semibold))
                    .foregroundStyle(Color.qkGoldDeep)
            }
            .padding(.top, 8)

            VStack(spacing: 6) {
                Text(loc.t("pay.awaitingApproval.title"))
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Color.qkInk)
                    .multilineTextAlignment(.center)
                Text(loc.t("instapay.awaitingBody"))
                    .font(.subheadline)
                    .foregroundStyle(Color.qkMuted)
                    .multilineTextAlignment(.center)
            }

            Button {
                onDone()
                dismiss()
            } label: {
                QKPrimaryButtonLabel(title: loc.t("common.done"), height: 50)
            }
            .buttonStyle(QKPressStyle())
        }
    }

    // MARK: - Actions

    /// Load the Instapay transfer destination once the sheet appears.
    @MainActor
    private func loadConfig() async {
        guard isSignedIn, config == nil else { return }
        isLoadingConfig = true
        configFailed = false
        defer { isLoadingConfig = false }
        do {
            let loaded = try await BookingService.shared.getPaymentConfig()
            config = loaded
            // Resolve the QR once, here, rather than on every body pass: prefer the
            // admin's uploaded image, else draw one from the payload with CoreImage.
            qrImage = Self.decodeDataURL(loaded.qrImage)
                ?? (loaded.qrPayload.isEmpty ? nil : QRCodeGenerator.image(from: loaded.qrPayload))
        } catch {
            configFailed = true
        }
    }

    /// Decode an inline `data:image/…;base64,…` URL (the World-1 image convention)
    /// into a `UIImage`. Returns `nil` for an empty or malformed value.
    private static func decodeDataURL(_ s: String) -> UIImage? {
        let trimmed = s.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.hasPrefix("data:image/"),
              let comma = trimmed.firstIndex(of: ","),
              let data = Data(base64Encoded: String(trimmed[trimmed.index(after: comma)...]),
                              options: .ignoreUnknownCharacters)
        else { return nil }
        return UIImage(data: data)
    }

    /// Decode the picked photo into a `UIImage` off the main thread.
    @MainActor
    private func loadPicked(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        errorMessage = nil
        isEncoding = true
        defer { isEncoding = false }
        do {
            if let data = try await item.loadTransferable(type: Data.self),
               let image = UIImage(data: data) {
                screenshot = image
            } else {
                errorMessage = loc.t("instapay.uploadError")
            }
        } catch {
            errorMessage = loc.t("instapay.uploadError")
        }
    }

    /// Encode the screenshot to a data URL and POST it as proof of payment. On
    /// success switch to the "awaiting approval" confirmation.
    @MainActor
    private func submitProof() async {
        guard let image = screenshot else {
            errorMessage = loc.t("instapay.missingScreenshot")
            return
        }
        // The button is disabled without one, so this is belt-and-braces — but it
        // keeps the method out of the request rather than guessing "instapay".
        guard let method else {
            errorMessage = loc.t("instapay.noHandle")
            return
        }
        guard let dataURL = QKAvatarImage.makeDataURL(from: image, maxDimension: 1600, quality: 0.7) else {
            errorMessage = loc.t("instapay.uploadError")
            return
        }
        errorMessage = nil
        phase = .submitting
        do {
            _ = try await BookingService.shared.submitPaymentProof(
                bookingId: bookingID,
                imageDataURL: dataURL,
                method: method
            )
            withAnimation(QKAnim.swap) { phase = .submitted }
        } catch BookingError.notSignedIn {
            phase = .form
            errorMessage = loc.t("instapay.signIn")
        } catch {
            phase = .form
            errorMessage = error.localizedDescription
        }
    }
}
