import SwiftUI

/// An animated shimmer overlay that sweeps a soft highlight across whatever it
/// modifies. Pair with `.redacted(reason: .placeholder)` to give loading
/// placeholders a subtle "loading" sheen. Respects Reduce Motion (falls back to
/// the static redacted look).
private struct Shimmer: ViewModifier {
    @State private var phase: CGFloat = -1
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .overlay {
                if !reduceMotion {
                    GeometryReader { geo in
                        let width = geo.size.width
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0),
                                Color.white.opacity(0.55),
                                Color.white.opacity(0),
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: width * 0.6)
                        .offset(x: phase * width * 1.6)
                        .blendMode(.plusLighter)
                    }
                    .allowsHitTesting(false)
                }
            }
            .clipped()
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

extension View {
    /// Sweeps a shimmer highlight across the view. Intended for skeleton
    /// placeholders shown while content loads.
    func shimmering() -> some View { modifier(Shimmer()) }
}

/// A single rounded "block" placeholder (image area, text line, pill…). Tan
/// fill so it reads as an empty card region against the cream background.
struct SkeletonBlock: View {
    var height: CGFloat
    var width: CGFloat? = nil
    var cornerRadius: CGFloat = 8

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(Color.qkTan)
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: .leading)
    }
}

/// A placeholder shaped like the real stay/service/reservation cards: a tall
/// image block on top, then a couple of text lines and a price line. Reused as
/// the loading state across the listing-style feeds so the skeleton matches the
/// layout that's about to appear.
struct SkeletonCard: View {
    var imageHeight: CGFloat = 200

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SkeletonBlock(height: imageHeight, cornerRadius: 0)

            VStack(alignment: .leading, spacing: 8) {
                SkeletonBlock(height: 16, width: 180)
                SkeletonBlock(height: 12, width: 120)
                SkeletonBlock(height: 14, width: 90)
                    .padding(.top, 2)
            }
            .padding(14)
        }
        .background(Color.qkSurface)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(Color.qkInk.opacity(0.05), lineWidth: 1)
        )
        .shadow(color: Color.qkInk.opacity(0.08), radius: 10, x: 0, y: 6)
        .shimmering()
    }
}

/// A vertical stack of `SkeletonCard`s used as the loading branch for a feed.
/// Mirrors the real list's spacing/padding so the swap is seamless.
struct SkeletonList: View {
    var count: Int = 5
    var imageHeight: CGFloat = 200

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                ForEach(0..<count, id: \.self) { _ in
                    SkeletonCard(imageHeight: imageHeight)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 32)
        }
        .redacted(reason: .placeholder)
        .allowsHitTesting(false)
    }
}

// MARK: - Shapes beyond the feed
//
// SkeletonList covered the browse feeds — stays, services, reservations, saved,
// subscriptions. Everything a guest reaches AFTER one of those still centred a
// ProgressView: tapping a card, opening a thread, checking earnings. A spinner
// there says "something is happening somewhere"; these say what is coming.
//
// A spinner inside a button is a different thing and stays as it is — it means
// THIS action is running, which is true and useful. Only the ones standing in for
// content belong here.

/// A detail screen: hero image, title, a row of facts, then body copy.
/// Shaped for ListingDetailView (300pt gallery) and ReservationDetailView.
struct SkeletonDetail: View {
    var heroHeight: CGFloat = 300

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                SkeletonBlock(height: heroHeight, cornerRadius: 0)

                VStack(alignment: .leading, spacing: 14) {
                    SkeletonBlock(height: 24, width: 240)
                    SkeletonBlock(height: 14, width: 160)

                    // The facts strip — nights, guests, rating.
                    HStack(spacing: 12) {
                        ForEach(0..<3, id: \.self) { _ in
                            VStack(alignment: .leading, spacing: 6) {
                                SkeletonBlock(height: 10, width: 52)
                                SkeletonBlock(height: 14)
                            }
                        }
                    }
                    .padding(.top, 4)

                    Divider().opacity(0.25).padding(.vertical, 4)

                    ForEach(0..<4, id: \.self) { i in
                        SkeletonBlock(height: 12, width: i == 3 ? 180 : nil)
                    }
                }
                .padding(18)
            }
            .shimmering()
        }
        .background(Color.qkCream)
        .redacted(reason: .placeholder)
        .allowsHitTesting(false)
    }
}

/// A chat transcript: bubbles alternating sides so it reads as a conversation
/// rather than a list. Matches the 18pt corner radius ChatView uses.
struct SkeletonChat: View {
    var count: Int = 5

    // Fixed widths and sides — a placeholder that reshuffles on every redraw is
    // more distracting than the spinner it replaced.
    private static let bubbles: [(width: CGFloat, mine: Bool)] = [
        (210, false), (150, true), (240, false), (120, true), (180, false), (140, true),
    ]

    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<count, id: \.self) { i in
                let bubble = Self.bubbles[i % Self.bubbles.count]
                HStack {
                    if bubble.mine { Spacer(minLength: 40) }
                    SkeletonBlock(height: 40, width: bubble.width, cornerRadius: 18)
                    if !bubble.mine { Spacer(minLength: 40) }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .shimmering()
        .redacted(reason: .placeholder)
        .allowsHitTesting(false)
    }
}

/// A grid of headline-number tiles, for the host dashboard, analytics and money
/// screens — the places that answer "how am I doing?" with a spinner today.
struct SkeletonStatTiles: View {
    var rows: Int = 2

    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<rows, id: \.self) { _ in
                HStack(spacing: 12) {
                    ForEach(0..<2, id: \.self) { _ in
                        VStack(alignment: .leading, spacing: 8) {
                            SkeletonBlock(height: 24, width: 84)
                            SkeletonBlock(height: 11, width: 108)
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.qkSurface)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .shimmering()
        .redacted(reason: .placeholder)
        .allowsHitTesting(false)
    }
}

/// Label-and-field pairs, for the settings and editor screens.
struct SkeletonForm: View {
    var fields: Int = 4
    var showsButton: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            ForEach(0..<fields, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 7) {
                    SkeletonBlock(height: 11, width: 96)
                    SkeletonBlock(height: 44, cornerRadius: 12)
                }
            }
            if showsButton {
                SkeletonBlock(height: 48, cornerRadius: 999)
                    .padding(.top, 4)
            }
        }
        .padding(16)
        .shimmering()
        .redacted(reason: .placeholder)
        .allowsHitTesting(false)
    }
}

#Preview("Feed") {
    ZStack {
        Color.qkCream.ignoresSafeArea()
        SkeletonList()
    }
}

#Preview("Detail") {
    SkeletonDetail()
}

#Preview("Chat") {
    ZStack {
        Color.qkCream.ignoresSafeArea()
        SkeletonChat()
    }
}

#Preview("Stats") {
    ZStack {
        Color.qkCream.ignoresSafeArea()
        SkeletonStatTiles()
    }
}

#Preview("Form") {
    ZStack {
        Color.qkCream.ignoresSafeArea()
        SkeletonForm()
    }
}
