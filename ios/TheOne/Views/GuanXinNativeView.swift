import SwiftUI

struct GuanXinNativeView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var daily: DailyDraw?
    @State private var isLoadingDaily = false
    @State private var isDrawing = false
    @State private var errorMessage: String?

    private var todayText: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy.MM.dd"
        return formatter.string(from: Date())
    }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 0) {
                LegacyPageHeader(symbol: .guanxin)

                DailyDrawSection(
                    daily: daily,
                    todayText: todayText,
                    isLoading: isLoadingDaily,
                    isDrawing: isDrawing,
                    errorMessage: errorMessage,
                    draw: { Task { await drawDaily() } },
                    retryLoad: { Task { await loadDaily() } }
                )

                LegacySectionLabel(title: "今 日 能 量", side: todayText)
                    .padding(.top, 40)

                DailyFortuneNativeCard()
                    .padding(.top, 16)

                LegacySectionLabel(title: "命 盘 排 演")
                    .padding(.top, 36)

                BaziSheetNativeCard()
                    .padding(.top, 16)

                LegacySectionLabel(title: "心 智 图 谱")
                    .padding(.top, 36)

                MBTIParityEntryCard()
                    .padding(.top, 16)
                    .padding(.bottom, 135)
            }
            .padding(.horizontal, 24)
        }
        .background(AppTheme.background)
        .task {
            while !Task.isCancelled {
                await loadDaily()
                try? await Task.sleep(for: .seconds(30))
            }
        }
    }

    private func loadDaily() async {
        errorMessage = nil
        defer { isLoadingDaily = false }
        guard auth.isAuthenticated else { daily = nil; return }
        do {
            let response: DailyDrawResponse = try await APIClient.shared.request("/api/daily-hexagram")
            daily = response.draw
        } catch let error as APIError where error.statusCode == 401 {
            daily = nil
        } catch {
            daily = nil
            errorMessage = "暂时无法读取今日之卦"
        }
    }

    private func drawDaily() async {
        guard auth.requireAuthentication() else { return }
        isDrawing = true
        defer { isDrawing = false }
        let started = ContinuousClock.now
        do {
            let response: DailyDrawResponse = try await APIClient.shared.request("/api/daily-hexagram", method: .POST)
            let elapsed = started.duration(to: .now)
            if elapsed < .milliseconds(1450) {
                try? await Task.sleep(for: .milliseconds(1450) - elapsed)
            }
            withAnimation(.easeOut(duration: 0.6)) { daily = response.draw }
        } catch {
            errorMessage = "暂时无法读取今日之卦"
        }
    }
}

private struct DailyDrawSection: View {
    let daily: DailyDraw?
    let todayText: String
    let isLoading: Bool
    let isDrawing: Bool
    let errorMessage: String?
    let draw: () -> Void
    let retryLoad: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            Rectangle()
                .fill(LinearGradient(colors: [AppTheme.stone300.opacity(0.80), AppTheme.stone300.opacity(0.50), .clear], startPoint: .top, endPoint: .bottom))
                .frame(width: 1)

            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 0) {
                    if let daily {
                        let item = HexagramCatalog.item(daily.hexagramIndex)
                        HStack(spacing: 10) {
                            Text("今 日 之 卦")
                                .font(.system(size: 10))
                                .tracking(3.4)
                                .foregroundStyle(AppTheme.stone400)
                            Rectangle().fill(AppTheme.stone300.opacity(0.70)).frame(width: 12, height: 1)
                            Text(item.name)
                                .font(.system(size: 10))
                                .tracking(2.2)
                                .foregroundStyle(AppTheme.stone500)
                            Text(String(format: "%02d", item.id))
                                .font(.system(size: 9))
                                .monospacedDigit()
                                .tracking(1.44)
                                .foregroundStyle(AppTheme.stone300)
                        }
                    } else {
                        Text("每 日 一 卦")
                            .font(.system(size: 10))
                            .tracking(3.4)
                            .foregroundStyle(AppTheme.stone400)
                    }
                    Spacer()
                    Text(todayText)
                        .font(.system(size: 9))
                        .monospacedDigit()
                        .tracking(1.62)
                        .foregroundStyle(AppTheme.stone400)
                }
                .frame(height: 15)
                .padding(.top, 2)

                if isLoading && daily == nil && errorMessage == nil {
                    Text("静 候 天 时")
                        .font(.system(size: 10)).tracking(2.8).foregroundStyle(AppTheme.stone300)
                        .frame(maxWidth: .infinity, minHeight: 156)
                } else if let errorMessage, daily == nil {
                    VStack(spacing: 12) {
                        Text(errorMessage).font(.kaiti(13)).tracking(0.6).foregroundStyle(AppTheme.stone500)
                        Button("重新尝试", action: retryLoad)
                            .font(.system(size: 10)).tracking(1.8)
                            .foregroundStyle(AppTheme.stone500)
                            .underline(true, color: AppTheme.stone300)
                    }
                    .frame(maxWidth: .infinity, minHeight: 156)
                } else if let daily {
                    let item = HexagramCatalog.item(daily.hexagramIndex)
                    // 网页移动端 slogan 为 21px 楷体，行高 1.55，字距 0.1em。
                    Text(item.slogan)
                        .font(.kaiti(21))
                        .tracking(2.1)
                        .lineSpacing(21 * 0.55)
                        .foregroundStyle(AppTheme.stone800)
                        .padding(.top, 12)
                    HStack(alignment: .center, spacing: 16) {
                        HexagramLines(code: item.code, width: 52)
                            .frame(width: 52)
                        Text(item.translation)
                            .font(.kaiti(13))
                            .tracking(0.33)
                            .foregroundStyle(AppTheme.stone500)
                            .lineSpacing(13 * 0.9)
                            .padding(.leading, 16)
                            .padding(.vertical, 2)
                            .overlay(alignment: .leading) {
                                Rectangle().fill(AppTheme.stone200.opacity(0.80)).frame(width: 1)
                            }
                    }
                    .padding(.top, 16)
                    Text("此卦留至下个卯时")
                        .font(.system(size: 9))
                        .tracking(1.8)
                        .foregroundStyle(AppTheme.stone300)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .padding(.top, 12)
                } else {
                    Text("抽取每日一卦")
                        .font(.kaiti(22))
                        .tracking(2)
                        .foregroundStyle(AppTheme.stone800)
                        .frame(height: 33, alignment: .leading)
                        .padding(.top, 16)
                    Text("静心一息，看此刻心往何处。")
                        .font(.kaiti(13))
                        .tracking(0.52)
                        .foregroundStyle(AppTheme.stone500)
                        .lineSpacing(7)
                        .frame(height: 28, alignment: .leading)
                        .padding(.top, 8)

                    HStack {
                        UnrevealedHexagramView(isDrawing: isDrawing)
                        Spacer()
                    }
                    .padding(.top, 8)
                    .frame(height: 60, alignment: .top)
                    .overlay(alignment: .top) { Rectangle().fill(AppTheme.stone200.opacity(0.70)).frame(height: 1) }
                    .padding(.top, 12)

                    Divider().overlay(AppTheme.stone200.opacity(0.70))
                        .padding(.top, 20)

                    VStack(alignment: .leading, spacing: 12) {
                        Button(action: draw) {
                            Text(isDrawing ? "正在成卦…" : "抽取今日一卦")
                                .font(.system(size: 12))
                                .tracking(2.4)
                                .foregroundStyle(Color(red: 247 / 255, green: 243 / 255, blue: 236 / 255))
                                .padding(.horizontal, 24)
                                .frame(height: 44)
                                .background(AppTheme.ink, in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .disabled(isDrawing)

                        Text("一日一卦 · 卯时更新")
                            .font(.system(size: 9))
                            .tracking(1.62)
                            .foregroundStyle(AppTheme.stone300)
                            .frame(height: 13.5, alignment: .leading)
                    }
                    .padding(.top, 16)
                }
            }
            .frame(minHeight: daily == nil ? 156 : nil, alignment: .top)
        }
    }
}

private struct UnrevealedHexagramView: View {
    let isDrawing: Bool
    @State private var pulse = false

    var body: some View {
        VStack(spacing: 4) {
            ForEach(0..<6, id: \.self) { line in
                Capsule()
                    .fill(AppTheme.secondaryInk)
                    .frame(width: 48, height: 3)
                    .scaleEffect(
                        x: isDrawing
                            ? (pulse ? 1 : (line.isMultiple(of: 2) ? 0.42 : 0.58))
                            : (line.isMultiple(of: 2) ? 0.72 : 0.48),
                        y: 1
                    )
                    .opacity(isDrawing ? (pulse ? 0.9 : 0.38) : 0.32)
                    .animation(
                        isDrawing
                            ? .easeInOut(duration: 0.72).repeatForever(autoreverses: true).delay(Double(line) * 0.07)
                            : .easeOut(duration: 0.4),
                        value: pulse
                    )
            }
        }
        .frame(width: 72, height: 52)
        .onAppear { pulse = true }
        .onChange(of: isDrawing) { _, value in pulse = value }
    }
}
