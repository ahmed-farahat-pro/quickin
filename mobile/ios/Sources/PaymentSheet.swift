import SwiftUI

/// A **mock** payment sheet for QuickIn. There is no real gateway yet (Paymob
/// comes later) — this just mimics paying so the booking flow completes
/// end-to-end. It POSTs to the backend's mock pay endpoint via
/// `BookingService.pay(bookingId:)`, which always succeeds for the booking's
/// owner and flips the booking to paid + confirmed.
///
/// Lifecycle:
///   • **form** — boutique amount breakdown (subtotal · service fee · total),
///     a clearly-labelled "Demo payment — no real charge" note, a decorative
///     (disabled) card row, and a burgundy "Pay EGP {total}" CTA.
///   • **paying** — the CTA shows a spinner.
///   • **paid** — a drawn checkmark + "Booking confirmed & paid" + the QK-…
///     reference, then a "Continue" button that calls `onPaid` and dismisses
///     (the caller routes on to the reservation / Apple Wallet flow).
///
/// All copy is localized (en + ar) and the layout is leading/trailing based, so
/// it mirrors correctly under RTL.
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
        .interactiveDismissDisabled(phase == .paying)
    }

    // MARK: - Form (pre-payment)

    private var formContent: some View {
        VStack(spacing: 20) {
            header

            methodSelector

            breakdownCard

            promoCard

            demoNote

            cardRow

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(Color.qkBurgundy)
                    .multilineTextAlignment(.center)
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

    /// The clearly-labelled "Demo payment — no real charge" banner.
    private var demoNote: some View {
        HStack(spacing: 10) {
            Image(systemName: "info.circle.fill")
                .font(.system(size: 16))
                .foregroundStyle(Color.qkGoldDeep)
            Text(loc.t("pay.demoNote"))
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

    /// A purely decorative, disabled "card" row (•••• masked number) so the
    /// sheet reads like a real checkout without collecting anything.
    private var cardRow: some View {
        HStack(spacing: 12) {
            Image(systemName: "creditcard.fill")
                .font(.system(size: 18))
                .foregroundStyle(Color.qkBurgundy)
                .frame(width: 28)
            Text("•••• •••• •••• 4242")
                .font(.system(.subheadline, design: .monospaced))
                .foregroundStyle(Color.qkInk)
            Spacer()
            Image(systemName: "lock.fill")
                .font(.system(size: 13))
                .foregroundStyle(Color.qkMuted)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 15)
        .background(Color.qkCream)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.qkInk.opacity(0.08), lineWidth: 1)
        )
        .opacity(0.85)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    /// Burgundy "Pay EGP {total}" CTA; shows a spinner while paying.
    private var payButton: some View {
        Button {
            Task { await pay() }
        } label: {
            QKPrimaryButtonLabel(
                title: phase == .paying
                    ? loc.t("pay.processing")
                    : String(format: loc.t("pay.payAmount"), "\(total)"),
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

    // MARK: - Action

    @MainActor
    private func pay() async {
        errorMessage = nil
        phase = .paying
        do {
            let r = try await BookingService.shared.pay(
                bookingId: bookingID,
                method: method.rawValue,
                promoCode: appliedPromoCode
            )
            receipt = r
            withAnimation(QKAnim.swap) { phase = .paid }
        } catch {
            errorMessage = error.localizedDescription
            phase = .form
        }
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
