import SwiftUI
import WebKit

@MainActor
final class HybridLoadState: ObservableObject {
    @Published private(set) var isReady = false
    @Published private(set) var message = "正在载入…"
    @Published private(set) var canRetry = false
    fileprivate var retryHandler: (() -> Void)?

    func retry() {
        retryHandler?()
    }

    fileprivate func markLoading(_ text: String) {
        isReady = false
        canRetry = false
        message = text
    }

    fileprivate func markReady() {
        isReady = true
        canRetry = false
    }

    fileprivate func markFailed(_ text: String) {
        isReady = false
        canRetry = true
        message = text
    }
}

/// 复杂业务内容直接运行与手机网站相同的 React 组件。
/// SwiftUI 仍负责启动、底栏、账户、登录、StoreKit、记录和系统能力。
struct HybridWebContentView: UIViewRepresentable {
    @ObservedObject var flow: AppFlowStore
    let sessionIdentity: String
    let scenePhase: ScenePhase
    let loadState: HybridLoadState
    let onTabChanged: @MainActor (AppScreen) -> Void
    let onLoginRequested: @MainActor () -> Void
    let onStoreRequested: @MainActor () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(
            loadState: loadState,
            onTabChanged: onTabChanged,
            onLoginRequested: onLoginRequested,
            onStoreRequested: onStoreRequested
        )
    }

    func makeUIView(context: Context) -> HybridWebViewContainer {
        if let container = context.coordinator.container {
            return container
        }

        let configuration = WKWebViewConfiguration()
#if DEBUG && targetEnvironment(simulator)
        // 本地 Next.js 的 chunk URL 在开发过程中保持不变，持久缓存会让模拟器
        // 继续执行旧 bundle，进而丢失最新的原生桥接函数。
        configuration.websiteDataStore = .nonPersistent()
#else
        configuration.websiteDataStore = .default()
#endif
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.userContentController.add(context.coordinator, name: "theone")
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: Self.embedBootstrapScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: false
            )
        )

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = true
        webView.backgroundColor = UIColor(AppTheme.background)
        webView.scrollView.isOpaque = true
        webView.scrollView.backgroundColor = UIColor(AppTheme.background)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.showsVerticalScrollIndicator = false
        webView.allowsBackForwardNavigationGestures = false
        webView.overrideUserInterfaceStyle = .light
        Self.lockWebViewZoom(webView)
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }

        let container = HybridWebViewContainer(webView: webView)
        context.coordinator.attach(container)
        // WKWebView 以零尺寸开始加载时，WebKit 偶尔会先按默认页面宽度排版，
        // 随后用一个固定倍率适配真实宽度。等首个有效布局再加载，避免这个竞态。
        container.onFirstValidLayout = { [weak coordinator = context.coordinator] in
            coordinator?.start(screen: flow.screen, sessionIdentity: sessionIdentity)
        }
        return container
    }

    func updateUIView(_ container: HybridWebViewContainer, context: Context) {
        context.coordinator.update(
            screen: flow.screen,
            tabSelectionTick: flow.tabSelectionTick,
            sessionIdentity: sessionIdentity,
            pendingChat: flow.pendingChat
        )
        context.coordinator.handleScenePhase(scenePhase)
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: HybridWebViewContainer, context: Context) -> CGSize? {
        let fallback = CGSize(width: 390, height: 720)
        let size = proposal.replacingUnspecifiedDimensions(by: fallback)
        guard size.width.isFinite, size.height.isFinite, size.width > 1, size.height > 1 else {
            return fallback
        }
        return size
    }

    static func dismantleUIView(_ container: HybridWebViewContainer, coordinator: Coordinator) {
        // 保留 WKWebView，避免 SwiftUI 短暂拆掉 representable 时把页面卸掉。
    }

    /// 按原生 App 处理：禁止捏合/双击缩放。WKWebView 在导航后可能把手势重新打开，所以加载完成后会再锁一次。
    fileprivate static func lockWebViewZoom(_ webView: WKWebView) {
        let scrollView = webView.scrollView
        scrollView.minimumZoomScale = 1
        scrollView.maximumZoomScale = 1
        scrollView.bouncesZoom = false
        scrollView.pinchGestureRecognizer?.isEnabled = false
        if abs(scrollView.zoomScale - 1) > 0.001 {
            scrollView.setZoomScale(1, animated: false)
        }

        func disableZoomGestures(in view: UIView) {
            for recognizer in view.gestureRecognizers ?? [] {
                if recognizer is UIPinchGestureRecognizer {
                    recognizer.isEnabled = false
                }
                if let tap = recognizer as? UITapGestureRecognizer, tap.numberOfTapsRequired == 2 {
                    recognizer.isEnabled = false
                }
            }
            // 智能双击缩放的 recognizer 挂在 WKContentView 等内部子视图上，
            // 只检查 webView/scrollView 本身会漏掉它。
            view.subviews.forEach(disableZoomGestures)
        }
        disableZoomGestures(in: webView)
    }

    /// 同时校准原生滚动层与 WebKit 的 visual viewport。
    /// 输入框聚焦缩放等情况下，visualViewport.scale 可能变化而 UIScrollView.zoomScale 仍为 1。
    fileprivate static func normalizeWebViewZoom(_ webView: WKWebView) {
        lockWebViewZoom(webView)
        webView.evaluateJavaScript(
            "window.__THEONE_RESET_VIEWPORT__ && window.__THEONE_RESET_VIEWPORT__();",
            completionHandler: nil
        )
    }

    private static let embedBootstrapScript = """
    (() => {
      window.__THEONE_IOS_EMBED__ = true;
      try {
        var initialTab = new URLSearchParams(location.search).get('tab');
        if (initialTab && !window.__THEONE_TAB__) window.__THEONE_TAB__ = initialTab;
      } catch (e) {}
      window.__THEONE_TAB__ = window.__THEONE_TAB__ || null;
      const viewportContent = 'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover';
      const applyViewport = () => {
        let meta = document.querySelector('meta[name="viewport"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', 'viewport');
          (document.head || document.documentElement).appendChild(meta);
        }
        if (meta.getAttribute('content') !== viewportContent) {
          meta.setAttribute('content', viewportContent);
        }
      };
      applyViewport();
      document.addEventListener('DOMContentLoaded', applyViewport);
      const style = document.createElement('style');
      style.id = 'theone-ios-embed-style';
      style.textContent = `
        html,body{
          width:100%;max-width:100%;overflow-x:hidden;
          touch-action:pan-x pan-y;-webkit-text-size-adjust:100%;
        }
        input:not([type="hidden"]),textarea,select,[contenteditable="true"]{
          font-size:max(16px,1em)!important;
        }
        .web-auth-entry,.theone-install-prompt{display:none!important}
        [data-ios-embed="true"]::before,[data-ios-embed="true"]::after{display:none!important}
      `;
      (document.head || document.documentElement).appendChild(style);
      const stopGesture = (event) => { event.preventDefault(); };
      document.addEventListener('gesturestart', stopGesture, { capture: true, passive: false });
      document.addEventListener('gesturechange', stopGesture, { capture: true, passive: false });
      document.addEventListener('gestureend', stopGesture, { capture: true, passive: false });
      let viewportResetPending = false;
      const resetViewport = () => {
        applyViewport();
        const viewport = window.visualViewport;
        if (!viewport || Math.abs(viewport.scale - 1) < 0.01 || viewportResetPending) return;
        viewportResetPending = true;
        const meta = document.querySelector('meta[name="viewport"]');
        // 重新赋值相同 content 不会让 WebKit 重新计算；短暂改动 initial-scale
        // 后再恢复，才能解除已经发生的聚焦/智能缩放。
        meta.setAttribute('content', viewportContent.replace('initial-scale=1', 'initial-scale=1.0001'));
        requestAnimationFrame(() => {
          meta.setAttribute('content', viewportContent);
          window.scrollTo(0, window.scrollY || 0);
          // viewport 的 resize 事件可能由上面的 meta 更新再次触发，短暂保留锁，
          // 避免 WebKit 在同一帧反复重排。
          setTimeout(() => { viewportResetPending = false; }, 250);
        });
      };
      window.__THEONE_RESET_VIEWPORT__ = resetViewport;
      window.visualViewport?.addEventListener('resize', resetViewport, { passive: true });
      window.visualViewport?.addEventListener('scroll', resetViewport, { passive: true });
      document.addEventListener('focusin', () => requestAnimationFrame(resetViewport), true);
      window.addEventListener('pageshow', resetViewport, { passive: true });
      const notify = (type) => {
        try { window.webkit.messageHandlers.theone.postMessage({ type }); } catch (e) {}
      };
      const kindFor = (url) => {
        if (!url) return null;
        try {
          const parsed = new URL(String(url), location.href);
          if (parsed.pathname === '/login') return 'login';
          if (parsed.pathname === '/shop') return 'store';
        } catch (e) {}
        return null;
      };
      const wrap = (fn) => function(state, title, url) {
        const kind = kindFor(url);
        if (kind) { notify(kind); return; }
        return fn.apply(this, arguments);
      };
      history.pushState = wrap(history.pushState);
      history.replaceState = wrap(history.replaceState);
    })();
    """

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        private(set) var container: HybridWebViewContainer?
        private var webView: WKWebView? { container?.webView }
        private let loadState: HybridLoadState
        private let onTabChanged: @MainActor (AppScreen) -> Void
        private let onLoginRequested: @MainActor () -> Void
        private let onStoreRequested: @MainActor () -> Void
        private var currentScreen: AppScreen?
        private var lastTabTick = 0
        private var lastPendingChatID: UUID?
        private var currentSessionIdentity = ""
        private var pageReady = false
        private var isLoadingPage = false
        private var loadAttempts = 0
        private var lastStoreRequestAt = Date.distantPast
        private var lastLoginRequestAt = Date.distantPast
        private var urlObservation: NSKeyValueObservation?
        private var retryWorkItem: DispatchWorkItem?
        private var lastScenePhase: ScenePhase = .inactive

        init(
            loadState: HybridLoadState,
            onTabChanged: @escaping @MainActor (AppScreen) -> Void,
            onLoginRequested: @escaping @MainActor () -> Void,
            onStoreRequested: @escaping @MainActor () -> Void
        ) {
            self.loadState = loadState
            self.onTabChanged = onTabChanged
            self.onLoginRequested = onLoginRequested
            self.onStoreRequested = onStoreRequested
            super.init()
        }

        func attach(_ container: HybridWebViewContainer) {
            self.container = container
            urlObservation = container.webView.observe(\.url, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in
                    self?.handleEmbeddedURL(view.url)
                }
            }
        }

        func cancelRetry() {
            retryWorkItem?.cancel()
            retryWorkItem = nil
        }

        func start(screen: AppScreen, sessionIdentity: String) {
            currentScreen = screen
            currentSessionIdentity = sessionIdentity
            loadState.retryHandler = { [weak self] in
                self?.reloadHome(force: true)
            }
            synchronizeNativeCookiesToWeb { [weak self] in
                self?.loadInitialPage(screen: screen)
            }
        }

        func update(
            screen: AppScreen,
            tabSelectionTick: Int,
            sessionIdentity: String,
            pendingChat: PendingChatRequest?
        ) {
            if sessionIdentity != currentSessionIdentity {
                currentSessionIdentity = sessionIdentity
                synchronizeNativeCookiesToWeb { [weak self] in
                    self?.notifyWebAuthChanged()
                }
            }
            let tapped = tabSelectionTick != lastTabTick
            let changed = screen != currentScreen
            currentScreen = screen
            lastTabTick = tabSelectionTick
            let newPendingChat = pendingChat.flatMap { request in
                request.id == lastPendingChatID ? nil : request
            }
            if let newPendingChat {
                lastPendingChatID = newPendingChat.id
            }
            if tapped || changed || newPendingChat != nil {
                dispatchNavigation(to: screen, pendingChat: newPendingChat)
            }
        }

        func handleScenePhase(_ phase: ScenePhase) {
            let becameActive = phase == .active && lastScenePhase != .active
            lastScenePhase = phase
            guard becameActive else { return }
            if let webView {
                HybridWebContentView.normalizeWebViewZoom(webView)
            }
            resumeIfNeeded()
        }

        func resumeIfNeeded() {
            guard !isLoadingPage, let currentScreen else { return }
            if pageReady { return }
            loadInitialPage(screen: currentScreen)
        }

        private func reloadHome(force: Bool) {
            guard let currentScreen else { return }
            if !force, isLoadingPage { return }
            pageReady = false
            isLoadingPage = false
            loadAttempts = 0
            loadInitialPage(screen: currentScreen)
        }

        private func loadInitialPage(screen: AppScreen) {
            guard let webView, !isLoadingPage, !pageReady else { return }
            container?.setModalBackdropActive(false, animated: false)
            var components = URLComponents(url: APIClient.baseURL, resolvingAgainstBaseURL: false)
            components?.path = "/"
            components?.queryItems = [
                URLQueryItem(name: "embed", value: "ios"),
                URLQueryItem(name: "tab", value: screen.rawValue),
            ]
            guard let url = components?.url else { return }
            cancelRetry()
            isLoadingPage = true
            loadAttempts += 1
            loadState.markLoading(loadAttempts <= 1 ? "正在载入…" : "正在重新连接本地页面…")
            var request = URLRequest(url: url)
            request.cachePolicy = .useProtocolCachePolicy
            request.setValue("ios-hybrid/1.0", forHTTPHeaderField: "X-TheOne-Client")
            webView.load(request)
        }

        private func retryLoadIfNeeded(error: Error? = nil) {
            isLoadingPage = false
            if isIgnorableLoadError(error) {
                return
            }
            pageReady = false
            guard let currentScreen else { return }
            if loadAttempts >= 6 {
                loadState.markFailed(Self.disconnectedMessage)
            }
            cancelRetry()
            let delay = loadAttempts >= 6 ? 8.0 : min(5, 0.6 * pow(1.6, Double(min(loadAttempts, 8))))
            let work = DispatchWorkItem { [weak self] in
                self?.loadInitialPage(screen: currentScreen)
            }
            retryWorkItem = work
            DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
        }

        private static var disconnectedMessage: String {
#if DEBUG && targetEnvironment(simulator)
            "本地页面还没连上，请确认开发服务已启动"
#else
            "页面暂时无法载入"
#endif
        }

        private func isIgnorableLoadError(_ error: Error?) -> Bool {
            let nsError = (error as NSError?) ?? NSError()
            if nsError.domain == NSURLErrorDomain, nsError.code == NSURLErrorCancelled {
                return true
            }
            // WebKit: Frame load interrupted
            if nsError.domain == "WebKitErrorDomain", nsError.code == 102 {
                return true
            }
            return false
        }

        private func dispatchNavigation(to screen: AppScreen, pendingChat: PendingChatRequest? = nil) {
            guard let webView else { return }
            let tab = screen.rawValue
            let importJSON = pendingChat.flatMap { request -> String? in
                guard JSONSerialization.isValidJSONObject(request.importData),
                      let data = try? JSONSerialization.data(withJSONObject: request.importData) else { return nil }
                return String(data: data, encoding: .utf8)
            } ?? ""
            let script = """
              if (chatImportJSON) {
                localStorage.removeItem('juexingcang-import-pending');
                localStorage.setItem('juexingcang-import-pending', chatImportJSON);
                localStorage.setItem('juexingcang-input-preset', chatPreset);
                localStorage.setItem('juexingcang-auto-send-pending', chatAutoSend ? 'true' : 'false');
              }
              window.__THEONE_TAB__ = tab;
              if (typeof window.__THEONE_NAVIGATE__ === 'function') {
                window.__THEONE_NAVIGATE__(tab);
              }
              // 兼容生产站点的上一代桥接。网页与 TestFlight 发布节奏不一致时，
              // 原生底栏仍可驱动已上线页面，避免按钮有反馈却不切换内容。
              window.dispatchEvent(new CustomEvent('theone:navigate', { detail: { tab: tab } }));
              var root = document.querySelector('[data-ios-embed="true"]');
              if (root) {
                root.setAttribute('data-active-tab', tab);
                document.documentElement.setAttribute('data-active-tab', tab);
                root.querySelectorAll('[data-ios-tab-pane]').forEach(function (pane) {
                  pane.setAttribute('aria-hidden', pane.getAttribute('data-ios-tab-pane') === tab ? 'false' : 'true');
                });
                window.scrollTo(0, 0);
              }
              return root ? root.getAttribute('data-active-tab') : '';
            """
            webView.callAsyncJavaScript(
                script,
                arguments: [
                    "tab": tab,
                    "chatImportJSON": importJSON,
                    "chatPreset": pendingChat?.preset ?? "",
                    "chatAutoSend": pendingChat?.autoSend ?? false,
                ],
                in: nil,
                in: .page,
                completionHandler: nil
            )
        }

        private func isFirstParty(_ url: URL?) -> Bool {
            Self.isFirstPartyHost(url?.host)
        }

        private static func isFirstPartyHost(_ rawHost: String?) -> Bool {
            guard let host = rawHost?.trimmingCharacters(in: CharacterSet(charactersIn: ".")).lowercased(),
                  !host.isEmpty else { return false }
            let expected = APIClient.baseURL.host?.lowercased() ?? ""
            if host == expected { return true }
            let loopback: Set<String> = ["localhost", "127.0.0.1", "0.0.0.0", "::1"]
            return loopback.contains(host) && loopback.contains(expected)
        }

        private func handleEmbeddedURL(_ url: URL?) {
            guard let url, isFirstParty(url) else { return }
            if url.path == "/login" {
                requestLogin()
            } else if url.path == "/shop" {
                requestStore()
            }
        }

        private func requestLogin() {
            let now = Date()
            guard now.timeIntervalSince(lastLoginRequestAt) > 1 else { return }
            lastLoginRequestAt = now
            onLoginRequested()
        }

        private func requestStore() {
            let now = Date()
            guard now.timeIntervalSince(lastStoreRequestAt) > 1 else { return }
            lastStoreRequestAt = now
            onStoreRequested()
        }

        private func synchronizeNativeCookiesToWeb(completion: @escaping @MainActor () -> Void) {
            guard let webView, APIClient.baseURL.host != nil else {
                completion()
                return
            }
            let store = webView.configuration.websiteDataStore.httpCookieStore
            let nativeCookies = HTTPCookieStorage.shared.cookies(for: APIClient.baseURL) ?? []
            let setGroup = DispatchGroup()
            nativeCookies.forEach { cookie in
                setGroup.enter()
                store.setCookie(cookie) { setGroup.leave() }
            }
            setGroup.notify(queue: .main) { completion() }
        }

        private func notifyWebAuthChanged() {
            webView?.evaluateJavaScript(
                "window.dispatchEvent(new CustomEvent('theone:auth-changed'));",
                completionHandler: nil
            )
        }

        private func synchronizeWebCookiesToNative() {
            guard let webView else { return }
            webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { cookies in
                cookies
                    .filter { Self.isFirstPartyHost($0.domain) }
                    .forEach { HTTPCookieStorage.shared.setCookie($0) }
            }
        }

        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
            isLoadingPage = false
            pageReady = true
            loadState.markReady()
            HybridWebContentView.normalizeWebViewZoom(webView)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            isLoadingPage = false
            loadAttempts = 0
            pageReady = true
            loadState.markReady()
            HybridWebContentView.normalizeWebViewZoom(webView)
            synchronizeWebCookiesToNative()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            retryLoadIfNeeded(error: error)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            retryLoadIfNeeded(error: error)
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
            let firstParty = isFirstParty(url)
            if firstParty, url.path == "/login" {
                requestLogin()
                decisionHandler(.cancel)
                return
            }
            if firstParty, url.path == "/shop" {
                requestStore()
                decisionHandler(.cancel)
                return
            }
            if firstParty, url.path == "/download" {
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
                requestLogin()
            } else if type == "store" {
                requestStore()
            } else if type == "modalBackdropChanged",
                      let payload = body["payload"] as? [String: Any],
                      let active = payload["active"] as? Bool {
                container?.setModalBackdropActive(active)
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

@MainActor
final class HybridWebViewContainer: UIView {
    let webView: WKWebView
    var onFirstValidLayout: (@MainActor () -> Void)?
    private let topFade = HybridEdgeFadeView(edge: .top)
    private let modalTopFade = HybridEdgeFadeView(edge: .modalTop)
    private let bottomFade = HybridEdgeFadeView(edge: .bottom)
    private var modalBackdropActive = false
    private var contentOffsetObservation: NSKeyValueObservation?
    private var contentSizeObservation: NSKeyValueObservation?
    private var zoomScaleObservation: NSKeyValueObservation?
    private var lastWebViewSize = CGSize.zero

    init(webView: WKWebView) {
        self.webView = webView
        super.init(frame: .zero)
        backgroundColor = UIColor(AppTheme.background)
        clipsToBounds = true
        isMultipleTouchEnabled = true
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(webView)
        addSubview(topFade)
        modalTopFade.alpha = 0
        addSubview(modalTopFade)
        addSubview(bottomFade)

        contentOffsetObservation = webView.scrollView.observe(\.contentOffset, options: [.initial, .new]) { [weak self] _, _ in
            Task { @MainActor in self?.updateEdgeFades() }
        }
        contentSizeObservation = webView.scrollView.observe(\.contentSize, options: [.initial, .new]) { [weak self] _, _ in
            Task { @MainActor in self?.updateEdgeFades() }
        }
        zoomScaleObservation = webView.scrollView.observe(\.zoomScale, options: [.new]) { scrollView, _ in
            guard abs(scrollView.zoomScale - 1) > 0.001 else { return }
            scrollView.setZoomScale(1, animated: false)
        }
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        setNeedsLayout()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        guard bounds.width > 1, bounds.height > 1 else { return }
        webView.frame = bounds
        let sizeChanged = webView.bounds.size != lastWebViewSize
        lastWebViewSize = webView.bounds.size
        if let onFirstValidLayout {
            self.onFirstValidLayout = nil
            onFirstValidLayout()
        }
        if sizeChanged {
            HybridWebContentView.normalizeWebViewZoom(webView)
        }
        topFade.frame = CGRect(x: 0, y: 0, width: bounds.width, height: 68)
        modalTopFade.frame = CGRect(x: 0, y: 0, width: bounds.width, height: 148)
        bottomFade.frame = CGRect(x: 0, y: max(0, bounds.height - 80), width: bounds.width, height: 80)
        updateEdgeFades()
    }

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        bounds.contains(point)
    }

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard bounds.contains(point) else { return nil }
        return super.hitTest(point, with: event)
    }

    func setModalBackdropActive(_ active: Bool, animated: Bool = true) {
        guard modalBackdropActive != active else { return }
        modalBackdropActive = active
        updateEdgeFades(animated: animated)
    }

    private func updateEdgeFades(animated: Bool = false) {
        let scrollView = webView.scrollView
        let offset = scrollView.contentOffset.y + scrollView.adjustedContentInset.top
        topFade.alpha = min(1, max(0, offset / 48))
        let modalAlpha: CGFloat = modalBackdropActive ? 1 : 0
        if animated {
            modalTopFade.layer.removeAllAnimations()
            let animator = UIViewPropertyAnimator(
                duration: 0.34,
                controlPoint1: CGPoint(x: 0.32, y: 0.72),
                controlPoint2: CGPoint(x: 0, y: 1)
            )
            animator.addAnimations { [weak self] in self?.modalTopFade.alpha = modalAlpha }
            animator.startAnimation()
        } else {
            modalTopFade.alpha = modalAlpha
        }

        let visibleBottom = scrollView.contentOffset.y + scrollView.bounds.height
        let contentBottom = scrollView.contentSize.height + scrollView.adjustedContentInset.bottom
        let remaining = contentBottom - visibleBottom
        bottomFade.alpha = min(1, max(0, remaining / 48))
    }

    required init?(coder: NSCoder) { nil }
}

@MainActor
private final class HybridEdgeFadeView: UIView {
    enum Edge { case top, modalTop, bottom }

    private let gradient = CAGradientLayer()

    init(edge: Edge) {
        super.init(frame: .zero)
        isUserInteractionEnabled = false
        backgroundColor = .clear
        let paper = UIColor(AppTheme.background)
        switch edge {
        case .top:
            gradient.colors = [
                paper.cgColor,
                paper.withAlphaComponent(0.86).cgColor,
                paper.withAlphaComponent(0.42).cgColor,
                paper.withAlphaComponent(0).cgColor,
            ]
            gradient.locations = [0, 0.28, 0.62, 1]
        case .modalTop:
            gradient.colors = [
                paper.cgColor,
                paper.withAlphaComponent(0.99).cgColor,
                paper.withAlphaComponent(0.96).cgColor,
                paper.withAlphaComponent(0.88).cgColor,
                paper.withAlphaComponent(0.74).cgColor,
                paper.withAlphaComponent(0.56).cgColor,
                paper.withAlphaComponent(0.38).cgColor,
                paper.withAlphaComponent(0.23).cgColor,
                paper.withAlphaComponent(0.12).cgColor,
                paper.withAlphaComponent(0.05).cgColor,
                paper.withAlphaComponent(0).cgColor,
                paper.withAlphaComponent(0).cgColor,
            ]
            gradient.locations = [0, 0.08, 0.18, 0.30, 0.44, 0.58, 0.70, 0.80, 0.88, 0.94, 0.98, 1]
        case .bottom:
            gradient.colors = [
                paper.withAlphaComponent(0).cgColor,
                paper.withAlphaComponent(0.42).cgColor,
                paper.withAlphaComponent(0.86).cgColor,
                paper.cgColor,
            ]
            gradient.locations = [0, 0.28, 0.62, 1]
        }
        layer.addSublayer(gradient)
        accessibilityElementsHidden = true
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        gradient.frame = bounds
    }

    required init?(coder: NSCoder) { nil }
}
