import SwiftUI

struct ListingDetailView: View {
    let listing: Listing
    @EnvironmentObject private var auth: AuthStore
    @State private var selectedImage = 0

    // Reserve inputs
    @State private var checkIn = Calendar.current.startOfDay(for: Date())
    @State private var checkOut = Calendar.current.date(byAdding: .day, value: 3, to: Date()) ?? Date()
    @State private var guests = 1

    // Reserve flow state
    @State private var isReserving = false
    @State private var reserveError: String?
    @State private var confirmation: Booking?
    @State private var showingAuth = false

    /// Whole nights between check-in and check-out (minimum 1).
    private var nights: Int {
        let days = Calendar.current.dateComponents([.day], from: checkIn, to: checkOut).day ?? 0
        return max(days, 1)
    }

    private var total: Int { nights * Int(listing.pricePerNight) }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    gallery
                    VStack(alignment: .leading, spacing: 16) {
                        header
                        Divider()
                        specs
                        if let description = listing.description, !description.isEmpty {
                            Divider()
                            VStack(alignment: .leading, spacing: 8) {
                                Text("About this place")
                                    .font(.title3).fontWeight(.semibold)
                                    .foregroundStyle(Color.qkInk)
                                Text(description)
                                    .font(.body)
                                    .foregroundStyle(Color.qkMuted)
                            }
                        }
                        Divider()
                        reservePanel.id("reserve")
                    }
                    .padding(20)
                }
            }
            .onAppear {
                // CLI screenshot hook: scroll the reserve panel into view.
                if UserDefaults.standard.bool(forKey: "uitestScroll") {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                        withAnimation { proxy.scrollTo("reserve", anchor: .top) }
                    }
                }
            }
        }
        .background(Color.qkCream.ignoresSafeArea())
        .navigationTitle(listing.title)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) { bookingBar }
        .sheet(isPresented: $showingAuth) {
            AuthView().environmentObject(auth)
        }
        .onChange(of: auth.isAuthenticated) { _, isAuthed in
            if isAuthed { showingAuth = false }
        }
        .alert("Reservation confirmed", isPresented: confirmationBinding) {
            Button("Done", role: .cancel) { confirmation = nil }
        } message: {
            if let confirmation {
                Text("You're booked at \(listing.title) for \(nights) night\(nights == 1 ? "" : "s") · \(confirmation.totalText).")
            }
        }
    }

    private var confirmationBinding: Binding<Bool> {
        Binding(get: { confirmation != nil }, set: { if !$0 { confirmation = nil } })
    }

    private var gallery: some View {
        TabView(selection: $selectedImage) {
            ForEach(Array(listing.sortedImageURLs.enumerated()), id: \.offset) { index, url in
                AsyncImage(url: URL(string: url)) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().aspectRatio(contentMode: .fill)
                    case .failure:
                        Color.qkTan.overlay(Image(systemName: "photo").foregroundStyle(Color.qkMuted))
                    default:
                        Color.qkTan.overlay(ProgressView().tint(.qkBurgundy))
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 300)
                .clipped()
                .tag(index)
            }
        }
        .frame(height: 300)
        .tabViewStyle(.page(indexDisplayMode: .always))
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(listing.title)
                .font(.title2).fontWeight(.bold)
                .foregroundStyle(Color.qkInk)
            if let location = listing.location {
                Label(location, systemImage: "mappin.and.ellipse")
                    .font(.subheadline)
                    .foregroundStyle(Color.qkMuted)
            }
            if listing.isGuestFavorite == true {
                Label("Guest favorite", systemImage: "star.fill")
                    .font(.caption).fontWeight(.semibold)
                    .foregroundStyle(Color.qkBurgundy)
            }
        }
    }

    private var specs: some View {
        HStack(spacing: 22) {
            spec(value: listing.maxGuests, label: "guests", system: "person.2.fill")
            spec(value: listing.bedrooms, label: "bedrooms", system: "bed.double.fill")
            spec(value: listing.beds, label: "beds", system: "bed.double")
            spec(value: listing.bathrooms, label: "baths", system: "shower.fill")
        }
    }

    private func spec(value: Int?, label: String, system: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: system).foregroundStyle(Color.qkBurgundy)
            Text("\(value ?? 0)").fontWeight(.semibold).foregroundStyle(Color.qkInk)
            Text(label).font(.caption).foregroundStyle(Color.qkMuted)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Reserve panel

    private var reservePanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Reserve your stay")
                .font(.title3).fontWeight(.semibold)
                .foregroundStyle(Color.qkInk)

            VStack(spacing: 10) {
                DatePicker("Check-in", selection: $checkIn, displayedComponents: .date)
                    .tint(.qkBurgundy)
                    .foregroundStyle(Color.qkInk)
                DatePicker("Check-out", selection: $checkOut, in: checkIn..., displayedComponents: .date)
                    .tint(.qkBurgundy)
                    .foregroundStyle(Color.qkInk)
                Stepper(value: $guests, in: 1...(listing.maxGuests ?? 16)) {
                    HStack(spacing: 8) {
                        Image(systemName: "person.2.fill").foregroundStyle(Color.qkBurgundy)
                        Text("\(guests) guest\(guests == 1 ? "" : "s")")
                            .foregroundStyle(Color.qkInk)
                    }
                }
                .tint(.qkBurgundy)
            }

            // Live total
            HStack {
                Text("\(listing.priceText) × \(nights) night\(nights == 1 ? "" : "s")")
                    .foregroundStyle(Color.qkMuted)
                Spacer()
                Text("\(listing.currencySymbol)\(total)")
                    .fontWeight(.bold)
                    .foregroundStyle(Color.qkInk)
            }
            .font(.subheadline)

            if let reserveError {
                Text(reserveError)
                    .font(.footnote)
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button {
                Task { await reserve() }
            } label: {
                ZStack {
                    if isReserving {
                        ProgressView().tint(.white)
                    } else {
                        Text(auth.isAuthenticated ? "Reserve" : "Sign in to reserve")
                            .fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(Color.qkBurgundy.opacity(isReserving ? 0.6 : 1))
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .disabled(isReserving)
        }
        .padding(18)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: Color.black.opacity(0.05), radius: 12, x: 0, y: 6)
    }

    private var bookingBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 4) {
                    Text(listing.priceText).font(.title3).fontWeight(.bold).foregroundStyle(Color.qkInk)
                    Text("/ night").font(.subheadline).foregroundStyle(Color.qkMuted)
                }
                Text("\(listing.currencySymbol)\(total) total · \(nights) night\(nights == 1 ? "" : "s")")
                    .font(.caption2).foregroundStyle(Color.qkMuted)
            }
            Spacer()
            Button {
                Task { await reserve() }
            } label: {
                Text(auth.isAuthenticated ? "Reserve" : "Sign in")
                    .fontWeight(.semibold)
                    .padding(.horizontal, 28)
                    .padding(.vertical, 12)
                    .background(Color.qkBurgundy)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
            }
            .disabled(isReserving)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
    }

    // MARK: - Reserve action

    private func reserve() async {
        reserveError = nil

        // Guests must sign in first.
        guard auth.isAuthenticated, BookingService.shared.token != nil else {
            showingAuth = true
            return
        }

        isReserving = true
        defer { isReserving = false }

        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.dateFormat = "yyyy-MM-dd"

        do {
            let booking = try await BookingService.shared.reserve(
                listingID: listing.id,
                checkIn: fmt.string(from: checkIn),
                checkOut: fmt.string(from: checkOut),
                guests: guests
            )
            confirmation = booking
        } catch BookingError.notSignedIn {
            showingAuth = true
        } catch {
            // 400 → server's { error } (e.g. dates unavailable); anything else.
            reserveError = error.localizedDescription
        }
    }
}
