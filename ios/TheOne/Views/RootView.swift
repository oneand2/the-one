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
            try? await Task.sleep(nanoseconds: 1_600_000_000)
            if reduceMotion {
                showLaunch = false
            } else {
                withAnimation(.timingCurve(0.32, 0.72, 0, 1, duration: 0.42)) {
                    showLaunch = false
                }
            }
        }
        .sheet(isPresented: $auth.showsLogin) {
            LoginView()
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .tint(AppTheme.ink)
    }
}

private struct LaunchView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var fieldVisible = false
    @State private var markVisible = false
    @State private var wordsVisible = false

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                AppTheme.background
                    .ignoresSafeArea()

                LaunchField()
                    .opacity(fieldVisible ? 1 : 0)
                    .scaleEffect(fieldVisible ? 1 : 0.94)

                VStack(spacing: 0) {
                    ZStack {
                        Circle()
                            .fill(AppTheme.warmWhite.opacity(0.76))
                            .frame(width: 142, height: 142)

                        Circle()
                            .stroke(AppTheme.gold.opacity(0.13), lineWidth: 0.7)
                            .frame(width: 142, height: 142)

                        Circle()
                            .stroke(AppTheme.gold.opacity(0.07), lineWidth: 0.7)
                            .frame(width: 124, height: 124)

                        FourSymbolGlyph(
                            symbol: .juexingcang,
                            width: 58,
                            lineHeight: 10.5,
                            color: AppTheme.ink
                        )

                        RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                            .fill(AppTheme.cinnabar.opacity(0.88))
                            .frame(width: 5, height: 18)
                            .offset(x: 49, y: 45)
                    }
                    .scaleEffect(markVisible ? 1 : 0.82)
                    .opacity(markVisible ? 1 : 0)

                    Rectangle()
                        .fill(AppTheme.gold.opacity(0.42))
                        .frame(width: 34, height: 0.7)
                        .padding(.top, 31)
                        .padding(.bottom, 19)
                        .scaleEffect(x: wordsVisible ? 1 : 0.15, y: 1)

                    Text("世间即道场，人生是修行")
                        .font(.kaiti(17))
                        .tracking(2.6)
                        .foregroundStyle(AppTheme.stone700)
                        .multilineTextAlignment(.center)
                        .opacity(wordsVisible ? 1 : 0)
                        .offset(y: wordsVisible ? 0 : 9)
                }
                .position(x: proxy.size.width / 2, y: proxy.size.height * 0.46)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("二，世间即道场，人生是修行")
        .onAppear {
            guard !reduceMotion else {
                fieldVisible = true
                markVisible = true
                wordsVisible = true
                return
            }

            withAnimation(.timingCurve(0.32, 0.72, 0, 1, duration: 0.90)) {
                fieldVisible = true
            }
            withAnimation(.spring(response: 0.72, dampingFraction: 0.86).delay(0.08)) {
                markVisible = true
            }
            withAnimation(.timingCurve(0.32, 0.72, 0, 1, duration: 0.68).delay(0.28)) {
                wordsVisible = true
            }
        }
    }
}

/// 像宣纸上极淡的圆规痕：暗示「道场」与循环，但不与品牌符号争夺视觉中心。
private struct LaunchField: View {
    var body: some View {
        Canvas { context, size in
            let center = CGPoint(x: size.width / 2, y: size.height * 0.46)
            let radii: [(CGFloat, Double)] = [
                (118, 0.10),
                (190, 0.065),
                (278, 0.035)
            ]

            for (radius, opacity) in radii {
                let rect = CGRect(
                    x: center.x - radius,
                    y: center.y - radius,
                    width: radius * 2,
                    height: radius * 2
                )
                context.stroke(
                    Path(ellipseIn: rect),
                    with: .color(AppTheme.gold.opacity(opacity)),
                    lineWidth: 0.7
                )
            }

            var axisMarks = Path()
            axisMarks.move(to: CGPoint(x: center.x, y: center.y - 199))
            axisMarks.addLine(to: CGPoint(x: center.x, y: center.y - 181))
            axisMarks.move(to: CGPoint(x: center.x, y: center.y + 181))
            axisMarks.addLine(to: CGPoint(x: center.x, y: center.y + 199))
            axisMarks.move(to: CGPoint(x: center.x - 199, y: center.y))
            axisMarks.addLine(to: CGPoint(x: center.x - 181, y: center.y))
            axisMarks.move(to: CGPoint(x: center.x + 181, y: center.y))
            axisMarks.addLine(to: CGPoint(x: center.x + 199, y: center.y))
            context.stroke(
                axisMarks,
                with: .color(AppTheme.gold.opacity(0.10)),
                lineWidth: 0.7
            )
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
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
            .id("theone-hybrid-web")

            LegacyTabBar(selection: Binding(
                get: { flow.screen.navigationSymbol },
                set: {
                    flow.selectNavigation($0)
                }
            ))
        }
        // 与网页 MobileNav（fixed bottom + padding-bottom: max(8px, safe-area)）对齐：
        // 底栏贴屏幕底，安全区留白放在栏内，避免系统先托起一整块再叠 8pt。
        .ignoresSafeArea(.container, edges: .bottom)
        .background(AmbientBackground())
        .overlay {
            if showGetCoins {
                GetCoinsInfoOverlay(showStore: $showStore, isPresented: $showGetCoins)
            }
        }
        .sheet(isPresented: $showStore) { StoreView() }
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
                accountMenuButton("我的八维结果", icon: "brain.head.profile") {
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

    var body: some View {
        HStack(spacing: 0) {
            ForEach(FourSymbol.allCases, id: \.self) { item in
                Button {
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
                .sensoryTap()
            }
        }
        .padding(.horizontal, UIContract.Navigation.barHorizontalPadding)
        .padding(.vertical, UIContract.Navigation.barVerticalPadding)
        .padding(.bottom, UIContract.Navigation.safeAreaMinimum)
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
