import SwiftUI

struct StoreView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var purchases: StoreKitManager
    @EnvironmentObject private var profile: ProfileStore

    private var alreadyLifetime: Bool { profile.profile?.isLifetimeVip == true }

    var body: some View {
        NavigationStack {
            ZStack {
                AmbientBackground()
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: UIContract.Spacing.xl) {
                        NativeSheetHeader(
                            title: "服务包",
                            subtitle: "铜币，或一次开通终身 VIP",
                            close: { dismiss() }
                        )

                        balanceSummary

                        if let vipPackage = purchases.vipPackage {
                            VStack(alignment: .leading, spacing: UIContract.Spacing.sm) {
                                NativeSectionHeading(title: "终身 VIP")
                                LifetimeVipCard(package: vipPackage, alreadyOwned: alreadyLifetime) {
                                    Task {
                                        if await purchases.purchase(package: vipPackage) {
                                            await profile.load()
                                        }
                                    }
                                }
                            }
                        }

                        VStack(alignment: .leading, spacing: UIContract.Spacing.sm) {
                            NativeSectionHeading(title: "铜币")
                            VStack(spacing: UIContract.Spacing.sm) {
                                ForEach(purchases.coinPackages) { package in
                                    ProductCard(package: package) {
                                        Task {
                                            if await purchases.purchase(package: package) {
                                                await profile.load()
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        VStack(spacing: 10) {
                            Button("恢复终身 VIP") {
                                Task {
                                    await purchases.restoreLifetimeVIP()
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

                            Text("仅非消耗型终身 VIP 可通过 Apple 恢复。铜币购买完成后会直接绑定当前账户，不可转赠、交易、提现或兑换现金，也不会过期。")
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
                if alreadyLifetime {
                    Image(systemName: "crown")
                        .font(.system(size: 18, weight: .light))
                        .foregroundStyle(AppTheme.earth.opacity(0.82))
                        .frame(width: 24, height: 24)
                } else {
                    CopperCoinMark(size: 24)
                        .foregroundStyle(AppTheme.earth.opacity(0.82))
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(alreadyLifetime ? "会员状态" : "当前余额")
                        .font(.system(size: 10))
                        .tracking(1.4)
                        .foregroundStyle(AppTheme.stone400)
                    if alreadyLifetime {
                        Text("终身 VIP")
                            .font(.webSerif(25))
                            .foregroundStyle(AppTheme.stone800)
                    } else {
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
                }
                Spacer()
            }
        }
    }
}

private struct LifetimeVipCard: View {
    let package: CoinPackage
    let alreadyOwned: Bool
    let purchase: () -> Void
    @EnvironmentObject private var manager: StoreKitManager

    var body: some View {
        NativeSurface(padding: 18) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(package.name)
                            .font(.webSerif(22))
                            .foregroundStyle(AppTheme.stone800)
                        Text(package.description)
                            .font(.system(size: 11))
                            .foregroundStyle(AppTheme.stone500)
                            .lineSpacing(3)
                    }
                    Spacer(minLength: 8)
                    Text(package.displayPrice)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(AppTheme.stone800)
                }

                if alreadyOwned {
                    Text("已开通")
                        .font(.system(size: 13))
                        .foregroundStyle(AppTheme.stone500)
                        .frame(maxWidth: .infinity)
                        .frame(height: 42)
                        .background(AppTheme.stone100.opacity(0.8), in: Capsule())
                } else {
                    Button(action: purchase) {
                        Group {
                            if manager.purchasingProductID == package.id {
                                ProgressView().tint(.white)
                            } else {
                                Text("开通终身 VIP")
                                    .font(.system(size: 13, weight: .medium))
                            }
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
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
}

private struct ProductCard: View {
    let package: CoinPackage
    let purchase: () -> Void
    @EnvironmentObject private var manager: StoreKitManager

    var body: some View {
        NativeSurface(padding: 18) {
            HStack(spacing: 15) {
                VStack(alignment: .leading, spacing: 7) {
                    Text(package.name)
                        .font(.system(size: 11))
                        .foregroundStyle(AppTheme.stone500)
                    HStack(alignment: .firstTextBaseline, spacing: 5) {
                        Text("\(package.coins)")
                            .font(.webSerif(27))
                            .foregroundStyle(AppTheme.stone800)
                            .monospacedDigit()
                        Text("枚铜币")
                            .font(.system(size: 10))
                            .foregroundStyle(AppTheme.stone400)
                    }
                    Text(package.description)
                        .font(.system(size: 10))
                        .foregroundStyle(AppTheme.stone400)
                        .lineLimit(2)
                }
                Spacer(minLength: 8)
                Button(action: purchase) {
                    Group {
                        if manager.purchasingProductID == package.id {
                            ProgressView().tint(.white)
                        } else {
                            Text(package.displayPrice)
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
