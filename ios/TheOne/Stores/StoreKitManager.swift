import Combine
import StoreKit
import UIKit

struct AppleCreditResponse: Decodable {
    let ok: Bool
    let credited: Bool
    let coins: Int?
    let balance: Int?
    let transactionId: String
    let lifetimeVip: Bool?

    var grantedLifetimeVip: Bool { lifetimeVip == true }
}

enum StoreProductKind {
    case coins
    case lifetimeVip
}

struct CoinPackage: Identifiable {
    let id: String
    let name: String
    let description: String
    let coins: Int
    let displayPrice: String
    let kind: StoreProductKind
    let storeProduct: Product?
}

@MainActor
final class StoreKitManager: ObservableObject {
    static let lifetimeVIPProductID = "com.theone.er.vip.lifetime"
    static let productIDs = [
        lifetimeVIPProductID,
        "com.theone.er.coins.100",
        "com.theone.er.coins.360",
        "com.theone.er.coins.800"
    ]

    /// 与网页 `SHOP_PACKAGES` / Configuration.storekit 对齐，避免 StoreKit 未返回时整栏空白。
    private static let catalog: [(id: String, name: String, description: String, coins: Int, price: String, kind: StoreProductKind)] = [
        (lifetimeVIPProductID, "终身 VIP", "一次开通，之后使用全部功能不再消耗铜币", 0, "¥398.00", .lifetimeVip),
        ("com.theone.er.coins.100", "初见", "适合轻量体验 AI 对话与解读服务", 100, "¥9.90", .coins),
        ("com.theone.er.coins.360", "深观", "适合持续使用与多轮深入交流", 360, "¥29.90", .coins),
        ("com.theone.er.coins.800", "长明", "适合长期使用数字内容服务", 800, "¥59.90", .coins),
    ]

    @Published private(set) var products: [Product] = []
    @Published private(set) var isLoading = false
    @Published private(set) var purchasingProductID: String?
    @Published var message: String?

    var packages: [CoinPackage] {
        Self.catalog.map { item in
            let product = products.first { $0.id == item.id }
            let storeDescription = product?.description.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return CoinPackage(
                id: item.id,
                name: item.name,
                description: storeDescription.isEmpty ? item.description : storeDescription,
                coins: item.coins,
                displayPrice: product?.displayPrice ?? item.price,
                kind: item.kind,
                storeProduct: product
            )
        }
    }

    var vipPackage: CoinPackage? { packages.first { $0.kind == .lifetimeVip } }
    var coinPackages: [CoinPackage] { packages.filter { $0.kind == .coins } }

    private var transactionListener: Task<Void, Never>?

    init() {
        transactionListener = listenForTransactions()
    }

    deinit { transactionListener?.cancel() }

    func prepare(force: Bool = false) async {
        if !force, !products.isEmpty { return }
        message = nil
        isLoading = true
        defer { isLoading = false }
        do {
            let loaded = try await Product.products(for: Self.productIDs)
            products = loaded.sorted {
                (Self.productIDs.firstIndex(of: $0.id) ?? 0)
                    < (Self.productIDs.firstIndex(of: $1.id) ?? 0)
            }
            if loaded.isEmpty {
                message = AppStore.canMakePayments
                    ? "暂时未能从 App Store 获取商品，请轻触服务包重试。"
                    : "此设备已关闭 App 内购买。"
            }
        } catch {
            message = "暂时无法连接 App Store：\(error.localizedDescription)"
        }
    }

    func purchase(package: CoinPackage, appAccountToken: UUID) async -> Bool {
        var product = package.storeProduct
        if product == nil {
            await prepare(force: true)
            product = products.first { $0.id == package.id }
        }
        guard let product else {
            message = AppStore.canMakePayments
                ? "暂时未能从 App Store 获取商品，请稍后重试。"
                : "此设备已关闭 App 内购买。"
            return false
        }
        return await purchase(product, appAccountToken: appAccountToken)
    }

    func purchase(_ product: Product, appAccountToken: UUID) async -> Bool {
        purchasingProductID = product.id
        defer { purchasingProductID = nil }
        do {
            // 不要给系统购买窗加短超时。审核员在 iPad 上输入沙盒账号时经常超过 30 秒。
            let result = try await purchaseWithPresentation(product, appAccountToken: appAccountToken)
            switch result {
            case .success(let verification):
                return try await deliver(verification)
            case .pending:
                message = "购买正在等待确认，确认后权益会自动到账。"
                return false
            case .userCancelled:
                return false
            @unknown default:
                return false
            }
        } catch {
            message = Self.friendlyPurchaseError(error)
            return false
        }
    }

    private func purchaseWithPresentation(
        _ product: Product,
        appAccountToken: UUID
    ) async throws -> Product.PurchaseResult {
        let options: Set<Product.PurchaseOption> = [.appAccountToken(appAccountToken)]
        if let scene = Self.foregroundWindowScene {
            if #available(iOS 18.2, *) {
                return try await product.purchase(confirmIn: scene, options: options)
            }
        }
        return try await product.purchase(options: options)
    }

    private static var foregroundWindowScene: UIWindowScene? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first
    }

    private static func friendlyPurchaseError(_ error: Error) -> String {
        let raw = error.localizedDescription
        let lower = raw.lowercased()
        if lower.contains("xcode") || raw.contains("模拟器") {
            return "暂时无法完成购买，请稍后重试。"
        }
        return raw
    }

    func recoverUnfinishedTransactions() async {
        await withTaskGroup(of: Void.self) { group in
            group.addTask { [weak self] in
                guard let self else { return }
                for await verification in Transaction.unfinished {
                    _ = try? await self.deliver(verification)
                }
            }
            group.addTask {
                try? await Task.sleep(for: .seconds(2))
            }
            _ = await group.next()
            group.cancelAll()
        }
    }

    func restoreLifetimeVIP() async {
        message = nil
        do {
            try await AppStore.sync()
        } catch {
            message = error.localizedDescription
            return
        }

        var restored = false
        for await verification in Transaction.currentEntitlements {
            guard case .verified(let transaction) = verification,
                  transaction.productID == Self.lifetimeVIPProductID else {
                continue
            }
            do {
                restored = try await deliver(verification) || restored
            } catch {
                message = "已找到购买记录，但恢复失败：\(error.localizedDescription)"
                return
            }
        }

        if !restored, message == nil {
            message = "没有找到可恢复的终身 VIP。铜币属于消耗型项目，不通过 Apple 恢复。"
        }
    }

    private func deliver(_ verification: VerificationResult<Transaction>) async throws -> Bool {
        switch verification {
        case .unverified(_, let error):
            throw error
        case .verified(let transaction):
            let response: AppleCreditResponse = try await APIClient.shared.request(
                "/api/mobile/iap/apple",
                method: .POST,
                json: ["signedTransaction": verification.jwsRepresentation]
            )
            await transaction.finish()
            if response.grantedLifetimeVip {
                message = response.credited
                    ? "终身 VIP 已开通，之后使用全部功能不再消耗铜币。"
                    : "这笔购买已经入账，终身 VIP 仍有效。"
            } else {
                let coins = response.coins ?? 0
                message = response.credited
                    ? "购买成功，\(coins) 枚铜币已到账。"
                    : "这笔购买已经入账，无需重复处理。"
            }
            return true
        }
    }

    private nonisolated func listenForTransactions() -> Task<Void, Never> {
        Task.detached { [weak self] in
            for await verification in Transaction.updates {
                guard let self else { return }
                _ = try? await self.deliver(verification)
            }
        }
    }
}
