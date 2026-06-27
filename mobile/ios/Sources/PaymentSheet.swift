import SwiftUI

/// The payment sheet for QuickIn, backed by **Paymob hosted checkout**.
///
/// The price breakdown here is purely informational — card details are entered
/// on Paymob's hosted page inside an in-app WebView (`PaymobCheckoutView`),
/// never collected in our own UI. Tapping Pay calls
/// `BookingService.payInit(bookingId:)` to open a checkout session, presents the
/// WebView, and — once it returns — polls the booking for the webhook-set paid
/// state.
///
/// Lifecycle:
///   • **form** — boutique amount breakdown (subtotal · service fee · total),
///     a "secured by Paymob" note, and a burgundy "Pay {amount} {currency}" CTA.
///   • **paying** — the CTA shows a spinner while `pay-init` runs / the WebView
///     is presented; afterwards a small spinner shows while we poll for paid.
///   • **paid** — a drawn checkmark + "Booking confirmed & paid" + the Paymob
///     reference, then a "Continue" button that calls `onPaid` and dismisses
///     (the caller reloads the reservation). If polling times out, the form
///     shows a "payment is processing" hint instead.
///
/// All copy is localized (en + ar + fr + es) and the layout is leading/trailing
/// based, so it mirrors correctly under RTL.
struct PaymentSheet: View {
    /// The booking to pay for.
    let bookingID: String
    /// Per-night price in EGP (whole units), for the "EGP X × N nights" line.
    let nightly: Int
    /// Whole nights in the stay.
    let nights: Int

    /// Called once the booking is successfully paid + confirmed, passing the
    /// server receipt. The caller dismisses the sheet and routes onward.
    var onPaid: (PaymentReceipt) -> Void

    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    private enum Phase: Equatable { case form, paying, paid }
    @State private var phase: Phase = .form
    @State private var receipt: PaymentReceipt?
    @State private var errorMessage: String?

    // MARK: - Paymob hosted-checkout state

    /// The active Paymob session from `pay-init`; presenting it drives the
    /// in-app WebView (`PaymobCheckoutView`).
    @State private var paymobInit: PaymobInit?
    /// Drives the full-screen checkout cover.
    @State private var showingCheckout = false
    /// True while polling the booking for the webhook-set paid state after the
    /// WebView closes.
    @State private var isPolling = false
    /// Set when polling times out without a paid flip → show the "processing" copy.
    @State private var processingMessage: String?
    /// An error to surface in an alert (e.g. 503 payment unavailable).
    @State private var alertMessage: String?

    /// The payment method the guest picks. `card` adds a +5% surcharge;
    /// `bankTransfer` applies a −5% discount. Defaults to card.
    private enum PayMethod: String, CaseIterable, Identifiable {
        case card
        case bankTransfer = "bank_transfer"
        var id: String { rawValue }
    }
    @State private var method: PayMethod = .card

    // MARK: - Promo code state

    /// The promo code the guest typed (passed to pay when an applied quote exists).
    @State private var promoCode = ""
    /// The validated quote for the applied code. `valid == true` → discount lands.
    @State private var promoQuote: PromoQuote?
    /// True while POSTing to `/promo/validate`.
    @State private var isCheckingPromo = false
    /// Inline message under the promo field (server message or a local error).
    @State private var promoMessage: String?

    /// The applied promo discount in EGP (0 unless a valid quote is applied).
    private var promoDiscount: Int {
        guard let q = promoQuote, q.valid else { return 0 }
        return max(0, q.discount)
    }
    /// The trimmed code to send to pay, or nil when no valid quote is applied.
    private var appliedPromoCode: String? {
        guard let q = promoQuote, q.valid else { return nil }
        let raw = (q.code ?? promoCode).trimmingCharacters(in: .whitespacesAndNewlines)
        return raw.isEmpty ? nil : raw
    }

    // MARK: - Computed amounts (preview before the server receipt arrives)

    /// Subtotal = nightly × nights (whole EGP).
    private var subtotal: Int { nightly * max(nights, 1) }
    /// Flat 10% service fee, rounded to whole EGP (matches the backend).
    private var serviceFee: Int { Int((Double(subtotal) * 0.10).rounded()) }
    /// Signed method adjustment in EGP: +5% of the subtotal for card, −5% for
    /// bank transfer (matches the backend's `methodFee`).
    private var methodFee: Int {
        let rate = method == .card ? 0.05 : -0.05
        return Int((Double(subtotal) * rate).rounded())
    }
    /// Magnitude of the method adjustment (for the signed display line).
    private var methodFeeMagnitude: Int { abs(methodFee) }
    /// Grand total in EGP (subtotal + service fee + signed method fee − promo),
    /// floored at 0. The backend computes the authoritative figure on pay; this
    /// is the live preview shown on the CTA.
    private var total: Int { max(0, subtotal + serviceFee + methodFee - promoDiscount) }

    /// The currency code for the CTA. Prefers the value the server returns on
    /// `pay-init`; defaults to "EGP" before that (and if the server omits it).
    private var currencyCode: String {
        let code = paymobInit?.currency?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (code?.isEmpty == false) ? code!.uppercased() : "EGP"
    }

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 20) {
                    switch phase {
                    case .form, .paying:
                        formContent
                    case .paid:
                        paidContent
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
        .interactiveDismissDisabled(phase == .paying || isPolling)
        .fullScreenCover(isPresented: $showingCheckout) {
            if let session = paymobInit {
                PaymobCheckoutView(
                    checkoutURL: session.checkoutURL,
                    returnURLPrefix: session.returnURLPrefix,
                    onFinished: { handleCheckoutFinished() },
                    onCancel: { handleCheckoutCancelled() }
                )
                .environmentObject(loc)
            }
        }
        .alert(loc.t("pay.errorTitle"), isPresented: alertBinding) {
            Button(loc.t("common.done"), role: .cancel) { alertMessage = nil }
        } message: {
            Text(alertMessage ?? "")
        }
    }

    /// Binding that shows the error alert whenever `alertMessage` is set.
    private var alertBinding: Binding<Bool> {
        Binding(
            get: { alertMessage != nil },
            set: { if !$0 { alertMessage = nil } }
        )
    }

    // MARK: - Form (pre-payment)

    private var formContent: some View {
        VStack(spacing: 20) {
            header

            methodSelector

            breakdownCard

            promoCard

            secureNote

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(Color.qkBurgundy)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            // After the WebView closes, while we poll for the webhook-set paid
            // state, or once polling times out without a flip.
            if isPolling {
                HStack(spacing: 8) {
                    ProgressView().tint(.qkBurgundy)
                    Text(loc.t("pay.verifying"))
                        .font(.footnote)
                        .foregroundStyle(Color.qkMuted)
                }
                .frame(maxWidth: .infinity)
            } else if let processingMessage {
                HStack(spacing: 8) {
                    Image(systemName: "clock.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.qkGoldDeep)
                    Text(processingMessage)
                        .font(.footnote)
                        .foregroundStyle(Color.qkInk)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            payButton
        }
    }

    /// "Payment" title + "Pay securely…" subtitle.
    private var header: some View {
        VStack(spacing: 6) {
            Text(loc.t("pay.title"))
                .font(.system(.title2, design: .serif).weight(.bold))
                .foregroundStyle(Color.qkInk)
            Text(loc.t("pay.subtitle"))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    /// The amount breakdown: subtotal (EGP X × N nights), service fee (10%),
    /// then a divider and the bold burgundy total.
    private var breakdownCard: some View {
        VStack(spacing: 0) {
            amountRow(
                label: "EGP \(nightly) × \(nights) \(nightsWord)",
                value: "EGP \(subtotal)"
            )
            Divider()
            amountRow(
                label: loc.t("pay.serviceFee"),
                value: "EGP \(serviceFee)"
            )
            Divider()
            methodFeeRow
            // Applied promo discount line (only when a valid code is applied).
            if promoDiscount > 0 {
                Divider()
                promoLine
            }
            Divider()
            HStack {
                Text(loc.t("common.total"))
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color.qkInk)
                Spacer()
                Text("EGP \(total)")
                    .font(.system(size: 18, weight: .heavy))
                    .foregroundStyle(Color.qkBurgundy)
            }
            .padding(.vertical, 14)
        }
        .padding(.horizontal, 16)
        .qkCard()
    }

    private func amountRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(Color.qkMuted)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
                .foregroundStyle(Color.qkInk)
        }
        .font(.subheadline)
        .padding(.vertical, 14)
    }

    /// Pluralized "night" / "nights" via the existing common keys.
    private var nightsWord: String {
        loc.t(nights == 1 ? "common.night" : "common.nights")
    }

    // MARK: - Payment method selector

    /// Segmented "Card (+5%)" vs "Bank transfer (−5%)" picker. Selecting one
    /// recomputes the displayed total locally (the backend prices it for real on
    /// pay). Leading/trailing layout so it mirrors under RTL.
    private var methodSelector: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(loc.t("pay.method.title"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.qkInk)
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 8) {
                methodOption(.card, label: loc.t("pay.method.card"), icon: "creditcard.fill")
                methodOption(.bankTransfer, label: loc.t("pay.method.bank"), icon: "building.columns.fill")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// One pill in the method selector. Selected fills burgundy; tapping it
    /// animates the recomputed total.
    private func methodOption(_ option: PayMethod, label: String, icon: String) -> some View {
        let isSelected = method == option
        return Button {
            withAnimation(QKAnim.swap) { method = option }
        } label: {
            HStack(spacing: 7) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                Text(label)
                    .font(.system(size: 14, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(isSelected ? Color.qkCream : Color.qkInk)
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .background(
                Group {
                    if isSelected { LinearGradient.qkBurgundyCTA } else { Color.qkSurface }
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(isSelected ? Color.clear : Color.qkInk.opacity(0.1), lineWidth: 1)
            )
        }
        .buttonStyle(.qkTap)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    /// The signed surcharge/discount line inside the breakdown card. Card shows a
    /// burgundy "+EGP X"; bank transfer shows a green "−EGP X".
    private var methodFeeRow: some View {
        let isCard = method == .card
        let label = isCard ? loc.t("pay.method.cardSurcharge") : loc.t("pay.method.bankDiscount")
        let sign = isCard ? "+" : "−"
        let valueColor = isCard ? Color.qkBurgundy : Color.qkSuccess
        return HStack {
            Text(label)
                .foregroundStyle(Color.qkMuted)
            Spacer()
            Text("\(sign)EGP \(methodFeeMagnitude)")
                .fontWeight(.semibold)
                .foregroundStyle(valueColor)
        }
        .font(.subheadline)
        .padding(.vertical, 14)
    }

    /// The applied-promo discount line inside the breakdown (green "−EGP X").
    private var promoLine: some View {
        HStack {
            Text(loc.t("promo.discount"))
                .foregroundStyle(Color.qkMuted)
            Spacer()
            Text("−EGP \(promoDiscount)")
                .fontWeight(.semibold)
                .foregroundStyle(Color.qkSuccess)
        }
        .font(.subheadline)
        .padding(.vertical, 14)
    }

    // MARK: - Promo code

    /// "Promo code" entry: a text field + Apply button, with an inline result
    /// message. Once a valid code is applied, the field shows an applied state and
    /// the Apply button becomes a Remove button. Leading/trailing for RTL.
    private var promoCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(loc.t("promo.code"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.qkInk)
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "tag")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.qkMuted)
                    TextField(loc.t("promo.placeholder"), text: $promoCode)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .foregroundStyle(Color.qkInk)
                        .disabled(isApplied || isCheckingPromo)
                        .onChange(of: promoCode) { _, _ in
                            // Editing the code after applying clears the applied
                            // state so the guest must re-apply.
                            if promoQuote != nil { promoQuote = nil; promoMessage = nil }
                        }
                }
                .padding(.horizontal, 14)
                .frame(height: 48)
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(isApplied ? Color.qkSuccess.opacity(0.5) : Color.qkInk.opacity(0.1),
                                      lineWidth: 1)
                )

                promoActionButton
            }

            if let promoMessage {
                HStack(spacing: 6) {
                    Image(systemName: isApplied ? "checkmark.seal.fill" : "exclamationmark.circle.fill")
                        .font(.system(size: 12, weight: .semibold))
                    Text(promoMessage)
                        .font(.footnote)
                }
                .foregroundStyle(isApplied ? Color.qkSuccess : Color.qkBurgundy)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(16)
        .qkCard()
    }

    /// Whether a valid promo quote is currently applied.
    private var isApplied: Bool { promoQuote?.valid == true }

    /// The Apply / Remove button next to the promo field.
    private var promoActionButton: some View {
        Button {
            if isApplied {
                removePromo()
            } else {
                Task { await applyPromo() }
            }
        } label: {
            Group {
                if isCheckingPromo {
                    ProgressView().tint(.qkBurgundy)
                } else {
                    Text(loc.t(isApplied ? "promo.remove" : "promo.apply"))
                        .font(.system(size: 14, weight: .bold))
                }
            }
            .foregroundStyle(isApplied ? Color.qkBurgundy : Color.qkCream)
            .padding(.horizontal, 16)
            .frame(height: 48)
            .frame(minWidth: 84)
            .background(
                Group {
                    if isApplied { Color.qkTan } else { LinearGradient.qkBurgundyCTA }
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.qkTap)
        .disabled(isCheckingPromo || (!isApplied && promoCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty))
        .accessibilityLabel(loc.t(isApplied ? "promo.remove" : "promo.apply"))
    }

    /// A reassuring "secured by Paymob — card entered on the next screen" banner.
    /// Card details are collected on Paymob's hosted page, never here.
    private var secureNote: some View {
        HStack(spacing: 10) {
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 16))
                .foregroundStyle(Color.qkGoldDeep)
            Text(loc.t("pay.secureNote"))
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

    /// Burgundy "Pay {amount} {currency}" CTA; shows a spinner while starting the
    /// checkout session.
    private var payButton: some View {
        Button {
            Task { await startCheckout() }
        } label: {
            QKPrimaryButtonLabel(
                title: phase == .paying
                    ? loc.t("pay.processing")
                    : String(format: loc.t("pay.payAmountCurrency"), "\(total)", currencyCode),
                systemImage: phase == .paying ? nil : "lock.fill",
                isLoading: phase == .paying
            )
        }
        .buttonStyle(QKPressStyle())
        .disabled(phase == .paying)
    }

    // MARK: - Paid (success)

    private var paidContent: some View {
        VStack(spacing: 18) {
            QKDrawCheck(size: 84, light: true)
                .padding(.top, 8)

            VStack(spacing: 6) {
                Text(loc.t("pay.confirmed"))
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Color.qkInk)
                    .multilineTextAlignment(.center)
                if let receipt {
                    Text(String(format: loc.t("pay.totalPaid"), "\(receipt.total)"))
                        .font(.subheadline)
                        .foregroundStyle(Color.qkMuted)
                }
            }

            // Reference + amount summary.
            VStack(spacing: 12) {
                if let receipt {
                    HStack {
                        Text(loc.t("pay.reference"))
                            .foregroundStyle(Color.qkMuted)
                        Spacer()
                        Text(receipt.reference)
                            .font(.system(.subheadline, design: .monospaced).weight(.semibold))
                            .foregroundStyle(Color.qkInk)
                            .textSelection(.enabled)
                    }
                    .font(.subheadline)
                    if receipt.methodFee != 0 {
                        Divider()
                        let isCard = receipt.methodFee > 0
                        HStack {
                            Text(isCard ? loc.t("pay.method.cardSurcharge") : loc.t("pay.method.bankDiscount"))
                                .foregroundStyle(Color.qkMuted)
                            Spacer()
                            Text("\(isCard ? "+" : "−")EGP \(abs(receipt.methodFee))")
                                .fontWeight(.semibold)
                                .foregroundStyle(isCard ? Color.qkBurgundy : Color.qkSuccess)
                        }
                        .font(.subheadline)
                    }
                    // Promo discount applied on the receipt (server-confirmed).
                    if receipt.hasPromo {
                        Divider()
                        HStack {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(loc.t("promo.discount"))
                                    .foregroundStyle(Color.qkMuted)
                                if let code = receipt.promoCode, !code.isEmpty {
                                    Text(code)
                                        .font(.caption.monospaced())
                                        .foregroundStyle(Color.qkMuted)
                                }
                            }
                            Spacer()
                            Text("−EGP \(receipt.promoDiscount ?? 0)")
                                .fontWeight(.semibold)
                                .foregroundStyle(Color.qkSuccess)
                        }
                        .font(.subheadline)
                    }
                    Divider()
                    HStack {
                        Text(loc.t("common.total"))
                            .foregroundStyle(Color.qkMuted)
                        Spacer()
                        Text("EGP \(receipt.total)")
                            .fontWeight(.bold)
                            .foregroundStyle(Color.qkBurgundy)
                    }
                    .font(.subheadline)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity)
            .qkCard()

            Button {
                if let receipt { onPaid(receipt) }
                dismiss()
            } label: {
                QKPrimaryButtonLabel(title: loc.t("pay.continue"), height: 50)
            }
            .buttonStyle(QKPressStyle())
        }
    }

    // MARK: - Action (Paymob hosted checkout)

    /// Start the Paymob hosted checkout: call `pay-init`, then present the in-app
    /// WebView with the returned `checkout_url`. The guest enters card details on
    /// Paymob's page — never here. On a 503 (keys not set) or other failure we
    /// surface an alert and stay on the form.
    @MainActor
    private func startCheckout() async {
        errorMessage = nil
        processingMessage = nil
        phase = .paying
        do {
            let session = try await BookingService.shared.payInit(bookingId: bookingID)
            paymobInit = session
            phase = .form
            showingCheckout = true
        } catch BookingError.alreadyPaid {
            // Already settled (e.g. paid in another session) — treat as success.
            phase = .form
            await finishAsPaid()
        } catch BookingError.paymentUnavailable {
            phase = .form
            alertMessage = loc.t("pay.unavailable")
        } catch {
            phase = .form
            alertMessage = error.localizedDescription
        }
    }

    /// The WebView reached our return-URL prefix (payment submitted on Paymob).
    /// Close the cover and poll the booking until the webhook flips it to paid.
    @MainActor
    private func handleCheckoutFinished() {
        showingCheckout = false
        Task { await pollForPaid() }
    }

    /// The guest cancelled the WebView (Cancel / swipe-down). No charge — just
    /// close the cover and leave the form as-is.
    @MainActor
    private func handleCheckoutCancelled() {
        showingCheckout = false
    }

    /// Poll the booking up to ~20s for the webhook-set paid state. On paid →
    /// switch to the confirmed (paid) screen; otherwise show the "processing" copy
    /// so the guest knows we'll catch up shortly.
    @MainActor
    private func pollForPaid() async {
        isPolling = true
        processingMessage = nil
        defer { isPolling = false }

        let paid = await BookingService.shared.pollUntilPaid(bookingId: bookingID)
        if paid {
            await finishAsPaid()
        } else {
            processingMessage = loc.t("pay.processingHint")
        }
    }

    /// Mark the flow as paid. We don't get a `PaymentReceipt` from the Paymob
    /// flow (the booking is settled by the webhook), so build a lightweight
    /// receipt from the local preview + the Paymob reference for the success
    /// screen, then notify the caller to refresh the booking.
    @MainActor
    private func finishAsPaid() async {
        let reference = paymobInit?.reference?.trimmingCharacters(in: .whitespacesAndNewlines)
        let summary = PaymentReceipt(
            currency: currencyCode,
            nights: nights,
            nightly: nightly,
            subtotal: subtotal,
            serviceFee: serviceFee,
            methodFee: methodFee,
            total: total,
            reference: (reference?.isEmpty == false) ? reference! : "—",
            paidAt: ISO8601DateFormatter().string(from: Date()),
            method: method.rawValue,
            promoCode: appliedPromoCode,
            promoDiscount: promoDiscount > 0 ? promoDiscount : nil
        )
        receipt = summary
        withAnimation(QKAnim.swap) { phase = .paid }
    }

    /// Validate the typed promo code against the current subtotal and apply it
    /// (preview only). On `valid` the discount lands in the breakdown + total; on
    /// invalid we surface the server's message inline.
    @MainActor
    private func applyPromo() async {
        let code = promoCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else { return }
        isCheckingPromo = true
        promoMessage = nil
        defer { isCheckingPromo = false }
        do {
            let quote = try await BookingService.shared.validatePromo(code: code, subtotal: subtotal)
            promoQuote = quote
            if quote.valid {
                let msg = quote.message?.trimmingCharacters(in: .whitespacesAndNewlines)
                promoMessage = (msg?.isEmpty == false)
                    ? msg
                    : String(format: loc.t("promo.applied"), "\(quote.discount)")
            } else {
                let msg = quote.message?.trimmingCharacters(in: .whitespacesAndNewlines)
                promoMessage = (msg?.isEmpty == false) ? msg : loc.t("promo.invalid")
            }
        } catch {
            promoQuote = nil
            promoMessage = error.localizedDescription
        }
    }

    /// Clear an applied promo code (back to no discount).
    private func removePromo() {
        promoQuote = nil
        promoMessage = nil
        promoCode = ""
    }
}
