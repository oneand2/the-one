import Combine
import StoreKit

struct AppleCreditResponse: Decodable {
    let ok: Bool
    let credited: Bool
    let coins: Int
    let balance: Int?
    let transactionId: String
}

@MainActor
final class StoreKitManager: ObservableObject {
    static let productIDs = [
        "com.theone.er.coins.100",
        "com.theone.er.coins.360",
        "com.theone.er.coins.800"
    ]

    @Published private(set) var products: [Product] = []
    @Published private(set) var isLoading = false
    @Published private(set) var purchasingProductID: String?
    @Published var message: String?

    private var transactionListener: Task<Void, Never>?

    init() {
        transactionListener = listenForTransactions()
    }

    deinit { transactionListener?.cancel() }

    func prepare() async {
        guard products.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            products = try await Product.products(for: Self.productIDs)
                .sorted {
                    (Self.productIDs.firstIndex(of: $0.id) ?? 0)
                        < (Self.productIDs.firstIndex(of: $1.id) ?? 0)
                }
        } catch {
            message = "暂时无法连接 App Store：\(error.localizedDescription)"
        }
    }

    func purchase(_ product: Product) async -> Bool {
        purchasingProductID = product.id
        defer { purchasingProductID = nil }
        do {
            let result = try await product.purchase()
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
        } catch {
            message = error.localizedDescription
            return false
        }
    }

    func recoverUnfinishedTransactions() async {
        for await verification in Transaction.unfinished {
            _ = try? await deliver(verification)
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
