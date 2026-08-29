import AuthenticationServices
import SwiftUI
import UIKit

struct LoginView: View {
    enum Mode: String, CaseIterable {
        case login = "登录"
        case signup = "注册"
    }

    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @EnvironmentObject private var auth: AuthStore

    @State private var mode: Mode = .login
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var nickname = ""
    @State private var inviteCode = ""
    @State private var otp = ""
    @State private var verificationEmail: String?
    @State private var isWorking = false
    @State private var appleNonce = ""
    @State private var hasAppeared = false

    private let spring = Animation.interpolatingSpring(stiffness: 310, damping: 31)

    private var title: String {
        if verificationEmail != nil { return "验证" }
        return mode == .login ? "归来" : "初见"
    }

    private var subtitle: String {
        if verificationEmail != nil { return "一封信，确认此刻是你" }
        return mode == .login ? "世间即道场，人生是修行" : "从此刻起，与自己同行"
    }

    private var submitDisabled: Bool {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        if mode == .login {
            return trimmed.isEmpty || password.count < 6
        }
        return !trimmed.contains("@") || password.count < 6 || confirmPassword.count < 6
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .topTrailing) {
                UnifiedAuthBackground()

                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(spacing: 0) {
                            Color.clear
                                .frame(height: 42)
                                .id("auth-top")

                            UnifiedAuthBrand(title: title, subtitle: subtitle)
                                .padding(.bottom, 24)

                            UnifiedAuthShell {
                                VStack(spacing: 16) {
                                    if verificationEmail == nil {
                                        UnifiedModeSwitcher(mode: $mode, onSelect: selectMode)
                                    }

                                    if let error = auth.errorMessage {
                                        Text(error)
                                            .font(.system(size: 12))
                                            .foregroundStyle(AppTheme.cinnabar)
                                            .multilineTextAlignment(.center)
                                            .frame(maxWidth: .infinity)
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 10)
                                            .background(AppTheme.cinnabar.opacity(0.04), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                                            .overlay {
                                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                                    .stroke(AppTheme.cinnabar.opacity(0.16), lineWidth: 1)
                                            }
                                            .transition(.opacity.combined(with: .move(edge: .top)))
                                    }

                                    Group {
                                        if verificationEmail != nil {
                                            verificationForm
                                        } else {
                                            credentialForm
                                        }
                                    }
                                    .id(verificationEmail != nil ? "verify" : mode.rawValue)
                                    .transition(
                                        .asymmetric(
                                            insertion: .opacity.combined(with: .offset(y: 10)),
                                            removal: .opacity.combined(with: .offset(y: -7))
                                        )
                                    )
                                }
                                .animation(spring, value: mode)
                                .animation(spring, value: verificationEmail)
                                .animation(.easeOut(duration: 0.28), value: auth.errorMessage)
                            }

                            UnifiedLegalText()
                                .padding(.top, 18)
                        }
                        .padding(.horizontal, 18)
                        .padding(.bottom, 36)
                        .frame(maxWidth: 474)
                        .frame(maxWidth: .infinity)
                        .opacity(hasAppeared ? 1 : 0)
                        .offset(y: hasAppeared ? 0 : 18)
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .onChange(of: mode) { _, _ in
                        withAnimation(spring) {
                            proxy.scrollTo("auth-top", anchor: .top)
                        }
                    }
                    .onChange(of: verificationEmail) { _, _ in
                        withAnimation(spring) {
                            proxy.scrollTo("auth-top", anchor: .top)
                        }
                    }
                }

                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(AppTheme.muted)
                        .frame(width: 36, height: 36)
                        .background(AppTheme.background.opacity(0.9), in: Circle())
                        .overlay { Circle().stroke(AppTheme.hairline, lineWidth: 1) }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("关闭")
                .padding(.top, 12)
                .padding(.trailing, 16)
            }
            .toolbar(.hidden, for: .navigationBar)
            .onAppear {
                withAnimation(.timingCurve(0.32, 0.72, 0, 1, duration: 0.82)) {
                    hasAppeared = true
                }
            }
        }
    }

    private var credentialForm: some View {
        VStack(spacing: 16) {
            credentialFields

            UnifiedPrimaryButton(
                title: mode == .login ? "进入" : "发送验证码",
                workingTitle: "处理中…",
                isWorking: isWorking,
                disabled: isWorking || submitDisabled,
                action: submit
            )

            Button(mode == .login ? "还没有账号？从这里开始" : "已有账号，返回登录") {
                selectMode(mode == .login ? .signup : .login)
            }
            .buttonStyle(UnifiedTextButtonStyle())

            credentialFooter
        }
    }

    @ViewBuilder
    private var credentialFields: some View {
        if mode == .login {
            UnifiedFieldStack {
                UnifiedAuthField(
                    label: "账号",
                    placeholder: "邮箱或用户名",
                    text: $email,
                    contentType: .username
                )
                UnifiedFieldDivider()
                UnifiedAuthField(
                    label: "密码",
                    placeholder: "输入密码",
                    text: $password,
                    secure: true,
                    contentType: .password,
                    actionTitle: "忘记密码？",
                    action: openForgotPassword
                )
            }
        } else {
            UnifiedFieldStack {
                UnifiedAuthField(
                    label: "称呼",
                    placeholder: "选填，用于展示",
                    text: $nickname,
                    contentType: .nickname
                )
                UnifiedFieldDivider()
                UnifiedAuthField(
                    label: "邮箱",
                    placeholder: "your@email.com",
                    text: $email,
                    contentType: .emailAddress,
                    keyboardType: .emailAddress
                )
                UnifiedFieldDivider()
                UnifiedAuthField(
                    label: "设置密码",
                    placeholder: "至少 6 位",
                    text: $password,
                    secure: true,
                    contentType: .newPassword
                )
                UnifiedFieldDivider()
                UnifiedAuthField(
                    label: "确认密码",
                    placeholder: "再次输入密码",
                    text: $confirmPassword,
                    secure: true,
                    contentType: .newPassword
                )
                UnifiedFieldDivider()
                UnifiedAuthField(
                    label: "邀请码",
                    placeholder: "选填",
                    text: $inviteCode
                )
            }
        }
    }

    @ViewBuilder
    private var credentialFooter: some View {
        if mode == .login {
            UnifiedProviderDivider()

            NativeAppleSignInButton(
                onRequest: configureAppleRequest,
                onCompletion: handleAppleResult
            )
            .frame(height: 48)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .allowsHitTesting(!isWorking)
            .opacity(isWorking ? 0.45 : 1)
        } else {
            Text("已注册的邮箱请直接登录。验证码只会发给尚未注册的邮箱")
                .font(.system(size: 10))
                .foregroundStyle(AppTheme.authFaint)
                .multilineTextAlignment(.center)
                .lineSpacing(3)
        }
    }

    private var verificationForm: some View {
        VStack(spacing: 16) {
            VStack(spacing: 5) {
                Text("验证码已发送至")
                    .font(.system(size: 11))
                    .foregroundStyle(AppTheme.authMuted)
                Text(verificationEmail ?? email)
                    .font(.system(size: 13))
                    .foregroundStyle(AppTheme.ink)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 8)

            UnifiedFieldStack {
                UnifiedAuthField(
                    label: "邮箱验证码",
                    placeholder: "······",
                    text: $otp,
                    contentType: .oneTimeCode,
                    keyboardType: .numberPad,
                    centered: true
                )
            }

            UnifiedPrimaryButton(
                title: "完成验证",
                workingTitle: "验证中…",
                isWorking: isWorking,
                disabled: otp.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isWorking
            ) {
                Task {
                    isWorking = true
                    defer { isWorking = false }
                    if await auth.verify(
                        email: verificationEmail ?? email,
                        token: otp,
                        nickname: nickname
                    ) {
                        dismiss()
                    }
                }
            }

            Button("返回重新注册") {
                withAnimation(spring) {
                    verificationEmail = nil
                    otp = ""
                    auth.errorMessage = nil
                }
            }
            .buttonStyle(UnifiedTextButtonStyle())

            Text("收不到验证码时，请检查垃圾邮件文件夹")
                .font(.system(size: 10))
                .foregroundStyle(AppTheme.authFaint)
                .multilineTextAlignment(.center)
        }
    }

    private func selectMode(_ nextMode: Mode) {
        guard mode != nextMode || verificationEmail != nil else { return }
        withAnimation(spring) {
            mode = nextMode
            verificationEmail = nil
            otp = ""
            confirmPassword = ""
            auth.errorMessage = nil
        }
        UISelectionFeedbackGenerator().selectionChanged()
    }

    private func submit() {
        Task {
            auth.errorMessage = nil
            if mode == .signup && password != confirmPassword {
                auth.errorMessage = "两次输入的密码不一致"
                return
            }

            isWorking = true
            defer { isWorking = false }
            if mode == .login {
                if await auth.login(email: email, password: password) { dismiss() }
            } else {
                do {
                    if try await auth.signup(
                        email: email,
                        password: password,
                        nickname: nickname,
                        inviteCode: inviteCode
                    ) {
                        withAnimation(spring) { verificationEmail = email }
                    } else if auth.isAuthenticated {
                        dismiss()
                    }
                } catch {
                    auth.errorMessage = AuthStore.friendlyMessage(error)
                }
            }
        }
    }

    private func openForgotPassword() {
        guard let url = URL(string: "https://www.the-one-and-the-two.com/forgot-password") else { return }
        openURL(url)
    }

    private func configureAppleRequest(_ request: ASAuthorizationAppleIDRequest) {
        auth.errorMessage = nil
        appleNonce = AuthStore.randomNonce()
        request.nonce = AuthStore.sha256(appleNonce)
        request.requestedScopes = [.fullName, .email]
    }

    private func handleAppleResult(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .failure(let error):
            if let authorizationError = error as? ASAuthorizationError,
               authorizationError.code == .canceled {
                return
            }
            auth.errorMessage = "Apple 登录未完成：\(error.localizedDescription)"
            return
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let token = String(data: tokenData, encoding: .utf8),
                  !appleNonce.isEmpty else {
                auth.errorMessage = "Apple 登录凭据不完整，请重新尝试"
                return
            }

            let name = [credential.fullName?.givenName, credential.fullName?.familyName]
                .compactMap { $0 }
                .joined()
            Task {
                isWorking = true
                defer { isWorking = false }
                if await auth.loginWithApple(identityToken: token, nonce: appleNonce, nickname: name) {
                    dismiss()
                }
            }
        }
    }
}

private struct NativeAppleSignInButton: UIViewRepresentable {
    var onRequest: (ASAuthorizationAppleIDRequest) -> Void
    var onCompletion: (Result<ASAuthorization, Error>) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onRequest: onRequest, onCompletion: onCompletion)
    }

    func makeUIView(context: Context) -> ASAuthorizationAppleIDButton {
        let button = ASAuthorizationAppleIDButton(type: .continue, style: .black)
        button.cornerRadius = 12
        button.setContentHuggingPriority(.defaultLow, for: .horizontal)
        button.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        button.addTarget(context.coordinator, action: #selector(Coordinator.handleTap), for: .touchUpInside)
        return button
    }

    func updateUIView(_ uiView: ASAuthorizationAppleIDButton, context: Context) {
        context.coordinator.onRequest = onRequest
        context.coordinator.onCompletion = onCompletion
    }

    final class Coordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
        var onRequest: (ASAuthorizationAppleIDRequest) -> Void
        var onCompletion: (Result<ASAuthorization, Error>) -> Void
        private var controller: ASAuthorizationController?

        init(
            onRequest: @escaping (ASAuthorizationAppleIDRequest) -> Void,
            onCompletion: @escaping (Result<ASAuthorization, Error>) -> Void
        ) {
            self.onRequest = onRequest
            self.onCompletion = onCompletion
        }

        @objc func handleTap() {
            let request = ASAuthorizationAppleIDProvider().createRequest()
            onRequest(request)
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.controller = controller
            controller.performRequests()
        }

        func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
            self.controller = nil
            onCompletion(.success(authorization))
        }

        func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
            self.controller = nil
            onCompletion(.failure(error))
        }

        func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
            let windows = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap(\.windows)
            return windows.first(where: \.isKeyWindow) ?? windows.first ?? ASPresentationAnchor()
        }
    }
}

private struct UnifiedAuthBackground: View {
    var body: some View {
        AppTheme.background.ignoresSafeArea()
    }
}

private struct UnifiedAuthBrand: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: 0) {
            UnifiedAuthEmblem()
                .padding(.bottom, 18)

            Text("THE ONE · THE TWO")
                .font(.system(size: 9, weight: .medium))
                .tracking(3.1)
                .foregroundStyle(AppTheme.stone400)
                .padding(.bottom, 12)

            Text(title)
                .font(.webSerif(30))
                .tracking(3.6)
                .foregroundStyle(AppTheme.headerTitle)
                .contentTransition(.opacity)

            Text(subtitle)
                .font(.kaiti(14))
                .tracking(1.1)
                .foregroundStyle(AppTheme.authMuted)
                .padding(.top, 12)
                .contentTransition(.opacity)
        }
        .multilineTextAlignment(.center)
        .animation(.easeOut(duration: 0.32), value: title)
        .animation(.easeOut(duration: 0.32), value: subtitle)
    }
}

private struct UnifiedAuthEmblem: View {
    @State private var visible = false

    var body: some View {
        FourSymbolGlyph(symbol: .juexingcang, width: 32, lineHeight: 6.4, color: AppTheme.headerGlyph)
            .scaleEffect(visible ? 1 : 0.9)
            .opacity(visible ? 1 : 0)
            .onAppear {
                withAnimation(.interpolatingSpring(stiffness: 210, damping: 22).delay(0.06)) {
                    visible = true
                }
            }
            .accessibilityHidden(true)
    }
}

private struct UnifiedAuthShell<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(.horizontal, 22)
            .padding(.top, 20)
            .padding(.bottom, 24)
            .background(AppTheme.background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(AppTheme.hairline, lineWidth: 1)
            }
            .shadow(color: Color.black.opacity(0.04), radius: 2, y: 1)
    }
}

private struct UnifiedModeSwitcher: View {
    @Binding var mode: LoginView.Mode
    let onSelect: (LoginView.Mode) -> Void

    var body: some View {
        GeometryReader { proxy in
            let itemWidth = proxy.size.width / 2
            ZStack(alignment: .bottomLeading) {
                HStack(spacing: 0) {
                    modeButton(.login)
                    modeButton(.signup)
                }

                Rectangle()
                    .fill(AppTheme.hairline)
                    .frame(height: 1)

                Rectangle()
                    .fill(AppTheme.stone800)
                    .frame(width: itemWidth, height: 1.5)
                    .offset(x: mode == .login ? 0 : itemWidth)
                    .animation(.interpolatingSpring(stiffness: 330, damping: 31), value: mode)
            }
        }
        .frame(height: 44)
    }

    private func modeButton(_ item: LoginView.Mode) -> some View {
        Button(item.rawValue) { onSelect(item) }
            .buttonStyle(.plain)
            .font(.kaiti(14))
            .tracking(2.8)
            .foregroundStyle(mode == item ? AppTheme.stone800 : AppTheme.authMuted)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
    }
}

private struct UnifiedFieldStack<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: 0) { content }
    }
}

private struct UnifiedFieldDivider: View {
    var body: some View {
        EmptyView()
    }
}

private struct UnifiedAuthField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    var secure = false
    var contentType: UITextContentType?
    var keyboardType: UIKeyboardType = .default
    var actionTitle: String?
    var action: (() -> Void)?
    var centered = false

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text(label)
                    .font(.system(size: 10))
                    .tracking(1.2)
                    .foregroundStyle(AppTheme.authMuted)
                Spacer()
                if let actionTitle, let action {
                    Button(actionTitle, action: action)
                        .buttonStyle(.plain)
                        .font(.system(size: 10))
                        .foregroundStyle(AppTheme.authMuted)
                }
            }

            Group {
                if secure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                }
            }
            .font(.system(size: centered ? 20 : 15))
            .tracking(centered ? 5.5 : 0)
            .multilineTextAlignment(centered ? .center : .leading)
            .foregroundStyle(AppTheme.stone800)
            .textContentType(contentType)
            .keyboardType(keyboardType)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .frame(height: 25)

            Rectangle()
                .fill(AppTheme.authLine)
                .frame(height: 1)
                .padding(.top, 9)
        }
        .padding(.horizontal, 2)
        .padding(.top, 10)
    }
}

private struct UnifiedPrimaryButton: View {
    let title: String
    let workingTitle: String
    let isWorking: Bool
    let disabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if isWorking {
                    ProgressView()
                        .tint(Color(red: 248 / 255, green: 245 / 255, blue: 238 / 255))
                        .controlSize(.small)
                }
                Text(isWorking ? workingTitle : title)
                    .font(.system(size: 13))
                    .tracking(2.9)
            }
            .foregroundStyle(Color(red: 248 / 255, green: 245 / 255, blue: 238 / 255))
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(AppTheme.stone800, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(UnifiedPrimaryButtonStyle())
        .disabled(disabled)
        .opacity(disabled ? 0.45 : 1)
        .sensoryTap()
    }
}

private struct UnifiedPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .animation(.interpolatingSpring(stiffness: 360, damping: 28), value: configuration.isPressed)
    }
}

private struct UnifiedTextButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12))
            .tracking(0.7)
            .foregroundStyle(AppTheme.authMuted)
            .padding(.vertical, 2)
            .opacity(configuration.isPressed ? 0.55 : 1)
            .offset(y: configuration.isPressed ? 1 : 0)
    }
}

private struct UnifiedProviderDivider: View {
    var body: some View {
        HStack(spacing: 12) {
            Rectangle().fill(AppTheme.authLine).frame(height: 1)
            Text("或使用")
                .font(.kaiti(11))
                .tracking(1.3)
                .foregroundStyle(AppTheme.authFaint)
            Rectangle().fill(AppTheme.authLine).frame(height: 1)
        }
    }
}

private struct UnifiedLegalText: View {
    var body: some View {
        Text(.init("继续即表示你已阅读并同意 [《用户协议》](https://www.the-one-and-the-two.com/terms) 和 [《隐私政策》](https://www.the-one-and-the-two.com/privacy)"))
            .font(.system(size: 10))
            .foregroundStyle(AppTheme.authFaint)
            .tint(AppTheme.authMuted)
            .multilineTextAlignment(.center)
            .lineSpacing(4)
            .frame(maxWidth: 360)
            .frame(maxWidth: .infinity)
    }
}
