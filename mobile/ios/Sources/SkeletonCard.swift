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

#Preview {
    ZStack {
        Color.qkCream.ignoresSafeArea()
        SkeletonList()
    }
}
