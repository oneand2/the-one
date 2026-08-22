import SwiftUI

/// 对照网页 `/report/classical` 的原生报告页。数据来自 `POST /api/mobile/bazi` action=report。
struct ClassicalReportView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var flow: AppFlowStore
    @Environment(\.dismiss) private var dismiss

    let params: [String: String]

    @State private var report: ReportPayload?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var saveStatus = SaveStatus.idle
    @State private var isAnalyzing = false
    @State private var selectedLuckIndex = 0

    private enum SaveStatus { case idle, saving, saved, error }

    var body: some View {
        Group {
            if isLoading {
                VStack(spacing: 16) {
                    ProgressView()
                    Text("正在排盘...").font(.system(size: 14)).foregroundStyle(AppTheme.stone700)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage, report == nil {
                VStack(spacing: 12) {
                    Text(errorMessage).font(.kaiti(14)).foregroundStyle(AppTheme.cinnabar)
                    Button("重试") { Task { await load() } }
                        .font(.system(size: 13)).foregroundStyle(AppTheme.stone700)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let report {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        identityCard(report.displayInfo)
                        pillarTable(report.classical)
                            .padding(.top, 24)
                        interactionSection(report)
                            .padding(.top, 28)
                        energySection(report.energyProfile)
                            .padding(.top, 28)
                        luckSection(report.luckCycles, classical: report.classical)
                            .padding(.top, 36)
                        Button("← 返回") { dismiss() }
                            .font(.system(size: 11)).tracking(1.8)
                            .foregroundStyle(AppTheme.stone400)
                            .padding(.vertical, 36)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 24)
                    .padding(.bottom, 40)
                }
            }
        }
        .background(AppTheme.background)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func identityCard(_ info: ReportDisplayInfo) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Text(info.name.isEmpty ? "命主" : info.name)
                    .font(.webSerif(30)).foregroundStyle(Color(red: 74 / 255, green: 64 / 255, blue: 58 / 255))
                Rectangle().fill(AppTheme.stone300).frame(width: 1, height: 20)
                Text(info.gender.isEmpty ? "乾造" : info.gender)
                    .font(.webSerif(18)).foregroundStyle(AppTheme.stone500)
            }
            .padding(.top, 32)
            Rectangle().fill(AppTheme.stone300).frame(width: 40, height: 1).padding(.vertical, 18)
            if info.solarDate != "未知日期", !info.solarDate.isEmpty {
                if info.isInferred {
                    Text("推测日期")
                        .font(.system(size: 9)).tracking(2.4)
                        .foregroundStyle(AppTheme.gold)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .overlay { RoundedRectangle(cornerRadius: 2).stroke(AppTheme.gold.opacity(0.30)) }
                        .padding(.bottom, 10)
                }
                dateRow("阳历", info.solarDate)
                dateRow("农历", lunarDisplay(info.lunarDate)).padding(.top, 8)
                if info.isInferred {
                    Text("注：此日期为根据八字反推的最近匹配日期（1960-2030范围内）")
                        .font(.system(size: 8)).foregroundStyle(AppTheme.stone300)
                        .padding(.top, 14)
                }
            } else if info.solarDate == "未知日期" {
                Text("未找到匹配的日期（1960-2030）")
                    .font(.system(size: 12)).foregroundStyle(AppTheme.stone400)
            }

            HStack(spacing: 12) {
                Button { Task { await save() } } label: {
                    Text(saveStatus == .saving ? "保存中…" : saveStatus == .saved ? "✓ 已保存" : "保存该八字")
                        .font(.system(size: 11)).tracking(1.8)
                        .foregroundStyle(AppTheme.stone500)
                        .frame(maxWidth: .infinity).frame(height: 40)
                        .overlay { RoundedRectangle(cornerRadius: 8).stroke(AppTheme.stone300.opacity(0.80)) }
                }
                .disabled(saveStatus == .saving)
                Button { Task { await analyze() } } label: {
                    Text(isAnalyzing ? "正在解析…" : "解析该八字")
                        .font(.system(size: 11)).tracking(1.8)
                        .foregroundStyle(Color(red: 245 / 255, green: 243 / 255, blue: 238 / 255))
                        .frame(maxWidth: .infinity).frame(height: 40)
                        .background(Color(red: 107 / 255, green: 96 / 255, blue: 89 / 255), in: RoundedRectangle(cornerRadius: 8))
                }
                .disabled(isAnalyzing || saveStatus == .saving)
            }
            .padding(.top, 22)
            .padding(.bottom, 20)
            if saveStatus == .error {
                Text("保存失败，请先登录或稍后重试")
                    .font(.system(size: 10)).foregroundStyle(Color.orange.opacity(0.70))
            }
        }
        .padding(.horizontal, 28)
        .frame(maxWidth: .infinity)
        .background(Color(red: 250 / 255, green: 248 / 255, blue: 245 / 255))
        .overlay(alignment: .top) { Rectangle().fill(AppTheme.stone300).frame(height: 2) }
        .overlay(alignment: .bottom) { Rectangle().fill(AppTheme.stone300).frame(height: 2) }
    }

    private func dateRow(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 16) {
            Text(label).font(.system(size: 10)).tracking(1.2).foregroundStyle(AppTheme.stone400).frame(width: 32, alignment: .trailing)
            Text(value).font(.system(size: 14)).foregroundStyle(AppTheme.stone600)
        }
    }

    private func pillarTable(_ data: ReportClassical) -> some View {
        let keys = ["year", "month", "day", "hour"]
        let names = ["年柱", "月柱", "日柱", "时柱"]
        return VStack(spacing: 0) {
            tableRow(tint: true) {
                tableLabel("日期")
                ForEach(names, id: \.self) { name in
                    Text(name).font(.webSerif(12)).foregroundStyle(AppTheme.stone700).frame(maxWidth: .infinity)
                }
            }
            tableRow(tint: false) {
                tableLabel("主星")
                ForEach(keys, id: \.self) { key in
                    Text(key == "day" ? "日主" : (data.tenGods.stems[data.pillars[key]?.gan ?? ""] ?? ""))
                        .font(.system(size: 10)).foregroundStyle(AppTheme.stone600).frame(maxWidth: .infinity)
                }
            }
            tableRow(tint: true) {
                tableLabel("天干")
                ForEach(keys, id: \.self) { key in
                    let gan = data.pillars[key]?.gan ?? "—"
                    Text(gan).font(.webSerif(24)).foregroundStyle(wuxingColor(gan)).frame(maxWidth: .infinity)
                }
            }
            tableRow(tint: false, alignment: .top) {
                tableLabel("地支").padding(.top, 6)
                ForEach(keys, id: \.self) { key in
                    let zhi = data.pillars[key]?.zhi ?? "—"
                    VStack(spacing: 6) {
                        Text(zhi).font(.webSerif(24)).foregroundStyle(wuxingColor(zhi))
                        ForEach(data.shenSha[key] ?? [], id: \.self) { sha in
                            Text(sha).font(.system(size: 8)).tracking(0.8).foregroundStyle(AppTheme.stone400)
                                .padding(.horizontal, 4).padding(.vertical, 2)
                                .background(AppTheme.stone50, in: Capsule())
                        }
                    }.frame(maxWidth: .infinity)
                }
            }
            tableRow(tint: true, alignment: .top) {
                tableLabel("藏干").padding(.top, 4)
                ForEach(keys, id: \.self) { key in
                    let zhi = data.pillars[key]?.zhi ?? ""
                    let stems = data.hiddenStems[zhi] ?? []
                    let gods = data.tenGods.hidden[zhi] ?? []
                    VStack(spacing: 8) {
                        ForEach(Array(stems.enumerated()), id: \.offset) { index, stem in
                            HStack(spacing: 4) {
                                Text(gods.indices.contains(index) ? gods[index] : "")
                                    .font(.system(size: 8)).foregroundStyle(AppTheme.stone400)
                                    .frame(width: 28, alignment: .trailing)
                                Text(stem.gan).font(.webSerif(15)).foregroundStyle(wuxingColor(stem.gan))
                            }
                        }
                    }.frame(maxWidth: .infinity)
                }
            }
            tableRow(tint: false) {
                tableLabel("星运")
                ForEach(keys, id: \.self) { key in
                    Text(data.lifeCycle[data.pillars[key]?.zhi ?? ""] ?? "")
                        .font(.system(size: 10)).foregroundStyle(AppTheme.stone600).frame(maxWidth: .infinity)
                }
            }
            tableRow(tint: true) {
                tableLabel("自坐")
                ForEach(keys, id: \.self) { key in
                    Text(data.selfSeat[data.pillars[key]?.zhi ?? ""] ?? "")
                        .font(.system(size: 10)).foregroundStyle(AppTheme.stone600).frame(maxWidth: .infinity)
                }
            }
            tableRow(tint: false) {
                tableLabel("空亡")
                ForEach(keys, id: \.self) { key in
                    Text(data.kongWang[key] ?? "").font(.system(size: 10)).foregroundStyle(AppTheme.stone600).frame(maxWidth: .infinity)
                }
            }
            tableRow(tint: true) {
                tableLabel("纳音")
                ForEach(keys, id: \.self) { key in
                    Text(data.nayin[key] ?? "").font(.system(size: 10)).foregroundStyle(AppTheme.stone600).frame(maxWidth: .infinity)
                }
            }
        }
        .background(Color.white.opacity(0.40), in: RoundedRectangle(cornerRadius: 16))
    }

    private func tableRow<Content: View>(tint: Bool, alignment: VerticalAlignment = .center, @ViewBuilder content: () -> Content) -> some View {
        HStack(alignment: alignment, spacing: 0) { content() }
            .padding(.vertical, 10).padding(.horizontal, 8)
            .background(tint ? Color(red: 250 / 255, green: 250 / 255, blue: 249 / 255).opacity(0.50) : Color.clear)
    }

    private func tableLabel(_ text: String) -> some View {
        Text(text).font(.system(size: 9)).foregroundStyle(AppTheme.stone400).frame(width: 36)
    }

    private func interactionSection(_ report: ReportPayload) -> some View {
        VStack(spacing: 12) {
            Text("八字关系图谱")
                .font(.webSerif(16)).foregroundStyle(Color(red: 68 / 255, green: 64 / 255, blue: 60 / 255))
                .tracking(1.6)
            Text("气 韵 流 转 · 听 见 内 在 生 命 的 呼 吸")
                .font(.system(size: 9)).tracking(1.2).foregroundStyle(Color(red: 168 / 255, green: 162 / 255, blue: 158 / 255))
            CircuitGraphCanvas(interactions: report.interactions, classical: report.classical)
                .frame(height: 260)
                .padding(.vertical, 4)
            circuitLegend
            if !report.textual.stems.isEmpty || !report.textual.branches.isEmpty || !report.textual.pillars.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    if !report.textual.stems.isEmpty {
                        textualRow(title: "原局天干：", text: report.textual.stems.joined(separator: " | "))
                    }
                    if !report.textual.branches.isEmpty {
                        textualRow(title: "原局地支：", text: report.textual.branches.joined(separator: " | "))
                    }
                    if !report.textual.pillars.isEmpty {
                        textualRow(title: "原局柱际：", text: report.textual.pillars.joined(separator: " | "))
                    }
                }
                .padding(.top, 12)
                .overlay(alignment: .top) { Rectangle().fill(AppTheme.stone200).frame(height: 1) }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 16)
        .frame(maxWidth: .infinity)
        .background(Color.white.opacity(0.40), in: RoundedRectangle(cornerRadius: 16))
    }

    private func textualRow(title: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.webSerif(12)).foregroundStyle(Color(red: 176 / 255, green: 159 / 255, blue: 115 / 255))
            Text(text).font(.system(size: 11)).foregroundStyle(AppTheme.stone600).lineSpacing(4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var circuitLegend: some View {
        HStack(spacing: 14) {
            legendItem(color: Color(red: 127 / 255, green: 166 / 255, blue: 138 / 255), dashed: false, title: "合")
            legendItem(color: Color(red: 186 / 255, green: 93 / 255, blue: 79 / 255), dashed: true, title: "冲")
            legendItem(color: Color(red: 155 / 255, green: 142 / 255, blue: 120 / 255), dashed: true, title: "刑")
            legendItem(color: Color(red: 127 / 255, green: 166 / 255, blue: 138 / 255), dashed: false, title: "生")
            legendItem(color: Color(red: 186 / 255, green: 93 / 255, blue: 79 / 255), dashed: true, title: "克")
        }
        .font(.system(size: 10)).foregroundStyle(Color(red: 168 / 255, green: 162 / 255, blue: 158 / 255))
    }

    private func legendItem(color: Color, dashed: Bool, title: String) -> some View {
        HStack(spacing: 6) {
            Capsule().stroke(color, style: StrokeStyle(lineWidth: 1.4, dash: dashed ? [4, 3] : []))
                .frame(width: 18, height: 1)
            Text(title)
        }
    }

    private func energySection(_ profile: ReportEnergyProfile) -> some View {
        VStack(spacing: 0) {
            VStack(spacing: 8) {
                Text("五行流通 · 能量分布")
                    .font(.webSerif(20)).foregroundStyle(Color(red: 74 / 255, green: 64 / 255, blue: 58 / 255)).tracking(1.6)
                HStack(spacing: 8) {
                    Text("日主强弱").font(.system(size: 12)).foregroundStyle(AppTheme.stone500)
                    Text(profile.status.level).font(.webSerif(13)).foregroundStyle(Color(red: 176 / 255, green: 159 / 255, blue: 115 / 255))
                    Text("·").foregroundStyle(AppTheme.stone400)
                    Text("同党").font(.system(size: 12)).foregroundStyle(AppTheme.stone500)
                    Text(String(format: "%.1f%%", profile.status.percent)).font(.system(size: 12)).foregroundStyle(AppTheme.stone600)
                    Text("·").foregroundStyle(AppTheme.stone400)
                    Text("燥湿").font(.system(size: 12)).foregroundStyle(AppTheme.stone500)
                    Text(profile.climate.level)
                        .font(.webSerif(13))
                        .foregroundStyle(profile.climate.isDry == true ? Color(red: 186 / 255, green: 93 / 255, blue: 79 / 255) : profile.climate.isWet == true ? Color(red: 79 / 255, green: 126 / 255, blue: 168 / 255) : AppTheme.stone600)
                }
            }
            .padding(.vertical, 16)
            .frame(maxWidth: .infinity)
            .background(LinearGradient(colors: [AppTheme.stone50, AppTheme.stone50.opacity(0.40)], startPoint: .leading, endPoint: .trailing))

            VStack(spacing: 22) {
                energyBars("天干能量", items: ganEnergyItems(profile))
                energyBars("十神格局", items: shishenEnergyItems(profile), markMax: true)
            }
            .padding(.horizontal, 16).padding(.vertical, 22)

            HStack(spacing: 12) {
                VStack(spacing: 4) {
                    Text("格局判定").font(.system(size: 12)).foregroundStyle(AppTheme.stone500)
                    Text(profile.status.pattern.replacingOccurrences(of: #"\(.*?\)"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespaces))
                        .font(.webSerif(16)).foregroundStyle(Color(red: 139 / 255, green: 95 / 255, blue: 69 / 255))
                    Text("(月令本气)").font(.system(size: 10)).foregroundStyle(AppTheme.stone400)
                }
                .frame(maxWidth: .infinity)
                VStack(spacing: 4) {
                    Text("用神").font(.system(size: 12)).foregroundStyle(AppTheme.stone500)
                    Text(profile.yongshen.final == "无" ? "未定" : profile.yongshen.final)
                        .font(.webSerif(15)).foregroundStyle(Color(red: 176 / 255, green: 159 / 255, blue: 115 / 255))
                }
                .frame(maxWidth: .infinity)
            }
            .padding(16)
            .background(AppTheme.stone50.opacity(0.50), in: RoundedRectangle(cornerRadius: 12))
            .overlay { RoundedRectangle(cornerRadius: 12).stroke(AppTheme.stone200.opacity(0.50)) }
            .padding(.horizontal, 16)

            HStack(spacing: 8) {
                climateCell("燥湿程度", profile.climate.level, note: profile.climate.tempScore.map { String(format: "(%.0f)", $0) })
                climateCell("调候用神", profile.yongshen.climate == "无" ? "未定" : profile.yongshen.climate, note: nil)
                climateCell("扶抑用神", profile.yongshen.balance == "无" ? "未定" : profile.yongshen.balance, note: nil)
            }
            .padding(16)
            .background(AppTheme.stone50.opacity(0.50), in: RoundedRectangle(cornerRadius: 12))
            .overlay { RoundedRectangle(cornerRadius: 12).stroke(AppTheme.stone200.opacity(0.50)) }
            .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 18)

            if !profile.yongshen.reason.isEmpty {
                Text(profile.yongshen.reason)
                    .font(.kaiti(12)).foregroundStyle(AppTheme.stone500).lineSpacing(5)
                    .padding(.horizontal, 20).padding(.bottom, 18)
            }
        }
        .background(Color(red: 250 / 255, green: 248 / 255, blue: 245 / 255), in: RoundedRectangle(cornerRadius: 16))
    }

    private func climateCell(_ title: String, _ value: String, note: String?) -> some View {
        VStack(spacing: 4) {
            Text(title).font(.system(size: 12)).foregroundStyle(AppTheme.stone500)
            Text(value).font(.webSerif(14)).foregroundStyle(AppTheme.stone700)
            if let note { Text(note).font(.system(size: 10)).foregroundStyle(AppTheme.stone400) }
        }
        .frame(maxWidth: .infinity)
    }

    private func ganEnergyItems(_ profile: ReportEnergyProfile) -> [(String, Double, Color)] {
        let percents = profile.percentages.ganDetailed ?? [:]
        let values = profile.ganDetailed ?? [:]
        return percents.keys.sorted { (values[$0] ?? 0) > (values[$1] ?? 0) }
            .filter { (values[$0] ?? 0) > 0 }
            .map { ($0, percents[$0] ?? 0, wuxingColor($0)) }
    }

    private func shishenEnergyItems(_ profile: ReportEnergyProfile) -> [(String, Double, Color)] {
        let percents = profile.percentages.shishenDetailed ?? [:]
        let values = profile.shishenDetailed ?? [:]
        let colors: [String: Color] = [
            "比肩": Color(red: 139 / 255, green: 95 / 255, blue: 69 / 255),
            "劫财": Color(red: 122 / 255, green: 85 / 255, blue: 64 / 255),
            "食神": Color(red: 176 / 255, green: 159 / 255, blue: 115 / 255),
            "伤官": Color(red: 158 / 255, green: 140 / 255, blue: 98 / 255),
            "正财": Color(red: 155 / 255, green: 142 / 255, blue: 120 / 255),
            "偏财": Color(red: 138 / 255, green: 125 / 255, blue: 104 / 255),
            "正官": Color(red: 120 / 255, green: 113 / 255, blue: 108 / 255),
            "七杀": Color(red: 104 / 255, green: 97 / 255, blue: 92 / 255),
            "正印": Color(red: 94 / 255, green: 127 / 255, blue: 99 / 255),
            "枭神": Color(red: 77 / 255, green: 104 / 255, blue: 82 / 255),
        ]
        return percents.keys.sorted { (values[$0] ?? 0) > (values[$1] ?? 0) }
            .filter { (values[$0] ?? 0) > 0 }
            .map { ($0, percents[$0] ?? 0, colors[$0] ?? AppTheme.stone500) }
    }

    private func energyBars(_ title: String, items: [(String, Double, Color)], markMax: Bool = false) -> some View {
        let maxValue = items.map(\.1).max() ?? 0
        return VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.webSerif(14)).foregroundStyle(Color(red: 139 / 255, green: 95 / 255, blue: 69 / 255)).tracking(1.6).frame(maxWidth: .infinity)
            ForEach(items, id: \.0) { item in
                HStack(spacing: 8) {
                    Text(item.0 + (markMax && item.1 == maxValue ? "★" : ""))
                        .font(.webSerif(12)).foregroundStyle(item.2).frame(width: 40, alignment: .trailing)
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(AppTheme.stone100)
                            Capsule().fill(item.2.opacity(markMax && item.1 == maxValue ? 1 : 0.75))
                                .frame(width: geo.size.width * min(item.1 / 100, 1))
                            Text(String(format: "%.1f%%", item.1))
                                .font(.system(size: 10)).foregroundStyle(AppTheme.stone700)
                                .frame(maxWidth: .infinity, alignment: .trailing)
                                .padding(.trailing, 8)
                        }
                    }.frame(height: 22)
                }
            }
        }
    }

    private func luckSection(_ cycles: [ReportLuckCycle], classical: ReportClassical) -> some View {
        VStack(spacing: 16) {
            HStack(spacing: 12) {
                LinearGradient(colors: [.clear, AppTheme.stone300], startPoint: .leading, endPoint: .trailing).frame(height: 1)
                Text("大运 · 流年").font(.webSerif(20)).foregroundStyle(Color(red: 74 / 255, green: 64 / 255, blue: 58 / 255))
                LinearGradient(colors: [AppTheme.stone300, .clear], startPoint: .leading, endPoint: .trailing).frame(height: 1)
            }
            if cycles.isEmpty {
                Text("暂无大运数据").font(.kaiti(13)).foregroundStyle(AppTheme.stone400)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(Array(cycles.enumerated()), id: \.offset) { index, cycle in
                            Button { selectedLuckIndex = index } label: {
                                VStack(spacing: 6) {
                                    Text("\(cycle.startAge)岁").font(.system(size: 10)).foregroundStyle(AppTheme.stone400)
                                    Text(cycle.ganZhi).font(.kaiti(20)).foregroundStyle(wuxingColor(cycle.gan))
                                    Text("\(cycle.gods.gan) · \(cycle.gods.zhi)").font(.system(size: 9)).foregroundStyle(AppTheme.stone500)
                                    Text("\(cycle.startYear)").font(.system(size: 10)).foregroundStyle(AppTheme.stone400)
                                }
                                .padding(.horizontal, 14).padding(.vertical, 12)
                                .background(selectedLuckIndex == index ? Color.white.opacity(0.90) : Color.white.opacity(0.45), in: RoundedRectangle(cornerRadius: 12))
                                .overlay { RoundedRectangle(cornerRadius: 12).stroke(selectedLuckIndex == index ? AppTheme.stone400 : AppTheme.stone200) }
                            }.buttonStyle(.plain)
                        }
                    }
                }
                if cycles.indices.contains(selectedLuckIndex) {
                    let years = cycles[selectedLuckIndex].years
                    let currentYear = Calendar.current.component(.year, from: Date())
                    VStack(spacing: 0) {
                        ForEach(years, id: \.year) { year in
                            HStack {
                                Text("\(year.age)岁").frame(width: 44, alignment: .leading)
                                Text("\(year.year)").frame(width: 52, alignment: .leading)
                                Text(year.ganZhi).font(.kaiti(15)).foregroundStyle(wuxingColor(year.gan ?? String(year.ganZhi.prefix(1))))
                                Spacer()
                                Text(year.gods).font(.system(size: 11)).foregroundStyle(AppTheme.stone500)
                            }
                            .font(.system(size: 12))
                            .foregroundStyle(year.year == currentYear ? AppTheme.stone800 : AppTheme.stone600)
                            .padding(.vertical, 8)
                            .padding(.horizontal, 12)
                            .background(year.year == currentYear ? AppTheme.gold.opacity(0.12) : Color.clear)
                        }
                    }
                    .background(Color.white.opacity(0.40), in: RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }

    private func wuxingColor(_ char: String) -> Color {
        let map: [String: String] = [
            "甲": "木", "乙": "木", "丙": "火", "丁": "火", "戊": "土", "己": "土",
            "庚": "金", "辛": "金", "壬": "水", "癸": "水",
            "子": "水", "丑": "土", "寅": "木", "卯": "木", "辰": "土", "巳": "火",
            "午": "火", "未": "土", "申": "金", "酉": "金", "戌": "土", "亥": "水",
            "木": "木", "火": "火", "土": "土", "金": "金", "水": "水",
        ]
        switch map[char] {
        case "木": return Color(red: 94 / 255, green: 127 / 255, blue: 99 / 255)
        case "火": return Color(red: 186 / 255, green: 93 / 255, blue: 79 / 255)
        case "土": return Color(red: 139 / 255, green: 95 / 255, blue: 69 / 255)
        case "金": return Color(red: 176 / 255, green: 159 / 255, blue: 115 / 255)
        case "水": return Color(red: 79 / 255, green: 126 / 255, blue: 168 / 255)
        default: return AppTheme.stone700
        }
    }

    private func lunarDisplay(_ text: String) -> String {
        let pattern = /^(\d+)年(.+?)月(.+?)\s+(.+)$/
        guard let match = text.firstMatch(of: pattern) else { return text }
        let han = ["0": "零", "1": "一", "2": "二", "3": "三", "4": "四", "5": "五", "6": "六", "7": "七", "8": "八", "9": "九"]
        let year = match.1.map { han[String($0)] ?? String($0) }.joined()
        return "\(year)年\(match.2)月\(match.3)\(match.4)"
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            report = try await APIClient.shared.request("/api/mobile/bazi", method: .POST, json: [
                "action": "report", "params": params,
            ])
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func save() async {
        guard auth.requireAuthentication() else { return }
        saveStatus = .saving
        do {
            try await APIClient.shared.request("/api/records/classical", method: .POST, json: ["params": params])
            saveStatus = .saved
        } catch {
            saveStatus = .error
        }
    }

    private func analyze() async {
        guard !isAnalyzing else { return }
        isAnalyzing = true
        await save()
        guard saveStatus == .saved, let report else { isAnalyzing = false; return }
        flow.openChat(preset: "请帮我解析该八字", importData: ["bazi": [report.importData.mapValues(\.anyValue)]], autoSend: false)
        isAnalyzing = false
        dismiss()
    }
}

private struct CircuitGraphCanvas: View {
    let interactions: ReportInteractions
    let classical: ReportClassical

    var body: some View {
        Canvas { context, size in
            let scaleX = size.width / 800
            let scaleY = size.height / 450
            let scale = min(scaleX, scaleY)
            let offsetX = (size.width - 800 * scale) / 2
            let offsetY = (size.height - 450 * scale) / 2
            func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: offsetX + x * scale, y: offsetY + y * scale)
            }
            let positions: [CGPoint] = [
                point(150, 120), point(300, 120), point(450, 120), point(600, 120),
                point(150, 300), point(300, 300), point(450, 300), point(600, 300),
            ]

            func isAdjacent(_ a: Int, _ b: Int) -> Bool {
                let sameRow = (a < 4 && b < 4) || (a >= 4 && b >= 4)
                if sameRow && abs(a - b) == 1 { return true }
                if abs(a - b) == 4 && a % 4 == b % 4 { return true }
                return false
            }

            let adjacent = interactions.relationships.enumerated().filter { _, rel in
                isAdjacent(rel.sourceIndex ?? 0, rel.targetIndex ?? 0)
            }

            for (index, rel) in adjacent {
                let sourceIdx = rel.sourceIndex ?? 0
                let targetIdx = rel.targetIndex ?? 0
                guard positions.indices.contains(sourceIdx), positions.indices.contains(targetIdx) else { continue }
                let source = positions[sourceIdx]
                let target = positions[targetIdx]
                let style = relationshipStyle(rel.type)
                var path = Path()
                let gan = sourceIdx < 4 && targetIdx < 4
                let zhi = sourceIdx >= 4 && targetIdx >= 4
                if gan || zhi {
                    let offset = (35 + CGFloat(index) * 15) * scale
                    let midY = gan ? source.y - offset : source.y + offset
                    path.move(to: source)
                    path.addLine(to: CGPoint(x: source.x, y: midY))
                    path.addLine(to: CGPoint(x: target.x, y: midY))
                    path.addLine(to: target)
                } else {
                    path.move(to: source)
                    path.addLine(to: target)
                }
                context.stroke(path, with: .color(style.color.opacity(style.opacity)), style: StrokeStyle(lineWidth: style.width * scale, lineCap: .round, lineJoin: .round, dash: style.dash.map { $0 * scale }))
                let mid = gan || zhi
                    ? CGPoint(x: (source.x + target.x) / 2, y: gan ? source.y - (35 + CGFloat(index) * 15) * scale : source.y + (35 + CGFloat(index) * 15) * scale)
                    : CGPoint(x: (source.x + target.x) / 2, y: (source.y + target.y) / 2)
                let labelSize = CGSize(width: 40 * scale, height: 16 * scale)
                let rect = CGRect(x: mid.x - labelSize.width / 2, y: mid.y - labelSize.height / 2, width: labelSize.width, height: labelSize.height)
                context.fill(Path(roundedRect: rect, cornerRadius: 8 * scale), with: .color(.white.opacity(0.95)))
                context.stroke(Path(roundedRect: rect, cornerRadius: 8 * scale), with: .color(style.color), lineWidth: 0.5 * scale)
                context.draw(context.resolve(Text(rel.label).font(.system(size: 9 * scale)).foregroundStyle(style.color)), at: mid, anchor: .center)
            }

            for flow in interactions.flows {
                let sourceIdx = flow.sourceIndex ?? 0
                let targetIdx = flow.targetIndex ?? 0
                let diff = abs(sourceIdx - targetIdx)
                guard diff == 1 || (diff == 4 && sourceIdx % 4 == targetIdx % 4) else { continue }
                guard positions.indices.contains(sourceIdx), positions.indices.contains(targetIdx) else { continue }
                let source = positions[sourceIdx]
                let target = positions[targetIdx]
                let dx = target.x - source.x
                let dy = target.y - source.y
                let distance = max(hypot(dx, dy), 1)
                let offset = 25 * scale
                let start = CGPoint(x: source.x + dx / distance * offset, y: source.y + dy / distance * offset)
                let end = CGPoint(x: target.x - dx / distance * offset, y: target.y - dy / distance * offset)
                let isSheng = flow.type == "Sheng"
                let color = (isSheng ? Color(red: 127 / 255, green: 166 / 255, blue: 138 / 255) : Color(red: 186 / 255, green: 93 / 255, blue: 79 / 255)).opacity(0.40)
                var line = Path()
                line.move(to: start)
                line.addLine(to: end)
                context.stroke(line, with: .color(color), style: StrokeStyle(lineWidth: 1.2 * scale, dash: isSheng ? [] : [3 * scale, 2 * scale]))
                let angle = atan2(end.y - start.y, end.x - start.x)
                var arrow = Path()
                arrow.move(to: end)
                arrow.addLine(to: CGPoint(x: end.x - 6 * scale * cos(angle - 0.4), y: end.y - 6 * scale * sin(angle - 0.4)))
                arrow.addLine(to: CGPoint(x: end.x - 6 * scale * cos(angle + 0.4), y: end.y - 6 * scale * sin(angle + 0.4)))
                arrow.closeSubpath()
                context.fill(arrow, with: .color(color))
            }

            let nodes = resolvedNodes
            for (index, node) in nodes.enumerated() where positions.indices.contains(index) {
                let pos = positions[index]
                let color = nodeColor(node.wuxing.isEmpty ? node.text : node.wuxing)
                let radius = 24 * scale
                context.fill(Path(ellipseIn: CGRect(x: pos.x - radius, y: pos.y - radius, width: radius * 2, height: radius * 2)), with: .color(Color(red: 251 / 255, green: 249 / 255, blue: 244 / 255)))
                context.stroke(Path(ellipseIn: CGRect(x: pos.x - radius, y: pos.y - radius, width: radius * 2, height: radius * 2)), with: .color(color), lineWidth: 2.5 * scale)
                context.draw(context.resolve(Text(node.text).font(.webSerif(20 * scale)).foregroundStyle(color)), at: pos, anchor: .center)
            }

            for (index, label) in ["年柱", "月柱", "日柱", "时柱"].enumerated() {
                context.draw(
                    context.resolve(Text(label).font(.webSerif(12 * scale)).foregroundStyle(Color(red: 168 / 255, green: 162 / 255, blue: 158 / 255))),
                    at: point(150 + CGFloat(index) * 150, 60),
                    anchor: .center
                )
            }
        }
        .accessibilityLabel("八字关系图谱")
    }

    private var resolvedNodes: [ReportGraphNode] {
        if !interactions.nodes.isEmpty { return interactions.nodes }
        let keys = ["year", "month", "day", "hour"]
        let gans = keys.map { ReportGraphNode(id: "\($0)-gan", text: classical.pillars[$0]?.gan ?? "—", wuxing: classical.pillars[$0]?.wuxing ?? "", pillar: $0, type: "gan") }
        let zhis = keys.map { ReportGraphNode(id: "\($0)-zhi", text: classical.pillars[$0]?.zhi ?? "—", wuxing: "", pillar: $0, type: "zhi") }
        return gans + zhis
    }

    private func relationshipStyle(_ type: String) -> (color: Color, width: CGFloat, dash: [CGFloat], opacity: Double) {
        switch type {
        case "He", "LiuHe", "SanHe", "SanHui", "TianGanHe", "DiZhiHe":
            return (Color(red: 127 / 255, green: 166 / 255, blue: 138 / 255), 1.5, [], 0.70)
        case "Chong":
            return (Color(red: 186 / 255, green: 93 / 255, blue: 79 / 255), 1.5, [4, 3], 0.60)
        case "Xing":
            return (Color(red: 155 / 255, green: 142 / 255, blue: 120 / 255), 1.2, [2, 2], 0.50)
        case "Hai":
            return (Color(red: 140 / 255, green: 118 / 255, blue: 88 / 255), 1.2, [3, 2], 0.50)
        default:
            return (Color(red: 168 / 255, green: 162 / 255, blue: 158 / 255), 1, [], 0.40)
        }
    }

    private func nodeColor(_ char: String) -> Color {
        let map: [String: String] = [
            "甲": "木", "乙": "木", "丙": "火", "丁": "火", "戊": "土", "己": "土",
            "庚": "金", "辛": "金", "壬": "水", "癸": "水",
            "子": "水", "丑": "土", "寅": "木", "卯": "木", "辰": "土", "巳": "火",
            "午": "火", "未": "土", "申": "金", "酉": "金", "戌": "土", "亥": "水",
            "木": "木", "火": "火", "土": "土", "金": "金", "水": "水",
        ]
        switch map[char] {
        case "木": return Color(red: 94 / 255, green: 127 / 255, blue: 99 / 255)
        case "火": return Color(red: 186 / 255, green: 93 / 255, blue: 79 / 255)
        case "土": return Color(red: 139 / 255, green: 95 / 255, blue: 69 / 255)
        case "金": return Color(red: 176 / 255, green: 159 / 255, blue: 115 / 255)
        case "水": return Color(red: 79 / 255, green: 126 / 255, blue: 168 / 255)
        default: return Color(red: 68 / 255, green: 64 / 255, blue: 60 / 255)
        }
    }
}

private struct ReportPayload: Decodable {
    let classical: ReportClassical
    let interactions: ReportInteractions
    let textual: ReportTextual
    let energyProfile: ReportEnergyProfile
    let luckCycles: [ReportLuckCycle]
    let displayInfo: ReportDisplayInfo
    let importData: [String: JSONValue]
}

private struct ReportDisplayInfo: Decodable {
    let name: String
    let gender: String
    let solarDate: String
    let lunarDate: String
    let isInferred: Bool
}

private struct ReportClassical: Decodable {
    let pillars: [String: ReportPillar]
    let dayMaster: ReportDayMaster
    let hiddenStems: [String: [ReportHiddenStem]]
    let nayin: [String: String]
    let tenGods: ReportTenGods
    let shenSha: [String: [String]]
    let lifeCycle: [String: String]
    let selfSeat: [String: String]
    let kongWang: [String: String]
}

private struct ReportPillar: Decodable { let gan: String; let zhi: String; let wuxing: String }
private struct ReportDayMaster: Decodable { let gan: String; let wuxing: String; let tenGod: String }
private struct ReportHiddenStem: Decodable { let gan: String; let wuxing: String; let tenGod: String }
private struct ReportTenGods: Decodable {
    let stems: [String: String]
    let hidden: [String: [String]]
}

private struct ReportInteractions: Decodable {
    let nodes: [ReportGraphNode]
    let flows: [ReportEnergyFlow]
    let relationships: [ReportRelationship]

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        nodes = try values.decodeIfPresent([ReportGraphNode].self, forKey: .nodes) ?? []
        flows = try values.decodeIfPresent([ReportEnergyFlow].self, forKey: .flows) ?? []
        relationships = try values.decodeIfPresent([ReportRelationship].self, forKey: .relationships) ?? []
    }
    enum CodingKeys: String, CodingKey { case nodes, flows, relationships }
}

private struct ReportGraphNode: Decodable {
    let id: String
    let text: String
    let wuxing: String
    let pillar: String
    let type: String
}

private struct ReportEnergyFlow: Decodable {
    let type: String
    let sourceIndex: Int?
    let targetIndex: Int?
}

private struct ReportRelationship: Decodable {
    let label: String
    let type: String
    let sourceIndex: Int?
    let targetIndex: Int?
    let chars: [String]

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        label = try values.decodeIfPresent(String.self, forKey: .label) ?? ""
        type = try values.decodeIfPresent(String.self, forKey: .type) ?? ""
        sourceIndex = try values.decodeIfPresent(Int.self, forKey: .sourceIndex)
        targetIndex = try values.decodeIfPresent(Int.self, forKey: .targetIndex)
        chars = try values.decodeIfPresent([String].self, forKey: .chars) ?? []
    }
    enum CodingKeys: String, CodingKey { case label, type, sourceIndex, targetIndex, chars }
}

private struct ReportTextual: Decodable {
    let stems: [String]
    let branches: [String]
    let pillars: [String]
}

private struct ReportEnergyProfile: Decodable {
    let percentages: ReportEnergyPercents
    let status: ReportEnergyStatus
    let climate: ReportClimate
    let yongshen: ReportYongshen
    let ganDetailed: [String: Double]?
    let shishenDetailed: [String: Double]?
}

private struct ReportEnergyPercents: Decodable {
    let wuxing: [String: Double]
    let ganDetailed: [String: Double]?
    let shishenDetailed: [String: Double]?
}

private struct ReportEnergyStatus: Decodable {
    let level: String
    let score: Double
    let percent: Double
    let pattern: String
}

private struct ReportClimate: Decodable {
    let level: String
    let needGod: String
    let isDry: Bool?
    let isWet: Bool?
    let tempScore: Double?
}

private struct ReportYongshen: Decodable {
    let climate: String
    let balance: String
    let final: String
    let reason: String
}

private struct ReportLuckCycle: Decodable {
    let startAge: Int
    let startYear: Int
    let ganZhi: String
    let gan: String
    let zhi: String
    let gods: ReportLuckGods
    let years: [ReportLuckYear]
}

private struct ReportLuckGods: Decodable { let gan: String; let zhi: String }

private struct ReportLuckYear: Decodable {
    let age: Int
    let year: Int
    let ganZhi: String
    let gan: String?
    let zhi: String?
    let gods: String
}

private extension Color {
    static let reportStone50 = Color(red: 250 / 255, green: 250 / 255, blue: 249 / 255)
}

private extension AppTheme {
    static var stone50: Color { .reportStone50 }
}
