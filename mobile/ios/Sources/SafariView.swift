import SwiftUI
import SafariServices

/// An in-app Safari page (`SFSafariViewController`) for SwiftUI.
///
/// Used for hosted pages that must stay inside the app — the Flash card / wallet
/// checkout, which has no return URL, so the payment sheet needs to know when the
/// guest closes it. `onFinish` fires when they tap Done; the presenter clears its
/// own binding there.
struct SafariView: UIViewControllerRepresentable {
    let url: URL
    var onFinish: () -> Void = {}

    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let config = SFSafariViewController.Configuration()
        config.entersReaderIfAvailable = false
        config.barCollapsingEnabled = false
        let vc = SFSafariViewController(url: url, configuration: config)
        vc.dismissButtonStyle = .done
        vc.preferredControlTintColor = UIColor(Color.qkBurgundy)
        vc.delegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ vc: SFSafariViewController, context: Context) {
        context.coordinator.onFinish = onFinish
    }

    final class Coordinator: NSObject, SFSafariViewControllerDelegate {
        var onFinish: () -> Void
        init(onFinish: @escaping () -> Void) { self.onFinish = onFinish }

        func safariViewControllerDidFinish(_ controller: SFSafariViewController) {
            onFinish()
        }
    }
}
