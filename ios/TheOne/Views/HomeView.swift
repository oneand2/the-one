import SwiftUI

struct HomeView: View {
    @State private var selectedDate = Date()
    @State private var news: WorldNewsResponse?
    @State private var almanac: AlmanacResponse?
    @State private var newsError: String?
    @State private var almanacError: String?
    @State private var isLoadingNews = true
    @State private var isLoadingAlmanac = true
    @State private var earliestNewsYear = Calendar.current.component(.year, from: Date())

    private let calendar = Calendar.current

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 0) {
                LegacyPageHeader(symbol: .guanshi)
                dateSelectors
                    .padding(.horizontal, 24)
                AlmanacCard(
                    date: selectedDate,
                    almanac: almanac,
                    isLoading: isLoadingAlmanac,
                    errorMessage: almanacError,
                    retry: { Task { await loadAlmanac() } }
                )
                    .padding(.horizontal, 24)
                    .padding(.top, 40)
                MeridianClockView()
                    .padding(.horizontal, 24)
                    .padding(.top, 32)
                NewsSection(response: news, isLoading: isLoadingNews, errorMessage: newsError)
                    .padding(.horizontal, 24)
                    .padding(.top, 38)
                    .padding(.bottom, 128)
            }
        }
        .background(AppTheme.background)
        .task(id: selectedDateKey) { await loadPageData() }
    }

    private var dateSelectors: some View {
        VStack(spacing: 16) {
            Text("选择日期")
                .font(.system(size: 12))
                .tracking(0.6)
                .foregroundStyle(AppTheme.stone400)
                .frame(height: 24)

            HStack(spacing: 16) {
                DatePartMenu(
                    label: "年",
                    value: calendar.component(.year, from: selectedDate),
                    values: Array(Array(earliestNewsYear...currentYear).reversed())
                ) { replaceDate(year: $0) }
                DatePartMenu(
                    label: "月",
                    value: calendar.component(.month, from: selectedDate),
                    values: Array(Array(1...maximumMonth).reversed())
                ) { replaceDate(month: $0) }
                DatePartMenu(
                    label: "日",
                    value: calendar.component(.day, from: selectedDate),
                    values: Array(Array(1...maximumDay).reversed())
                ) { replaceDate(day: $0) }
            }
        }
    }

    private var daysInSelectedMonth: Int {
        calendar.range(of: .day, in: .month, for: selectedDate)?.count ?? 31
    }

    private var currentYear: Int { calendar.component(.year, from: Date()) }

    private var maximumMonth: Int {
        calendar.component(.year, from: selectedDate) == currentYear
            ? calendar.component(.month, from: Date())
            : 12
    }

    private var maximumDay: Int {
        let selected = calendar.dateComponents([.year, .month], from: selectedDate)
        let today = calendar.dateComponents([.year, .month, .day], from: Date())
        if selected.year == today.year, selected.month == today.month { return today.day ?? 1 }
        return daysInSelectedMonth
    }

    private var selectedDateKey: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: selectedDate)
    }

    private func replaceDate(year: Int? = nil, month: Int? = nil, day: Int? = nil) {
        var components = calendar.dateComponents([.year, .month, .day], from: selectedDate)
        if let year { components.year = year }
        if let month { components.month = month }
        if let day { components.day = min(day, maximumDay) }
        if let value = calendar.date(from: components) { selectedDate = value }
    }

    private func loadNews() async {
        isLoadingNews = true
        newsError = nil
        do {
            let response: WorldNewsResponse = try await APIClient.shared.request(
                "/api/mobile/world",
                query: [URLQueryItem(name: "date", value: selectedDateKey)]
            )
            news = response
            earliestNewsYear = min(currentYear, response.earliestYear)
        } catch {
            news = nil
            newsError = "今日见闻暂时无法读取"
        }
        isLoadingNews = false
    }

    private func loadAlmanac() async {
        isLoadingAlmanac = true
        almanacError = nil
        let components = calendar.dateComponents([.year, .month, .day], from: selectedDate)
        do {
            almanac = try await APIClient.shared.request(
                "/api/mobile/almanac",
                query: [
                    URLQueryItem(name: "year", value: String(components.year ?? currentYear)),
                    URLQueryItem(name: "month", value: String(components.month ?? 1)),
                    URLQueryItem(name: "day", value: String(components.day ?? 1)),
                ]
            )
        } catch {
            almanac = nil
            almanacError = "暂时无法读取黄历"
        }
        isLoadingAlmanac = false
    }

    private func loadPageData() async {
        async let newsTask: Void = loadNews()
        async let almanacTask: Void = loadAlmanac()
        _ = await (newsTask, almanacTask)
    }
}

private struct DatePartMenu: View {
    let label: String
    let value: Int
    let values: [Int]
    let select: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .tracking(0.6)
                .foregroundStyle(AppTheme.stone500)
                .frame(height: 18)
            Menu {
                ForEach(values, id: \.self) { item in
                    Button("\(item)") { select(item) }
                }
            } label: {
                HStack {
                    Text(verbatim: "\(value)")
                        .font(.system(size: 14))
                        .foregroundStyle(AppTheme.stone700)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AppTheme.stone400)
                }
                .padding(.horizontal, 12)
                .frame(height: 41)
                .background(AppTheme.stone200.opacity(0.18), in: RoundedRectangle(cornerRadius: 6))
                .overlay { RoundedRectangle(cornerRadius: 6).stroke(AppTheme.stone200.opacity(0.60)) }
            }
        }
        .frame(maxWidth: .infinity)
    }
}

private struct AlmanacCard: View {
    let date: Date
    let almanac: AlmanacResponse?
    let isLoading: Bool
    let errorMessage: String?
    let retry: () -> Void
    @State private var showsDetails = false

    private var dateText: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "yyyy.MM.dd\u{2002}EEEE"
        return formatter.string(from: date)
    }

    var body: some View {
        Group {
            if isLoading && almanac == nil {
                placeholderCard { ProgressView().controlSize(.small).tint(AppTheme.muted) }
            } else if let errorMessage, almanac == nil {
                placeholderCard {
                    VStack(spacing: 10) {
                        Text(errorMessage).font(.kaiti(13)).foregroundStyle(AppTheme.stone500)
                        Button("重新尝试", action: retry)
                            .font(.system(size: 10)).tracking(1.8)
                            .foregroundStyle(AppTheme.stone500)
                            .underline(true, color: AppTheme.stone300)
                    }
                }
            } else if let almanac {
                loadedCard(almanac)
            } else {
                placeholderCard {
                    Text("暂时无法读取黄历").font(.kaiti(13)).foregroundStyle(AppTheme.stone500)
                }
            }
        }
    }

    private func placeholderCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .frame(maxWidth: .infinity)
            .frame(minHeight: 180)
            .padding(1)
            .background(AppTheme.warmWhite, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: 16).stroke(Color.black.opacity(0.07)) }
    }

    private func loadedCard(_ almanac: AlmanacResponse) -> some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Text(almanac.lunarTitle)
                        .font(.kaiti(28))
                        .tracking(0.7)
                        .foregroundStyle(AppTheme.lunarInk)
                    Spacer()
                    Text(dateText)
                        .font(.system(size: 11))
                        .foregroundStyle(AppTheme.lunarDate)
                }
                Text("\(almanac.yearGanZhi) \(almanac.monthGanZhi) \(almanac.dayGanZhi) 属\(almanac.zodiac) · 此时\(almanac.currentZhi)时 \(almanac.timePillar)")
                    .font(.kaiti(11))
                    .tracking(0.66)
                    .foregroundStyle(AppTheme.lunarMeta)
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 12)

            Divider().overlay(AppTheme.hairline)

            HStack(spacing: 0) {
                PillarColumn(label: "年", pillar: almanac.yearPillar, divider: true)
                PillarColumn(label: "月", pillar: almanac.monthPillar, divider: true)
                PillarColumn(label: "日", pillar: almanac.dayPillar, divider: true)
                PillarColumn(label: "时", pillar: almanac.timePillar, divider: false)
            }
            .frame(height: 123)

            Divider().overlay(AppTheme.hairline)

            VStack(alignment: .leading, spacing: 6) {
                AlmanacLine(mark: "宜", text: almanac.yi.joined(separator: "　"), color: AppTheme.jade)
                AlmanacLine(mark: "忌", text: almanac.ji.joined(separator: "　"), color: AppTheme.cinnabar)
                Text("传统历法摘录 · 仅作文化资料浏览")
                    .font(.system(size: 9))
                    .foregroundStyle(AppTheme.faint)
                    .frame(height: 17.5, alignment: .bottom)
            }
            .padding(.horizontal, 20)
            .padding(.top, 14)

            HStack {
                Text("\(almanac.tianShenType) · \(almanac.tianShen) · \(almanac.zhiXing)日")
                Spacer()
                HStack(spacing: 2) {
                    Text("查看详情")
                    Image(systemName: "chevron.right")
                        .font(.system(size: 8, weight: .regular))
                }
            }
            .font(.system(size: 10))
            .tracking(0.5)
            .foregroundStyle(AppTheme.lunarMeta)
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .frame(height: 26, alignment: .top)
            .overlay(alignment: .top) { Rectangle().fill(Color.black.opacity(0.05)).frame(height: 1) }
            .padding(.top, 12)
            .padding(.bottom, 16)
        }
        .padding(.horizontal, 1)
        .background(AppTheme.warmWhite, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 16).stroke(Color.black.opacity(0.07)) }
        .shadow(color: .black.opacity(0.04), radius: 3, y: 1)
        .shadow(color: .black.opacity(0.03), radius: 2, y: 1)
        .contentShape(RoundedRectangle(cornerRadius: 16))
        .onTapGesture { showsDetails = true }
        .accessibilityAddTraits(.isButton)
        .sensoryTap()
        .sheet(isPresented: $showsDetails) {
            AlmanacDetailSheet(date: date, lunarTitle: almanac.lunarTitle, dateText: dateText, almanac: almanac)
                .presentationDetents([.fraction(0.78), .large])
                .presentationDragIndicator(.visible)
                .presentationCornerRadius(24)
        }
    }
}

private struct AlmanacDetailSheet: View {
    @Environment(\.dismiss) private var dismiss
    let date: Date
    let lunarTitle: String
    let dateText: String
    let almanac: AlmanacResponse

    private var pillars: [String] {
        [almanac.yearPillar, almanac.monthPillar, almanac.dayPillar, almanac.timePillar]
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 25) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(lunarTitle).font(.kaiti(31)).tracking(3)
                        Text(dateText).font(.system(size: 12)).foregroundStyle(AppTheme.muted)
                        Text("\(almanac.yearGanZhi) · \(almanac.monthGanZhi) · \(almanac.dayGanZhi)")
                            .font(.kaiti(13)).tracking(1.2).foregroundStyle(AppTheme.secondaryInk)
                    }

                    HStack(spacing: 0) {
                        PillarColumn(label: "年", pillar: pillars[0], divider: true)
                        PillarColumn(label: "月", pillar: pillars[1], divider: true)
                        PillarColumn(label: "日", pillar: pillars[2], divider: true)
                        PillarColumn(label: "时", pillar: pillars[3], divider: false)
                    }
                    .overlay { RoundedRectangle(cornerRadius: 16).stroke(AppTheme.hairline) }
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                    DetailBlock(title: "宜", text: almanac.yi.joined(separator: "　"), tint: AppTheme.jade)
                    DetailBlock(title: "忌", text: almanac.ji.joined(separator: "　"), tint: AppTheme.cinnabar)

                    VStack(alignment: .leading, spacing: 12) {
                        LegacySectionLabel(title: "历 法 摘 录")
                        DetailRow(label: "纳音五行", value: almanac.dayNaYin)
                        DetailRow(label: "十二建除", value: "\(almanac.zhiXing)日")
                        DetailRow(label: almanac.tianShenType.isEmpty ? "神煞" : almanac.tianShenType, value: almanac.tianShen)
                        if let xiu = almanac.xiu, !xiu.isEmpty {
                            let xiuText = [
                                almanac.xiuGong.map { "\($0)方" },
                                [xiu, almanac.xiuZheng].compactMap { $0 }.joined(separator: ""),
                                almanac.xiuAnimal,
                            ].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
                            DetailRow(label: "廿八宿", value: xiuText)
                        }
                        DetailRow(label: "今日冲煞", value: "冲\(almanac.chongShengXiao)　煞\(almanac.sha)")
                    }

                    if let times = almanac.shiChen, !times.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            LegacySectionLabel(title: "十 二 时 辰")
                            ForEach(times) { time in
                                HStack(alignment: .top, spacing: 12) {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(time.ganZhi).font(.kaiti(15)).foregroundStyle(AppTheme.stone800)
                                        Text(time.range).font(.system(size: 9)).foregroundStyle(AppTheme.stone400)
                                    }.frame(width: 68, alignment: .leading)
                                    Text(time.luck).font(.kaiti(12)).foregroundStyle(time.luck == "吉" ? AppTheme.jade : time.luck == "凶" ? AppTheme.cinnabar : AppTheme.stone500)
                                        .frame(width: 24)
                                    Text(time.reason).font(.kaiti(11.5)).foregroundStyle(AppTheme.stone600).lineSpacing(4)
                                    Spacer(minLength: 0)
                                }
                                .padding(.vertical, 7)
                                .overlay(alignment: .bottom) { Rectangle().fill(AppTheme.stone200.opacity(0.55)).frame(height: 1) }
                            }
                        }
                    }

                    Text("传统历法信息仅作文化资料浏览，不作为医疗、投资或重大人生决策依据。")
                        .font(.kaiti(11)).foregroundStyle(AppTheme.faint).lineSpacing(5)
                }
                .padding(24)
                .padding(.bottom, 30)
            }
            .background(AppTheme.background)
            .navigationTitle("万年历")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("完成") { dismiss() } } }
        }
    }
}

private struct DetailBlock: View {
    let title: String, text: String, tint: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.kaiti(15)).foregroundStyle(tint)
                .frame(width: 28, height: 28)
                .overlay { Circle().stroke(tint.opacity(0.6)) }
            Text(text).font(.kaiti(14)).foregroundStyle(AppTheme.secondaryInk).lineSpacing(8)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tint.opacity(0.04), in: RoundedRectangle(cornerRadius: 18))
    }
}

private struct DetailRow: View {
    let label: String, value: String
    var body: some View {
        HStack {
            Text(label).font(.system(size: 12)).foregroundStyle(AppTheme.muted)
            Spacer()
            Text(value).font(.kaiti(14)).foregroundStyle(AppTheme.secondaryInk)
        }
        .padding(.vertical, 4)
    }
}

private struct PillarColumn: View {
    let label: String
    let pillar: String
    let divider: Bool

    private var gan: String { pillar.first.map(String.init) ?? "·" }
    private var zhi: String { pillar.dropFirst().first.map(String.init) ?? "·" }

    var body: some View {
        VStack(spacing: 0) {
            Text(label)
                .font(.system(size: 8))
                .tracking(1.44)
                .foregroundStyle(AppTheme.faint)
                .frame(height: 12)
                .padding(.bottom, 12)
            Text(gan)
                .font(.kaiti(22))
                .foregroundStyle(wuxingColor(gan))
                .frame(height: 22)
                .padding(.bottom, 10)
            Rectangle().fill(Color.black.opacity(0.08)).frame(width: 14, height: 1)
                .padding(.bottom, 10)
            Text(zhi)
                .font(.kaiti(22))
                .foregroundStyle(wuxingColor(zhi))
                .frame(height: 22)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .overlay(alignment: .trailing) {
            if divider { Rectangle().fill(Color.black.opacity(0.06)).frame(width: 1) }
        }
    }

    private func wuxingColor(_ value: String) -> Color {
        if "庚辛申酉".contains(value) { return AppTheme.metal }
        if "甲乙寅卯".contains(value) { return AppTheme.wood }
        if "壬癸子亥".contains(value) { return AppTheme.water }
        if "丙丁巳午".contains(value) { return AppTheme.fire }
        if "戊己辰戌丑未".contains(value) { return AppTheme.earth }
        return AppTheme.secondaryInk
    }
}

private struct AlmanacLine: View {
    let mark: String, text: String, color: Color
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Text(mark)
                .font(.system(size: 9))
                .foregroundStyle(color)
                .frame(width: 17, height: 17)
                .overlay { Circle().stroke(color.opacity(0.6), lineWidth: 1) }
            Text(text)
                .font(.kaiti(11.5))
                .foregroundStyle(AppTheme.lunarText)
                .lineLimit(1)
        }
        .frame(height: 17.25)
    }
}

private struct NewsSection: View {
    let response: WorldNewsResponse?
    let isLoading: Bool
    let errorMessage: String?

    private var sections: [(String, [WorldNewsItem])] {
        guard let items = response?.items else { return [] }
        var order: [String] = []
        var grouped: [String: [WorldNewsItem]] = [:]
        for item in items {
            let key = item.section.isEmpty ? "今日见闻" : item.section
            if grouped[key] == nil { order.append(key) }
            grouped[key, default: []].append(item)
        }
        return order.map { ($0, grouped[$0] ?? []) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Rectangle().fill(AppTheme.hairline).frame(height: 1)
                .padding(.bottom, 30)

            if response?.isYesterdayFallback == true {
                VStack(spacing: 8) {
                    HStack(spacing: 16) {
                        Rectangle().fill(AppTheme.hairline).frame(height: 1)
                        Text("昨日").font(.kaiti(11)).tracking(2).foregroundStyle(AppTheme.muted)
                        Rectangle().fill(AppTheme.hairline).frame(height: 1)
                    }
                    Text("今日新闻暂未更新，为您展示昨日新闻")
                        .font(.kaiti(11.5)).tracking(1.5).foregroundStyle(AppTheme.muted.opacity(0.8))
                }
                .padding(.bottom, 30)
            }

            if isLoading {
                HStack { Spacer(); ProgressView().controlSize(.small).tint(AppTheme.muted); Spacer() }
                    .padding(.vertical, 48)
            } else if let errorMessage {
                Text(errorMessage)
                    .font(.kaiti(14)).foregroundStyle(AppTheme.muted)
                    .frame(maxWidth: .infinity).padding(.vertical, 48)
            } else if sections.isEmpty {
                Text("该日新闻暂未更新")
                    .font(.kaiti(14)).tracking(1).foregroundStyle(AppTheme.muted)
                    .frame(maxWidth: .infinity).padding(.vertical, 48)
            } else {
                ForEach(Array(sections.enumerated()), id: \.offset) { sectionIndex, section in
                    WorldNewsCategoryCard(title: section.0, items: section.1)
                    if sectionIndex < sections.count - 1 {
                        VStack(spacing: 6) {
                            Rectangle().fill(AppTheme.hairline.opacity(0.5)).frame(height: 1)
                            Rectangle().fill(AppTheme.hairline.opacity(0.5)).frame(height: 1)
                        }
                        .padding(.vertical, 27)
                    }
                }

                let linked = response?.items.filter { $0.url != nil } ?? []
                if !linked.isEmpty {
                    VStack(spacing: 6) {
                        Rectangle().fill(AppTheme.hairline.opacity(0.5)).frame(height: 1)
                        Rectangle().fill(AppTheme.hairline.opacity(0.5)).frame(height: 1)
                    }
                    .padding(.vertical, 27)
                    NewsLinksCard(items: linked)
                }
            }

            HStack(alignment: .top, spacing: 8) {
                Text("|").foregroundStyle(AppTheme.faint.opacity(0.5))
                Text("声明 · 本站仅提供信息收集与整理服务，不保证信息的准确性与完整性，所有新闻版权归原媒体所有。所有内容仅供参考，不构成任何投资建议。")
                    .font(.system(size: 11)).tracking(0.6).foregroundStyle(AppTheme.muted.opacity(0.72)).lineSpacing(4)
            }
            .padding(.top, 32)
        }
    }
}

private struct WorldNewsCategoryCard: View {
    let title: String
    let items: [WorldNewsItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Capsule().fill(AppTheme.ink).frame(width: 4, height: 20)
                Text(title).font(.system(size: 15, weight: .medium, design: .serif)).tracking(0.6)
            }
            .padding(.bottom, 12)
            .overlay(alignment: .bottom) { Rectangle().fill(AppTheme.hairline.opacity(0.6)).frame(height: 1) }
            .padding(.bottom, 18)

            ForEach(items) { item in
                Text(item.title)
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(Color(red: 0.25, green: 0.24, blue: 0.22))
                    .lineSpacing(4)
                    .padding(.bottom, 10)

                ForEach(Array(item.summary.split(separator: "\n", omittingEmptySubsequences: true).enumerated()), id: \.offset) { _, rawLine in
                    let line = String(rawLine)
                    if line.hasPrefix("利好：") || line.hasPrefix("利空：") {
                        NewsImpactLine(text: line)
                    } else {
                        Text(line)
                            .font(.system(size: 13.5))
                            .foregroundStyle(Color(red: 0.31, green: 0.29, blue: 0.27))
                            .lineSpacing(7)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.bottom, 12)
                    }
                }

                if let source = item.source, !source.isEmpty {
                    Text("消息来源：\(source)")
                        .font(.system(size: 11.5)).italic()
                        .foregroundStyle(AppTheme.muted)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .padding(.top, 2).padding(.bottom, 14)
                }
            }
        }
        .padding(24)
        .background(
            LinearGradient(colors: [Color(red: 0.992, green: 0.992, blue: 0.984), Color(red: 0.98, green: 0.98, blue: 0.972)], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 16, style: .continuous)
        )
        .overlay { RoundedRectangle(cornerRadius: 16).stroke(AppTheme.hairline.opacity(0.55)) }
        .shadow(color: .black.opacity(0.035), radius: 3, y: 1)
    }
}

private struct NewsImpactLine: View {
    let text: String
    private var bullish: Bool { text.hasPrefix("利好：") }
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("•").foregroundStyle(AppTheme.faint)
            Text(bullish ? "利好" : "利空")
                .foregroundStyle(bullish ? AppTheme.gold.opacity(0.55) : Color.gray.opacity(0.6))
            Text("|").foregroundStyle(AppTheme.faint)
            Text(String(text.dropFirst(3))).foregroundStyle(AppTheme.secondaryInk.opacity(0.9))
        }
        .font(.system(size: 11))
        .padding(.bottom, 7)
    }
}

private struct NewsLinksCard: View {
    let items: [WorldNewsItem]
    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack(spacing: 10) {
                Capsule().fill(AppTheme.gold).frame(width: 4, height: 20)
                Text("新闻链接查证").font(.system(size: 15, weight: .medium, design: .serif))
            }
            Divider().overlay(AppTheme.gold.opacity(0.18))
            ForEach(items) { item in
                if let string = item.url, let url = URL(string: string) {
                    Link(destination: url) {
                        HStack(alignment: .top, spacing: 8) {
                            Text("•").foregroundStyle(AppTheme.gold)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("[\(item.source ?? "来源")] \(item.title)")
                                    .font(.system(size: 13)).foregroundStyle(AppTheme.secondaryInk)
                                Text(string).font(.system(size: 11)).foregroundStyle(AppTheme.muted).lineLimit(2)
                            }
                        }
                    }
                }
            }
        }
        .padding(24)
        .background(AppTheme.warmWhite, in: RoundedRectangle(cornerRadius: 16))
        .overlay { RoundedRectangle(cornerRadius: 16).stroke(AppTheme.gold.opacity(0.16)) }
    }
}

struct HexagramLines: View {
    let code: String
    var width: CGFloat = 72

    var body: some View {
        VStack(spacing: 5) {
            ForEach(Array(code.enumerated()), id: \.offset) { _, bit in
                if bit == "1" {
                    Rectangle().fill(AppTheme.secondaryInk).frame(width: width, height: 4)
                } else {
                    HStack(spacing: width * 0.16) {
                        Rectangle().fill(AppTheme.secondaryInk)
                        Rectangle().fill(AppTheme.secondaryInk)
                    }
                    .frame(width: width, height: 4)
                }
            }
        }
        .accessibilityLabel("卦象")
    }
}
