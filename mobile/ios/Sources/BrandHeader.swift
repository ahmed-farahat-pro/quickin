import SwiftUI

// QuickIn branded travel header — replaces the stock iOS large titles on the
// root tabs with a boutique burgundy "boarding pass" banner. On appear a little
// plane climbs in along a dashed gold contrail (like a takeoff) and, in its
// wake, the eyebrow + title/wordmark + subtitle are "delivered" with a gentle
// rise. Harmonizes with the launch splash (the mark that flies in from afar)
// and the DesignKit vocabulary (qkBurgundyCTA, QKEyebrow, qkGold). Fully RTL-
// aware and honors Reduce Motion (everything just settles, no flight).

// MARK: - Flight contrail + plane

/// A gentle climbing arc with a dashed gold contrail that draws on, a plane at
/// its head, and a soft glow. `progress` (0→1) is driven by the parent so the
/// title reveal can be timed to the plane's path. RTL flips the climb + plane.
struct QKFlightTrail: View {
    @Environment(\.layoutDirection) private var layoutDirection
    @Binding var progress: CGFloat
    var tint: Color = .qkGoldLight

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let rtl = layoutDirection == .rightToLeft
            // A steady climb (takeoff) from the bottom-leading edge up to the
            // top-trailing edge. Mirrored for RTL so it still reads "forward".
            let p0 = CGPoint(x: rtl ? w : 0,          y: h * 0.94)
            let c  = CGPoint(x: w * (rtl ? 0.55 : 0.45), y: h * 0.30)
            let p1 = CGPoint(x: rtl ? w * 0.05 : w * 0.95, y: h * 0.10)
            let head = quadPoint(p0, c, p1, progress)

            ZStack {
                // Dashed contrail, drawn up to the plane's current position.
                QKQuadPath(p0: p0, c: c, p1: p1)
                    .trim(from: 0, to: progress)
                    .stroke(tint.opacity(0.55),
                            style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [1.5, 7]))

                // The plane at the head of the trail — nose tilted up as it climbs.
                Image(systemName: "airplane")
                    .font(.system(size: 19, weight: .semibold))
                    .foregroundStyle(tint)
                    .scaleEffect(x: rtl ? -1 : 1, y: 1)            // face the travel direction
                    .rotationEffect(.degrees(rtl ? 12 : -12))       // slight climb tilt
                    .shadow(color: tint.opacity(0.6), radius: 6, x: 0, y: 0)
                    .position(head)
                    .opacity(progress > 0.04 ? 1 : 0)
            }
        }
        .allowsHitTesting(false)
    }

    /// Point on the quadratic Bézier P0→(control C)→P1 at parameter `t`.
    private func quadPoint(_ p0: CGPoint, _ c: CGPoint, _ p1: CGPoint, _ t: CGFloat) -> CGPoint {
        let mt = 1 - t
        return CGPoint(
            x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
            y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y
        )
    }
}

/// A bare quadratic-curve `Shape` (so `.trim` can animate the contrail drawing).
private struct QKQuadPath: Shape {
    let p0: CGPoint
    let c: CGPoint
    let p1: CGPoint
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: p0)
        p.addQuadCurve(to: p1, control: c)
        return p
    }
}

// MARK: - Brand header banner

/// The boutique travel header. Drop it at the top of a root tab (inside the
/// NavigationStack, with `.toolbar(.hidden, for: .navigationBar)`) in place of
/// `.navigationTitle`. `wordmark: true` renders the two-tone "QuickIn" brand
/// mark; otherwise `title` is shown in the serif display face. `trailing` is an
/// optional accessory (avatar / bell) laid over the burgundy.
struct QKBrandHeader<Trailing: View>: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var eyebrow: String? = nil
    var title: String = ""
    var subtitle: String? = nil
    var wordmark: Bool = false
    @ViewBuilder var trailing: () -> Trailing

    /// Plane progress 0→1 (also gates the title reveal timing).
    @State private var progress: CGFloat = 0
    /// Text reveal (rise + fade), kicked off shortly after the plane departs.
    @State private var revealed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            QKFlightTrail(progress: $progress)
                .frame(height: 32)

            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 5) {
                    if let eyebrow {
                        QKEyebrow(text: eyebrow, color: .qkGoldLight)
                            .opacity(revealed ? 1 : 0)
                    }
                    titleView
                    if let subtitle {
                        Text(subtitle)
                            .font(.system(size: 13.5, weight: .medium))
                            .foregroundStyle(Color.qkCream.opacity(0.84))
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                            .opacity(revealed ? 1 : 0)
                    }
                }
                Spacer(minLength: 8)
                trailing()
                    .opacity(revealed ? 1 : 0)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 18)
        // Size the burgundy surface to the content (not greedy) so the banner
        // stays a compact hero regardless of how short the screen below is.
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(background)
        .padding(.horizontal, 12)
        .padding(.top, 6)
        .onAppear(perform: run)
    }

    // MARK: Title / wordmark

    @ViewBuilder
    private var titleView: some View {
        Group {
            if wordmark {
                // Two-tone brand mark: cream "Quick" + gold "In".
                (Text("Quick").foregroundColor(.qkCream)
                 + Text("In").foregroundColor(.qkGoldLight))
                    .font(.system(size: 38, weight: .heavy, design: .serif))
            } else {
                Text(title)
                    .font(.system(size: 29, weight: .heavy, design: .serif))
                    .foregroundStyle(Color.qkCream)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .shadow(color: Color.qkBurgundyDark.opacity(0.4), radius: 8, x: 0, y: 4)
        .opacity(revealed ? 1 : 0)
        .offset(y: revealed ? 0 : 10)
    }

    // MARK: Background

    private var background: some View {
        let shape = RoundedRectangle(cornerRadius: 28, style: .continuous)
        return shape
            .fill(LinearGradient.qkBurgundyCTA)
            .overlay(
                // Soft gold glow in the top-trailing corner — the "sky".
                RadialGradient(
                    colors: [Color.qkGoldLight.opacity(0.26), .clear],
                    center: .topTrailing, startRadius: 4, endRadius: 240
                )
            )
            .clipShape(shape)            // keep the glow inside the rounded corners
            .overlay(
                // Hairline highlight for a crafted, embossed edge.
                shape.strokeBorder(Color.qkCream.opacity(0.14), lineWidth: 1)
            )
            .shadow(color: Color.qkBurgundy.opacity(0.30), radius: 18, x: 0, y: 10)
    }

    // MARK: Animation

    private func run() {
        guard !reduceMotion else { progress = 1; revealed = true; return }
        // Plane climbs in (takeoff easing), then the text is delivered in its wake.
        withAnimation(.timingCurve(0.22, 1, 0.36, 1, duration: 1.05)) { progress = 1 }
        withAnimation(QKAnim.slideUp.delay(0.30)) { revealed = true }
    }
}

extension QKBrandHeader where Trailing == EmptyView {
    /// Convenience for headers with no trailing accessory (Services / Saved).
    init(eyebrow: String? = nil, title: String = "", subtitle: String? = nil, wordmark: Bool = false) {
        self.init(eyebrow: eyebrow, title: title, subtitle: subtitle, wordmark: wordmark) { EmptyView() }
    }
}

// MARK: - Header accessory button (frosted cream, for the burgundy banner)

/// A circular header action that sits on the burgundy banner: a frosted cream
/// disc with a cream glyph and an optional gold unread badge. Pushes `destination`.
struct QKHeaderIconButton<Destination: View>: View {
    let systemName: String
    var badge: Int = 0
    var accessibilityLabel: String = ""
    @ViewBuilder var destination: () -> Destination

    var body: some View {
        NavigationLink {
            destination()
        } label: {
            Image(systemName: systemName)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color.qkCream)
                .frame(width: 40, height: 40)
                .background(Color.qkCream.opacity(0.16), in: Circle())
                .overlay(Circle().strokeBorder(Color.qkCream.opacity(0.28), lineWidth: 1))
                .overlay(alignment: .topTrailing) {
                    if badge > 0 {
                        Text(badge > 99 ? "99+" : "\(badge)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Color.qkBurgundy)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(Color.qkGoldLight)
                            .clipShape(Capsule())
                            .overlay(Capsule().strokeBorder(Color.qkBurgundy.opacity(0.25), lineWidth: 1))
                            .offset(x: 6, y: -5)
                    }
                }
        }
        .accessibilityLabel(accessibilityLabel)
    }
}
