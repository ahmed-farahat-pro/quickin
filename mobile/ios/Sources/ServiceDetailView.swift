import SwiftUI

/// Service detail: hero image, title/host/location, description, an optional
/// preferred-date + note, and a "Subscribe" button that requests the experience
/// (→ pending; the host confirms/rejects). On success it shows a branded
/// confirmation overlay IDENTICAL to the listing's "Request sent" modal.
/// Subscribing requires sign-in — reuses the app's `AuthView` sheet gate.
struct ServiceDetailView: View {
    let service: Service
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager

    // Subscribe inputs
    @State private var useDate = false
    @State private var preferredDate = Calendar.current.startOfDay(for: Date())
    @State private var note = ""

    // Subscribe flow state
    @State private var isSubscribing = false
    @State private var subscribeError: String?
    @State private var confirmation: ServiceRequest?
    @State private var showingAuth = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                hero
                VStack(alignment: .leading, spacing: 16) {
                    header
                    Divider()
                    if let description = service.description, !description.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("About this experience")
                                .font(.title3).fontWeight(.semibold)
                                .foregroundStyle(Color.qkInk)
                            Text(description)
                                .font(.body)
                                .foregroundStyle(Color.qkMuted)
                        }
                        Divider()
                    }
                    subscribePanel
                }
                .padding(20)
            }
        }
        .background(LinearGradient.qkPageWash.ignoresSafeArea())
        .navigationTitle(service.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                ShareLink(
                    item: AppLinks.service(service.id),
                    subject: Text(shareTitle),
                    message: Text(loc.t("share.service.message")),
                    preview: SharePreview(shareTitle)
                ) {
                    Image(systemName: "square.and.arrow.up")
                        .foregroundStyle(Color.qkBurgundy)
                }
                .accessibilityLabel(loc.t("share.label"))
            }
        }
        .safeAreaInset(edge: .bottom) { subscribeBar }
        .sheet(isPresented: $showingAuth) {
            AuthView().environmentObject(auth)
        }
        .onChange(of: auth.isAuthenticated) { _, isAuthed in
            if isAuthed { showingAuth = false }
        }
        .overlay { confirmationOverlay }
    }

    /// "{title} — QuickIn" used as the share subject + preview title.
    private var shareTitle: String {
        String(format: loc.t("share.service.title"), service.title)
    }

    // MARK: - Hero

    /// Dark Ken Burns hero with a legibility scrim and the category pill, serif
    /// title and gold ★ rating overlaid at the bottom — matching the mockup.
    private var hero: some View {
        ZStack(alignment: .bottomLeading) {
            ListingImageView(url: service.photoURL, placeholderIconSize: 44)
                .frame(maxWidth: .infinity)
                .frame(height: 300)
                .kenBurns()
                .clipped()
                .qkPhotoScrim(strength: 0.55, start: 0.30)

            VStack(alignment: .leading, spacing: 8) {
                if let category = service.category, !category.isEmpty {
                    Text(category.capitalized)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.qkBurgundy)
                        .padding(.horizontal, 11).padding(.vertical, 4)
                        .background(Color.white.opacity(0.92))
                        .clipShape(Capsule())
                }
                Text(service.title)
                    .font(.system(.title, design: .serif).weight(.bold))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 6) {
                    Image(systemName: "star.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.qkGoldLight)
                    Text(String(format: "%.1f", service.displayRating))
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    if let location = service.location, !location.isEmpty {
                        Text("· \(location)")
                            .font(.system(size: 13))
                            .foregroundStyle(.white.opacity(0.9))
                            .lineLimit(1)
                    }
                }
            }
            .padding(18)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let host = service.hostName, !host.isEmpty {
                Label("Hosted by \(host)", systemImage: "person.crop.circle")
                    .font(.subheadline)
                    .foregroundStyle(Color.qkMuted)
            }
            if let location = service.location, !location.isEmpty {
                Label(location, systemImage: "mappin.and.ellipse")
                    .font(.subheadline)
                    .foregroundStyle(Color.qkMuted)
            }
        }
    }

    // MARK: - Subscribe panel

    private var subscribePanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Request this experience")
                .font(.title3).fontWeight(.semibold)
                .foregroundStyle(Color.qkInk)

            VStack(spacing: 10) {
                Toggle(isOn: $useDate.animation(.easeInOut(duration: 0.2))) {
                    Label("Preferred date", systemImage: "calendar")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color.qkInk)
                }
                .tint(.qkBurgundy)

                if useDate {
                    DatePicker("Date", selection: $preferredDate, in: Date()..., displayedComponents: .date)
                        .tint(.qkBurgundy)
                        .foregroundStyle(Color.qkInk)
                }

                TextField("Add a note for the host (optional)", text: $note, axis: .vertical)
                    .lineLimit(2...4)
                    .foregroundStyle(Color.qkInk)
                    .padding(12)
                    .background(Color.qkCream)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            HStack {
                Text("Price")
                    .foregroundStyle(Color.qkMuted)
                Spacer()
                Text(service.priceText)
                    .fontWeight(.bold)
                    .foregroundStyle(Color.qkInk)
            }
            .font(.subheadline)

            if let subscribeError {
                Text(subscribeError)
                    .font(.footnote)
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button {
                Task { await subscribe() }
            } label: {
                QKPrimaryButtonLabel(
                    title: auth.isAuthenticated ? "Subscribe" : "Sign in to subscribe",
                    isLoading: isSubscribing
                )
                .opacity(isSubscribing ? 0.85 : 1)
            }
            .buttonStyle(QKPressStyle())
            .disabled(isSubscribing)
        }
        .padding(18)
        .qkCard(lifts: false)
    }

    private var subscribeBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 4) {
                    Text(service.priceText)
                        .font(.system(size: 20, weight: .heavy))
                        .foregroundStyle(Color.qkBurgundy)
                    Text("per experience").font(.subheadline).foregroundStyle(Color.qkMuted)
                }
            }
            Spacer()
            Button {
                Task { await subscribe() }
            } label: {
                Text(auth.isAuthenticated ? "Subscribe" : "Sign in")
                    .fontWeight(.bold)
                    .foregroundStyle(Color.qkCream)
                    .padding(.horizontal, 30)
                    .padding(.vertical, 14)
                    .background(LinearGradient.qkBurgundyCTA)
                    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
            }
            .buttonStyle(QKPressStyle())
            .disabled(isSubscribing)
        }
        .padding(.horizontal, 20)
        .padding(.top, 14)
        .padding(.bottom, 14)
        .background(.regularMaterial)
        .overlay(Rectangle().frame(height: 1).foregroundStyle(Color.qkInk.opacity(0.08)), alignment: .top)
    }

    // MARK: - Confirmation modal (mirrors ListingDetailView's "Request sent")

    /// Dismiss the branded confirmation modal with a gentle fade.
    private func dismissConfirmation() {
        withAnimation(.easeInOut(duration: 0.2)) { confirmation = nil }
    }

    @ViewBuilder
    private var confirmationOverlay: some View {
        if let confirmation {
            ZStack {
                Color.black.opacity(0.45)
                    .ignoresSafeArea()
                    .onTapGesture { dismissConfirmation() }

                confirmationCard(for: confirmation)
                    .transition(.opacity.combined(with: .scale(scale: 0.96)))
            }
            .animation(.easeInOut(duration: 0.2), value: confirmation)
        }
    }

    private func confirmationCard(for request: ServiceRequest) -> some View {
        VStack(spacing: 16) {
            // Badge — pops in like the listing "request sent" modal.
            QKPopIn {
                Circle()
                    .fill(LinearGradient.qkBurgundyCTA)
                    .frame(width: 72, height: 72)
                    .overlay(
                        Image(systemName: "paperplane.fill")
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundStyle(Color.qkCream)
                    )
                    .shadow(color: Color.qkBurgundy.opacity(0.25), radius: 14, x: 0, y: 8)
            }

            // Title + subtitle
            VStack(spacing: 6) {
                Text("Request sent")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Color.qkInk)
                    .multilineTextAlignment(.center)
                Text("Waiting for the host to confirm your request for \(service.title).")
                    .font(.system(size: 15))
                    .foregroundStyle(Color.qkMuted)
                    .multilineTextAlignment(.center)
            }

            // Summary block
            VStack(spacing: 10) {
                HStack {
                    if !request.preferredDateText.isEmpty {
                        Text(request.preferredDateText)
                    } else {
                        Text(service.category?.capitalized ?? "Experience")
                    }
                    Spacer()
                    StatusBadge(status: request.requestStatus, onPhoto: false)
                }
                .font(.system(size: 13))
                .foregroundStyle(Color.qkMuted)

                Divider()

                HStack {
                    Text("Price")
                        .foregroundStyle(Color.qkMuted)
                    Spacer()
                    Text(service.priceText)
                        .fontWeight(.bold)
                        .foregroundStyle(Color.qkBurgundy)
                }
                .font(.system(size: 15))
            }
            .padding(14)
            .frame(maxWidth: .infinity)
            .background(Color.qkTan)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            // Primary action
            Button {
                dismissConfirmation()
            } label: {
                QKPrimaryButtonLabel(title: "Done", height: 50)
            }
            .buttonStyle(QKPressStyle())
        }
        .padding(24)
        .frame(maxWidth: 340)
        .background(Color.qkSurface)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .strokeBorder(Color.black.opacity(0.06), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.18), radius: 24, x: 0, y: 12)
        .padding(24)
    }

    // MARK: - Subscribe action

    private func subscribe() async {
        subscribeError = nil

        // Guests must sign in first.
        guard auth.isAuthenticated, ServiceService.shared.token != nil else {
            showingAuth = true
            return
        }

        isSubscribing = true
        defer { isSubscribing = false }

        var dateString: String?
        if useDate {
            let fmt = DateFormatter()
            fmt.locale = Locale(identifier: "en_US_POSIX")
            fmt.dateFormat = "yyyy-MM-dd"
            dateString = fmt.string(from: preferredDate)
        }

        do {
            let request = try await ServiceService.shared.subscribe(
                serviceID: service.id,
                preferredDate: dateString,
                note: note
            )
            confirmation = request
        } catch ServiceError.notSignedIn {
            showingAuth = true
        } catch {
            subscribeError = error.localizedDescription
        }
    }
}
