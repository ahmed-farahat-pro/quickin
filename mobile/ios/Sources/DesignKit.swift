import SwiftUI

// QuickIn DesignKit — the reusable visual + animation vocabulary shared by every
// screen of the redesign. Mirrors the web mockup's `.qk-*` classes and the 7
// animation keyframes (see /tmp/redesign-spec.md). Everything here is locale /
// RTL agnostic: we use leading/trailing, symmetric padding and SF Symbols that
// mirror under `.environment(\.layoutDirection, .rightToLeft)`.

// MARK: - Animation curves

enum QKAnim {
    /// qkSwap / qkOver — screen + overlay enter. `cubic-bezier(0.22,1,0.36,1)`.
    static let swap = Animation.timingCurve(0.22, 1, 0.36, 1, duration: 0.42)
    /// Slightly quicker variant for overlay transitions (qkOver = 0.40s).
    static let over = Animation.timingCurve(0.22, 1, 0.36, 1, duration: 0.40)
    /// Springy press/heart. Matches the web `cubic-bezier(.34,1.56,.64,1)` feel.
    static let press = Animation.spring(response: 0.3, dampingFraction: 0.6)
    /// Bouncy pop used for badges + confirmation marks (qkPop).
    static let pop = Animation.spring(response: 0.45, dampingFraction: 0.55)
    /// Gentle content reveal (qkSlideUp).
    static let slideUp = Animation.timingCurve(0.22, 1, 0.36, 1, duration: 0.5)
}

// MARK: - Press style (qk-press / qk-tap)

/// Primary button feel: press → `scaleEffect(0.97)` with a springy settle, plus
/// a burgundy drop shadow. Use on every primary CTA. Honors Reduce Motion.
struct QKPressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Shadow tint — burgundy for filled CTAs, ink for light surfaces.
    var shadow: Color = Color.qkBurgundy.opacity(0.28)
    var shadowRadius: CGFloat = 12
    var pressedScale: CGFloat = 0.97

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(reduceMotion ? 1 : (configuration.isPressed ? pressedScale : 1))
            .shadow(color: shadow,
                    radius: configuration.isPressed ? shadowRadius * 0.6 : shadowRadius,
                    x: 0, y: configuration.isPressed ? 4 : 8)
            .animation(reduceMotion ? nil : QKAnim.press, value: configuration.isPressed)
    }
}

/// Lighter "tap" feel for tiles/rows: press → `scaleEffect(0.98)`, no shadow.
struct QKTapStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var pressedScale: CGFloat = 0.98

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(reduceMotion ? 1 : (configuration.isPressed ? pressedScale : 1))
            .animation(reduceMotion ? nil : QKAnim.press, value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == QKTapStyle {
    static var qkTap: QKTapStyle { QKTapStyle() }
}

// MARK: - Card

/// `qkCard()` — the boutique card recipe: white surface, 22pt continuous corner,
/// hairline ink border, resting shadow, and a subtle lift on first appear.
private struct QKCardModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var cornerRadius: CGFloat = 22
    var lifts: Bool = true
    @State private var appeared = false

    func body(content: Content) -> some View {
        content
            .background(Color.qkSurface)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(Color.qkInk.opacity(0.05), lineWidth: 1)
            )
            .shadow(color: Color.qkInk.opacity(0.10),
                    radius: appeared ? 18 : 8,
                    x: 0, y: appeared ? 10 : 6)
            .scaleEffect(appeared || reduceMotion ? 1 : 0.98)
            .opacity(appeared || reduceMotion ? 1 : 0)
            .onAppear {
                guard lifts, !reduceMotion else { appeared = true; return }
                withAnimation(QKAnim.swap) { appeared = true }
            }
    }
}

extension View {
    /// Apply the boutique card surface + resting shadow + appear lift.
    func qkCard(cornerRadius: CGFloat = 22, lifts: Bool = true) -> some View {
        modifier(QKCardModifier(cornerRadius: cornerRadius, lifts: lifts))
    }
}

// MARK: - Screen / overlay transitions

extension AnyTransition {
    /// qkSwap — a leading-side nudge + fade for tab/screen content swaps. The
    /// nudge respects writing direction: from the right in LTR, from the left in
    /// RTL (SwiftUI's `.offset` is not auto-mirrored, so we flip the sign).
    static func qkScreen(rtl: Bool) -> AnyTransition {
        .asymmetric(
            insertion: .offset(x: rtl ? -14 : 14).combined(with: .opacity),
            removal: .opacity
        )
    }
}

/// Wrap screen content so it animates in with the qkSwap curve when `key`
/// changes (e.g. the selected tab). Reduce Motion → plain fade. RTL-aware.
struct QKScreenSwap<Content: View, Key: Hashable>: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.layoutDirection) private var layoutDirection
    let key: Key
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .id(key)
            .transition(reduceMotion ? .opacity : .qkScreen(rtl: layoutDirection == .rightToLeft))
            .animation(reduceMotion ? .default : QKAnim.swap, value: key)
    }
}

// MARK: - Ken Burns (qkZoom)

/// Slow hero zoom: `scale(1) → scale(1.09)` over 14s, repeating + autoreversing.
private struct KenBurnsModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var zoom = false
    var maxScale: CGFloat = 1.09

    func body(content: Content) -> some View {
        content
            .scaleEffect(reduceMotion ? 1 : (zoom ? maxScale : 1))
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 14).repeatForever(autoreverses: true)) {
                    zoom = true
                }
            }
    }
}

extension View {
    /// Apply the slow Ken Burns hero zoom. Clip the parent to contain it.
    func kenBurns(maxScale: CGFloat = 1.09) -> some View {
        modifier(KenBurnsModifier(maxScale: maxScale))
    }
}

// MARK: - Eyebrow label

/// Uppercase, wide-tracked gold eyebrow (e.g. "NORTH COAST · EGYPT"). Mono-ish
/// premium label that sits above section / hero headlines.
struct QKEyebrow: View {
    let text: String
    var color: Color = .qkGold

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .bold, design: .monospaced))
            .tracking(2.2)
            .foregroundStyle(color)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
    }
}

// MARK: - Gold star rating

/// Compact gold ★ + value, used on listing/service cards and detail headers.
struct QKStarRating: View {
    let value: Double
    var size: CGFloat = 13
    var tint: Color = .qkGold
    var textColor: Color = .qkInk

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "star.fill")
                .font(.system(size: size - 1))
                .foregroundStyle(tint)
            Text(formatted)
                .font(.system(size: size, weight: .semibold))
                .foregroundStyle(textColor)
                .monospacedDigit()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Rated \(formatted) out of 5")
    }

    private var formatted: String {
        String(format: "%.1f", value)
    }
}

// MARK: - Gradient avatar

/// Circular initials avatar with a brand/gold gradient + soft glow. Used for the
/// profile header, host rows and chat. `gold == true` switches the burgundy
/// gradient to the gold avatar gradient (host / superhost accent).
struct QKAvatar: View {
    let initials: String
    var size: CGFloat = 88
    var gold: Bool = false

    var body: some View {
        Circle()
            .fill(gold ? AnyShapeStyle(LinearGradient.qkGoldAvatar)
                       : AnyShapeStyle(LinearGradient.qkBurgundyCTA))
            .frame(width: size, height: size)
            .overlay(
                Text(initials)
                    .font(.system(size: size * 0.36, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.qkCream)
            )
            .shadow(color: (gold ? Color.qkGold : Color.qkBurgundy).opacity(0.3),
                    radius: size * 0.13, x: 0, y: size * 0.1)
    }
}

// MARK: - Avatar image helpers

/// Shared helpers for turning the profile `avatar_url` (which may be an
/// `http(s)://` URL or an inline `data:image/jpeg;base64,…` data URL) into a
/// `UIImage`, and for producing such a data URL from a freshly-picked photo.
enum QKAvatarImage {
    /// Decode an inline `data:` URL into a `UIImage`. Returns `nil` for non-data
    /// strings (e.g. http URLs, which `AsyncImage` handles instead) or malformed
    /// payloads.
    static func decodeDataURL(_ string: String?) -> UIImage? {
        guard let string, string.hasPrefix("data:") else { return nil }
        // data:[<mediatype>][;base64],<data>
        guard let comma = string.firstIndex(of: ","), string[..<comma].contains(";base64") else {
            return nil
        }
        let base64 = String(string[string.index(after: comma)...])
        guard let data = Data(base64Encoded: base64) else { return nil }
        return UIImage(data: data)
    }

    /// Whether the string is a remote `http(s)://` URL we should load with
    /// `AsyncImage` (as opposed to an inline data URL or initials fallback).
    static func isRemoteURL(_ string: String?) -> Bool {
        guard let string else { return false }
        return string.hasPrefix("http://") || string.hasPrefix("https://")
    }

    /// Downscale `image` so its longest side is ≤ `maxDimension`, JPEG-encode it,
    /// and wrap it in a `data:image/jpeg;base64,…` URL suitable for the profile
    /// `avatar_url`. Returns `nil` only if JPEG encoding fails.
    static func makeDataURL(from image: UIImage, maxDimension: CGFloat = 256, quality: CGFloat = 0.8) -> String? {
        let scaled = downscale(image, maxDimension: maxDimension)
        guard let jpeg = scaled.jpegData(compressionQuality: quality) else { return nil }
        return "data:image/jpeg;base64,\(jpeg.base64EncodedString())"
    }

    /// Aspect-fit downscale (no upscaling) using a flattened, opaque context so the
    /// resulting JPEG has no alpha and a predictable size.
    private static func downscale(_ image: UIImage, maxDimension: CGFloat) -> UIImage {
        let size = image.size
        let longest = max(size.width, size.height)
        guard longest > maxDimension, longest > 0 else { return image }
        let scale = maxDimension / longest
        let target = CGSize(width: size.width * scale, height: size.height * scale)

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1          // target is already in pixels
        format.opaque = true      // JPEG has no alpha anyway
        let renderer = UIGraphicsImageRenderer(size: target, format: format)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
    }
}

/// Circular profile avatar that prefers a real photo from `avatarURL` (a `data:`
/// or `http(s)://` URL) and falls back to the gradient `QKAvatar` initials when
/// none is available or the URL can't be rendered. Matches `QKAvatar`'s size +
/// gold glow so it drops in wherever an initials avatar was used.
struct QKPhotoAvatar: View {
    let avatarURL: String?
    let initials: String
    var size: CGFloat = 88
    var gold: Bool = false

    var body: some View {
        if let image = QKAvatarImage.decodeDataURL(avatarURL) {
            photo(Image(uiImage: image))
        } else if QKAvatarImage.isRemoteURL(avatarURL), let url = URL(string: avatarURL ?? "") {
            AsyncImage(url: url) { phase in
                if let image = phase.image {
                    photo(image)
                } else if phase.error != nil {
                    QKAvatar(initials: initials, size: size, gold: gold)
                } else {
                    Circle()
                        .fill(Color.qkTan)
                        .frame(width: size, height: size)
                        .overlay(ProgressView().tint(.qkBurgundy))
                }
            }
        } else {
            QKAvatar(initials: initials, size: size, gold: gold)
        }
    }

    /// Shared circular frame + ring + brand glow for a rendered photo.
    private func photo(_ image: Image) -> some View {
        image
            .resizable()
            .scaledToFill()
            .frame(width: size, height: size)
            .clipShape(Circle())
            .overlay(
                Circle().strokeBorder((gold ? Color.qkGold : Color.qkBurgundy).opacity(0.18), lineWidth: 1)
            )
            .shadow(color: (gold ? Color.qkGold : Color.qkBurgundy).opacity(0.3),
                    radius: size * 0.13, x: 0, y: size * 0.1)
    }
}

// MARK: - Pop-in badge

/// A badge/pill that pops in with the springy `qkPop` (scale 0.5 → 1.1 → 1).
/// Wrap any label content. Honors Reduce Motion.
struct QKPopIn<Content: View>: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var delay: Double = 0
    @ViewBuilder var content: () -> Content
    @State private var shown = false

    var body: some View {
        content()
            .scaleEffect(shown || reduceMotion ? 1 : 0.5)
            .opacity(shown || reduceMotion ? 1 : 0)
            .onAppear {
                guard !reduceMotion else { shown = true; return }
                withAnimation(QKAnim.pop.delay(delay)) { shown = true }
            }
    }
}

/// The "Guest favorite" gold-trimmed pill from the mockup.
struct QKGuestFavoriteBadge: View {
    let text: String
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "star.fill")
                .font(.system(size: 10))
                .foregroundStyle(Color.qkGold)
            Text(text)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.qkBurgundy)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 5)
        .background(Color.qkTan)
        .clipShape(Capsule())
    }
}

// MARK: - Heart (qk-heart)

/// Springy favorite heart on a frosted white circle, with a pop on toggle.
struct QKHeartButton: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding var isOn: Bool
    var size: CGFloat = 36
    var action: (() -> Void)? = nil
    @State private var bump = false

    var body: some View {
        Button {
            isOn.toggle()
            action?()
            guard !reduceMotion else { return }
            bump = true
            withAnimation(QKAnim.press) { bump = false }
        } label: {
            Image(systemName: isOn ? "heart.fill" : "heart")
                .font(.system(size: size * 0.5, weight: .semibold))
                .foregroundStyle(isOn ? Color.qkBurgundy : Color.qkInk)
                .frame(width: size, height: size)
                .background(.regularMaterial, in: Circle())
                .overlay(Circle().strokeBorder(Color.white.opacity(0.5), lineWidth: 0.5))
                .shadow(color: Color.qkInk.opacity(0.16), radius: 6, x: 0, y: 3)
                .scaleEffect(bump ? 1.18 : 1)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isOn ? "Saved" : "Save")
    }
}

// MARK: - Share button (qk-share)

/// On-brand share control: a SwiftUI `ShareLink` dressed in the same frosted
/// white circle as `QKHeartButton`, so it sits naturally beside the heart in a
/// hero overlay. Shares `url` with a localized `message` and a system preview
/// titled `title`. The arrow glyph mirrors automatically in RTL.
struct QKShareButton: View {
    let url: URL
    let title: String
    var message: String? = nil
    var size: CGFloat = 40

    var body: some View {
        ShareLink(
            item: url,
            subject: Text(title),
            message: message.map { Text($0) },
            preview: SharePreview(title)
        ) {
            Image(systemName: "square.and.arrow.up")
                .font(.system(size: size * 0.42, weight: .semibold))
                .foregroundStyle(Color.qkInk)
                // Nudge the glyph up a hair so it sits optically centered.
                .offset(y: -size * 0.03)
                .frame(width: size, height: size)
                .background(.regularMaterial, in: Circle())
                .overlay(Circle().strokeBorder(Color.white.opacity(0.5), lineWidth: 0.5))
                .shadow(color: Color.qkInk.opacity(0.16), radius: 6, x: 0, y: 3)
        }
        .accessibilityLabel(title)
    }
}

// MARK: - Animated draw checkmark (qkDraw)

/// A checkmark `Shape` whose stroke is `trim`-animated 0 → 1, for the
/// confirmed-booking mark. Pair with `QKPopIn` on the enclosing circle.
struct QKCheckmarkShape: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        // Normalized check geometry mapped into rect.
        p.move(to: CGPoint(x: rect.minX + rect.width * 0.20, y: rect.minY + rect.height * 0.52))
        p.addLine(to: CGPoint(x: rect.minX + rect.width * 0.42, y: rect.minY + rect.height * 0.72))
        p.addLine(to: CGPoint(x: rect.minX + rect.width * 0.80, y: rect.minY + rect.height * 0.30))
        return p
    }
}

/// Self-contained confirmed mark: a circle that pops, with a checkmark that
/// draws on. `light == true` draws a cream check on burgundy (dark backdrops);
/// otherwise burgundy check on cream.
struct QKDrawCheck: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var size: CGFloat = 92
    var light: Bool = false
    @State private var trim: CGFloat = 0
    @State private var popped = false

    private var circleFill: Color { light ? .qkBurgundy : .qkCream }
    private var strokeColor: Color { light ? .qkCream : .qkBurgundy }

    var body: some View {
        ZStack {
            Circle()
                .fill(circleFill)
                .frame(width: size, height: size)
                .shadow(color: Color.qkBurgundy.opacity(0.25), radius: 16, x: 0, y: 10)

            QKCheckmarkShape()
                .trim(from: 0, to: reduceMotion ? 1 : trim)
                .stroke(strokeColor, style: StrokeStyle(lineWidth: size * 0.075, lineCap: .round, lineJoin: .round))
                .frame(width: size * 0.55, height: size * 0.55)
        }
        .scaleEffect(popped || reduceMotion ? 1 : 0.5)
        .onAppear {
            guard !reduceMotion else { trim = 1; popped = true; return }
            withAnimation(QKAnim.pop) { popped = true }
            withAnimation(.easeOut(duration: 0.55).delay(0.25)) { trim = 1 }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Pulse ring (qkPulse)

/// Expanding/fading burgundy ring behind a primary CTA or map pin. Loops.
struct QKPulseRing: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var color: Color = Color.qkBurgundy
    var cornerRadius: CGFloat = 18
    var lineWidth: CGFloat = 2
    @State private var animate = false

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .stroke(color.opacity(animate ? 0 : 0.5), lineWidth: lineWidth)
            .scaleEffect(animate ? 1.06 : 1)
            .opacity(animate ? 0 : 1)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeOut(duration: 1.8).repeatForever(autoreverses: false)) {
                    animate = true
                }
            }
            .allowsHitTesting(false)
    }
}

// MARK: - Pills, chips & rows

/// Standard selectable chip (region / sort / filter). Selected fills burgundy;
/// unselected is a white pill with a hairline border. Springy tap.
struct QKChip: View {
    let title: String
    var count: Int? = nil
    var isSelected: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                if let count {
                    Text("\(count)")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(isSelected ? Color.white : Color.qkMuted)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(isSelected ? Color.white.opacity(0.22) : Color.qkTan)
                        .clipShape(Capsule())
                }
            }
            .foregroundStyle(isSelected ? Color.qkCream : Color.qkInk)
            .padding(.horizontal, 15)
            .frame(height: 36)
            .background(
                Group {
                    if isSelected {
                        LinearGradient.qkBurgundyCTA
                    } else {
                        Color.qkSurface
                    }
                }
            )
            .clipShape(Capsule(style: .continuous))
            .overlay(
                Capsule(style: .continuous)
                    .strokeBorder(isSelected ? Color.clear : Color.qkInk.opacity(0.1), lineWidth: 1)
            )
        }
        .buttonStyle(.qkTap)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// A settings/list row recipe: leading burgundy glyph, title (+ optional
/// subtitle), trailing chevron that mirrors in RTL. Tap feel built in.
struct QKListRow: View {
    let icon: String
    let title: String
    var subtitle: String? = nil
    var tint: Color = .qkBurgundy
    var showChevron: Bool = true
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(tint)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.qkInk)
                    if let subtitle {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(Color.qkMuted)
                    }
                }
                Spacer(minLength: 8)
                if showChevron {
                    Image(systemName: "chevron.forward")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.qkTan4)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 15)
            .contentShape(Rectangle())
        }
        .buttonStyle(.qkTap)
    }
}

// MARK: - Buttons

/// The primary burgundy-gradient CTA button label. Compose inside a `Button`
/// with `.buttonStyle(QKPressStyle())`. `pulse` adds the looping ring.
struct QKPrimaryButtonLabel: View {
    let title: String
    var systemImage: String? = nil
    var isLoading: Bool = false
    var cornerRadius: CGFloat = 16
    var height: CGFloat = 52

    var body: some View {
        ZStack {
            if isLoading {
                ProgressView().tint(.white)
            } else {
                HStack(spacing: 8) {
                    if let systemImage {
                        Image(systemName: systemImage)
                            .font(.system(size: 16, weight: .semibold))
                    }
                    Text(title).fontWeight(.bold)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .foregroundStyle(Color.qkCream)
        .background(LinearGradient.qkBurgundyCTA)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }
}

// MARK: - Display rating

/// The redesign cards show a gold ★ rating, but the backend has no per-listing
/// rating column yet. We derive a stable, pleasant display value (4.6–5.0) from
/// the entity id so each card shows the same star every render — a purely
/// cosmetic flourish until real ratings land. Guest favorites skew higher.
enum QKRating {
    static func display(for id: String, favorite: Bool = false) -> Double {
        let hash = abs(id.hashValue)
        // 0...4 → map to 4.6, 4.7, 4.8, 4.9, 5.0
        let base = 46 + (hash % 5)
        let value = Double(base) / 10.0
        if favorite { return min(5.0, max(value, 4.8)) }
        return value
    }
}

extension Listing {
    /// The rating to show on cards. Prefers the real average once the place has
    /// reviews; otherwise falls back to the stable cosmetic value so cards never
    /// look empty during the rollout.
    var displayRating: Double {
        hasRating ? rating : QKRating.display(for: id, favorite: isGuestFavorite == true)
    }
}

extension Service {
    var displayRating: Double { QKRating.display(for: id) }
}

// MARK: - Photo legibility overlay

extension View {
    /// Bottom-up dark scrim for text legibility over hero photos:
    /// `linear-gradient(180deg, transparent 45% → rgba(42,34,32,0.6))`.
    func qkPhotoScrim(strength: Double = 0.6, start: Double = 0.45) -> some View {
        overlay(
            LinearGradient(
                stops: [
                    .init(color: .clear, location: start),
                    .init(color: Color.qkInk.opacity(strength), location: 1),
                ],
                startPoint: .top, endPoint: .bottom
            )
        )
    }
}

// MARK: - Animated sea waves (vacation motif)

/// A horizontally-scrolling sine wave filled to the bottom — layered to evoke the
/// sea. `phase` animates continuously for a gentle "water" motion.
struct QKWaveShape: Shape {
    var phase: CGFloat
    var amplitude: CGFloat = 3
    /// Fraction of the height where the waterline sits (0 = top, 1 = bottom).
    var baseline: CGFloat = 0.6
    var wavelength: CGFloat = 20

    var animatableData: CGFloat {
        get { phase }
        set { phase = newValue }
    }

    func path(in rect: CGRect) -> Path {
        var p = Path()
        let mid = rect.height * baseline
        p.move(to: CGPoint(x: rect.minX, y: mid))
        var x: CGFloat = 0
        while x <= rect.width {
            let y = mid + sin((x / wavelength) * .pi * 2 + phase) * amplitude
            p.addLine(to: CGPoint(x: rect.minX + x, y: y))
            x += 2
        }
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}

/// A boutique "sun over the sea" mark for the AI travel concierge launcher: a
/// gold sun and two scrolling cream/gold waves. Loops forever; honors Reduce
/// Motion (waves rest flat).
struct QKVacationWavesIcon: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var size: CGFloat = 30
    @State private var phase: CGFloat = 0

    var body: some View {
        ZStack {
            // Sun, upper-trailing, with a soft glow.
            Circle()
                .fill(Color.qkGoldLight)
                .frame(width: size * 0.26, height: size * 0.26)
                .shadow(color: Color.qkGoldLight.opacity(0.85), radius: size * 0.12)
                .offset(x: size * 0.26, y: -size * 0.24)

            // Two layered waves, clipped to the icon circle.
            ZStack {
                QKWaveShape(phase: phase, amplitude: size * 0.07, baseline: 0.56, wavelength: size * 0.72)
                    .fill(Color.qkGoldLight.opacity(0.55))
                QKWaveShape(phase: phase + .pi * 0.9, amplitude: size * 0.085, baseline: 0.66, wavelength: size * 0.58)
                    .fill(Color.qkCream)
            }
            .frame(width: size, height: size)
            .clipShape(Circle())
        }
        .frame(width: size, height: size)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.linear(duration: 2.4).repeatForever(autoreverses: false)) {
                phase = .pi * 2
            }
        }
    }
}
