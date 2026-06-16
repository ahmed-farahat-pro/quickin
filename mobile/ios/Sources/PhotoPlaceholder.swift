import SwiftUI

/// A branded "no photo" placeholder shown wherever a listing or service has no
/// image, replacing the old stock-image fallback. Renders a tan/cream rounded
/// rectangle with a centered muted `photo` glyph + caption so empty media reads
/// as intentional rather than broken.
struct PhotoPlaceholder: View {
    /// Caption under the glyph. Defaults to "No photo".
    var label: String = "No photo"
    /// SF Symbol point size for the glyph (caption scales with it).
    var iconSize: CGFloat = 30

    var body: some View {
        ZStack {
            // Soft tan→cream wash so it sits within the boutique palette.
            LinearGradient(
                colors: [Color.qkTan, Color.qkCream],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            VStack(spacing: 8) {
                Image(systemName: "photo")
                    .font(.system(size: iconSize, weight: .regular))
                    .foregroundStyle(Color.qkMuted.opacity(0.7))
                if !label.isEmpty {
                    Text(label)
                        .font(.system(size: max(iconSize * 0.4, 11), weight: .medium))
                        .foregroundStyle(Color.qkMuted)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Loads `url` and renders the standard success/loading states, falling back to
/// a `PhotoPlaceholder` when `url` is nil/empty or the image fails to load.
/// Centralizes the "no dummy image" behavior so every card/gallery is consistent.
struct ListingImageView: View {
    let url: String?
    var placeholderLabel: String = "No photo"
    var placeholderIconSize: CGFloat = 30

    private var resolvedURL: URL? {
        guard let url, !url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return nil
        }
        return URL(string: url)
    }

    var body: some View {
        if let resolvedURL {
            AsyncImage(url: resolvedURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fill)
                case .failure:
                    PhotoPlaceholder(label: placeholderLabel, iconSize: placeholderIconSize)
                default:
                    ZStack {
                        Color.qkTan
                        ProgressView().tint(.qkBurgundy)
                    }
                }
            }
        } else {
            PhotoPlaceholder(label: placeholderLabel, iconSize: placeholderIconSize)
        }
    }
}
