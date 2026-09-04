import Combine
import Foundation

@MainActor
final class ProfileStore: ObservableObject {
    @Published private(set) var profile: Profile?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            profile = try await APIClient.shared.request("/api/user/profile")
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateNickname(_ nickname: String) async -> Bool {
        do {
            try await APIClient.shared.request(
                "/api/user/profile", method: .PATCH, json: ["nickname": nickname]
            )
            await load()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func updateMeditationDefault(_ enabled: Bool) async -> Bool {
        do {
            try await APIClient.shared.request(
                "/api/user/profile",
                method: .PATCH,
                json: ["juexingcang_meditation_default": enabled]
            )
            await load()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func generateInviteCode() async -> Bool {
        do {
            struct InviteResponse: Decodable {
                let inviteCode: String
                enum CodingKeys: String, CodingKey { case inviteCode = "invite_code" }
            }
            try await APIClient.shared.request("/api/user/invite-code", method: .POST)
            await load()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func reset() {
        profile = nil
        errorMessage = nil
    }
}
