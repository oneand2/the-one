import SwiftUI
import WebKit

/// 复杂业务内容直接运行与手机网站相同的 React 组件。
/// SwiftUI 仍负责启动、底栏、账户、登录、StoreKit、记录和系统能力。
struct HybridWebContentView: UIViewRepresentable {
    let screen: AppScreen
    let sessionIdentity: String
    let onTabChanged: @MainActor (AppScreen) -> Void
    let onLoginRequested: @MainActor () -> Void
    let onStoreRequested: @MainActor () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(
            onTabChanged: onTabChanged,
            onLoginRequested: onLoginRequested,
            onStoreRequested: onStoreRequested
        )
    }

    func makeUIView(context: Context) -> HybridWebViewContainer {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.userContentController.add(context.coordinator, name: "theone")
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: """
                (() => {
                  const style = document.createElement('style');
                  style.id = 'theone-ios-embed-style';
                  style.textContent = '.web-auth-entry{display:none!important}';
                  (document.head || document.documentElement).appendChild(style);
                })();
                """,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: false
            )
        )

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = UIColor(AppTheme.background)
        webView.scrollView.backgroundColor = UIColor(AppTheme.background)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.showsVerticalScrollIndicator = false
        webView.allowsBackForwardNavigationGestures = false
        context.coordinator.attach(webView)
        context.coordinator.start(screen: screen, sessionIdentity: sessionIdentity)
        return HybridWebViewContainer(webView: webView)
    }

    func updateUIView(_ container: HybridWebViewContainer, context: Context) {
        context.coordinator.update(screen: screen, sessionIdentity: sessionIdentity)
    }

    static func dismantleUIView(_ container: HybridWebViewContainer, coordinator: Coordinator) {
        container.webView.stopLoading()
        container.webView.configuration.userContentController.removeScriptMessageHandler(forName: "theone")
        container.webView.navigationDelegate = nil
        container.webView.uiDelegate = nil
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        private weak var webView: WKWebView?
        private let onTabChanged: @MainActor (AppScreen) -> Void
        private let onLoginRequested: @MainActor () -> Void
        private let onStoreRequested: @MainActor () -> Void
        private var currentScreen: AppScreen?
        private var currentSessionIdentity = ""
        private var pageReady = false
        private var isLoadingPage = false
        private var loadAttempts = 0

        init(
            onTabChanged: @escaping @MainActor (AppScreen) -> Void,
            onLoginRequested: @escaping @MainActor () -> Void,
            onStoreRequested: @escaping @MainActor () -> Void
        ) {
            self.onTabChanged = onTabChanged
            self.onLoginRequested = onLoginRequested
            self.onStoreRequested = onStoreRequested
        }

        func attach(_ webView: WKWebView) {
            self.webView = webView
        }

        func start(screen: AppScreen, sessionIdentity: String) {
            currentScreen = screen
            currentSessionIdentity = sessionIdentity
            synchronizeNativeCookiesToWeb { [weak self] in
                self?.loadInitialPage(screen: screen)
            }
        }

        func update(screen: AppScreen, sessionIdentity: String) {
            if sessionIdentity != currentSessionIdentity {
                currentSessionIdentity = sessionIdentity
                pageReady = false
                isLoadingPage = false
                loadAttempts = 0
                synchronizeNativeCookiesToWeb { [weak self] in
                    guard let self else { return }
                    self.loadInitialPage(screen: screen)
                }
                return
            }
            guard screen != currentScreen else { return }
            currentScreen = screen
            guard pageReady else { return }
            dispatchNavigation(to: screen)
        }

        private func loadInitialPage(screen: AppScreen) {
            guard let webView, !isLoadingPage else { return }
            var components = URLComponents(url: APIClient.baseURL, resolvingAgainstBaseURL: false)
            components?.path = "/"
            components?.queryItems = [
                URLQueryItem(name: "embed", value: "ios"),
                URLQueryItem(name: "tab", value: screen.rawValue),
            ]
            guard let url = components?.url else { return }
            isLoadingPage = true
            loadAttempts += 1
            var request = URLRequest(url: url)
            request.cachePolicy = .reloadRevalidatingCacheData
            request.setValue("ios-hybrid/1.0", forHTTPHeaderField: "X-TheOne-Client")
            webView.load(request)
        }

        private func retryLoadIfNeeded() {
            isLoadingPage = false
            pageReady = false
            guard loadAttempts < 3, let currentScreen else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
                self?.loadInitialPage(screen: currentScreen)
            }
        }

        private func dispatchNavigation(to screen: AppScreen) {
            guard let webView else { return }
            let tab = screen.rawValue.replacingOccurrences(of: "'", with: "\\'")
            webView.evaluateJavaScript(
                "window.dispatchEvent(new CustomEvent('theone:navigate',{detail:{tab:'\(tab)'}}));"
            )
        }

        private func synchronizeNativeCookiesToWeb(completion: @escaping @MainActor () -> Void) {
            guard let webView, let host = APIClient.baseURL.host else {
                completion()
                return
            }
            let store = webView.configuration.websiteDataStore.httpCookieStore
            store.getAllCookies { cookies in
                let firstPartyCookies = cookies.filter { cookie in
                    cookie.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")) == host
                }
                let group = DispatchGroup()
                firstPartyCookies.forEach { cookie in
                    group.enter()
                    store.delete(cookie) { group.leave() }
                }
                group.notify(queue: .main) {
                    let nativeCookies = HTTPCookieStorage.shared.cookies(for: APIClient.baseURL) ?? []
                    let setGroup = DispatchGroup()
                    nativeCookies.forEach { cookie in
                        setGroup.enter()
                        store.setCookie(cookie) { setGroup.leave() }
                    }
                    setGroup.notify(queue: .main) { completion() }
                }
            }
        }

        private func synchronizeWebCookiesToNative() {
            guard let webView, let host = APIClient.baseURL.host else { return }
            webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { cookies in
                cookies
                    .filter { $0.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")) == host }
                    .forEach { HTTPCookieStorage.shared.setCookie($0) }
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            isLoadingPage = false
            loadAttempts = 0
            pageReady = true
            synchronizeWebCookiesToNative()
            if let currentScreen { dispatchNavigation(to: currentScreen) }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            retryLoadIfNeeded()
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            retryLoadIfNeeded()
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            let firstParty = url.host == APIClient.baseURL.host
            if firstParty, url.path == "/login" {
                onLoginRequested()
                decisionHandler(.cancel)
                return
            }
            if firstParty, url.path == "/shop" {
                onStoreRequested()
                decisionHandler(.cancel)
                return
            }
            if !firstParty, navigationAction.navigationType == .linkActivated {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.name == "theone",
                  let body = message.body as? [String: Any],
                  let type = body["type"] as? String else { return }
            if type == "tabChanged",
               let rawTab = body["tab"] as? String,
               let tab = AppScreen(rawValue: rawTab) {
                currentScreen = tab
                onTabChanged(tab)
            } else if type == "login" {
                onLoginRequested()
            } else if type == "store" {
                onStoreRequested()
            } else if type == "haptic" {
                UIImpactFeedbackGenerator(style: .soft).impactOccurred()
            }
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let url = navigationAction.request.url {
                UIApplication.shared.open(url)
            }
            return nil
        }
    }
}

final class HybridWebViewContainer: UIView {
    let webView: WKWebView

    init(webView: WKWebView) {
        self.webView = webView
        super.init(frame: .zero)
        backgroundColor = UIColor(AppTheme.background)
        clipsToBounds = true
        addSubview(webView)
    }

    required init?(coder: NSCoder) { nil }

    override func layoutSubviews() {
        super.layoutSubviews()
        webView.frame = bounds
    }
}
