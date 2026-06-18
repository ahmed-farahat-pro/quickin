import SwiftUI

/// Loads the host's own services + their incoming subscription requests for the
/// host dashboard's Services section. Mirrors `HostDashboardViewModel`.
@MainActor
final class HostServicesViewModel: ObservableObject {
    @Published var requests: [ServiceRequest] = []
    @Published var services: [Service] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var hasLoaded = false

    /// Ids currently being confirmed/rejected, to disable their buttons.
    @Published var updatingIDs: Set<String> = []

    func load() async {
        isLoading = true
        errorMessage = nil
        async let requests = ServiceService.shared.hostServiceRequests()
        async let services = ServiceService.shared.hostServices()
        do {
            let (r, s) = try await (requests, services)
            self.requests = r
            self.services = s
        } catch ServiceError.notSignedIn {
            errorMessage = "Sign in as a host to manage your services."
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
        hasLoaded = true
    }

    var pendingRequests: [ServiceRequest] {
        requests.filter { $0.requestStatus == .pending }
    }

    var pastRequests: [ServiceRequest] {
        requests.filter { $0.requestStatus != .pending }
    }

    func update(_ request: ServiceRequest, action: HostBookingAction) async {
        updatingIDs.insert(request.id)
        defer { updatingIDs.remove(request.id) }
        do {
            _ = try await ServiceService.shared.setRequestStatus(id: request.id, action: action)
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// The host dashboard's "Services" section: an "Add service" CTA, an inbox of
/// incoming subscription requests (Accept / Reject), and the host's published
/// services. Embedded inside `HostDashboardView`. Mirrors the reservation
/// requests + listings sections.
struct HostServicesSection: View {
    @StateObject private var viewModel = HostServicesViewModel()
    @State private var showingAddService = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            sectionTitle

            addServiceCard

            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            requestsSection
            servicesSection
        }
        .sheet(isPresented: $showingAddService) {
            AddServiceView(onCreated: {
                Task { await viewModel.load() }
            })
        }
        // onAppear fires whenever the Services tab (which embeds this section)
        // becomes visible — always reload so service requests are never stale.
        .onAppear {
            Task { await viewModel.load() }
        }
    }

    private var sectionTitle: some View {
        Text("Services")
            .font(.system(.title2, design: .serif).weight(.semibold))
            .foregroundStyle(Color.qkInk)
            .padding(.top, 8)
    }

    // MARK: - Add service CTA

    private var addServiceCard: some View {
        Button {
            showingAddService = true
        } label: {
            HStack(spacing: 13) {
                Image(systemName: "sparkles")
                    .font(.title3)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Add a service")
                        .font(.system(size: 15, weight: .bold))
                    Text("Offer a standalone experience for guests to book.")
                        .font(.caption)
                        .foregroundStyle(Color.qkCream.opacity(0.82))
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.forward").font(.system(size: 14, weight: .semibold))
            }
            .foregroundStyle(Color.qkCream)
            .padding(16)
            .background(LinearGradient.qkBurgundyPanel)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(color: Color.qkBurgundy.opacity(0.26), radius: 14, x: 0, y: 10)
        }
        .buttonStyle(.qkTap)
    }

    // MARK: - Subscription requests (inbox)

    private var requestsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Service requests")
                .font(.system(.title3, design: .serif).weight(.semibold))
                .foregroundStyle(Color.qkInk)

            if viewModel.requests.isEmpty {
                emptyHint(icon: "tray", text: "No requests yet. They'll appear here when a guest subscribes to one of your services.")
            } else {
                ForEach(viewModel.pendingRequests) { request in
                    HostServiceRequestCard(
                        request: request,
                        isUpdating: viewModel.updatingIDs.contains(request.id),
                        onConfirm: { Task { await viewModel.update(request, action: .confirm) } },
                        onReject: { Task { await viewModel.update(request, action: .reject) } }
                    )
                }
                if !viewModel.pastRequests.isEmpty {
                    Text("Past")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.qkMuted)
                        .padding(.top, 4)
                    ForEach(viewModel.pastRequests) { request in
                        HostServiceRequestCard(request: request, isUpdating: false, onConfirm: nil, onReject: nil)
                    }
                }
            }
        }
    }

    // MARK: - Host services

    private var servicesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your services")
                .font(.system(.title3, design: .serif).weight(.semibold))
                .foregroundStyle(Color.qkInk)

            if viewModel.services.isEmpty {
                emptyHint(icon: "sparkles", text: "You haven't published a service yet. Tap “Add a service” to get started.")
            } else {
                ForEach(viewModel.services) { service in
                    HostServiceRow(service: service)
                }
            }
        }
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
}

/// A subscription-request row for the host inbox. Pending rows show Accept /
/// Reject; resolved rows show only their status badge (pass `nil` handlers).
/// Mirrors `HostRequestCard`.
struct HostServiceRequestCard: View {
    let request: ServiceRequest
    let isUpdating: Bool
    let onConfirm: (() -> Void)?
    let onReject: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(request.serviceTitle ?? "Service")
                    .font(.headline)
                    .foregroundStyle(Color.qkInk)
                    .lineLimit(1)
                Spacer()
                StatusBadge(status: request.requestStatus, onPhoto: false)
            }
            if let requester = request.requesterName, !requester.isEmpty {
                Label(requester, systemImage: "person.crop.circle")
                    .font(.subheadline)
                    .foregroundStyle(Color.qkInk)
                    .lineLimit(1)
            }
            if let category = request.serviceCategory, !category.isEmpty {
                Label(category.capitalized, systemImage: "tag.fill")
                    .font(.subheadline)
                    .foregroundStyle(Color.qkMuted)
                    .lineLimit(1)
            }
            if !request.preferredDateText.isEmpty {
                Label(request.preferredDateText, systemImage: "calendar")
                    .font(.subheadline)
                    .foregroundStyle(Color.qkInk)
            }
            if let note = request.note, !note.isEmpty {
                Text("“\(note)”")
                    .font(.subheadline)
                    .italic()
                    .foregroundStyle(Color.qkMuted)
            }
            HStack {
                if let email = request.requesterEmail, !email.isEmpty {
                    Text(email)
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                        .lineLimit(1)
                }
                Spacer()
                Text(request.priceText)
                    .fontWeight(.bold)
                    .foregroundStyle(Color.qkInk)
            }
            .font(.subheadline)

            if let code = request.requestCode, !code.isEmpty {
                Text(code)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(Color.qkMuted)
            }

            if onConfirm != nil || onReject != nil {
                actionButtons
            }
        }
        .padding(16)
        .qkCard(cornerRadius: 20)
    }

    private var actionButtons: some View {
        HStack(spacing: 12) {
            Button {
                onReject?()
            } label: {
                Text("Reject")
                    .fontWeight(.bold)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(Color.qkTan)
                    .foregroundStyle(Color.qkBurgundy)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.qkTap)
            .disabled(isUpdating)

            Button {
                onConfirm?()
            } label: {
                QKPrimaryButtonLabel(title: "Accept", isLoading: isUpdating, cornerRadius: 12, height: 44)
                    .opacity(isUpdating ? 0.85 : 1)
            }
            .buttonStyle(QKPressStyle(shadowRadius: 8))
            .disabled(isUpdating)
        }
        .padding(.top, 4)
    }
}

/// A compact row for one of the host's own services. Mirrors `HostListingRow`.
struct HostServiceRow: View {
    let service: Service

    var body: some View {
        HStack(spacing: 12) {
            ListingImageView(url: service.photoURL, placeholderLabel: "", placeholderIconSize: 22)
                .frame(width: 72, height: 72)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(service.title)
                    .font(.headline)
                    .foregroundStyle(Color.qkInk)
                    .lineLimit(1)
                if let category = service.category, !category.isEmpty {
                    Text(category.capitalized)
                        .font(.subheadline)
                        .foregroundStyle(Color.qkMuted)
                        .lineLimit(1)
                }
                Text(service.priceText)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.qkBurgundy)
            }
            Spacer()
        }
        .padding(12)
        .qkCard(cornerRadius: 18)
    }
}
