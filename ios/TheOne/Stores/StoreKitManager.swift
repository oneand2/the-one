import Combine
import StoreKit

struct AppleCreditResponse: Decodable {
    let ok: Bool
    let credited: Bool
    let coins: Int
    let balance: Int?
    let transactionId: String
}

struct CoinPackage: Identifiable {
    let id: String
    let name: String
    let description: String
    let coins: Int
    let displayPrice: String
    let storeProduct: Product?
}

@MainActor
final class StoreKitManager: ObservableObject {
    static let productIDs = [
        "com.theone.er.coins.100",
        "com.theone.er.coins.360",
        "com.theone.er.coins.800"
    ]

    /// 与网页 `COIN_PACKAGES` / Configuration.storekit 对齐，避免 StoreKit 未返回时整栏空白。
    private static let catalog: [(id: String, name: String, description: String, coins: Int, price: String)] = [
        ("com.theone.er.coins.100", "初见", "适合轻量体验 AI 对话与解读服务", 100, "¥9.90"),
        ("com.theone.er.coins.360", "深观", "适合持续使用与多轮深入交流", 360, "¥29.90"),
        ("com.theone.er.coins.800", "长明", "适合长期使用数字内容服务", 800, "¥59.90"),
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
                storeProduct: product
            )
        }
    }

    private var transactionListener: Task<Void, Never>?

    init() {
        transactionListener = listenForTransactions()
    }

    deinit { transactionListener?.cancel() }

    func prepare(force: Bool = false) async {
        if !force, !products.isEmpty { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let loaded = try await Product.products(for: Self.productIDs)
            if !loaded.isEmpty {
                products = loaded.sorted {
                    (Self.productIDs.firstIndex(of: $0.id) ?? 0)
                        < (Self.productIDs.firstIndex(of: $1.id) ?? 0)
                }
            }
        } catch {
            message = "暂时无法连接 App Store：\(error.localizedDescription)"
        }
    }

    func purchase(package: CoinPackage) async -> Bool {
        var product = package.storeProduct
        if product == nil {
            await prepare(force: true)
            product = products.first { $0.id == package.id }
        }
        guard let product else {
            message = "暂时连不上 App Store 商品。请从 Xcode 运行以加载本地服务包，或改用真机沙盒账号。"
            return false
        }
        return await purchase(product)
    }

    func purchase(_ product: Product) async -> Bool {
        purchasingProductID = product.id
        defer { purchasingProductID = nil }
        do {
            let result = try await withTimeout(seconds: 30) {
                try await product.purchase()
            }
            switch result {
            case .success(let verification):
                return try await deliver(verification)
            case .pending:
                message = "购买正在等待确认，确认后铜币会自动到账。"
                return false
            case .userCancelled:
                return false
            @unknown default:
                return false
            }
        } catch is CancellationError {
            message = "模拟器里的购买确认窗可能没有弹出。请点右上角关闭后重试，或改用真机。"
            return false
        } catch {
            message = error.localizedDescription
            return false
        }
    }

    func recoverUnfinishedTransactions() async {
        let recovered = await withTaskGroup(of: Bool.self) { group in
            group.addTask { [weak self] in
                guard let self else { return false }
                var any = false
                for await verification in Transaction.unfinished {
                    any = ((try? await self.deliver(verification)) ?? false) || any
                }
                return any
            }
            group.addTask {
                try? await Task.sleep(for: .seconds(2))
                return false
            }
            let first = await group.next() ?? false
            group.cancelAll()
            return first
        }
        if !recovered, message == nil {
            message = "没有待恢复的购买。"
        }
    }

    private func withTimeout<T: Sendable>(
        seconds: TimeInterval,
        operation: @escaping @Sendable () async throws -> T
    ) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask { try await operation() }
            group.addTask {
                try await Task.sleep(for: .seconds(seconds))
                throw CancellationError()
            }
            guard let value = try await group.next() else { throw CancellationError() }
            group.cancelAll()
            return value
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
            message = response.credited
                ? "购买成功，\(response.coins) 枚铜币已到账。"
                : "这笔购买已经入账，无需重复处理。"
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
