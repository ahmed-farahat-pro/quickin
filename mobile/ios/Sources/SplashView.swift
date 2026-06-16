import SwiftUI

/// Launch splash: the QuickIn key mark flies in from "far away" — starting
/// tiny and transparent and zooming up to full size — on the cream background.
/// After a brief hold it calls `onFinished` so `RootView` can cross-fade to the
/// main app.
struct SplashView: View {
    /// Called once the zoom-in + hold has completed.
    var onFinished: () -> Void = {}

    @State private var animateIn = false

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()

            // Soft gold halo behind the mark.
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color.qkGoldLight.opacity(animateIn ? 0.22 : 0), .clear],
                        center: .center, startRadius: 0, endRadius: 180
                    )
                )
                .frame(width: 360, height: 360)

            Image("logo")
                .resizable()
                .scaledToFit()
                .frame(height: 120)
                .scaleEffect(animateIn ? 1.0 : 0.2)
                .opacity(animateIn ? 1.0 : 0.0)
                .shadow(color: Color.qkBurgundy.opacity(animateIn ? 0.18 : 0.0),
                        radius: 24, x: 0, y: 12)
        }
        .onAppear(perform: runAnimation)
    }

    private func runAnimation() {
        // Zoom from far/small to full, easing out over ~1.1s.
        withAnimation(.easeOut(duration: 1.1)) {
            animateIn = true
        }
        // Hold briefly after the zoom settles, then hand off (~1.6s total).
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
            onFinished()
        }
    }
}

#Preview {
    SplashView()
}
