import SwiftUI

/// 原网页 MbtiTestView 的原生呈现：26 题、题序与选项随机、每项 0...5 分，
/// 结果由服务端直接运行同一套八维宫位 / Gearing / Radar Matching 算法。
struct MBTIView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var questions: [MBTIQuestion] = []
    @State private var index = 0
    @State private var answers: [Int: [String: Int]] = [:]
    @State private var result: MBTITestResult?
    @State private var isLoading = true
    @State private var isCalculating = false
    @State private var saveState = ""
    @State private var errorMessage: String?

    private var currentQuestion: MBTIQuestion? {
        questions.indices.contains(index) ? questions[index] : nil
    }

    private var currentWeights: [String: Int] {
        guard let question = currentQuestion else { return [:] }
        return answers[question.id] ?? [:]
    }

    private var totalAllocated: Int { currentWeights.values.reduce(0, +) }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    LegacyPageHeader(
                        symbol: .guanxin,
                        title: "荣格八维",
                        subtitle: "知己即知天，请成为自己的答案"
                    )
                    .id("mbti-top")

                    Group {
                        if isLoading {
                            ProgressView("正在展开八维题卷…")
                                .font(.kaiti(12))
                                .padding(.top, 80)
                        } else if let result {
                            resultView(result)
                        } else if let question = currentQuestion {
                            questionView(question)
                        } else {
                            Text(errorMessage ?? "题卷暂时无法读取")
                                .font(.kaiti(13))
                                .foregroundStyle(AppTheme.cinnabar)
                        }
                    }
                    .padding(.bottom, 135)
                }
                .padding(.horizontal, 24)
            }
            .onChange(of: index) { _, _ in
                withAnimation(.easeInOut(duration: 0.30)) { proxy.scrollTo("mbti-top", anchor: .top) }
            }
        }
        .background(AppTheme.background)
        .task { if questions.isEmpty { await loadQuestions() } }
    }

    private func questionView(_ question: MBTIQuestion) -> some View {
        VStack(spacing: 24) {
            VStack(spacing: 8) {
                HStack {
                    Text("问题 \(index + 1) / \(questions.count)")
                    Spacer()
                    Text("已分配 \(totalAllocated) 分")
                        .foregroundStyle(totalAllocated > 0 ? AppTheme.stone700 : Color.orange.opacity(0.85))
                }
                .font(.system(size: 11))
                .foregroundStyle(AppTheme.stone500)

                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Capsule().fill(AppTheme.stone200).frame(height: 4)
                        Capsule().fill(AppTheme.stone700)
                            .frame(width: geometry.size.width * CGFloat(index + 1) / CGFloat(max(1, questions.count)), height: 4)
                    }
                }
                .frame(height: 4)
            }

            VStack(alignment: .leading, spacing: 20) {
                Text(question.question)
                    .font(.webSerif(16))
                    .foregroundStyle(AppTheme.stone800)
                    .fixedSize(horizontal: false, vertical: true)

                ForEach(question.options) { option in
                    MBTIOptionCard(
                        option: option,
                        value: currentWeights[option.id] ?? 0,
                        update: { setWeight($0, for: option.id, questionID: question.id) }
                    )
                }
            }
            .padding(24)
            .background(Color.white.opacity(0.60), in: RoundedRectangle(cornerRadius: 9))
            .overlay { RoundedRectangle(cornerRadius: 9).stroke(AppTheme.stone200.opacity(0.50)) }
            .shadow(color: .black.opacity(0.025), radius: 3, y: 1)

            HStack(spacing: 12) {
                Button("上一题") {
                    withAnimation(.easeInOut(duration: 0.30)) { index = max(0, index - 1) }
                }
                .disabled(index == 0)
                .foregroundStyle(index == 0 ? AppTheme.stone300 : AppTheme.stone700)
                .frame(maxWidth: .infinity).frame(height: 46)
                .overlay { RoundedRectangle(cornerRadius: 8).stroke(index == 0 ? AppTheme.stone200 : AppTheme.stone300) }

                Button {
                    if index == questions.count - 1 { Task { await calculate() } }
                    else { withAnimation(.easeInOut(duration: 0.30)) { index += 1 } }
                } label: {
                    HStack(spacing: 7) {
                        if isCalculating { ProgressView().tint(.white).controlSize(.small) }
                        Text(index == questions.count - 1 ? "查看结果" : "下一题")
                        if totalAllocated > 0 && !isCalculating { Image(systemName: "chevron.right").font(.system(size: 10)) }
                    }
                }
                .disabled(totalAllocated < 1 || isCalculating)
                .foregroundStyle(totalAllocated > 0 ? Color.white : AppTheme.stone400)
                .frame(maxWidth: .infinity).frame(height: 46)
                .background(totalAllocated > 0 ? AppTheme.stone700 : AppTheme.stone200, in: RoundedRectangle(cornerRadius: 8))
            }
            .font(.system(size: 14))

            if let errorMessage {
                Text(errorMessage).font(.kaiti(12)).foregroundStyle(AppTheme.cinnabar)
            }
        }
    }

    private func resultView(_ value: MBTITestResult) -> some View {
        VStack(spacing: 18) {
            MBTIResultContent(value: value)
            HStack(spacing: 12) {
                Button(saveState.isEmpty ? "保存结果" : saveState) { Task { await save(value) } }
                    .disabled(saveState == "已保存")
                    .frame(maxWidth: .infinity).frame(height: 46)
                    .overlay { RoundedRectangle(cornerRadius: 10).stroke(AppTheme.stone300) }
                Button("重新测试") { restart() }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity).frame(height: 46)
                    .background(AppTheme.stone700, in: RoundedRectangle(cornerRadius: 10))
            }
            .font(.system(size: 13))
        }
    }

    private func loadQuestions() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response: MBTIQuestionEnvelope = try await APIClient.shared.request("/api/mobile/mbti")
            questions = response.questions.shuffled().map { source in
                var question = source
                question.options.shuffle()
                return question
            }
        } catch { errorMessage = error.localizedDescription }
    }

    private func setWeight(_ value: Int, for optionID: String, questionID: Int) {
        var weights = answers[questionID] ?? [:]
        weights[optionID] = min(5, max(0, value))
        answers[questionID] = weights
    }

    private func calculate() async {
        isCalculating = true
        errorMessage = nil
        defer { isCalculating = false }
        let payload = questions.map { question in
            ["questionId": question.id, "weights": answers[question.id] ?? [:]] as [String: Any]
        }
        do {
            let calculated: MBTITestResult = try await APIClient.shared.request("/api/mobile/mbti", method: .POST, json: ["answers": payload])
            result = calculated
            if auth.isAuthenticated { await save(calculated) }
        } catch { errorMessage = error.localizedDescription }
    }

    private func save(_ value: MBTITestResult) async {
        guard auth.requireAuthentication() else { return }
        saveState = "保存中…"
        let slots = value.userSlots.mapValues { slot in
            ["function": slot.function, "score": slot.score, "hasConflict": slot.hasConflict ?? false, "conflictWith": slot.conflictWith ?? ""] as [String: Any]
        }
        do {
            try await APIClient.shared.request("/api/records/mbti", method: .POST, json: [
                "type": value.type,
                "function_scores": value.functionScores,
                "user_slots": slots,
                "function_strengths": value.functionStrengths,
                "ideal_strengths": value.idealStrengths,
                "fit_score": value.fitScore,
                "shadow_type": value.shadowType,
            ])
            saveState = "已保存"
        } catch {
            saveState = "保存失败"
            errorMessage = error.localizedDescription
        }
    }

    private func restart() {
        questions = questions.shuffled().map { source in
            var question = source
            question.options.shuffle()
            return question
        }
        answers = [:]
        result = nil
        index = 0
        saveState = ""
        errorMessage = nil
    }
}

private struct MBTIOptionCard: View {
    let option: MBTIOption
    let value: Int
    let update: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            styledOptionText
                .font(.system(size: 13))
                .foregroundStyle(AppTheme.stone700)
                .lineSpacing(5)
            HStack {
                Text("分配分数").font(.system(size: 10)).foregroundStyle(AppTheme.stone500)
                Spacer()
                Text("\(value) 分").font(.system(size: 15, weight: .medium)).foregroundStyle(AppTheme.stone800)
            }
            Slider(
                value: Binding(get: { Double(value) }, set: { update(Int($0.rounded())) }),
                in: 0...5,
                step: 1
            )
            .tint(AppTheme.stone600)
            HStack { Text("0分"); Spacer(); Text("5分") }
                .font(.system(size: 9)).foregroundStyle(AppTheme.stone400)
        }
        .padding(16)
        .background(value > 0 ? AppTheme.stone200.opacity(0.25) : Color.white.opacity(0.45), in: RoundedRectangle(cornerRadius: 8))
        .overlay { RoundedRectangle(cornerRadius: 8).stroke(value > 0 ? AppTheme.stone400 : AppTheme.stone200) }
        .animation(.easeInOut(duration: 0.20), value: value)
    }

    private var styledOptionText: Text {
        option.text
            .components(separatedBy: "**")
            .enumerated()
            .reduce(Text("")) { result, item in
                result + Text(item.element).fontWeight(item.offset.isMultiple(of: 2) ? .regular : .semibold)
            }
    }
}

struct MBTIResultContent: View {
    let value: MBTITestResult

    private let slotNames = ["主导", "辅助", "儿童", "劣势", "对立", "批评", "盲点", "恶魔"]
    private let functions = ["Se", "Si", "Ne", "Ni", "Te", "Ti", "Fe", "Fi"]

    var body: some View {
        VStack(spacing: 18) {
            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(LinearGradient(colors: [AppTheme.stone800, Color.black.opacity(0.88)], startPoint: .topLeading, endPoint: .bottomTrailing))
                VStack(spacing: 14) {
                    if let origin = value.detail?.origin, !origin.isEmpty {
                        Text(origin)
                            .font(.system(size: 11)).tracking(1.2)
                            .foregroundStyle(Color.white.opacity(0.72))
                            .padding(.horizontal, 12).padding(.vertical, 6)
                            .background(Color.white.opacity(0.10), in: Capsule())
                    }
                    if let detail = value.detail {
                        Text(detail.name).font(.webSerif(32)).foregroundStyle(.white)
                    }
                    Text(value.type)
                        .font(.system(size: 22, weight: .medium, design: .monospaced))
                        .tracking(6)
                        .foregroundStyle(Color.white.opacity(0.62))
                    if let detail = value.detail {
                        Text(detail.slogan).font(.kaiti(14)).foregroundStyle(Color.white.opacity(0.78)).multilineTextAlignment(.center)
                    }
                    Text("拟合度 \(Int(value.fitScore.rounded()))% · 阴影人格 \(value.shadowType)")
                        .font(.system(size: 11)).tracking(1).foregroundStyle(Color.white.opacity(0.50))
                }
                .padding(.horizontal, 24).padding(.vertical, 36)
            }

            CognitiveRadar(values: functions.map { value.functionStrengths[$0] ?? 0 }, labels: functions)
                .frame(height: 240)
                .padding(16)
                .background(Color.white.opacity(0.62), in: RoundedRectangle(cornerRadius: 12))
                .overlay { RoundedRectangle(cornerRadius: 12).stroke(AppTheme.stone200.opacity(0.55)) }

            VStack(spacing: 13) {
                ForEach(functions, id: \.self) { function in
                    CognitiveFunctionBar(
                        function: function,
                        value: value.functionStrengths[function] ?? 0,
                        maximum: max(1, value.functionStrengths.values.max() ?? 1)
                    )
                }
            }
            .padding(20)
            .background(Color.white.opacity(0.55), in: RoundedRectangle(cornerRadius: 12))
            .overlay { RoundedRectangle(cornerRadius: 12).stroke(AppTheme.stone200.opacity(0.55)) }

            if !value.userSlots.isEmpty {
                VStack(spacing: 10) {
                    Text("心灵星盘").font(.webSerif(16)).foregroundStyle(AppTheme.stone800)
                    Text("你在每个心理位置上的主导功能").font(.system(size: 11)).foregroundStyle(AppTheme.stone500)
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
                        ForEach(0..<8, id: \.self) { index in
                            let slot = value.userSlots["\(index)"]
                            VStack(spacing: 4) {
                                Text("\(index + 1). \(slotNames[index])")
                                    .font(.system(size: 10)).foregroundStyle(index < 4 ? AppTheme.stone500 : AppTheme.stone400)
                                HStack(spacing: 2) {
                                    Text(slot?.function ?? "—").font(.system(size: 16, design: .monospaced)).foregroundStyle(AppTheme.stone800)
                                    if slot?.hasConflict == true, let other = slot?.conflictWith, !other.isEmpty {
                                        Text("⚡").font(.system(size: 10))
                                        Text(other).font(.system(size: 16, design: .monospaced)).foregroundStyle(AppTheme.stone600)
                                    }
                                }
                                Text(String(format: "%.1f分", slot?.score ?? 0)).font(.system(size: 10)).foregroundStyle(AppTheme.stone400)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(index < 4 ? Color(red: 250 / 255, green: 250 / 255, blue: 249 / 255) : Color(red: 245 / 255, green: 245 / 255, blue: 244 / 255), in: RoundedRectangle(cornerRadius: 10))
                            .overlay { RoundedRectangle(cornerRadius: 10).stroke(slot?.hasConflict == true ? AppTheme.gold.opacity(0.50) : AppTheme.stone200) }
                        }
                    }
                }
                .padding(18)
                .background(Color.white.opacity(0.70), in: RoundedRectangle(cornerRadius: 12))
                .overlay { RoundedRectangle(cornerRadius: 12).stroke(AppTheme.stone200.opacity(0.50)) }
            }

            if let detail = value.detail {
                MBTITextSection(title: "本 命 指 引", text: detail.guide)
                MBTITextSection(title: "深 层 画 像", text: detail.deepProfile)
                MBTITextSection(title: "天 赋", text: detail.strengths)
                MBTITextSection(title: "功 课", text: detail.weaknesses)
                MBTITextSection(title: "阴 影", text: detail.shadow)
                MBTITextSection(title: "修 行 建 议", text: detail.advice)

                ForEach(detail.functions) { function in
                    VStack(alignment: .leading, spacing: 12) {
                        Text(function.pos).font(.system(size: 10)).tracking(2).foregroundStyle(AppTheme.stone400)
                        Text(function.title).font(.webSerif(18)).foregroundStyle(AppTheme.stone800)
                        Text(function.logic).font(.kaiti(13)).foregroundStyle(AppTheme.stone600).lineSpacing(7)
                        Divider().overlay(AppTheme.stone200)
                        Text(function.lesson).font(.kaiti(13)).foregroundStyle(AppTheme.stone700).lineSpacing(7)
                    }
                    .padding(20)
                    .background(Color.white.opacity(0.52), in: RoundedRectangle(cornerRadius: 12))
                    .overlay { RoundedRectangle(cornerRadius: 12).stroke(AppTheme.stone200.opacity(0.55)) }
                }
            }
        }
    }
}

private struct CognitiveRadar: View {
    let values: [Double]
    let labels: [String]

    var body: some View {
        Canvas { context, size in
            let center = CGPoint(x: size.width / 2, y: size.height / 2 + 6)
            let radius = min(size.width, size.height) * 0.36
            let count = values.count
            let maxValue = max(values.max() ?? 1, 1)
            func point(_ index: Int, scale: CGFloat) -> CGPoint {
                let angle = (Double(index) / Double(count) * 2 * .pi) - .pi / 2
                return CGPoint(x: center.x + cos(angle) * radius * scale, y: center.y + sin(angle) * radius * scale)
            }
            for ring in [0.33, 0.66, 1.0] {
                var path = Path()
                for index in 0..<count {
                    let p = point(index, scale: ring)
                    if index == 0 { path.move(to: p) } else { path.addLine(to: p) }
                }
                path.closeSubpath()
                context.stroke(path, with: .color(AppTheme.stone200), lineWidth: 1)
            }
            var data = Path()
            for index in 0..<count {
                let p = point(index, scale: CGFloat(values[index] / maxValue))
                if index == 0 { data.move(to: p) } else { data.addLine(to: p) }
            }
            data.closeSubpath()
            context.fill(data, with: .color(AppTheme.stone700.opacity(0.18)))
            context.stroke(data, with: .color(AppTheme.stone700.opacity(0.70)), lineWidth: 1.4)
            for index in 0..<count {
                context.draw(
                    context.resolve(Text(labels[index]).font(.system(size: 11, design: .monospaced)).foregroundStyle(AppTheme.stone600)),
                    at: point(index, scale: 1.22),
                    anchor: .center
                )
            }
        }
    }
}

private struct CognitiveFunctionBar: View {
    let function: String
    let value: Double
    let maximum: Double
    var body: some View {
        HStack(spacing: 12) {
            Text(function).font(.system(size: 12, design: .monospaced)).frame(width: 24)
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule().fill(AppTheme.stone200)
                    Capsule().fill(AppTheme.stone600).frame(width: geometry.size.width * value / maximum)
                }
            }.frame(height: 6)
            Text(value.formatted(.number.precision(.fractionLength(1))))
                .font(.system(size: 10, design: .monospaced)).foregroundStyle(AppTheme.stone500).frame(width: 34, alignment: .trailing)
        }
    }
}

private struct MBTITextSection: View {
    let title: String
    let text: String
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.system(size: 10)).tracking(2.5).foregroundStyle(AppTheme.stone400)
            Text(text).font(.kaiti(13.5)).foregroundStyle(AppTheme.stone600).lineSpacing(8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(Color.white.opacity(0.52), in: RoundedRectangle(cornerRadius: 12))
        .overlay { RoundedRectangle(cornerRadius: 12).stroke(AppTheme.stone200.opacity(0.55)) }
    }
}
