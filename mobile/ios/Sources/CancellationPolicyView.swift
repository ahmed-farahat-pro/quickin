import SwiftUI

// MARK: - Policy picker (shared)

/// A three-option cancellation-policy picker: one selectable card per policy
/// (flexible / moderate / strict), each with its name + a one-line refund
/// explanation. Used in the host "Add listing" flow and the host policy editor.
/// Selected cards fill burgundy-tinted; the binding holds the chosen policy.
///
/// Leading/trailing layout so it mirrors correctly under RTL.
struct CancellationPolicyPicker: View {
    @Binding var selection: CancellationPolicy

    var body: some View {
        VStack(spacing: 10) {
            ForEach(CancellationPolicy.allCases) { policy in
                policyRow(policy)
            }
        }
    }

    private func policyRow(_ policy: CancellationPolicy) -> some View {
        let isOn = selection == policy
        return Button {
            selection = policy
        } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: policy.systemImage)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(isOn ? Color.qkBurgundy : Color.qkMuted)
                    .frame(width: 26)

                VStack(alignment: .leading, spacing: 3) {
                    Text(policy.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.qkInk)
                    Text(policy.explanation)
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 8)

                Image(systemName: isOn ? "largecircle.fill.circle" : "circle")
                    .font(.system(size: 18))
                    .foregroundStyle(isOn ? Color.qkBurgundy : Color.qkMuted.opacity(0.5))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isOn ? Color.qkBurgundy.opacity(0.08) : Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(isOn ? Color.qkBurgundy.opacity(0.5) : Color.qkBurgundy.opacity(0.12),
                                  lineWidth: isOn ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(policy.name). \(policy.explanation)")
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }
}

// MARK: - Host policy editor (sheet)

/// Host-facing editor for a single listing's cancellation policy, presented as a
/// sheet from `AvailabilityManagerView`. Seeds with the listing's current policy,
/// lets the host pick a new one, and PATCHes
/// `/api/local/listings/:id` via `BookingService.setCancellationPolicy`.
struct CancellationPolicyEditorView: View {
    let listing: Listing
    /// Called with the updated listing after a successful save, so the parent can
    /// refresh the policy it shows.
    var onSaved: (Listing) -> Void

    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    @State private var selection: CancellationPolicy
    @State private var isSaving = false
    @State private var saved = false
    @State private var errorMessage: String?

    init(listing: Listing, onSaved: @escaping (Listing) -> Void) {
        self.listing = listing
        self.onSaved = onSaved
        _selection = State(initialValue: listing.policy)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(loc.t("cancel.choosePolicyHint"))
                            .font(.subheadline)
                            .foregroundStyle(Color.qkMuted)
                            .fixedSize(horizontal: false, vertical: true)

                        CancellationPolicyPicker(selection: $selection)
                            .onChange(of: selection) { _, _ in saved = false }

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundStyle(Color.qkBurgundy)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Button {
                            Task { await save() }
                        } label: {
                            QKPrimaryButtonLabel(
                                title: saved ? loc.t("cancel.policySaved") : loc.t("cancel.savePolicy"),
                                systemImage: isSaving ? nil : (saved ? "checkmark" : "tray.and.arrow.down.fill"),
                                isLoading: isSaving,
                                height: 50
                            )
                        }
                        .buttonStyle(QKPressStyle())
                        .disabled(isSaving)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .padding(.bottom, 28)
                }
            }
            .navigationTitle(loc.t("cancel.policy"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(loc.t("common.done")) { dismiss() }
                        .tint(.qkBurgundy)
                }
            }
        }
        .tint(.qkBurgundy)
    }

    @MainActor
    private func save() async {
        errorMessage = nil
        isSaving = true
        defer { isSaving = false }
        do {
            let updated = try await BookingService.shared.setCancellationPolicy(
                listingID: listing.id,
                policy: selection
            )
            saved = true
            onSaved(updated)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Guest cancel (sheet)

/// Guest-facing cancellation flow, presented as a sheet from
/// `ReservationDetailView`. Fetches the refund **quote** on appear
/// (`GET …/cancel`, no mutation), shows the policy + the refund the guest will
/// receive, and — on confirm — POSTs the cancel (`POST …/cancel`) and reports the
/// updated booking back so the detail screen reflects the cancelled status.
struct CancelReservationSheet: View {
    let bookingID: String
    /// Stay title, for the header (optional).
    let stayTitle: String?
    /// Called with the cancelled `Booking` after a successful cancel.
    var onCancelled: (Booking) -> Void

    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    @State private var quote: CancellationQuote?
    @State private var isLoadingQuote = false
    @State private var isCancelling = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()
                content
            }
            .navigationTitle(loc.t("cancel.confirmTitle"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(loc.t("cancel.keepReservation")) { dismiss() }
                        .tint(.qkBurgundy)
                        .disabled(isCancelling)
                }
            }
            .task { await loadQuote() }
        }
        .tint(.qkBurgundy)
        .interactiveDismissDisabled(isCancelling)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder
    private var content: some View {
        if isLoadingQuote && quote == nil {
            ProgressView()
                .tint(.qkBurgundy)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if let stay = stayTitle?.trimmingCharacters(in: .whitespacesAndNewlines), !stay.isEmpty {
                        Text(stay)
                            .font(.system(.title3, design: .serif).weight(.semibold))
                            .foregroundStyle(Color.qkInk)
                    }

                    if let quote {
                        Text(String(format: loc.t("cancel.confirmBody"), quote.cancellationPolicy.name))
                            .font(.subheadline)
                            .foregroundStyle(Color.qkMuted)
                            .fixedSize(horizontal: false, vertical: true)

                        refundCard(quote)
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(Color.qkBurgundy)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    confirmButton
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 28)
            }
        }
    }

    /// The refund summary card: policy row, days-until-check-in, total, and the
    /// emphasized refund the guest will receive.
    private func refundCard(_ quote: CancellationQuote) -> some View {
        VStack(spacing: 0) {
            row(icon: quote.cancellationPolicy.systemImage,
                label: loc.t("cancel.policyLabel"),
                value: quote.cancellationPolicy.name)
            Divider()
            row(icon: "calendar",
                label: loc.t("detail.dates"),
                value: String(format: loc.t("cancel.daysUntil"), "\(quote.daysUntilCheckIn)"))
            Divider()
            row(icon: "creditcard.fill",
                label: loc.t("common.total"),
                value: quote.totalText)
            Divider()
            // Emphasized refund line.
            HStack(spacing: 12) {
                Image(systemName: "arrow.uturn.backward.circle.fill")
                    .foregroundStyle(quote.refundPercent > 0 ? Color.qkSuccess : Color.qkMuted)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 1) {
                    Text(loc.t("cancel.youWillReceive"))
                        .font(.subheadline)
                        .foregroundStyle(Color.qkMuted)
                    Text(String(format: loc.t("cancel.refundPercentLabel"), "\(quote.refundPercent)"))
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
                Spacer(minLength: 8)
                Text(quote.refundText)
                    .font(.system(size: 18, weight: .heavy))
                    .foregroundStyle(quote.refundPercent > 0 ? Color.qkBurgundy : Color.qkMuted)
            }
            .padding(.vertical, 14)

            if quote.refundPercent == 0 {
                Text(loc.t("cancel.noRefund"))
                    .font(.footnote)
                    .foregroundStyle(Color.qkMuted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, 12)
            }
        }
        .padding(.horizontal, 16)
        .qkCard()
    }

    private func row(icon: String, label: String, value: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(Color.qkBurgundy)
                .frame(width: 24)
            Text(label)
                .foregroundStyle(Color.qkMuted)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
                .foregroundStyle(Color.qkInk)
                .multilineTextAlignment(.trailing)
        }
        .font(.subheadline)
        .padding(.vertical, 14)
    }

    private var confirmButton: some View {
        Button {
            Task { await confirmCancel() }
        } label: {
            QKPrimaryButtonLabel(
                title: loc.t("cancel.confirm"),
                systemImage: isCancelling ? nil : "xmark.circle.fill",
                isLoading: isCancelling,
                height: 52
            )
        }
        .buttonStyle(QKPressStyle())
        .disabled(isCancelling || quote == nil)
    }

    // MARK: - Actions

    @MainActor
    private func loadQuote() async {
        guard quote == nil else { return }
        isLoadingQuote = true
        errorMessage = nil
        defer { isLoadingQuote = false }
        do {
            quote = try await BookingService.shared.cancellationQuote(bookingId: bookingID)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func confirmCancel() async {
        errorMessage = nil
        isCancelling = true
        defer { isCancelling = false }
        do {
            let cancelled = try await BookingService.shared.cancelReservation(bookingId: bookingID)
            onCancelled(cancelled)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
