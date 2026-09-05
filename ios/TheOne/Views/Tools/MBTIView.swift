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
                        title: "八卦人格",
                        subtitle: "八卦定其性，八门观其位"
                    )
                    .id("mbti-top")

                    Group {
                        if isLoading {
                            ProgressView("正在展开观心题卷…")
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

    private var primaryCode: String { BaguaPersonality.stacks[value.type]?.first ?? "Ni" }
    private var supportingCode: String { BaguaPersonality.stacks[value.type]?.dropFirst().first ?? "Fe" }

    var body: some View {
        VStack(spacing: 18) {
            VStack(spacing: 16) {
                HStack(spacing: 34) {
                    VStack(spacing: 7) {
                        Text("开门").font(.system(size: 9)).tracking(1.8).foregroundStyle(AppTheme.stone400)
                        NativeBaguaGlyph(code: primaryCode, width: 36, lineHeight: 2.5)
                        Text(BaguaPersonality.label(for: primaryCode)).font(.kaiti(12)).foregroundStyle(AppTheme.stone600)
                    }
                    Rectangle().fill(AppTheme.hairline).frame(width: 1, height: 54)
                    VStack(spacing: 7) {
                        Text("休门").font(.system(size: 9)).tracking(1.8).foregroundStyle(AppTheme.stone400)
                        NativeBaguaGlyph(code: supportingCode, width: 36, lineHeight: 2.5)
                        Text(BaguaPersonality.label(for: supportingCode)).font(.kaiti(12)).foregroundStyle(AppTheme.stone600)
                    }
                }
                if let detail = value.detail {
                    Text(detail.name).font(.webSerif(32)).foregroundStyle(AppTheme.ink)
                    if let origin = value.detail?.origin, !origin.isEmpty {
                        Text(origin)
                            .font(.system(size: 11)).tracking(1.2)
                            .foregroundStyle(AppTheme.stone500)
                            .padding(.horizontal, 12).padding(.vertical, 6)
                            .overlay { Capsule().stroke(AppTheme.hairline) }
                    }
                    Text(BaguaPersonality.present(detail.slogan))
                        .font(.kaiti(14)).foregroundStyle(AppTheme.stone600).multilineTextAlignment(.center)
                }
                Text("拟合度 \(Int(value.fitScore.rounded()))% · 阴影原型 \(BaguaPersonality.personalityName(for: value.shadowType))")
                    .font(.system(size: 11)).tracking(0.8).foregroundStyle(AppTheme.stone400)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 24).padding(.vertical, 32)
            .background(AppTheme.background, in: RoundedRectangle(cornerRadius: 14))
            .overlay {
                RoundedRectangle(cornerRadius: 14).stroke(AppTheme.stone300.opacity(0.72))
                    .padding(4)
                    .overlay { RoundedRectangle(cornerRadius: 17).stroke(AppTheme.hairline) }
            }

            VStack(spacing: 8) {
                Text("八卦心势图").font(.webSerif(16)).foregroundStyle(AppTheme.stone800)
                CognitiveRadar(
                    values: BaguaPersonality.chartOrder.map { value.functionStrengths[$0] ?? 0 },
                    labels: BaguaPersonality.chartOrder.map { BaguaPersonality.dimension(for: $0)?.trigram ?? "—" }
                )
                .frame(height: 240)
            }
            .padding(16)
            .background(Color.white.opacity(0.54), in: RoundedRectangle(cornerRadius: 12))
            .overlay { RoundedRectangle(cornerRadius: 12).stroke(AppTheme.stone200.opacity(0.55)) }

            VStack(spacing: 13) {
                ForEach(BaguaPersonality.chartOrder, id: \.self) { function in
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
                    Text("八门心盘").font(.webSerif(16)).foregroundStyle(AppTheme.stone800)
                    Text("八卦为心势，八门为其作用位置").font(.system(size: 11)).foregroundStyle(AppTheme.stone500)
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 2), spacing: 8) {
                        ForEach(0..<8, id: \.self) { index in
                            let slot = value.userSlots["\(index)"]
                            let door = BaguaPersonality.doors[index]
                            let isDeviation = slot?.function != BaguaPersonality.stacks[value.type]?[index]
                            VStack(spacing: 7) {
                                Text("\(door.layer) · \(door.door)")
                                    .font(.system(size: 9)).tracking(1.2).foregroundStyle(index < 4 ? AppTheme.stone500 : AppTheme.stone400)
                                Text(door.role).font(.system(size: 10)).foregroundStyle(AppTheme.stone500)
                                if let code = slot?.function, BaguaPersonality.dimension(for: code) != nil {
                                    HStack(spacing: 7) {
                                        NativeBaguaGlyph(code: code, width: 24, lineHeight: 1.8, color: index < 4 ? AppTheme.stone800 : AppTheme.stone600)
                                        Text(BaguaPersonality.label(for: code)).font(.kaiti(13)).foregroundStyle(index < 4 ? AppTheme.stone800 : AppTheme.stone600)
                                    }
                                }
                                Text(String(format: "%.1f分", slot?.score ?? 0)).font(.system(size: 10)).foregroundStyle(AppTheme.stone400)
                                if slot?.hasConflict == true, let other = slot?.conflictWith, !other.isEmpty {
                                    Text("并见 \(BaguaPersonality.label(for: other))").font(.system(size: 9)).foregroundStyle(AppTheme.gold)
                                } else if isDeviation {
                                    Text("原型之外").font(.system(size: 9)).tracking(0.8).foregroundStyle(AppTheme.stone400)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: 128)
                            .padding(.vertical, 12)
                            .background(index < 4 ? Color(red: 250 / 255, green: 250 / 255, blue: 249 / 255) : Color(red: 245 / 255, green: 245 / 255, blue: 244 / 255), in: RoundedRectangle(cornerRadius: 10))
                            .overlay { RoundedRectangle(cornerRadius: 10).stroke(slot?.hasConflict == true ? AppTheme.gold.opacity(0.50) : AppTheme.stone200) }
                        }
                    }
                    Text("“阳面 / 阴面”仅指本测试中的心理层次，不等同于传统奇门遁甲的吉凶分类。")
                        .font(.kaiti(10.5)).foregroundStyle(AppTheme.stone400).lineSpacing(4).multilineTextAlignment(.center)
                        .padding(.top, 5)
                }
                .padding(18)
                .background(Color.white.opacity(0.70), in: RoundedRectangle(cornerRadius: 12))
                .overlay { RoundedRectangle(cornerRadius: 12).stroke(AppTheme.stone200.opacity(0.50)) }
            }

            if let detail = value.detail {
                MBTITextSection(title: "本 命 指 引", text: BaguaPersonality.present(detail.guide))
                MBTITextSection(title: "深 层 画 像", text: BaguaPersonality.present(detail.deepProfile))
                MBTITextSection(title: "天 赋", text: BaguaPersonality.present(detail.strengths))
                MBTITextSection(title: "功 课", text: BaguaPersonality.present(detail.weaknesses))
                MBTITextSection(title: "阴 影", text: BaguaPersonality.present(detail.shadow))
                MBTITextSection(title: "修 行 建 议", text: BaguaPersonality.present(detail.advice))

                ForEach(Array(detail.functions.enumerated()), id: \.offset) { index, function in
                    let door = BaguaPersonality.doors[min(index, BaguaPersonality.doors.count - 1)]
                    let stack = BaguaPersonality.stacks[value.type] ?? []
                    let code = stack.indices.contains(index) ? stack[index] : nil
                    VStack(alignment: .leading, spacing: 12) {
                        Text("\(door.layer) · \(door.door) · \(door.role)").font(.system(size: 10)).tracking(1.4).foregroundStyle(AppTheme.stone400)
                        HStack(spacing: 10) {
                            if let code { NativeBaguaGlyph(code: code, width: 27, lineHeight: 2) }
                            Text(BaguaPersonality.label(for: code)).font(.webSerif(18)).foregroundStyle(AppTheme.stone800)
                        }
                        Text(BaguaPersonality.present(function.logic)).font(.kaiti(13)).foregroundStyle(AppTheme.stone600).lineSpacing(7)
                        Divider().overlay(AppTheme.stone200)
                        Text(BaguaPersonality.present(function.lesson)).font(.kaiti(13)).foregroundStyle(AppTheme.stone700).lineSpacing(7)
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
            HStack(spacing: 7) {
                NativeBaguaGlyph(code: function, width: 20, lineHeight: 1.5, color: AppTheme.stone600)
                Text(BaguaPersonality.label(for: function)).font(.kaiti(11)).foregroundStyle(AppTheme.stone600)
            }
            .frame(width: 78, alignment: .leading)
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
