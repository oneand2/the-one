import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showLaunch = true

    var body: some View {
        Group {
            if showLaunch {
                LaunchView()
            } else {
                MainTabView()
            }
        }
        .task {
            try? await Task.sleep(nanoseconds: 2_100_000_000)
            if reduceMotion {
                showLaunch = false
            } else {
                withAnimation(.timingCurve(0.32, 0.72, 0, 1, duration: 0.42)) {
                    showLaunch = false
                }
            }
        }
        .fullScreenCover(isPresented: $auth.showsLogin) {
            LoginView()
        }
        .tint(AppTheme.ink)
    }
}

private struct LaunchView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var firstStroke: CGFloat = 0
    @State private var secondStroke: CGFloat = 0
    @State private var mountVisible = false
    @State private var ruleVisible = false
    @State private var wordsVisible = false
    @State private var captionVisible = false

    private let slogan = Array("世间即道场，人生是修行")

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                AppTheme.background
                    .ignoresSafeArea()

                // 装裱细框：沿屏幕四边内收 18pt，把「空」围成「境」。
                Rectangle()
                    .stroke(AppTheme.stone300.opacity(0.9), lineWidth: 0.75)
                    .padding(18)
                    .opacity(mountVisible ? 1 : 0)

                VStack(spacing: 0) {
                    // 老阳：两个等长阳爻相叠。第一笔自左伸出，第二笔自右应回——连接之上的连接。
                    VStack(spacing: 14) {
                        LaunchBar(width: 56, height: 7, color: AppTheme.stone800, progress: firstStroke, anchor: .leading)
                        LaunchBar(width: 56, height: 7, color: AppTheme.stone800, progress: secondStroke, anchor: .trailing)
                    }

                    Rectangle()
                        .fill(AppTheme.gold.opacity(0.38))
                        .frame(width: 26, height: 0.7)
                        .padding(.top, 34)
                        .padding(.bottom, 20)
                        .scaleEffect(x: ruleVisible ? 1 : 0.08, y: 1)
                        .opacity(ruleVisible ? 1 : 0)

                    HStack(spacing: 2.6) {
                        ForEach(Array(slogan.enumerated()), id: \.offset) { index, character in
                            Text(String(character))
                                .font(.kaiti(17))
                                .foregroundStyle(AppTheme.stone600)
                                .opacity(wordsVisible ? 1 : 0)
                                .offset(y: wordsVisible ? 0 : 7)
                                .animation(
                                    .timingCurve(0.22, 0.68, 0, 1, duration: 0.46)
                                        .delay(1.05 + Double(index) * 0.03),
                                    value: wordsVisible
                                )
                        }
                    }
                    .lineLimit(1)
                    .minimumScaleFactor(0.9)
                }
                .frame(width: proxy.size.width - 48)
                .position(x: proxy.size.width / 2, y: proxy.size.height * 0.46)

                Text("用之则行　舍之则藏")
                    .font(.kaiti(10))
                    .tracking(3.4)
                    .foregroundStyle(AppTheme.stone500.opacity(0.6))
                    .opacity(captionVisible ? 1 : 0)
                    .position(x: proxy.size.width / 2, y: proxy.size.height - proxy.safeAreaInsets.bottom - 44)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("二，世间即道场，人生是修行")
        .onAppear {
            guard !reduceMotion else {
                mountVisible = true
                firstStroke = 1
                secondStroke = 1
                ruleVisible = true
                wordsVisible = true
                captionVisible = true
                return
            }

            withAnimation(.easeOut(duration: 0.4)) {
                mountVisible = true
            }
            withAnimation(.timingCurve(0.5, 0.06, 0.24, 1, duration: 0.5).delay(0.15)) {
                firstStroke = 1
            }
            withAnimation(.timingCurve(0.5, 0.06, 0.24, 1, duration: 0.5).delay(0.45)) {
                secondStroke = 1
            }
            withAnimation(.timingCurve(0.32, 0.72, 0, 1, duration: 0.42).delay(0.95)) {
                ruleVisible = true
            }
            // 逐字入场由每个字自带的 delay 驱动，这里直接置位。
            wordsVisible = true
            withAnimation(.easeOut(duration: 0.38).delay(1.35)) {
                captionVisible = true
            }
        }
    }
}

/// 一根阳爻：纯几何直边，用横向遮罩从 anchor 一侧「写」出。
private struct LaunchBar: View {
    var width: CGFloat
    var height: CGFloat
    var color: Color
    var progress: CGFloat
    var anchor: UnitPoint

    var body: some View {
        Rectangle()
            .fill(color)
            .frame(width: width, height: height)
            .mask {
                Rectangle()
                    .scaleEffect(x: max(progress, 0.0001), anchor: anchor)
            }
    }
}

// 兼容账户页与登录页中原有的品牌引用；外观使用网站的老阳符号。
struct AppMark: View {
    var size: CGFloat = 54
    var body: some View {
        FourSymbolGlyph(
            symbol: .juexingcang,
            width: size * 0.62,
            lineHeight: max(5, size * 0.11),
            color: AppTheme.ink
        )
        .frame(width: size, height: size)
        .accessibilityLabel("二")
    }
}

private struct MainTabView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var profile: ProfileStore
    @EnvironmentObject private var flow: AppFlowStore
    @Environment(\.scenePhase) private var scenePhase
    @State private var showStore = false
    @State private var showGetCoins = false
    @StateObject private var webLoad = HybridLoadState()

    var body: some View {
        GeometryReader { geo in
            let fullHeight = geo.size.height + geo.safeAreaInsets.bottom
            VStack(spacing: 0) {
                HStack {
                    Spacer(minLength: 0)
                    AccountMenu(showGetCoins: $showGetCoins)
                }
                .background(AppTheme.background)

                ZStack {
                    HybridWebContentView(
                        flow: flow,
                        sessionIdentity: auth.user?.id ?? "guest",
                        scenePhase: scenePhase,
                        loadState: webLoad,
                        onTabChanged: { flow.screen = $0 },
                        onLoginRequested: { auth.showsLogin = true },
                        onStoreRequested: { showStore = true }
                    )
                    if !webLoad.isReady {
                        HybridLoadOverlay(state: webLoad)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipped()
                .id("theone-hybrid-web")

                LegacyTabBar(selection: Binding(
                    get: { flow.screen.navigationSymbol },
                    set: {
                        flow.selectNavigation($0)
                    }
                ))
                .frame(height: LegacyTabBar.barHeight)
            }
            .frame(width: geo.size.width, height: fullHeight, alignment: .top)
        }
        // 只把底栏推进屏幕底边，网页高度由上面 VStack 扣死，避免 WKWebView 盖住按钮。
        .ignoresSafeArea(.container, edges: .bottom)
        .background(AmbientBackground())
        .overlay {
            if showGetCoins {
                GetCoinsInfoOverlay(showStore: $showStore, isPresented: $showGetCoins)
            }
        }
        .fullScreenCover(isPresented: $showStore) { StoreView() }
    }

    private struct HybridLoadOverlay: View {
        @ObservedObject var state: HybridLoadState

        var body: some View {
            VStack(spacing: 16) {
                if !state.canRetry {
                    ProgressView()
                        .controlSize(.regular)
                        .tint(AppTheme.muted)
                }
                Text(state.message)
                    .font(.kaiti(14))
                    .tracking(0.4)
                    .foregroundStyle(AppTheme.stone500)
                    .multilineTextAlignment(.center)
                if state.canRetry {
                    Button("重新载入", action: state.retry)
                        .font(.system(size: 13))
                        .foregroundStyle(AppTheme.stone600)
                        .underline(true, color: AppTheme.stone300)
                }
            }
            .padding(32)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(AppTheme.background)
            .allowsHitTesting(state.canRetry)
        }
    }

    private struct AccountMenu: View {
        @EnvironmentObject private var auth: AuthStore
        @EnvironmentObject private var profile: ProfileStore
        @EnvironmentObject private var flow: AppFlowStore
        @State private var showProfile = false
        @State private var recordsKind: RecordsKind?
        @State private var showLegal = false
        @Binding var showGetCoins: Bool
        @State private var menuOpen = false

        var body: some View {
            accountTrigger
                .padding(.top, 4)
                .padding(.bottom, 4)
                .padding(.trailing, 10)
                .fullScreenCover(isPresented: $menuOpen) {
                    ZStack(alignment: .topTrailing) {
                        Color.black.opacity(0.001)
                            .ignoresSafeArea()
                            .contentShape(Rectangle())
                            .onTapGesture { setMenuOpen(false) }

                        menuPanel
                            .padding(.top, 44)
                            .padding(.trailing, 10)
                    }
                    .presentationBackground(.clear)
                }
                .sheet(isPresented: $showProfile) { NavigationStack { ProfileView() } }
                .sheet(item: $recordsKind) { kind in
                    NavigationStack {
                        switch kind {
                        case .classical: ClassicalRecordsList()
                        case .mbti: MBTIRecordsList()
                        case .liuyao: LiuYaoRecordsList()
                        }
                    }
                }
                .sheet(isPresented: $showLegal) { NavigationStack { LegalCenterView() } }
                .onChange(of: flow.pendingChat?.id) { _, requestID in
                    guard requestID != nil else { return }
                    recordsKind = nil
                    showProfile = false
                    showLegal = false
                    setMenuOpen(false)
                }
        }

        private var displayName: String {
            let profileNick = profile.profile?.nickname.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !profileNick.isEmpty { return profileNick }
            let authNick = auth.user?.nickname.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !authNick.isEmpty { return authNick }
            let email = auth.user?.email.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !email.isEmpty { return email }
            return "用户"
        }

        private var coinTint: Color {
            Color(red: 180 / 255, green: 83 / 255, blue: 9 / 255).opacity(0.80)
        }

        @ViewBuilder
        private var accountTrigger: some View {
            if auth.isAuthenticated {
                HStack(spacing: 4) {
                    Button { showGetCoins = true } label: {
                        Group {
                            if profile.profile?.isActiveVip == true {
                                Text(profile.profile?.vipBadgeText ?? "VIP")
                                    .font(.system(size: 13))
                                    .foregroundStyle(AppTheme.stone700)
                            } else {
                                HStack(spacing: 5) {
                                    CopperCoinMark(size: 15)
                                        .foregroundStyle(coinTint)
                                    Text("\(profile.profile?.coinsBalance ?? 0)")
                                        .font(.system(size: 13))
                                        .foregroundStyle(AppTheme.stone700)
                                        .monospacedDigit()
                                }
                            }
                        }
                        .padding(.horizontal, 6)
                        .padding(.vertical, 6)
                    }
                    .buttonStyle(.plain)
                    .sensoryTap()

                    Button { setMenuOpen(!menuOpen) } label: {
                        HStack(spacing: 3) {
                            Text(displayName)
                                .font(.system(size: 13))
                                .foregroundStyle(AppTheme.stone700)
                                .lineLimit(1)
                                .truncationMode(.tail)
                                .frame(maxWidth: 52, alignment: .leading)
                            Image(systemName: "chevron.down")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(AppTheme.stone500)
                                .rotationEffect(.degrees(menuOpen ? 180 : 0))
                        }
                        .padding(.leading, 2)
                        .padding(.trailing, 6)
                        .padding(.vertical, 6)
                    }
                    .buttonStyle(.plain)
                    .sensoryTap()
                }
                .fixedSize()
            } else {
                Button { auth.showsLogin = true } label: {
                    Text("登录")
                        .font(.system(size: UIContract.Typography.button.size))
                        .foregroundStyle(.white)
                        .padding(.horizontal, UIContract.Spacing.md)
                        .frame(height: 34)
                        .background(AppTheme.stone800, in: Capsule())
                }
                .buttonStyle(.plain)
                .sensoryTap()
            }
        }

        private var menuPanel: some View {
            VStack(spacing: 0) {
                accountMenuButton("个人设置", icon: "person.crop.circle") {
                    closeMenu(); showProfile = true
                }
                accountMenuButton("我的八字排盘", icon: "calendar") {
                    closeMenu(); recordsKind = .classical
                }
                accountMenuButton("我的八卦人格", icon: "brain.head.profile") {
                    closeMenu(); recordsKind = .mbti
                }
                accountMenuButton("我的周易解卦", icon: "sparkles") {
                    closeMenu(); recordsKind = .liuyao
                }

                menuDivider

                accountMenuButton("服务与支持", icon: "lifepreserver", showsChevron: true) {
                    closeMenu(); showLegal = true
                }

                menuDivider

                Button {
                    closeMenu()
                    Task { await auth.logout() }
                } label: {
                    HStack {
                        Text("退出")
                            .font(.system(size: 14))
                            .foregroundStyle(AppTheme.stone600)
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .frame(height: 42)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .padding(.vertical, 6)
            .frame(width: 256)
            .background(
                Color.white.opacity(0.95),
                in: RoundedRectangle(cornerRadius: 16, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.black.opacity(0.08), lineWidth: 1)
            }
            .shadow(
                color: Color(red: 68 / 255, green: 64 / 255, blue: 60 / 255).opacity(0.14),
                radius: 25,
                y: 9
            )
        }

        private var menuDivider: some View {
            Rectangle()
                .fill(AppTheme.stone100)
                .frame(height: 1)
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
        }

        private func accountMenuButton(
            _ title: String,
            icon: String,
            showsChevron: Bool = false,
            action: @escaping () -> Void
        ) -> some View {
            Button(action: action) {
                HStack(spacing: 8) {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .regular))
                        .foregroundStyle(AppTheme.stone500)
                        .frame(width: 16, height: 16)
                    Text(title)
                        .font(.system(size: 14))
                        .foregroundStyle(AppTheme.stone700)
                    Spacer(minLength: 8)
                    if showsChevron {
                        Image(systemName: "chevron.down")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(AppTheme.stone400)
                    }
                }
                .padding(.horizontal, 16)
                .frame(height: 42)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .sensoryTap()
        }

        private func closeMenu() {
            setMenuOpen(false)
        }

        private func setMenuOpen(_ open: Bool) {
            var transaction = Transaction()
            transaction.disablesAnimations = true
            withTransaction(transaction) {
                menuOpen = open
            }
        }
    }
}

private struct LegacyTabBar: View {
    @Binding var selection: FourSymbol
    @Namespace private var indicatorNamespace

    /// 与网页 MobileNav 对齐：图标区 + 栏内 py-2 + padding-bottom: 8px。
    static var barHeight: CGFloat {
        UIContract.Navigation.barVerticalPadding * 2
            + UIContract.Navigation.itemVerticalPadding * 2
            + UIContract.Navigation.iconSize
            + UIContract.Navigation.iconLabelGap
            + UIContract.Typography.navigationLabel.lineHeight
            + UIContract.Navigation.safeAreaMinimum
    }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(FourSymbol.allCases, id: \.self) { item in
                Button {
                    UIImpactFeedbackGenerator(style: .soft).impactOccurred()
                    selection = item
                } label: {
                    ZStack(alignment: .top) {
                        VStack(spacing: UIContract.Navigation.iconLabelGap) {
                            MobileNavGlyph(
                                symbol: item,
                                color: selection == item ? AppTheme.stone600 : AppTheme.stone400
                            )
                            .frame(width: UIContract.Navigation.iconSize, height: UIContract.Navigation.iconSize)
                            Text(item.title)
                                .font(.kaiti(UIContract.Typography.navigationLabel.size))
                                .tracking(UIContract.Typography.navigationLabel.letterSpacing)
                                .foregroundStyle(selection == item ? AppTheme.stone600 : AppTheme.stone400)
                                .frame(height: UIContract.Typography.navigationLabel.lineHeight)
                        }
                        .padding(.vertical, UIContract.Navigation.itemVerticalPadding)

                        if selection == item {
                            Capsule()
                                .fill(AppTheme.stone500)
                                .frame(
                                    width: UIContract.Navigation.indicatorWidth,
                                    height: UIContract.Navigation.indicatorHeight
                                )
                                .matchedGeometryEffect(id: "mobileActiveIndicator", in: indicatorNamespace)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, UIContract.Navigation.barHorizontalPadding)
        .padding(.vertical, UIContract.Navigation.barVerticalPadding)
        .padding(.bottom, UIContract.Navigation.safeAreaMinimum)
        .frame(height: Self.barHeight)
        .contentShape(Rectangle())
        .background(AppTheme.background)
        .animation(
            .interpolatingSpring(
                stiffness: UIContract.Motion.springStiffness,
                damping: UIContract.Motion.springDamping
            ),
            value: selection
        )
    }
}

/// 手机版底栏使用另一套 100×100 SVG 坐标：x=10/58、y=30/58、宽=32、高=12。
/// 不能复用页首四象，否则线段会被画宽 25%。
private struct MobileNavGlyph: View {
    let symbol: FourSymbol
    let color: Color

    var body: some View {
        Canvas { context, size in
            let w = size.width
            let h = size.height
            let lineHeight = h * 0.12
            let yValues = [h * 0.30, h * 0.58]
            for (index, halves) in symbol.lines.enumerated() {
                let y = yValues[index]
                if halves.0 {
                    context.fill(Path(CGRect(x: w * 0.10, y: y, width: w * 0.32, height: lineHeight)), with: .color(color))
                    context.fill(Path(CGRect(x: w * 0.58, y: y, width: w * 0.32, height: lineHeight)), with: .color(color))
                } else {
                    context.fill(Path(CGRect(x: w * 0.10, y: y, width: w * 0.80, height: lineHeight)), with: .color(color))
                }
            }
        }
        .accessibilityHidden(true)
    }
}
