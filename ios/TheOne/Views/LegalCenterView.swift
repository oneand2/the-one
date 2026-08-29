import SwiftUI

struct LegalCenterView: View {
    var body: some View {
        ZStack {
            AmbientBackground()
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: UIContract.Spacing.xl) {
                    VStack(alignment: .leading, spacing: UIContract.Spacing.sm) {
                        NativeSectionHeading(title: "协议与说明")
                        NativeSurface(padding: 8) {
                            VStack(spacing: 0) {
                                NavigationLink {
                                    LegalTextView(title: "隐私政策", sections: privacySections)
                                } label: {
                                    NativeMenuRow(title: "隐私政策", detail: "信息收集、处理与删除", icon: "hand.raised", tint: AppTheme.jade)
                                }
                                .buttonStyle(.plain)
                                legalDivider
                                NavigationLink {
                                    LegalTextView(title: "用户服务协议", sections: termsSections)
                                } label: {
                                    NativeMenuRow(title: "用户服务协议", detail: "服务范围与内容边界", icon: "doc.text", tint: AppTheme.water)
                                }
                                .buttonStyle(.plain)
                                legalDivider
                                NavigationLink {
                                    LegalTextView(title: "退款与售后", sections: refundSections)
                                } label: {
                                    NativeMenuRow(title: "退款与售后", detail: "Apple 购买与异常处理", icon: "arrow.uturn.backward", tint: AppTheme.gold)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: UIContract.Spacing.sm) {
                        NativeSectionHeading(title: "联系")
                        NativeSurface {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("客服邮箱")
                                    .font(.system(size: 10))
                                    .tracking(1.2)
                                    .foregroundStyle(AppTheme.stone400)
                                Text("892777353@qq.com")
                                    .font(.system(size: 14))
                                    .foregroundStyle(AppTheme.stone700)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                .padding(UIContract.Spacing.lg)
                .frame(maxWidth: UIContract.contentMaxWidth)
                .frame(maxWidth: .infinity)
            }
        }
        .navigationTitle("服务与支持")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbarBackground(AppTheme.background, for: .navigationBar)
    }

    private var legalDivider: some View {
        Rectangle().fill(AppTheme.hairline).frame(height: 1).padding(.leading, 43)
    }
}

private struct LegalTextView: View {
    let title: String
    let sections: [(String, String)]

    var body: some View {
        ZStack {
            AmbientBackground()
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: UIContract.Spacing.xl) {
                    ForEach(Array(sections.enumerated()), id: \.offset) { _, section in
                        VStack(alignment: .leading, spacing: UIContract.Spacing.sm) {
                            NativeSectionHeading(title: section.0)
                            Text(section.1)
                                .font(.system(size: 14))
                                .foregroundStyle(AppTheme.stone600)
                                .lineSpacing(7)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                .padding(UIContract.Spacing.lg)
                .padding(.bottom, UIContract.Spacing.xl)
                .frame(maxWidth: UIContract.contentMaxWidth)
                .frame(maxWidth: .infinity)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbarBackground(AppTheme.background, for: .navigationBar)
    }
}

private let privacySections = [
    ("我们收集的信息", "账户邮箱、昵称、登录状态与账户标识；你主动提交的出生时间地点、排盘、测试及对话；保障服务安全所需的设备和访问日志；以及由 Apple 提供的订单和交易状态。我们不保存支付密码或银行卡号。"),
    ("第三方处理", "Supabase 提供账户与数据存储；Apple 处理 iOS 内购；你明确同意后，AI 服务提供方处理你发送的内容，搜索服务仅在你主动开启联网检索时参与。"),
    ("保存、撤回与删除", "我们仅在提供服务、履行法律义务和解决争议所需的期限内保存信息。你可以停止使用 AI 功能，并在个人设置中直接发起完整账户删除。依法需要保留的交易记录可能在法定期限内继续保存。"),
    ("联系我们", "隐私权利请求可发送至 892777353@qq.com，我们通常会在 15 个工作日内答复。")
]

private let termsSections = [
    ("服务范围", "“二”提供自我探索、传统文化与 AI 数字内容服务。相关内容仅供文化体验、自我观察及一般信息参考。"),
    ("数字内容与铜币", "iOS 中的铜币通过 Apple App Store 内购获得，用于应用内数字服务，不可转赠、交易、提现或兑换现金，也不会过期。也可购买终身 VIP，开通后使用全部功能不再消耗铜币。"),
    ("内容边界", "排盘、心理类型和 AI 生成内容不构成医疗诊断、心理治疗、法律意见、投资建议，也不应作为重大人生决定的唯一依据。")
]

private let refundSections = [
    ("Apple 购买", "iOS 内购的支付、退款和账单由 Apple 处理。你可以在 Apple 的“报告问题”页面申请退款；应用会根据 Apple 的最终交易状态处理相应数字权益。"),
    ("服务异常", "终身 VIP 属于非消耗型项目，可在服务包页面选择“恢复终身 VIP”。铜币属于消耗型项目，购买后直接绑定当前账户，不通过 Apple 恢复；若购买成功但未到账，请联系 892777353@qq.com 并提供 Apple 订单信息。")
]
