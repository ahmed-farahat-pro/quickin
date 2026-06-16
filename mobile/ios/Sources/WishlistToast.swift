import SwiftUI

/// A transient "Added to wishlist" / "Removed from wishlist" toast event,
/// published by `WishlistStore` whenever a heart is toggled. A fresh value (new
/// `id`) is emitted on every toggle so the overlay re-animates even on repeats.
struct WishlistToast: Identifiable, Equatable {
    let id = UUID()
    /// `true` → "Added to wishlist"; `false` → "Removed from wishlist".
    let saved: Bool
}

/// The branded toast pill: a frosted capsule with a heart glyph + message,
/// matching the boutique palette. Heart fills + burgundy when saved; outline +
/// muted when removed. RTL-safe (HStack mirrors). Purely presentational.
struct QKToastView: View {
    let saved: Bool
    let text: String

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: saved ? "heart.fill" : "heart.slash")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(saved ? Color.qkBurgundy : Color.qkMuted)
            Text(text)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.qkInk)
                .lineLimit(1)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 11)
        .background(.regularMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(Color.qkInk.opacity(0.08), lineWidth: 1))
        .shadow(color: Color.qkInk.opacity(0.18), radius: 14, x: 0, y: 6)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(text)
    }
}

/// A reusable, app-level overlay that watches the shared `WishlistStore` and
/// shows a brief auto-dismissing toast whenever an item is added/removed from
/// the wishlist. Attached once near the root (above the tab bar) so any heart —
/// on a card, the detail hero, or the Saved screen — gets visible confirmation.
private struct WishlistToastModifier: ViewModifier {
    @EnvironmentObject private var wishlist: WishlistStore
    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// The toast currently on screen (nil when hidden).
    @State private var active: WishlistToast?
    /// Cancels a pending auto-dismiss when a new toast arrives mid-display.
    @State private var dismissTask: Task<Void, Never>?

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                if let active {
                    QKToastView(
                        saved: active.saved,
                        text: loc.t(active.saved ? "wishlist.added" : "wishlist.removed")
                    )
                    .padding(.top, 8)
                    .transition(
                        reduceMotion
                            ? .opacity
                            : .move(edge: .top).combined(with: .opacity)
                    )
                    // Tag by id so a repeat toggle re-runs the transition.
                    .id(active.id)
                }
            }
            .animation(reduceMotion ? .easeInOut(duration: 0.2) : QKAnim.pop, value: active)
            .onChange(of: wishlist.lastToast) { _, toast in
                guard let toast else { return }
                show(toast)
            }
    }

    /// Present `toast` and schedule its auto-dismiss (~1.8s), replacing any toast
    /// already showing so rapid toggles don't stack.
    private func show(_ toast: WishlistToast) {
        dismissTask?.cancel()
        active = toast
        dismissTask = Task {
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            guard !Task.isCancelled else { return }
            // Only clear if this is still the toast on screen.
            if active?.id == toast.id { active = nil }
        }
    }
}

extension View {
    /// Attach the app-level wishlist toast overlay. Requires `WishlistStore` and
    /// `LocalizationManager` in the environment.
    func wishlistToast() -> some View {
        modifier(WishlistToastModifier())
    }
}
