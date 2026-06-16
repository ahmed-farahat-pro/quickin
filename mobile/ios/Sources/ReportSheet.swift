import SwiftUI

/// A reason a user can pick when reporting content. The `key` is the
/// localization key for the label; the `value` is the stable English string
/// sent to the backend as `reason` (so triage stays locale-independent).
struct ReportReason: Identifiable, Hashable {
    let key: String
    let value: String
    var id: String { value }

    /// The four reasons offered for a listing report.
    static let listingReasons: [ReportReason] = [
        ReportReason(key: "report.reason.inaccurate", value: "Inaccurate listing"),
        ReportReason(key: "report.reason.scam",       value: "Scam or fraud"),
        ReportReason(key: "report.reason.offensive",  value: "Offensive content"),
        ReportReason(key: "report.reason.other",      value: "Something else"),
    ]
}

/// View model for the report sheet: holds the picked reason + optional details
/// and POSTs to `/api/local/reports`. Surfaces submit state so the sheet can
/// show a spinner / success note. Requires a signed-in user (the service throws
/// `.notSignedIn` otherwise).
@MainActor
final class ReportViewModel: ObservableObject {
    let targetType: ReportTargetType
    let targetID: String
    let reasons: [ReportReason]

    @Published var selectedReason: ReportReason
    @Published var details = ""
    @Published var isSubmitting = false
    @Published var didSubmit = false
    @Published var errorMessage: String?

    init(targetType: ReportTargetType, targetID: String, reasons: [ReportReason] = ReportReason.listingReasons) {
        self.targetType = targetType
        self.targetID = targetID
        self.reasons = reasons
        self.selectedReason = reasons.first ?? ReportReason(key: "report.reason.other", value: "Something else")
    }

    func submit() async {
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            try await TrustService.shared.submitReport(
                targetType: targetType,
                targetID: targetID,
                reason: selectedReason.value,
                details: details
            )
            didSubmit = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// Sheet presented from a "Report" action. Lets the user pick a reason, add
/// optional details, and submit. Shows a branded "Thanks" confirmation on
/// success, then auto-dismisses. RTL-safe; DesignKit tokens throughout.
struct ReportSheet: View {
    @StateObject private var viewModel: ReportViewModel
    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    /// `title` is the localized sheet title (e.g. "Report listing").
    init(targetType: ReportTargetType, targetID: String, reasons: [ReportReason] = ReportReason.listingReasons) {
        _viewModel = StateObject(wrappedValue: ReportViewModel(
            targetType: targetType,
            targetID: targetID,
            reasons: reasons
        ))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()

                if viewModel.didSubmit {
                    successState
                } else {
                    form
                }
            }
            .navigationTitle(loc.t("report.report"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(loc.t("common.close")) { dismiss() }
                        .tint(.qkBurgundy)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        // Auto-dismiss shortly after a successful submit.
        .onChange(of: viewModel.didSubmit) { _, done in
            if done {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.1) { dismiss() }
            }
        }
    }

    // MARK: - Form

    private var form: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                reasonCard
                detailsCard

                if let errorMessage = viewModel.errorMessage {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(Color.qkBurgundy)
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(Color.qkInk)
                        Spacer(minLength: 0)
                    }
                    .padding(14)
                    .background(Color.qkTan)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }

                submitButton
            }
            .padding(20)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private var reasonCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(loc.t("report.reason"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.qkInk)

            VStack(spacing: 0) {
                ForEach(Array(viewModel.reasons.enumerated()), id: \.element.id) { index, reason in
                    Button {
                        viewModel.selectedReason = reason
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: viewModel.selectedReason == reason ? "largecircle.fill.circle" : "circle")
                                .font(.system(size: 18))
                                .foregroundStyle(viewModel.selectedReason == reason ? Color.qkBurgundy : Color.qkTan4)
                            Text(loc.t(reason.key))
                                .font(.system(size: 15))
                                .foregroundStyle(Color.qkInk)
                            Spacer(minLength: 0)
                        }
                        .padding(.vertical, 12)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if index < viewModel.reasons.count - 1 { Divider() }
                }
            }
        }
        .padding(18)
        .qkCard(lifts: false)
    }

    private var detailsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(loc.t("report.details"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.qkInk)
            TextField(
                loc.t("report.details.placeholder"),
                text: $viewModel.details,
                axis: .vertical
            )
            .lineLimit(3...6)
            .textInputAutocapitalization(.sentences)
            .foregroundStyle(Color.qkInk)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(minHeight: 96, alignment: .topLeading)
            .background(Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.qkInk.opacity(0.1), lineWidth: 1)
            )
        }
        .padding(18)
        .qkCard(lifts: false)
    }

    private var submitButton: some View {
        Button {
            Task { await viewModel.submit() }
        } label: {
            QKPrimaryButtonLabel(
                title: loc.t("report.submit"),
                isLoading: viewModel.isSubmitting
            )
            .opacity(viewModel.isSubmitting ? 0.85 : 1)
        }
        .buttonStyle(QKPressStyle())
        .disabled(viewModel.isSubmitting)
    }

    // MARK: - Success

    private var successState: some View {
        VStack(spacing: 16) {
            QKDrawCheck(size: 72, light: true)
            Text(loc.t("report.thanks"))
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Color.qkInk)
                .multilineTextAlignment(.center)
            Text(loc.t("report.thanks.body"))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .multilineTextAlignment(.center)
        }
        .padding(32)
    }
}
