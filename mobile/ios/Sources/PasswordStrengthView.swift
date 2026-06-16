import SwiftUI

// Animated password-strength meter + requirements checklist, shown under every
// "new password" field (sign-up, password reset, change password). Mirrors the
// QuickIn boutique redesign: burgundy/gold/ink/muted tokens, springy reveals,
// the QKDrawCheck draw-on tick, and full RTL via leading/trailing. All copy is
// localized through `L.t`.

// MARK: - Rules engine

/// The five rules we score a password against. `length` / `upper` / `lower` /
/// `number` are required for a usable password; `special` is a strength bonus.
/// Pure value logic so it's trivially testable and usable off the main actor.
enum PasswordRules {
    /// Minimum length required for a valid password.
    static let minLength = 8

    static func hasMinLength(_ pw: String) -> Bool { pw.count >= minLength }
    static func hasUppercase(_ pw: String) -> Bool { pw.contains(where: \.isUppercase) }
    static func hasLowercase(_ pw: String) -> Bool { pw.contains(where: \.isLowercase) }
    static func hasNumber(_ pw: String) -> Bool { pw.contains(where: \.isNumber) }

    /// Anything that isn't a letter, number or whitespace counts as "special".
    static func hasSpecial(_ pw: String) -> Bool {
        pw.contains { ch in
            !ch.isLetter && !ch.isNumber && !ch.isWhitespace
        }
    }

    /// Number of rules satisfied, 0...5. Drives the meter fill + label.
    static func score(_ pw: String) -> Int {
        var s = 0
        if hasMinLength(pw) { s += 1 }
        if hasUppercase(pw) { s += 1 }
        if hasLowercase(pw) { s += 1 }
        if hasNumber(pw) { s += 1 }
        if hasSpecial(pw) { s += 1 }
        return s
    }

    /// The bar to clear before a primary button enables: length + upper + lower
    /// + number (special is a bonus, not a gate).
    static func meetsMin(_ pw: String) -> Bool {
        hasMinLength(pw) && hasUppercase(pw) && hasLowercase(pw) && hasNumber(pw)
    }
}

// MARK: - Strength label + color

/// Maps a 0...5 score onto a label key and a color, per the spec:
/// ≤2 Weak (red) · 3 Fair (gold) · 4 Good (green) · 5 Strong (deep green).
private enum PasswordStrength {
    case weak, fair, good, strong

    init(score: Int) {
        switch score {
        case ...2:  self = .weak
        case 3:     self = .fair
        case 4:     self = .good
        default:    self = .strong
        }
    }

    /// Localization key for the strength label.
    var labelKey: String {
        switch self {
        case .weak:   return "password.strength.weak"
        case .fair:   return "password.strength.fair"
        case .good:   return "password.strength.good"
        case .strong: return "password.strength.strong"
        }
    }

    var color: Color {
        switch self {
        case .weak:   return Color(hex: 0xC0392B)        // red
        case .fair:   return .qkGold                       // gold accent
        case .good:   return Color(hex: 0x0F5132)         // green
        case .strong: return Color(hex: 0x0A3D26)         // deep green
        }
    }
}

// MARK: - View

/// The full widget: an animated strength bar + a per-rule checklist. Renders
/// nothing while `password` is empty, so it appears the moment the user starts
/// typing in a new-password field.
struct PasswordStrengthView: View {
    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let password: String

    private var score: Int { PasswordRules.score(password) }
    private var strength: PasswordStrength { PasswordStrength(score: score) }

    /// Fill fraction of the strength track (0...1).
    private var fraction: CGFloat { CGFloat(score) / 5 }

    var body: some View {
        if password.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 12) {
                strengthBar
                checklist
            }
            .padding(.top, 2)
            .transition(.opacity.combined(with: .move(edge: .top)))
            .accessibilityElement(children: .combine)
            .accessibilityLabel(
                "\(loc.t("password.strength.label")): \(loc.t(strength.labelKey))"
            )
        }
    }

    // MARK: Strength bar

    private var strengthBar: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(loc.t("password.strength.label"))
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Color.qkMuted)
                Spacer()
                Text(loc.t(strength.labelKey))
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(strength.color)
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.3), value: score)
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    // Track.
                    Capsule()
                        .fill(Color.qkInk.opacity(0.08))
                    // Fill — width fraction + color animate together.
                    Capsule()
                        .fill(strength.color)
                        .frame(width: max(0, geo.size.width * fraction))
                        .animation(reduceMotion ? nil : .easeInOut(duration: 0.3), value: score)
                }
            }
            .frame(height: 6)
        }
    }

    // MARK: Checklist

    private var checklist: some View {
        VStack(alignment: .leading, spacing: 8) {
            requirementRow(loc.t("password.rule.length"), met: PasswordRules.hasMinLength(password))
            requirementRow(loc.t("password.rule.uppercase"), met: PasswordRules.hasUppercase(password))
            requirementRow(loc.t("password.rule.lowercase"), met: PasswordRules.hasLowercase(password))
            requirementRow(loc.t("password.rule.number"), met: PasswordRules.hasNumber(password))
            requirementRow(loc.t("password.rule.special"), met: PasswordRules.hasSpecial(password))
        }
    }

    private func requirementRow(_ text: String, met: Bool) -> some View {
        HStack(spacing: 10) {
            RequirementCheck(met: met)
            Text(text)
                .font(.caption)
                .foregroundStyle(met ? Color.qkInk : Color.qkMuted)
            Spacer(minLength: 0)
        }
        .animation(reduceMotion ? nil : QKAnim.press, value: met)
    }
}

// MARK: - Animated requirement check

/// A single requirement's leading glyph: a muted hollow ○ when unmet, switching
/// to a burgundy draw-on tick (reusing `QKCheckmarkShape`) when satisfied. The
/// tick scales + fades + draws in with the springy `QKAnim.press` feel; Reduce
/// Motion shows the end state with no animation.
private struct RequirementCheck: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let met: Bool

    private let size: CGFloat = 18
    @State private var trim: CGFloat = 0

    var body: some View {
        ZStack {
            // Unmet: hollow muted ring.
            Circle()
                .strokeBorder(Color.qkMuted.opacity(0.45), lineWidth: 1.5)
                .frame(width: size, height: size)
                .opacity(met ? 0 : 1)

            // Met: filled burgundy disc with a draw-on cream check.
            ZStack {
                Circle()
                    .fill(Color.qkBurgundy)
                    .frame(width: size, height: size)
                QKCheckmarkShape()
                    .trim(from: 0, to: reduceMotion ? 1 : trim)
                    .stroke(
                        Color.qkCream,
                        style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round)
                    )
                    .frame(width: size * 0.55, height: size * 0.55)
            }
            .opacity(met ? 1 : 0)
            .scaleEffect(met || reduceMotion ? 1 : 0.4)
        }
        .frame(width: size, height: size)
        .onChange(of: met) { _, isMet in
            guard !reduceMotion else { trim = isMet ? 1 : 0; return }
            if isMet {
                trim = 0
                withAnimation(.easeOut(duration: 0.35)) { trim = 1 }
            } else {
                trim = 0
            }
        }
        .onAppear {
            // Honor the initial state (e.g. a pre-filled field) without replaying.
            if met { trim = 1 }
        }
        .accessibilityHidden(true)
    }
}

#Preview {
    struct PreviewWrap: View {
        @State private var pw = "Test1"
        var body: some View {
            VStack(spacing: 16) {
                SecureField("Password", text: $pw)
                    .textFieldStyle(.roundedBorder)
                PasswordStrengthView(password: pw)
            }
            .padding(24)
            .background(LinearGradient.qkPageWash)
            .environmentObject(LocalizationManager.shared)
        }
    }
    return PreviewWrap()
}
