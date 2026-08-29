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

    var isAuthenticated: Bool { user != nil }

    func restoreSession() async {
        // 先进入主界面，避免登录探测卡住时一直停在启动页。
        isRestoring = false
        do {
            let response: AuthResponse = try await APIClient.shared.request("/api/mobile/auth")
            user = response.user
        } catch {
            user = nil
        }
    }

    func login(email: String, password: String) async -> Bool {
        await perform {
            let response: AuthResponse = try await APIClient.shared.request(
                "/api/mobile/auth",
                method: .POST,
                json: ["action": "login", "email": email, "password": password]
            )
            self.user = response.user
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
        user = response.user
        return response.needsVerification == true
    }

    func verify(email: String, token: String, nickname: String) async -> Bool {
        await perform {
            let response: AuthResponse = try await APIClient.shared.request(
                "/api/mobile/auth",
                method: .POST,
                json: ["action": "verify-signup", "email": email, "token": token, "nickname": nickname]
            )
            self.user = response.user
        }
    }

    func loginWithApple(identityToken: String, nonce: String, nickname: String) async -> Bool {
        await perform {
            let response: AuthResponse = try await APIClient.shared.request(
                "/api/mobile/auth",
                method: .POST,
                json: ["action": "apple", "identityToken": identityToken, "nonce": nonce, "nickname": nickname]
            )
            self.user = response.user
        }
    }

    func logout() async {
        try? await APIClient.shared.request("/api/mobile/auth", method: .POST, json: ["action": "logout"])
        user = nil
    }

    func deleteAccount() async -> Bool {
        await perform {
            try await APIClient.shared.request("/api/mobile/auth", method: .DELETE)
            self.user = nil
        }
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

