import StoreKit
import SwiftUI

struct StoreView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var purchases: StoreKitManager
    @EnvironmentObject private var profile: ProfileStore

    var body: some View {
        NavigationStack {
            ZStack {
                AmbientBackground()
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: UIContract.Spacing.xl) {
                        NativeSheetHeader(
                            title: "铜币",
                            subtitle: "为下一次深谈留些余量",
                            close: { dismiss() }
                        )

                        balanceSummary

                        VStack(alignment: .leading, spacing: UIContract.Spacing.sm) {
                            NativeSectionHeading(title: "服务包", detail: "APPLE IN-APP PURCHASE")
                            if purchases.isLoading {
                                NativeSurface {
                                    HStack(spacing: 12) {
                                        ProgressView().tint(AppTheme.stone500)
                                        Text("正在连接 App Store…")
                                            .font(.system(size: 12))
                                            .foregroundStyle(AppTheme.stone500)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 56)
                                }
                            } else {
                                VStack(spacing: UIContract.Spacing.sm) {
                                    ForEach(purchases.products, id: \.id) { product in
                                        ProductCard(product: product) {
                                            Task {
                                                if await purchases.purchase(product) {
                                                    await profile.load()
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        VStack(spacing: 10) {
                            Button("恢复未完成的购买") {
                                Task {
                                    await purchases.recoverUnfinishedTransactions()
                                    await profile.load()
                                }
                            }
                            .font(.system(size: 12))
                            .foregroundStyle(AppTheme.stone600)
                            .frame(maxWidth: .infinity)
                            .frame(height: 42)
                            .buttonStyle(.plain)
                            .sensoryTap()

                            if let message = purchases.message {
                                Text(message)
                                    .font(.system(size: 11))
                                    .foregroundStyle(AppTheme.stone500)
                                    .frame(maxWidth: .infinity)
                                    .multilineTextAlignment(.center)
                                    .lineSpacing(3)
                            }

                            Text("铜币不可转赠、交易、提现或兑换现金，也不会过期。")
                                .font(.system(size: 10))
                                .foregroundStyle(AppTheme.stone400)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .padding(.horizontal, UIContract.Spacing.lg)
                    .padding(.top, UIContract.Spacing.lg)
                    .padding(.bottom, UIContract.Spacing.section)
                    .frame(maxWidth: UIContract.contentMaxWidth)
                    .frame(maxWidth: .infinity)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .task { await purchases.prepare() }
        }
    }

    private var balanceSummary: some View {
        NativeSurface(padding: UIContract.Spacing.lg) {
            HStack(spacing: 14) {
                CopperCoinMark(size: 24)
                    .foregroundStyle(AppTheme.earth.opacity(0.82))
                VStack(alignment: .leading, spacing: 3) {
                    Text("当前余额")
                        .font(.system(size: 10))
                        .tracking(1.4)
                        .foregroundStyle(AppTheme.stone400)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text("\(profile.profile?.coinsBalance ?? 0)")
                            .font(.webSerif(25))
                            .foregroundStyle(AppTheme.stone800)
                            .monospacedDigit()
                        Text("枚")
                            .font(.system(size: 11))
                            .foregroundStyle(AppTheme.stone400)
                    }
                }
                Spacer()
                FourSymbolGlyph(symbol: .juexingcang, width: 28, lineHeight: 5, color: AppTheme.stone300)
            }
        }
    }
}

private struct ProductCard: View {
    let product: Product
    let purchase: () -> Void
    @EnvironmentObject private var manager: StoreKitManager

    private var coins: Int {
        if product.id.hasSuffix(".100") { return 100 }
        if product.id.hasSuffix(".360") { return 360 }
        return 800
    }

    var body: some View {
        NativeSurface(padding: 18) {
            HStack(spacing: 15) {
                VStack(alignment: .leading, spacing: 7) {
                    Text(product.displayName)
                        .font(.system(size: 11))
                        .foregroundStyle(AppTheme.stone500)
                    HStack(alignment: .firstTextBaseline, spacing: 5) {
                        Text("\(coins)")
                            .font(.webSerif(27))
                            .foregroundStyle(AppTheme.stone800)
                            .monospacedDigit()
                        Text("枚铜币")
                            .font(.system(size: 10))
                            .foregroundStyle(AppTheme.stone400)
                    }
                    Text(product.description)
                        .font(.system(size: 10))
                        .foregroundStyle(AppTheme.stone400)
                        .lineLimit(2)
                }
                Spacer(minLength: 8)
                Button(action: purchase) {
                    Group {
                        if manager.purchasingProductID == product.id {
                            ProgressView().tint(.white)
                        } else {
                            Text(product.displayPrice)
                                .font(.system(size: 13, weight: .medium))
                        }
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 17)
                    .frame(height: 42)
                    .background(AppTheme.stone800, in: Capsule())
                }
                .buttonStyle(.plain)
                .disabled(manager.purchasingProductID != nil)
                .sensoryTap()
            }
        }
    }
}
