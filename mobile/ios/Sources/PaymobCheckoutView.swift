import SwiftUI
import WebKit

/// An in-app WebView wrapper around Paymob's **hosted** checkout page.
///
/// Card details are entered entirely on Paymob's page loaded here — QuickIn
/// never collects card data in its own UI (App Store / Play compliance). The
/// flow is:
///
///   1. Load `checkoutURL` (from `BookingService.payInit`).
///   2. Watch every navigation. As soon as the WebView tries to navigate to a
///      URL that `hasPrefix(returnURLPrefix)` (our `/api/paymob/return` page),
///      the payment is finished → cancel that navigation, call `onFinished`.
///   3. The Cancel button (or swipe-down) calls `onCancel` → treated as a
///      cancelled payment, no charge.
///
/// The booking is marked paid by a server **webhook**, so the presenter polls
/// the booking after `onFinished` rather than trusting the WebView alone.
struct PaymobCheckoutView: View {
    /// Paymob's hosted-checkout URL to load.
    let checkoutURL: String
    /// When the WebView navigates to a URL starting with this, the flow is done.
    let returnURLPrefix: String
    /// Called once the WebView reaches `returnURLPrefix` (payment submitted).
    var onFinished: () -> Void
    /// Called when the guest cancels (Cancel button / swipe-down). No charge.
    var onCancel: () -> Void

    @EnvironmentObject private var loc: LocalizationManager
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            ZStack {
                Color.qkCream.ignoresSafeArea()

                if let url = URL(string: checkoutURL) {
                    PaymobWebView(
                        url: url,
                        returnURLPrefix: returnURLPrefix,
                        isLoading: $isLoading,
                        onFinished: onFinished
                    )
                    .ignoresSafeArea(edges: .bottom)
                } else {
                    // Malformed checkout URL — bail out as a cancel.
                    Color.clear.onAppear { onCancel() }
                }

                if isLoading {
                    VStack(spacing: 12) {
                        ProgressView()
                            .tint(.qkBurgundy)
                            .scaleEffect(1.2)
                        Text(loc.t("pay.loadingCheckout"))
                            .font(.footnote)
                            .foregroundStyle(Color.qkMuted)
                    }
                }
            }
            .navigationTitle(loc.t("pay.secureCheckout"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.qkCream, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(loc.t("common.cancel")) { onCancel() }
                        .foregroundStyle(Color.qkBurgundy)
                }
            }
            .interactiveDismissDisabled(false)
        }
    }
}

/// `UIViewRepresentable` bridge to `WKWebView`. Detects the return-URL prefix in
/// its `WKNavigationDelegate` and reports load state for the spinner overlay.
private struct PaymobWebView: UIViewRepresentable {
    let url: URL
    let returnURLPrefix: String
    @Binding var isLoading: Bool
    var onFinished: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(returnURLPrefix: returnURLPrefix, isLoading: $isLoading, onFinished: onFinished)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        webView.backgroundColor = .clear
        webView.isOpaque = false
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        private let returnURLPrefix: String
        @Binding private var isLoading: Bool
        private let onFinished: () -> Void
        /// Guards against firing `onFinished` more than once (the return URL can
        /// be hit by both the main frame and a redirect).
        private var didFinish = false

        init(returnURLPrefix: String, isLoading: Binding<Bool>, onFinished: @escaping () -> Void) {
            self.returnURLPrefix = returnURLPrefix
            self._isLoading = isLoading
            self.onFinished = onFinished
        }

        /// Intercept every navigation: if it targets our return-URL prefix, stop
        /// the load and report completion to the presenter.
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let target = navigationAction.request.url?.absoluteString,
               !returnURLPrefix.isEmpty,
               target.hasPrefix(returnURLPrefix) {
                decisionHandler(.cancel)
                finishOnce()
                return
            }
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            setLoading(true)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            setLoading(false)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            setLoading(false)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            setLoading(false)
        }

        private func finishOnce() {
            guard !didFinish else { return }
            didFinish = true
            setLoading(false)
            DispatchQueue.main.async { [onFinished] in onFinished() }
        }

        private func setLoading(_ value: Bool) {
            DispatchQueue.main.async { [weak self] in self?.isLoading = value }
        }
    }
}
