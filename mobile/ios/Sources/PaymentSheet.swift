import SwiftUI
import PhotosUI
import UIKit

/// The payment sheet for QuickIn — an **Instapay bank-transfer** flow that mirrors
/// the website and the Android app. There is no card gateway (Paymob was removed):
/// the guest sends the booking amount to the host's Instapay handle, uploads a
/// screenshot of the transfer, and the host confirms the booking after checking it.
///
/// Lifecycle:
///   • **form** — the amount to transfer, the Instapay destination (handle with a
///     Copy button + the host's instructions, from `GET /api/local/payment-config`),
///     a transfer-screenshot picker, and an "I've paid — submit screenshot" CTA.
///   • **submitting** — the CTA spins while the screenshot uploads via
///     `POST /api/local/bookings/:id/payment-proof { image, method:"instapay" }`.
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

    // MARK: - Picked screenshot

    @State private var pickerItem: PhotosPickerItem?
    @State private var screenshot: UIImage?
    /// True while the picked photo is being decoded off the main thread.
    @State private var isEncoding = false

    @State private var errorMessage: String?
    /// Briefly true right after tapping Copy (flips the button label to "Copied").
    @State private var copied = false

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
            Text(loc.t("instapay.subtitle"))
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

    /// Transfer destination: the Instapay handle (copyable) + the host's instructions.
    private var destinationCard: some View {
        VStack(alignment: .leading, spacing: 12) {
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
            } else if handle.isEmpty {
                Text(loc.t("instapay.noHandle"))
                    .font(.subheadline)
                    .foregroundStyle(Color.qkInk)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                HStack(spacing: 10) {
                    Text(handle)
                        .font(.system(.body, design: .monospaced).weight(.bold))
                        .foregroundStyle(Color.qkInk)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    copyButton
                }
                if !instructions.isEmpty {
                    Divider()
                    Text(instructions)
                        .font(.subheadline)
                        .foregroundStyle(Color.qkMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .qkCard()
    }

    /// The Copy button beside the handle — copies to the pasteboard and briefly
    /// flips its label to "Copied".
    private var copyButton: some View {
        Button {
            UIPasteboard.general.string = handle
            withAnimation(QKAnim.swap) { copied = true }
            Task {
                try? await Task.sleep(nanoseconds: 1_600_000_000)
                await MainActor.run { withAnimation(QKAnim.swap) { copied = false } }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: copied ? "checkmark" : "doc.on.doc")
                    .font(.system(size: 13, weight: .semibold))
                Text(loc.t(copied ? "instapay.copied" : "instapay.copy"))
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
        // Require a loaded, non-empty Instapay handle too — don't let the guest "submit a
        // transfer" when the destination never loaded / isn't set (handle is "" in those cases).
        .disabled(phase == .submitting || screenshot == nil || isEncoding || handle.isEmpty)
        .opacity((screenshot == nil || isEncoding || handle.isEmpty) ? 0.6 : 1)
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
            config = try await BookingService.shared.getPaymentConfig()
        } catch {
            configFailed = true
        }
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
        guard let dataURL = QKAvatarImage.makeDataURL(from: image, maxDimension: 1600, quality: 0.7) else {
            errorMessage = loc.t("instapay.uploadError")
            return
        }
        errorMessage = nil
        phase = .submitting
        do {
            _ = try await BookingService.shared.submitPaymentProof(bookingId: bookingID, imageDataURL: dataURL)
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
