import SwiftUI

/// Host-facing availability manager for a single listing, presented as a sheet
/// from `ListingDetailView` when the signed-in user owns the listing.
///
/// Lets the host:
///   • pick a start/end range (the branded `DateRangePicker`) and **block** it
///     (`POST /api/local/listings/:id/availability`),
///   • see the listing's current spans — host **blocks** are removable
///     (`DELETE …?blockId=ID`), **booked** spans are read-only,
///   • the list refreshes after every add / remove.
///
/// Spans are half-open `[start, end)`, matching the backend; the calendar greys
/// out days that are already booked or blocked so the host can't double-book.
struct AvailabilityManagerView: View {
    let listing: Listing

    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    // Current spans for the listing.
    @State private var ranges: [AvailabilityRange] = []
    @State private var isLoading = false
    @State private var hasLoaded = false
    @State private var errorMessage: String?

    // New-block range selection (committed via the date picker sheet).
    @State private var newStart: Date?
    @State private var newEnd: Date?
    @State private var showingDatePicker = false
    @State private var isBlocking = false

    // Ids currently being removed, to disable their button + show a spinner.
    @State private var removingIDs: Set<String> = []

    // Cancellation policy: the host can edit it here. Seeded from the listing,
    // updated locally after a save so the summary row reflects the change.
    @State private var policy: CancellationPolicy
    @State private var showingPolicyEditor = false

    // Length-of-stay discounts: the host can edit them here. Seeded from the
    // listing, updated locally after a save so the summary row reflects the change.
    @State private var weeklyDiscount: Int
    @State private var monthlyDiscount: Int
    @State private var showingDiscountEditor = false

    init(listing: Listing) {
        self.listing = listing
        _policy = State(initialValue: listing.policy)
        _weeklyDiscount = State(initialValue: listing.weeklyDiscount)
        _monthlyDiscount = State(initialValue: listing.monthlyDiscount)
    }

    /// `yyyy-MM-dd`, locale-independent — matches the API exactly.
    private static let apiFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    /// "Aug 1 → Aug 4" preview of the pending block range.
    private static let prettyFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "MMM d"
        return f
    }()

    private var blockedRanges: [AvailabilityRange] { ranges.filter { $0.isBlocked } }
    private var bookedRanges: [AvailabilityRange] { ranges.filter { !$0.isBlocked } }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()
                content
            }
            .navigationTitle(loc.t("availability.manage"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(loc.t("common.done")) { dismiss() }
                        .tint(.qkBurgundy)
                }
            }
            .task {
                if !hasLoaded { await load() }
            }
            .sheet(isPresented: $showingDatePicker) {
                DateRangePicker(
                    checkIn: $newStart,
                    checkOut: $newEnd,
                    // Grey out days already booked/blocked so a host can't create
                    // an overlapping block.
                    unavailableRanges: ranges
                ) { start, end in
                    newStart = start
                    newEnd = end
                }
            }
            .sheet(isPresented: $showingPolicyEditor) {
                CancellationPolicyEditorView(listing: listing) { updated in
                    // Reflect the saved policy in the summary row immediately.
                    policy = updated.policy
                }
                .environmentObject(loc)
            }
            .sheet(isPresented: $showingDiscountEditor) {
                DiscountEditorView(
                    listing: listing,
                    weekly: weeklyDiscount,
                    monthly: monthlyDiscount
                ) { updated in
                    // Reflect the saved discounts in the summary row immediately.
                    weeklyDiscount = updated.weeklyDiscount
                    monthlyDiscount = updated.monthlyDiscount
                }
                .environmentObject(loc)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if isLoading && !hasLoaded {
            ProgressView()
                .tint(.qkBurgundy)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    policyCard
                    discountCard
                    addBlockCard
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(Color.qkBurgundy)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    blockedSection
                    bookedSection
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 28)
            }
            .refreshable { await reload() }
        }
    }

    // MARK: - Cancellation policy

    /// The cancellation-policy summary + "edit" entry. Tapping it opens the
    /// `CancellationPolicyEditorView` sheet, which PATCHes the listing.
    private var policyCard: some View {
        Button {
            showingPolicyEditor = true
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                Text(loc.t("cancel.policy"))
                    .font(.system(.title3, design: .serif).weight(.semibold))
                    .foregroundStyle(Color.qkInk)

                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: policy.systemImage)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.qkBurgundy)
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
                    Image(systemName: "chevron.forward")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.qkMuted)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .qkCard(cornerRadius: 20)
        }
        .buttonStyle(.qkTap)
        .accessibilityLabel("\(loc.t("cancel.policy")): \(policy.name)")
    }

    // MARK: - Length-of-stay discounts

    /// "Weekly −X% · Monthly −Y%" summary, or "No discounts yet" when both 0.
    private var discountSummary: String {
        var parts: [String] = []
        if weeklyDiscount > 0 {
            parts.append(String(format: loc.t("growth.weeklyShort"), "\(weeklyDiscount)"))
        }
        if monthlyDiscount > 0 {
            parts.append(String(format: loc.t("growth.monthlyShort"), "\(monthlyDiscount)"))
        }
        return parts.isEmpty ? loc.t("growth.noDiscountsYet") : parts.joined(separator: " · ")
    }

    /// The length-of-stay discount summary + "edit" entry. Tapping it opens the
    /// `DiscountEditorView` sheet, which PATCHes the listing.
    private var discountCard: some View {
        Button {
            showingDiscountEditor = true
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                Text(loc.t("growth.lengthOfStayDiscounts"))
                    .font(.system(.title3, design: .serif).weight(.semibold))
                    .foregroundStyle(Color.qkInk)

                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "tag.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.qkBurgundy)
                        .frame(width: 26)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(discountSummary)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.qkInk)
                        Text(loc.t("growth.discountsHint"))
                            .font(.caption)
                            .foregroundStyle(Color.qkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                            .multilineTextAlignment(.leading)
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.forward")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.qkMuted)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .qkCard(cornerRadius: 20)
        }
        .buttonStyle(.qkTap)
        .accessibilityLabel("\(loc.t("growth.lengthOfStayDiscounts")): \(discountSummary)")
    }

    // MARK: - Add block

    /// The "Block dates" composer: a date-range row + the action button.
    private var addBlockCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(loc.t("availability.blockDates"))
                .font(.system(.title3, design: .serif).weight(.semibold))
                .foregroundStyle(Color.qkInk)

            Button {
                showingDatePicker = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "calendar")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(Color.qkBurgundy)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(loc.t("detail.dates"))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.qkMuted)
                        Text(pendingRangeLabel)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(newStart == nil ? Color.qkMuted : Color.qkInk)
                    }
                    Spacer()
                    Image(systemName: "chevron.forward")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.qkMuted)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)

            Button {
                Task { await addBlock() }
            } label: {
                QKPrimaryButtonLabel(
                    title: loc.t("availability.addBlock"),
                    systemImage: "plus",
                    isLoading: isBlocking,
                    height: 48
                )
                .opacity(canBlock ? 1 : 0.5)
            }
            .buttonStyle(QKPressStyle())
            .disabled(!canBlock || isBlocking)
        }
        .padding(16)
        .qkCard(cornerRadius: 20)
    }

    /// A valid pending range needs both ends, with checkout strictly after
    /// check-in.
    private var canBlock: Bool {
        guard let s = newStart, let e = newEnd else { return false }
        return e > s
    }

    /// "Aug 1 → Aug 4" preview, or the empty hint when nothing is picked yet.
    private var pendingRangeLabel: String {
        guard let s = newStart else { return loc.t("availability.pickRange") }
        let startText = Self.prettyFormatter.string(from: s)
        guard let e = newEnd, e > s else { return startText }
        return "\(startText) → \(Self.prettyFormatter.string(from: e))"
    }

    // MARK: - Current blocks

    /// Host-created blocks (removable). Empty hint when none.
    private var blockedSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(loc.t("availability.blocked"))
                .font(.system(.title3, design: .serif).weight(.semibold))
                .foregroundStyle(Color.qkInk)

            if blockedRanges.isEmpty {
                emptyHint(icon: "calendar", text: loc.t("availability.noBlocks"))
            } else {
                ForEach(blockedRanges) { range in
                    blockRow(range)
                }
            }
        }
    }

    /// Booked spans (read-only). Hidden entirely when there are none.
    @ViewBuilder
    private var bookedSection: some View {
        if !bookedRanges.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text(loc.t("availability.booked"))
                    .font(.system(.title3, design: .serif).weight(.semibold))
                    .foregroundStyle(Color.qkInk)

                ForEach(bookedRanges) { range in
                    bookedRow(range)
                }
            }
        }
    }

    /// One removable host block — range label, optional note, and a trash button.
    private func blockRow(_ range: AvailabilityRange) -> some View {
        let isRemoving = removingIDs.contains(range.id)
        return HStack(spacing: 12) {
            Image(systemName: "lock.fill")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.qkBurgundy)
                .frame(width: 40, height: 40)
                .background(Color.qkTan)
                .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(range.displayRangeText)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.qkInk)
                if let note = range.note?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty {
                    Text(note)
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 8)

            Button {
                Task { await removeBlock(range) }
            } label: {
                if isRemoving {
                    ProgressView().tint(.qkBurgundy)
                        .frame(width: 36, height: 36)
                } else {
                    Image(systemName: "trash")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.qkBurgundy)
                        .frame(width: 36, height: 36)
                        .background(Color.qkTan)
                        .clipShape(Circle())
                }
            }
            .buttonStyle(.qkTap)
            .disabled(isRemoving)
            .accessibilityLabel(loc.t("availability.remove"))
        }
        .padding(12)
        .qkCard(cornerRadius: 18)
    }

    /// One read-only booked span.
    private func bookedRow(_ range: AvailabilityRange) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "calendar.badge.checkmark")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.qkSuccess)
                .frame(width: 40, height: 40)
                .background(Color.qkSuccess.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(range.displayRangeText)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.qkInk)
                Text(loc.t("availability.booked"))
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .qkCard(cornerRadius: 18)
    }

    private func emptyHint(icon: String, text: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(Color.qkBurgundy.opacity(0.6))
            Text(text)
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .qkCard(cornerRadius: 18)
    }

    // MARK: - Actions

    /// Initial load of the listing's spans.
    private func load() async {
        isLoading = true
        await fetch()
        isLoading = false
        hasLoaded = true
    }

    /// Pull-to-refresh / post-mutation reload (no full-screen spinner).
    private func reload() async {
        await fetch()
    }

    private func fetch() async {
        do {
            ranges = try await SupabaseService.shared.fetchAvailability(listingID: listing.id)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// POST the pending range as a block, then refresh + clear the picker.
    private func addBlock() async {
        guard let start = newStart, let end = newEnd, end > start else { return }
        isBlocking = true
        errorMessage = nil
        defer { isBlocking = false }
        do {
            _ = try await BookingService.shared.blockDates(
                listingID: listing.id,
                start: Self.apiFormatter.string(from: start),
                end: Self.apiFormatter.string(from: end),
                note: nil
            )
            newStart = nil
            newEnd = nil
            await fetch()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// DELETE a host block, then refresh.
    private func removeBlock(_ range: AvailabilityRange) async {
        removingIDs.insert(range.id)
        errorMessage = nil
        defer { removingIDs.remove(range.id) }
        do {
            try await BookingService.shared.unblockDates(listingID: listing.id, blockID: range.id)
            await fetch()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
