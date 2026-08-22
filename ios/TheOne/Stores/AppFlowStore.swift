import Foundation

enum AppScreen: String, CaseIterable {
    case guanshi
    case wendao
    case guanxin
    case bazi
    case mbti
    case juexingcang

    var navigationSymbol: FourSymbol {
        switch self {
        case .guanshi: .guanshi
        case .wendao: .wendao
        case .guanxin, .bazi, .mbti: .guanxin
        case .juexingcang: .juexingcang
        }
    }
}

struct PendingChatRequest {
    let preset: String
    let importData: [String: Any]
    let autoSend: Bool
}

@MainActor
final class AppFlowStore: ObservableObject {
    @Published var screen: AppScreen
    @Published private(set) var pendingChat: PendingChatRequest?

    init() {
#if DEBUG
        screen = AppScreen(rawValue: ProcessInfo.processInfo.environment["THEONE_INITIAL_TAB"] ?? "") ?? .guanshi
#else
        screen = .guanshi
#endif
    }

    func selectNavigation(_ symbol: FourSymbol) {
        screen = AppScreen(rawValue: symbol.rawValue) ?? .guanshi
    }

    func openMBTI() { screen = .mbti }

    func openChat(preset: String = "", importData: [String: Any] = [:], autoSend: Bool = false) {
        pendingChat = PendingChatRequest(preset: preset, importData: importData, autoSend: autoSend)
        screen = .juexingcang
    }

    func consumePendingChat() -> PendingChatRequest? {
        defer { pendingChat = nil }
        return pendingChat
    }
}
