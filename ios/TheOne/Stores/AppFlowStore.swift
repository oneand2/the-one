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
    let id = UUID()
    let preset: String
    let importData: [String: Any]
    let autoSend: Bool
}

@MainActor
final class AppFlowStore: ObservableObject {
    @Published var screen: AppScreen
    /// 每次点底栏都加一，即使还在同一 tab，WebView 也会再同步一次。
    @Published private(set) var tabSelectionTick = 0
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
        tabSelectionTick += 1
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
