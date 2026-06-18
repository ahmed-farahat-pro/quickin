import SwiftUI

/// Launch splash: the QuickIn key mark flies in (tiny → full) and then gently
/// floats over a cream wash, while layered waves roll continuously across the
/// bottom for a lively, premium feel. After a brief hold it calls `onFinished`
/// so `RootView` can cross-fade into the main app.
struct SplashView: View {
    /// Called once the fly-in + hold has completed.
    var onFinished: () -> Void = {}

    @State private var animateIn = false
    @State private var floating = false

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()

            // Waves rolling across the bottom of the screen.
            VStack(spacing: 0) {
                Spacer()
                SplashWaves()
            }
            .ignoresSafeArea()

            // Gold halo + logo: flies in, then gently bobs. Lifted slightly above
            // center so the waves have room to breathe at the bottom.
            ZStack {
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
                    .offset(y: floating ? -8 : 0)
            }
            .offset(y: -34)
        }
        .onAppear(perform: runAnimation)
    }

    private func runAnimation() {
        // Fly from far/small to full, easing out over ~1.1s.
        withAnimation(.easeOut(duration: 1.1)) {
            animateIn = true
        }
        // Once it settles, a slow continuous bob gives the mark life.
        withAnimation(.easeInOut(duration: 1.8).repeatForever(autoreverses: true).delay(0.9)) {
            floating = true
        }
        // Hold so the waves register, then hand off (~2.0s total).
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            onFinished()
        }
    }
}

/// Three layered sine waves that roll horizontally forever. Drawn each frame via
/// a `TimelineView(.animation)` so the motion is smooth and continuous, tinted in
/// the QuickIn palette (gold wash → burgundy crest).
private struct SplashWaves: View {
    var body: some View {
        TimelineView(.animation) { timeline in
            let t = CGFloat(timeline.date.timeIntervalSinceReferenceDate)
            ZStack {
                Wave(phase: t * 0.80, amplitude: 13, baseline: 0.40, cycles: 1.3)
                    .fill(Color.qkGoldLight.opacity(0.30))
                Wave(phase: t * 1.15 + 1.6, amplitude: 18, baseline: 0.54, cycles: 1.1)
                    .fill(Color.qkBurgundy.opacity(0.26))
                Wave(phase: t * 1.55 + 3.1, amplitude: 12, baseline: 0.66, cycles: 1.6)
                    .fill(
                        LinearGradient(
                            colors: [Color.qkBurgundy, Color.qkBurgundy.opacity(0.9)],
                            startPoint: .top, endPoint: .bottom
                        )
                    )
            }
        }
        .frame(height: 220)
        .frame(maxWidth: .infinity)
    }
}

/// A filled sine wave: a horizontal sine curve at `baseline` (fraction of the
/// height), filled down to the bottom edge. `phase` shifts it sideways to animate.
private struct Wave: Shape {
    var phase: CGFloat
    var amplitude: CGFloat
    var baseline: CGFloat
    var cycles: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width, h = rect.height
        let mid = h * baseline
        path.move(to: CGPoint(x: 0, y: mid))
        var x: CGFloat = 0
        while x <= w {
            let y = mid + amplitude * sin(2 * .pi * (x / w) * cycles + phase)
            path.addLine(to: CGPoint(x: x, y: y))
            x += 3
        }
        path.addLine(to: CGPoint(x: w, y: h))
        path.addLine(to: CGPoint(x: 0, y: h))
        path.closeSubpath()
        return path
    }
}

#Preview {
    SplashView()
}
