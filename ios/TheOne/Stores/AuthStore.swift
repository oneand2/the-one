import AuthenticationServices
import Combine
import CryptoKit
import Foundation

@MainActor
final class AuthStore: ObservableObject {
    @Published private(set) var user: NativeUser?
    @Published private(set) var isRestoring = true
    @Published var errorMessage: String?
    @Published var showsLogin = false

    private static let cachedUserKey = "theone.native-auth.cached-user"
    private var sessionCheckInFlight = false

    init() {
        if let data = UserDefaults.standard.data(forKey: Self.cachedUserKey),
           let cachedUser = try? JSONDecoder().decode(NativeUser.self, from: data) {
            user = cachedUser
        } else {
            user = nil
        }
    }

    var isAuthenticated: Bool { user != nil }

    func restoreSession() async {
        guard !sessionCheckInFlight else { return }
        sessionCheckInFlight = true
        isRestoring = true
        defer {
            sessionCheckInFlight = false
            isRestoring = false
        }

        let retryDelays: [Duration] = [.zero, .milliseconds(700), .seconds(2)]
        for (attempt, delay) in retryDelays.enumerated() {
            if delay != .zero {
                try? await Task.sleep(for: delay)
            }
            do {
                let response: AuthResponse = try await APIClient.shared.request("/api/mobile/auth")
                setUser(response.user)
                return
            } catch let error as APIError where error.statusCode == 401 {
                // 另一容器可能刚好完成令牌轮换；只要本机仍有认证 Cookie，
                // 给双向同步一次机会，避免用竞态中的旧请求误判为退出。
                if attempt < retryDelays.count - 1, !APIClient.authenticationCookies().isEmpty {
                    continue
                }
                invalidateSession()
                return
            } catch {
                // 断网、超时、限流或服务暂时不可用都不是退出登录。
                // 保留上次验证过的本地身份，等待前台恢复时再次校验。
                if attempt == retryDelays.count - 1 { return }
            }
        }
    }

    func login(email: String, password: String) async -> Bool {
        await perform {
            let response: AuthResponse = try await APIClient.shared.request(
                "/api/mobile/auth",
                method: .POST,
                json: ["action": "login", "email": email, "password": password]
            )
            self.setUser(response.user)
        }
    }

    func signup(email: String, password: String, nickname: String, inviteCode: String) async throws -> Bool {
        let response: AuthResponse = try await APIClient.shared.request(
            "/api/mobile/auth",
            method: .POST,
            json: [
                "action": "signup", "email": email, "password": password,
                "nickname": nickname, "inviteCode": inviteCode
            ]
        )
        setUser(response.user)
        return response.needsVerification == true
    }

    func verify(email: String, token: String, nickname: String) async -> Bool {
        await perform {
            let response: AuthResponse = try await APIClient.shared.request(
                "/api/mobile/auth",
                method: .POST,
                json: ["action": "verify-signup", "email": email, "token": token, "nickname": nickname]
            )
            self.setUser(response.user)
        }
    }

    func loginWithApple(identityToken: String, nonce: String, nickname: String) async -> Bool {
        await perform {
            let response: AuthResponse = try await APIClient.shared.request(
                "/api/mobile/auth",
                method: .POST,
                json: ["action": "apple", "identityToken": identityToken, "nonce": nonce, "nickname": nickname]
            )
            self.setUser(response.user)
        }
    }

    func logout() async {
        try? await APIClient.shared.request("/api/mobile/auth", method: .POST, json: ["action": "logout"])
        APIClient.clearAuthenticationCookies()
        invalidateSession()
    }

    func deleteAccount() async -> Bool {
        await perform {
            try await APIClient.shared.request("/api/mobile/auth", method: .DELETE)
            APIClient.clearAuthenticationCookies()
            self.invalidateSession()
        }
    }

    func invalidateSession() {
        setUser(nil)
    }

    func requireAuthentication() -> Bool {
        if isAuthenticated { return true }
        showsLogin = true
        return false
    }

    private func perform(_ operation: () async throws -> Void) async -> Bool {
        do {
            errorMessage = nil
            try await operation()
            return true
        } catch {
            errorMessage = Self.friendlyMessage(error)
            return false
        }
    }

    private func setUser(_ newUser: NativeUser?) {
        user = newUser
        if let newUser, let data = try? JSONEncoder().encode(newUser) {
            UserDefaults.standard.set(data, forKey: Self.cachedUserKey)
        } else {
            UserDefaults.standard.removeObject(forKey: Self.cachedUserKey)
        }
    }

    static func friendlyMessage(_ error: Error) -> String {
        let raw = error.localizedDescription
        let lower = raw.lowercased()
        if lower.contains("error sending confirmation email")
            || lower.contains("error sending recovery email")
            || lower.contains("unable to send email")
            || lower.contains("error sending email") {
            return "验证邮件暂时发不出去。请改用微信注册，或稍后再试。"
        }
        if lower.contains("user already registered") || lower.contains("already been registered") {
            return "该邮箱已注册，请直接登录。若忘记密码，请使用「忘记密码」。"
        }
        return raw
    }

    static func randomNonce() -> String {
        let alphabet = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        return String((0..<32).compactMap { _ in alphabet.randomElement() })
    }

    static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
