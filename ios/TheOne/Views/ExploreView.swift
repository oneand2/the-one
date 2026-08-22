import SwiftUI

struct ExploreView: View {
    var body: some View {
        VStack(spacing: 0) {
            LegacyPageHeader(symbol: .wendao)
            VStack(spacing: 24) {
                Rectangle().fill(AppTheme.stone200.opacity(0.8)).frame(width: 48, height: 1)
                Text("感谢您的支持\n见众生功能正在开发中")
                    .font(.kaiti(14))
                    .tracking(0.35)
                    .foregroundStyle(AppTheme.stone500)
                    .multilineTextAlignment(.center)
                Rectangle().fill(AppTheme.stone200.opacity(0.6)).frame(width: 32, height: 1)
            }
            .frame(height: 320)
            Spacer(minLength: 0)
        }
        .background(AppTheme.background)
    }
}
