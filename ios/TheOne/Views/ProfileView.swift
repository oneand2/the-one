import SwiftUI

struct ProfileView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var profile: ProfileStore
    @State private var showStore = false
    @State private var showDeleteConfirmation = false
    @State private var isDeleting = false
    @State private var nicknameDraft = ""
    @State private var isSavingNickname = false
    @State private var isGeneratingInvite = false
    @State private var showGetCoinsInfo = false

    var body: some View {
        ZStack {
            AmbientBackground()
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: UIContract.Spacing.xl) {
                    NativeSheetHeader(
                        title: "个人设置",
                        subtitle: "账户、铜币与记录会在各端同步",
                        close: { dismiss() }
                    )

                    if auth.isAuthenticated { authenticatedContent }
                    else { guestContent }
                }
                .padding(.horizontal, UIContract.Spacing.lg)
                .padding(.top, UIContract.Spacing.lg)
                .padding(.bottom, UIContract.Spacing.section)
                .frame(maxWidth: UIContract.contentMaxWidth)
                .frame(maxWidth: .infinity)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .onAppear { nicknameDraft = profile.profile?.nickname ?? "" }
        .onChange(of: profile.profile?.nickname) { _, value in
            if let value { nicknameDraft = value }
        }
        .sheet(isPresented: $showStore) { StoreView() }
        .overlay {
            if showGetCoinsInfo {
                GetCoinsInfoOverlay(showStore: $showStore, isPresented: $showGetCoinsInfo)
            }
        }
        .confirmationDialog("确认永久注销账户？", isPresented: $showDeleteConfirmation, titleVisibility: .visible) {
            Button("永久删除账户及个人数据", role: .destructive) {
                Task {
                    isDeleting = true
                    _ = await auth.deleteAccount()
                    isDeleting = false
                }
            }
            Button("取消", role: .cancel) {}
        } message: {
            Text("此操作不可撤销。依法需要保留的交易记录可能在法定期限内继续保存。")
        }
    }

    private var guestContent: some View {
        NativeSurface(padding: UIContract.Spacing.lg) {
            VStack(spacing: UIContract.Spacing.md) {
                AppMark(size: 68)
                Text("登录，继续你的记录")
                    .font(.webSerif(23))
                    .foregroundStyle(AppTheme.stone800)
                Text("账户、铜币、排盘和测试记录会与网页及 Android 同步。")
                    .font(.system(size: 12))
                    .foregroundStyle(AppTheme.stone500)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                Button {
                    auth.showsLogin = true
                } label: {
                    Text("登录或注册")
                        .font(.system(size: 13))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 46)
                        .background(AppTheme.stone800, in: Capsule())
                }
                .buttonStyle(.plain)
                .sensoryTap()
            }
            .frame(maxWidth: .infinity)
        }
    }

    private var authenticatedContent: some View {
        VStack(alignment: .leading, spacing: UIContract.Spacing.xl) {
            accountSection
            inviteSection
            balanceSection
            routesSection
            accountActions
        }
    }

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: UIContract.Spacing.sm) {
            NativeSectionHeading(title: "账户")
            NativeSurface {
                VStack(alignment: .leading, spacing: 10) {
                    Text("昵称")
                        .font(.system(size: 12))
                        .foregroundStyle(AppTheme.stone600)
                    HStack(spacing: 8) {
                        TextField("用于展示的称呼", text: $nicknameDraft)
                            .font(.system(size: 14))
                            .padding(.horizontal, 14)
                            .frame(height: 44)
                            .background(
                                AppTheme.stone100.opacity(0.64),
                                in: RoundedRectangle(cornerRadius: UIContract.Radii.small, style: .continuous)
                            )
                            .overlay {
                                RoundedRectangle(cornerRadius: UIContract.Radii.small, style: .continuous)
                                    .stroke(AppTheme.hairline)
                            }
                        Button(isSavingNickname ? "保存中…" : "保存") { saveNickname() }
                            .font(.system(size: 13))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 15)
                            .frame(height: 44)
                            .background(
                                AppTheme.stone800,
                                in: RoundedRectangle(cornerRadius: UIContract.Radii.small, style: .continuous)
                            )
                            .disabled(isSavingNickname)
                            .sensoryTap()
                    }
                    Text(auth.user?.email ?? "")
                        .font(.system(size: 10))
                        .foregroundStyle(AppTheme.stone400)
                }
            }
        }
    }

    private var inviteSection: some View {
        VStack(alignment: .leading, spacing: UIContract.Spacing.sm) {
            NativeSectionHeading(title: "邀请")
            NativeSurface {
                VStack(alignment: .leading, spacing: 8) {
                    Text("邀请码")
                        .font(.system(size: 12))
                        .foregroundStyle(AppTheme.stone600)
                    Text("他人注册时填写你的邀请码，你可获得 200 铜币")
                        .font(.system(size: 10))
                        .foregroundStyle(AppTheme.stone400)
                    HStack(spacing: 8) {
                        Text(profile.profile?.inviteCode ?? "—")
                            .font(.system(size: 14, design: .monospaced))
                            .foregroundStyle(AppTheme.stone700)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 14)
                            .frame(height: 44)
                            .background(
                                AppTheme.stone100.opacity(0.64),
                                in: RoundedRectangle(cornerRadius: UIContract.Radii.small, style: .continuous)
                            )
                        Button(isGeneratingInvite ? "生成中…" : (profile.profile?.inviteCode == nil ? "生成邀请码" : "重新生成")) {
                            generateInvite()
                        }
                        .font(.system(size: 12))
                        .foregroundStyle(AppTheme.stone600)
                        .padding(.horizontal, 12)
                        .frame(height: 44)
                        .background(
                            AppTheme.warmWhite,
                            in: RoundedRectangle(cornerRadius: UIContract.Radii.small, style: .continuous)
                        )
                        .overlay {
                            RoundedRectangle(cornerRadius: UIContract.Radii.small, style: .continuous)
                                .stroke(AppTheme.hairline)
                        }
                        .disabled(isGeneratingInvite)
                        .sensoryTap()
                    }
                }
            }
        }
    }

    private var balanceSection: some View {
        VStack(alignment: .leading, spacing: UIContract.Spacing.sm) {
            NativeSectionHeading(title: profile.profile?.isActiveVip == true ? "会员" : "铜币")
            NativeSurface {
                if profile.profile?.isActiveVip == true {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(profile.profile?.vipDetailText ?? "VIP")
                            .font(.webSerif(20))
                            .foregroundStyle(AppTheme.stone800)
                        Text("VIP 使用任意功能不消耗铜币")
                            .font(.system(size: 11))
                            .foregroundStyle(AppTheme.stone400)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(alignment: .firstTextBaseline, spacing: 7) {
                            Text("\(profile.profile?.coinsBalance ?? 0)")
                                .font(.webSerif(22))
                                .foregroundStyle(AppTheme.stone800)
                                .monospacedDigit()
                            Text("铜币")
                                .font(.system(size: 11))
                                .foregroundStyle(AppTheme.stone400)
                        }
                        Text("决行藏每问 2 枚（深度思考 +2，宗师 +20，联网 +2）")
                            .font(.system(size: 10))
                            .foregroundStyle(AppTheme.stone400)
                        Button("获取铜币") { showGetCoinsInfo = true }
                            .font(.system(size: 12))
                            .foregroundStyle(AppTheme.stone600)
                            .underline()
                            .padding(.top, 4)
                            .sensoryTap()
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private var routesSection: some View {
        VStack(alignment: .leading, spacing: UIContract.Spacing.sm) {
            NativeSectionHeading(title: "更多")
            NativeSurface(padding: 8) {
                VStack(spacing: 0) {
                    NavigationLink(destination: RecordsView()) {
                        NativeMenuRow(
                            title: "我的记录",
                            detail: "排盘、测试与起卦",
                            icon: "clock.arrow.circlepath",
                            tint: AppTheme.jade
                        )
                    }
                    .buttonStyle(.plain)
                    Rectangle().fill(AppTheme.hairline).frame(height: 1).padding(.leading, 43)
                    NavigationLink(destination: LegalCenterView()) {
                        NativeMenuRow(
                            title: "协议与隐私",
                            detail: "查看数据处理说明",
                            icon: "doc.text",
                            tint: AppTheme.water
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var accountActions: some View {
        VStack(spacing: 6) {
            Button { Task { await auth.logout() } } label: {
                Text("退出登录")
                    .font(.system(size: 13))
                    .foregroundStyle(AppTheme.stone600)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
            }
            .buttonStyle(.plain)
            .sensoryTap()
            Button { showDeleteConfirmation = true } label: {
                Text(isDeleting ? "正在注销…" : "注销账户")
                    .font(.system(size: 12))
                    .foregroundStyle(AppTheme.cinnabar)
                    .frame(maxWidth: .infinity)
                    .frame(height: 40)
            }
            .buttonStyle(.plain)
            .disabled(isDeleting)
        }
    }

    private func saveNickname() {
        Task {
            isSavingNickname = true
            _ = await profile.updateNickname(
                String(nicknameDraft.trimmingCharacters(in: .whitespaces).prefix(50))
            )
            isSavingNickname = false
        }
    }

    private func generateInvite() {
        Task {
            isGeneratingInvite = true
            _ = await profile.generateInviteCode()
            isGeneratingInvite = false
        }
    }
}

struct GetCoinsInfoOverlay: View {
    @Binding var showStore: Bool
    @Binding var isPresented: Bool
    @State private var appeared = false

    var body: some View {
        ZStack {
            Color.black.opacity(appeared ? 0.18 : 0)
                .ignoresSafeArea()
                .onTapGesture { close() }

            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("铜币与数字内容服务")
                            .font(.webSerif(21))
                            .foregroundStyle(AppTheme.stone800)
                        Text("APPLE IN-APP PURCHASE")
                            .font(.system(size: 9, weight: .medium))
                            .tracking(1.8)
                            .foregroundStyle(AppTheme.stone400)
                    }
                    Spacer()
                    Button(action: close) {
                        Image(systemName: "xmark")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(AppTheme.stone500)
                            .frame(width: 32, height: 32)
                            .background(AppTheme.stone100.opacity(0.7), in: Circle())
                    }
                    .buttonStyle(.plain)
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("铜币是本站数字内容服务的使用额度，可用于 AI 对话、深度思考、联网检索与 AI 解卦。")
                    Text("iOS 端通过 Apple 内购入账；支付成功后铜币直接增加到当前账户。")
                    Text("铜币不可转赠、交易、提现或兑换现金。")
                }
                .font(.system(size: 13))
                .foregroundStyle(AppTheme.stone600)
                .lineSpacing(5)
                .padding(.top, 20)

                HStack(spacing: 10) {
                    Button("稍后再看") { close() }
                        .font(.system(size: 13))
                        .foregroundStyle(AppTheme.stone600)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(AppTheme.stone100.opacity(0.62), in: Capsule())
                    Button("查看服务包") {
                        close()
                        showStore = true
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(AppTheme.stone800, in: Capsule())
                }
                .buttonStyle(.plain)
                .padding(.top, 24)
            }
            .padding(UIContract.Spacing.lg)
            .frame(maxWidth: 360)
            .background(
                AppTheme.background,
                in: RoundedRectangle(cornerRadius: UIContract.Radii.large, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: UIContract.Radii.large, style: .continuous)
                    .stroke(Color.white.opacity(0.7), lineWidth: 1)
            }
            .shadow(color: Color.black.opacity(0.11), radius: 34, y: 15)
            .padding(.horizontal, 20)
            .scaleEffect(appeared ? 1 : 0.96)
            .opacity(appeared ? 1 : 0)
        }
        .onAppear {
            withAnimation(.interpolatingSpring(stiffness: 290, damping: 29)) {
                appeared = true
            }
        }
    }

    private func close() {
        withAnimation(.timingCurve(0.32, 0.72, 0, 1, duration: 0.22)) {
            appeared = false
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) {
            isPresented = false
        }
    }
}
