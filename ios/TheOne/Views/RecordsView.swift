import SwiftUI

enum RecordsKind: String, Identifiable {
    case classical, mbti, liuyao
    var id: String { rawValue }
}

struct RecordsView: View {
    var body: some View {
        ZStack {
            AmbientBackground()
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: UIContract.Spacing.sm) {
                    NativeSectionHeading(title: "记录分类")
                    NativeSurface(padding: 8) {
                        VStack(spacing: 0) {
                            NavigationLink(destination: ClassicalRecordsList()) {
                                NativeMenuRow(title: "我的八字排盘", detail: "古典命理排盘", icon: "calendar", tint: AppTheme.gold)
                            }
                            .buttonStyle(.plain)
                            recordDivider
                            NavigationLink(destination: MBTIRecordsList()) {
                                NativeMenuRow(title: "我的八维结果", detail: "荣格认知功能", icon: "brain.head.profile", tint: AppTheme.water)
                            }
                            .buttonStyle(.plain)
                            recordDivider
                            NavigationLink(destination: LiuYaoRecordsList()) {
                                NativeMenuRow(title: "我的周易解卦", detail: "六爻起卦与解读", icon: "sparkles", tint: AppTheme.jade)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(UIContract.Spacing.lg)
                .frame(maxWidth: UIContract.contentMaxWidth)
                .frame(maxWidth: .infinity)
            }
        }
        .navigationTitle("我的记录")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbarBackground(AppTheme.background, for: .navigationBar)
    }

    private var recordDivider: some View {
        Rectangle().fill(AppTheme.hairline).frame(height: 1).padding(.leading, 43)
    }
}

struct ClassicalRecordsList: View {
    @State private var items: [ClassicalRecord] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var deletingID: String?
    @State private var pendingDeletionID: String?

    var body: some View {
        ZStack {
            AmbientBackground()
            Group {
                if isLoading { NativeRecordsLoading(title: "正在整理排盘…") }
                else if let errorMessage { NativeRecordsError(message: errorMessage) }
                else if items.isEmpty {
                    NativeEmptyState(symbol: .guanxin, title: "尚无排盘", detail: "完成排盘并点击「保存该八字」后，将在这里留存。")
                } else {
                    ScrollView(showsIndicators: false) {
                        LazyVStack(spacing: UIContract.Spacing.sm) {
                            ForEach(items) { item in
                                NativeSurface(padding: 0) {
                                    HStack(spacing: 0) {
                                        NavigationLink {
                                            ClassicalReportView(
                                                params: stringParams(item.params),
                                                isSavedRecord: true
                                            )
                                        } label: {
                                            ClassicalRecordRow(item: item)
                                                .padding(.leading, 20)
                                                .padding(.trailing, 14)
                                                .padding(.vertical, 16)
                                                .contentShape(Rectangle())
                                        }
                                        .buttonStyle(.plain)
                                        .sensoryTap()

                                        Rectangle()
                                            .fill(AppTheme.hairline)
                                            .frame(width: 1)
                                            .padding(.vertical, 12)

                                        Button {
                                            withAnimation(deletePromptAnimation) {
                                                pendingDeletionID = item.id
                                            }
                                        } label: {
                                            ZStack {
                                                Circle().fill(AppTheme.stone100.opacity(0.48))
                                                if deletingID == item.id {
                                                    ProgressView()
                                                        .controlSize(.mini)
                                                        .tint(AppTheme.stone400)
                                                } else {
                                                    Image(systemName: "trash")
                                                        .font(.system(size: 11, weight: .light))
                                                        .foregroundStyle(AppTheme.stone300)
                                                }
                                            }
                                            .frame(width: 36, height: 36)
                                        }
                                        .buttonStyle(.plain)
                                        .disabled(deletingID != nil)
                                        .padding(.horizontal, 10)
                                        .accessibilityLabel("删除这份排盘")
                                    }
                                }
                            }
                        }
                        .padding(UIContract.Spacing.lg)
                        .frame(maxWidth: UIContract.contentMaxWidth)
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .navigationTitle("我的古典排盘")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbarBackground(AppTheme.background, for: .navigationBar)
        .task { await load() }
        .overlay {
            if let pendingDeletionID,
               let item = items.first(where: { $0.id == pendingDeletionID }) {
                ZStack {
                    Color.black.opacity(0.14)
                        .ignoresSafeArea()
                        .contentShape(Rectangle())
                        .onTapGesture { dismissDeletePrompt() }

                    ClassicalDeletePrompt(
                        recordTitle: classicalRecordTitle(item),
                        onCancel: dismissDeletePrompt,
                        onConfirm: confirmPendingDeletion
                    )
                    .padding(.horizontal, 32)
                    .transition(
                        .asymmetric(
                            insertion: .scale(scale: 0.94).combined(with: .opacity),
                            removal: .scale(scale: 0.97).combined(with: .opacity)
                        )
                    )
                }
                .transition(.opacity)
            }
        }
    }

    private var deletePromptAnimation: Animation {
        .timingCurve(0.32, 0.72, 0, 1, duration: 0.34)
    }

    private func dismissDeletePrompt() {
        withAnimation(deletePromptAnimation) {
            pendingDeletionID = nil
        }
    }

    private func confirmPendingDeletion() {
        guard let id = pendingDeletionID else { return }
        withAnimation(deletePromptAnimation) {
            pendingDeletionID = nil
        }
        Task { await deleteClassical(id) }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do { items = try await APIClient.shared.request("/api/records/classical") }
        catch { errorMessage = error.localizedDescription }
    }

    private func deleteClassical(_ id: String) async {
        deletingID = id
        defer { deletingID = nil }
        do {
            try await APIClient.shared.request("/api/records/classical", method: .DELETE, query: [URLQueryItem(name: "id", value: id)])
            items.removeAll { $0.id == id }
        } catch { errorMessage = error.localizedDescription }
    }
}

private struct ClassicalDeletePrompt: View {
    let recordTitle: String
    let onCancel: () -> Void
    let onConfirm: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 9) {
                Rectangle()
                    .fill(AppTheme.gold.opacity(0.58))
                    .frame(width: 20, height: 1)

                Text("排 盘 记 录")
                    .font(.system(size: 9, weight: .medium))
                    .tracking(2.1)
                    .foregroundStyle(AppTheme.stone400)

                Spacer()

                Text("删")
                    .font(.kaiti(11))
                    .foregroundStyle(AppTheme.cinnabar.opacity(0.82))
                    .frame(width: 23, height: 23)
                    .background(AppTheme.cinnabar.opacity(0.075), in: Circle())
                    .overlay {
                        Circle()
                            .stroke(AppTheme.cinnabar.opacity(0.16), lineWidth: 0.7)
                    }
            }

            Text("确定移除这份排盘？")
                .font(.webSerif(22))
                .foregroundStyle(AppTheme.stone800)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 18)

            Text("「\(recordTitle)」将从记录中移除，删除后无法恢复。")
                .font(.kaiti(13))
                .foregroundStyle(AppTheme.stone500)
                .lineSpacing(4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 9)

            Rectangle()
                .fill(AppTheme.hairline)
                .frame(height: 1)
                .padding(.vertical, 20)

            HStack(spacing: 10) {
                Button(action: onCancel) {
                    Text("暂不删除")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(AppTheme.stone600)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(
                            AppTheme.stone100.opacity(0.62),
                            in: RoundedRectangle(cornerRadius: 11, style: .continuous)
                        )
                        .overlay {
                            RoundedRectangle(cornerRadius: 11, style: .continuous)
                                .stroke(AppTheme.hairline, lineWidth: 0.8)
                        }
                }
                .buttonStyle(.plain)
                .sensoryTap()

                Button(action: onConfirm) {
                    Text("确认删除")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(AppTheme.cinnabar)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(
                            AppTheme.cinnabar.opacity(0.085),
                            in: RoundedRectangle(cornerRadius: 11, style: .continuous)
                        )
                        .overlay {
                            RoundedRectangle(cornerRadius: 11, style: .continuous)
                                .stroke(AppTheme.cinnabar.opacity(0.18), lineWidth: 0.8)
                        }
                }
                .buttonStyle(.plain)
                .sensoryTap()
            }
        }
        .padding(22)
        .background(
            AppTheme.warmWhite,
            in: RoundedRectangle(cornerRadius: 22, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(Color.white.opacity(0.72), lineWidth: 0.8)
        }
        .padding(5)
        .background(
            AppTheme.stone100.opacity(0.92),
            in: RoundedRectangle(cornerRadius: 27, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 27, style: .continuous)
                .stroke(AppTheme.hairline, lineWidth: 0.8)
        }
        .shadow(color: Color.black.opacity(0.11), radius: 28, y: 14)
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
    }
}

private struct ClassicalRecordRow: View {
    let item: ClassicalRecord

    private var params: [String: JSONValue] { item.params }
    private var name: String {
        params["name"]?.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }
    private var gender: String {
        params["gender"]?.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }
    private var city: String {
        params["city"]?.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }
    private var dateText: String { classicalBirthDate(item) }
    private var title: String { classicalRecordTitle(item) }
    private var pillars: (gans: [String], zhis: [String])? {
        guard params["mode"]?.text == "bazi",
              let rawGans = params["gans"]?.text,
              let rawZhis = params["zhis"]?.text else { return nil }
        let gans = rawGans.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        let zhis = rawZhis.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        guard gans.count == 4, zhis.count == 4 else { return nil }
        return (gans, zhis)
    }

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 7) {
                Text(title)
                    .font(.kaiti(name.isEmpty ? 15 : 17))
                    .foregroundStyle(name.isEmpty ? AppTheme.stone500 : AppTheme.lunarInk)
                    .lineLimit(1)

                HStack(spacing: 7) {
                    if !gender.isEmpty {
                        Text(gender)
                            .font(.system(size: 9))
                            .tracking(0.6)
                            .foregroundStyle(AppTheme.lunarMeta)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(AppTheme.stone100.opacity(0.62), in: RoundedRectangle(cornerRadius: 4, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: 4, style: .continuous)
                                    .stroke(AppTheme.hairline, lineWidth: 0.7)
                            }
                    }

                    if !name.isEmpty, !dateText.isEmpty {
                        Text(dateText + (city.isEmpty ? "" : " · \(city)"))
                            .font(.system(size: 10.5))
                            .foregroundStyle(AppTheme.stone300)
                            .lineLimit(1)
                    }

                    Text(shortDate(item.createdAt))
                        .font(.system(size: 9.5))
                        .foregroundStyle(AppTheme.faint)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if let pillars {
                ClassicalFourPillars(gans: pillars.gans, zhis: pillars.zhis)
                    .fixedSize()
            } else if !name.isEmpty, !dateText.isEmpty {
                VStack(alignment: .trailing, spacing: 3) {
                    Text(dateText)
                        .font(.system(size: 11))
                        .foregroundStyle(AppTheme.stone500)
                        .lineLimit(1)
                    if !city.isEmpty {
                        Text(city)
                            .font(.system(size: 10))
                            .foregroundStyle(AppTheme.stone300)
                    }
                }
                .fixedSize(horizontal: true, vertical: false)
            }

            Image(systemName: "chevron.right")
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(AppTheme.stone300)
        }
        .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title)，点击查看古典排盘报告")
    }
}

private struct ClassicalFourPillars: View {
    let gans: [String]
    let zhis: [String]
    private let names = ["年", "月", "日", "时"]

    var body: some View {
        HStack(alignment: .bottom, spacing: 10) {
            ForEach(names.indices, id: \.self) { index in
                VStack(spacing: 4) {
                    Text(gans[index])
                        .font(.kaiti(19))
                        .foregroundStyle(classicalWuxingColor(gans[index]))
                        .frame(height: 19)
                    Text(zhis[index])
                        .font(.kaiti(19))
                        .foregroundStyle(classicalWuxingColor(zhis[index]))
                        .frame(height: 19)
                    Text("\(names[index])柱")
                        .font(.system(size: 8))
                        .tracking(0.4)
                        .foregroundStyle(AppTheme.stone300)
                        .padding(.top, 1)
                }
            }
        }
    }
}

struct MBTIRecordsList: View {
    @State private var items: [MBTIImportRecord] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            AmbientBackground()
            Group {
                if isLoading { NativeRecordsLoading(title: "正在整理结果…") }
                else if let errorMessage { NativeRecordsError(message: errorMessage) }
                else if items.isEmpty {
                    NativeEmptyState(symbol: .guanxin, title: "尚无八维结果", detail: "完成八维测试并保存后，将在这里留存。")
                } else {
                    ScrollView(showsIndicators: false) {
                        LazyVStack(spacing: UIContract.Spacing.sm) {
                            ForEach(items) { item in
                                NavigationLink {
                                    MBTIRecordDetailView(recordID: item.id)
                                } label: {
                                    NativeSurface(padding: 16) {
                                        HStack {
                                            Text(item.type)
                                                .font(.system(size: 18, weight: .medium, design: .monospaced))
                                                .tracking(2.4)
                                                .foregroundStyle(AppTheme.stone800)
                                            Spacer()
                                            Text(shortDate(item.createdAt))
                                                .font(.system(size: 10))
                                                .foregroundStyle(AppTheme.stone400)
                                            Image(systemName: "chevron.right")
                                                .font(.system(size: 9, weight: .semibold))
                                                .foregroundStyle(AppTheme.stone300)
                                        }
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(UIContract.Spacing.lg)
                        .frame(maxWidth: UIContract.contentMaxWidth)
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .navigationTitle("我的八维结果")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbarBackground(AppTheme.background, for: .navigationBar)
        .task { await load() }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do { items = try await APIClient.shared.request("/api/records/mbti") }
        catch { errorMessage = error.localizedDescription }
    }
}

struct LiuYaoRecordsList: View {
    @State private var items: [LiuYaoImportRecord] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            AmbientBackground()
            Group {
                if isLoading { NativeRecordsLoading(title: "正在整理解卦…") }
                else if let errorMessage { NativeRecordsError(message: errorMessage) }
                else if items.isEmpty {
                    NativeEmptyState(symbol: .juexingcang, title: "尚无解卦", detail: "在六爻占卜中起卦后，将在这里留存。")
                } else {
                    ScrollView(showsIndicators: false) {
                        LazyVStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("历次起卦记录 · 点击查看详情")
                                    .font(.system(size: 11))
                                    .tracking(1.2)
                                    .foregroundStyle(AppTheme.faint)
                                Rectangle()
                                    .fill(AppTheme.hairline)
                                    .frame(height: 1)
                            }
                            .padding(.bottom, 8)

                            ForEach(items) { item in
                                NavigationLink {
                                    LiuYaoRecordDetailView(record: item)
                                } label: {
                                    NativeSurface(padding: 0) {
                                        LiuYaoRecordRow(record: item)
                                            .padding(.horizontal, 16)
                                            .padding(.vertical, 15)
                                    }
                                }
                                .buttonStyle(.plain)
                                .sensoryTap()
                            }
                        }
                        .padding(UIContract.Spacing.lg)
                        .frame(maxWidth: UIContract.contentMaxWidth)
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .navigationTitle("我的周易解卦")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbarBackground(AppTheme.background, for: .navigationBar)
        .task { await load() }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do { items = try await APIClient.shared.request("/api/records/liuyao") }
        catch { errorMessage = error.localizedDescription }
    }
}

struct MBTIRecordDetailView: View {
    let recordID: String
    @State private var result: MBTITestResult?
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if let result {
                ScrollView(showsIndicators: false) {
                    MBTISavedResultView(value: result).padding(.horizontal, 24).padding(.bottom, 40)
                }
            } else if let errorMessage {
                Text(errorMessage).font(.kaiti(13)).foregroundStyle(AppTheme.cinnabar)
            } else {
                ProgressView("加载中…")
            }
        }
        .background(AppTheme.background)
        .navigationTitle("八维报告")
        .task { await load() }
    }

    private func load() async {
        do {
            let record: MBTISavedRecord = try await APIClient.shared.request(
                "/api/records/mbti", query: [URLQueryItem(name: "id", value: recordID)]
            )
            var detail: MBTITypeDetail?
            if let envelope: MBTIDetailEnvelope = try? await APIClient.shared.request(
                "/api/mobile/mbti", query: [URLQueryItem(name: "type", value: record.type)]
            ) {
                detail = envelope.detail
            }
            result = MBTITestResult(
                type: record.type,
                score: record.fitScore ?? 0,
                fitScore: record.fitScore ?? 0,
                shadowType: record.shadowType ?? envelopeShadow(record.type),
                functionScores: record.functionScores,
                functionStrengths: record.functionStrengths ?? record.functionScores,
                idealStrengths: record.idealStrengths ?? [:],
                userSlots: record.userSlots ?? [:],
                detail: detail
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func envelopeShadow(_ type: String) -> String {
        let opposite: [Character: Character] = ["E": "I", "I": "E", "S": "N", "N": "S", "T": "F", "F": "T", "J": "P", "P": "J"]
        return String(type.map { opposite[$0] ?? $0 })
    }
}

struct LiuYaoRecordDetailView: View {
    let record: LiuYaoImportRecord

    var body: some View {
        ScrollView(showsIndicators: false) {
            LiuYaoDetailPaper(record: record)
                .padding(.horizontal, 16)
                .padding(.top, 24)
                .padding(.bottom, 44)
        }
        .background(AppTheme.background)
        .navigationTitle("周易解卦记录")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(AppTheme.background, for: .navigationBar)
    }
}

private struct LiuYaoRecordRow: View {
    let record: LiuYaoImportRecord

    private var info: LiuYaoHexagramPresentation {
        LiuYaoHexagramPresentation(record.hexagramInfo)
    }

    var body: some View {
        HStack(spacing: 15) {
            ZStack {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(AppTheme.stone100.opacity(0.42))
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .stroke(AppTheme.hairline, lineWidth: 0.8)
                LiuYaoMiniHexagramGlyph(lines: info.lines)
            }
            .frame(width: 42, height: 50)

            VStack(alignment: .leading, spacing: 5) {
                if !info.mainHexagram.isEmpty {
                    Text(info.listTitle)
                        .font(.system(size: 10))
                        .tracking(1.1)
                        .foregroundStyle(AppTheme.lunarMeta)
                        .lineLimit(1)
                }

                Text(record.question.isEmpty ? "（未填写问题）" : record.question)
                    .font(.kaiti(15.5))
                    .foregroundStyle(AppTheme.lunarInk)
                    .lineSpacing(3)
                    .lineLimit(2)

                Text(liuYaoDisplayDate(record))
                    .font(.system(size: 10))
                    .monospacedDigit()
                    .foregroundStyle(AppTheme.faint)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Image(systemName: "chevron.right")
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(AppTheme.stone300)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(info.listTitle)，\(record.question)，点击查看解卦详情")
    }
}

private struct LiuYaoDetailPaper: View {
    let record: LiuYaoImportRecord

    private var info: LiuYaoHexagramPresentation {
        LiuYaoHexagramPresentation(record.hexagramInfo)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(liuYaoDisplayDate(record))
                .font(.system(size: 11))
                .tracking(0.7)
                .monospacedDigit()
                .foregroundStyle(AppTheme.faint)
                .padding(.horizontal, 22)
                .padding(.top, 23)
                .padding(.bottom, 17)

            paperDivider

            if !record.question.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    LiuYaoSectionLabel("所 问")
                    Text(record.question)
                        .font(.kaiti(16))
                        .foregroundStyle(AppTheme.lunarInk)
                        .lineSpacing(6)
                }
                .padding(.horizontal, 22)
                .padding(.vertical, 20)

                paperDivider
            }

            VStack(alignment: .leading, spacing: 17) {
                LiuYaoSectionLabel("卦 象")

                if info.lines.count == 6 {
                    HStack(alignment: .top, spacing: 20) {
                        LiuYaoHexagramDiagram(lines: info.lines)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        LiuYaoHexagramNames(info: info)
                            .frame(width: 112, alignment: .leading)
                    }
                } else {
                    LiuYaoHexagramNames(info: info)
                }

                if !info.changingLines.isEmpty {
                    VStack(alignment: .leading, spacing: 9) {
                        LiuYaoSectionLabel("变 爻")
                        LazyVGrid(
                            columns: [GridItem(.adaptive(minimum: 76), spacing: 7)],
                            alignment: .leading,
                            spacing: 7
                        ) {
                            ForEach(info.changingLines) { line in
                                Text("\(line.name)  \(line.value == 9 ? "○" : "×")")
                                    .font(.kaiti(12.5))
                                    .foregroundStyle(AppTheme.stone600)
                                    .padding(.horizontal, 9)
                                    .frame(height: 27)
                                    .background(
                                        AppTheme.stone100.opacity(0.56),
                                        in: RoundedRectangle(cornerRadius: 5, style: .continuous)
                                    )
                                    .overlay {
                                        RoundedRectangle(cornerRadius: 5, style: .continuous)
                                            .stroke(AppTheme.hairline, lineWidth: 0.7)
                                    }
                            }
                        }
                        Text("○ 老阳（阳极生阴） · × 老阴（阴极生阳）")
                            .font(.system(size: 9.5))
                            .foregroundStyle(AppTheme.faint)
                    }
                    .padding(.top, 2)
                }
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 22)

            if let interpretation = info.interpretation {
                paperDivider

                VStack(alignment: .leading, spacing: 13) {
                    LiuYaoSectionLabel("解卦依据")
                    Text(interpretation.title)
                        .font(.system(size: 11))
                        .tracking(0.4)
                        .foregroundStyle(AppTheme.lunarMeta)

                    VStack(alignment: .leading, spacing: 11) {
                        ForEach(Array(interpretation.texts.enumerated()), id: \.offset) { _, text in
                            Text(text)
                                .font(.kaiti(13.5))
                                .foregroundStyle(interpretation.isLineText ? AppTheme.stone700 : AppTheme.stone600)
                                .lineSpacing(5)
                                .padding(.leading, interpretation.isLineText ? 13 : 0)
                                .overlay(alignment: .leading) {
                                    if interpretation.isLineText {
                                        Rectangle()
                                            .fill(AppTheme.stone200.opacity(0.78))
                                            .frame(width: 2)
                                    }
                                }
                        }
                    }
                }
                .padding(.horizontal, 22)
                .padding(.vertical, 21)
            }

            paperDivider

            VStack(alignment: .leading, spacing: 13) {
                LiuYaoSectionLabel("解卦详析")
                Text(record.aiResult.isEmpty ? "暂无解卦内容" : record.aiResult)
                    .font(record.aiResult.isEmpty ? .system(size: 12.5) : .kaiti(14))
                    .foregroundStyle(record.aiResult.isEmpty ? AppTheme.faint : AppTheme.stone700)
                    .lineSpacing(8)
                    .textSelection(.enabled)
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 22)
        }
        .background(
            AppTheme.warmWhite,
            in: RoundedRectangle(cornerRadius: 18, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(AppTheme.hairline, lineWidth: 0.9)
        }
        .padding(4)
        .background(
            AppTheme.stone100.opacity(0.52),
            in: RoundedRectangle(cornerRadius: 22, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(AppTheme.hairline.opacity(0.72), lineWidth: 0.7)
        }
        .shadow(color: Color.black.opacity(0.045), radius: 10, y: 3)
    }

    private var paperDivider: some View {
        Rectangle()
            .fill(AppTheme.hairline)
            .frame(height: 1)
    }
}

private struct LiuYaoHexagramNames: View {
    let info: LiuYaoHexagramPresentation

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 5) {
                LiuYaoSectionLabel("本 卦")
                Text(info.mainHexagram.isEmpty ? "—" : info.mainHexagram)
                    .font(.kaiti(20))
                    .foregroundStyle(AppTheme.lunarInk)
                if !info.mainDescription.isEmpty {
                    Text(info.mainDescription)
                        .font(.kaiti(12))
                        .foregroundStyle(AppTheme.stone500)
                        .lineSpacing(4)
                }
            }

            if !info.transformedHexagram.isEmpty {
                VStack(alignment: .leading, spacing: 5) {
                    LiuYaoSectionLabel("变 卦")
                    Text(info.transformedHexagram)
                        .font(.kaiti(19))
                        .foregroundStyle(AppTheme.stone600)
                    if !info.transformedDescription.isEmpty {
                        Text(info.transformedDescription)
                            .font(.kaiti(12))
                            .foregroundStyle(AppTheme.lunarMeta)
                            .lineSpacing(4)
                    }
                }
            }
        }
    }
}

private struct LiuYaoMiniHexagramGlyph: View {
    let lines: [LiuYaoLinePresentation]

    var body: some View {
        if lines.count == 6 {
            VStack(spacing: 2.6) {
                ForEach(lines.reversed()) { line in
                    LiuYaoStroke(line: line, width: 24, height: 3.1, gap: 4)
                }
            }
        } else {
            FourSymbolGlyph(symbol: .juexingcang, width: 24, lineHeight: 4, color: AppTheme.stone500)
        }
    }
}

private struct LiuYaoHexagramDiagram: View {
    let lines: [LiuYaoLinePresentation]
    private let fallbackNames = ["初爻", "二爻", "三爻", "四爻", "五爻", "上爻"]

    var body: some View {
        VStack(spacing: 10) {
            ForEach(Array(lines.reversed().enumerated()), id: \.element.id) { reverseIndex, line in
                HStack(spacing: 8) {
                    Text(line.name.isEmpty ? fallbackNames[5 - reverseIndex] : line.name)
                        .font(.kaiti(10.5))
                        .foregroundStyle(AppTheme.faint)
                        .frame(width: 28, alignment: .trailing)

                    LiuYaoStroke(line: line, width: 104, height: 9, gap: 8)

                    Text(line.isChanging ? (line.value == 9 ? "○" : "×") : "")
                        .font(.system(size: 11, weight: .light))
                        .foregroundStyle(AppTheme.lunarMeta)
                        .frame(width: 12)
                }
            }
        }
    }
}

private struct LiuYaoStroke: View {
    let line: LiuYaoLinePresentation
    let width: CGFloat
    let height: CGFloat
    let gap: CGFloat

    var body: some View {
        let color = line.isChanging ? AppTheme.lunarMeta : AppTheme.stone800
        HStack(spacing: line.isYang ? 0 : gap) {
            Capsule()
                .fill(color)
                .frame(width: line.isYang ? width : (width - gap) / 2, height: height)
            if !line.isYang {
                Capsule()
                    .fill(color)
                    .frame(width: (width - gap) / 2, height: height)
            }
        }
        .frame(width: width, height: height)
        .accessibilityHidden(true)
    }
}

private struct LiuYaoSectionLabel: View {
    let title: String

    init(_ title: String) {
        self.title = title
    }

    var body: some View {
        Text(title)
            .font(.system(size: 9.5))
            .tracking(2)
            .foregroundStyle(AppTheme.faint)
    }
}

private struct LiuYaoHexagramPresentation {
    let mainHexagram: String
    let transformedHexagram: String
    let mainDescription: String
    let transformedDescription: String
    let lines: [LiuYaoLinePresentation]
    let interpretation: LiuYaoInterpretationPresentation?

    init(_ raw: [String: JSONValue]) {
        mainHexagram = raw["mainHexagram"]?.text ?? ""
        transformedHexagram = raw["transformedHexagram"]?.text ?? ""
        mainDescription = raw["mainDescription"]?.text ?? ""
        transformedDescription = raw["transformedDescription"]?.text ?? ""
        if case .array(let values)? = raw["yaos"] {
            lines = values.compactMap(LiuYaoLinePresentation.init)
        } else {
            lines = []
        }
        interpretation = LiuYaoInterpretationPresentation(raw["interpretation"])
    }

    var listTitle: String {
        guard !mainHexagram.isEmpty else { return "周易解卦" }
        return transformedHexagram.isEmpty ? mainHexagram : "\(mainHexagram) → \(transformedHexagram)"
    }

    var changingLines: [LiuYaoLinePresentation] {
        lines.filter(\.isChanging)
    }
}

private struct LiuYaoLinePresentation: Identifiable {
    let position: Int
    let name: String
    let value: Int
    let isChanging: Bool
    var id: Int { position }
    var isYang: Bool { value == 7 || value == 9 }

    init?(_ raw: JSONValue) {
        guard case .object(let value) = raw else { return nil }
        if case .number(let number)? = value["position"] { position = Int(number) }
        else { position = 0 }
        name = value["name"]?.text ?? ""
        if case .number(let number)? = value["value"] { self.value = Int(number) }
        else { self.value = 0 }
        if case .bool(let flag)? = value["isChanging"] { isChanging = flag }
        else { isChanging = false }
    }
}

private struct LiuYaoInterpretationPresentation {
    let title: String
    let texts: [String]
    let isLineText: Bool

    init?(_ raw: JSONValue?) {
        guard case .object(let value)? = raw else { return nil }
        title = value["title"]?.text ?? ""
        if case .array(let rawTexts)? = value["texts"] {
            texts = rawTexts.compactMap(\.text)
        } else {
            texts = []
        }
        isLineText = value["type"]?.text == "yaoci"
        if title.isEmpty && texts.isEmpty { return nil }
    }
}

private struct MBTIDetailEnvelope: Decodable {
    let detail: MBTITypeDetail?
}

private struct MBTISavedRecord: Decodable {
    let id: String
    let type: String
    let functionScores: [String: Double]
    let functionStrengths: [String: Double]?
    let idealStrengths: [String: Double]?
    let userSlots: [String: MBTIUserSlot]?
    let fitScore: Double?
    let shadowType: String?
    enum CodingKeys: String, CodingKey {
        case id, type
        case functionScores = "function_scores"
        case functionStrengths = "function_strengths"
        case idealStrengths = "ideal_strengths"
        case userSlots = "user_slots"
        case fitScore = "fit_score"
        case shadowType = "shadow_type"
    }
}

private struct NativeRecordsLoading: View {
    let title: String

    var body: some View {
        VStack(spacing: 14) {
            ProgressView().tint(AppTheme.stone500)
            Text(title)
                .font(.system(size: 12))
                .foregroundStyle(AppTheme.stone400)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct NativeRecordsError: View {
    let message: String

    var body: some View {
        NativeEmptyState(symbol: .wendao, title: "暂时无法加载", detail: message)
    }
}

struct MBTISavedResultView: View {
    let value: MBTITestResult
    var body: some View { MBTIResultContent(value: value) }
}

private func classicalBirthDate(_ item: ClassicalRecord) -> String {
    let year = item.params["year"]?.text ?? ""
    let month = item.params["month"]?.text ?? ""
    let day = item.params["day"]?.text ?? ""
    if year.isEmpty || month.isEmpty || day.isEmpty { return "" }
    let hour = item.params["hour"]?.text ?? "?"
    let minute = (item.params["minute"]?.text ?? "00")
    let padded = minute.count == 1 ? "0\(minute)" : minute
    return "\(year)年\(month)月\(day)日 \(hour):\(padded)"
}

private func classicalRecordTitle(_ item: ClassicalRecord) -> String {
    let name = item.params["name"]?.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if !name.isEmpty { return name }
    let birthDate = classicalBirthDate(item)
    return birthDate.isEmpty ? "未命名排盘" : birthDate
}

private func classicalWuxingColor(_ value: String) -> Color {
    if "庚辛申酉".contains(value) { return AppTheme.metal }
    if "甲乙寅卯".contains(value) { return AppTheme.wood }
    if "壬癸子亥".contains(value) { return AppTheme.water }
    if "丙丁巳午".contains(value) { return AppTheme.fire }
    if "戊己辰戌丑未".contains(value) { return AppTheme.earth }
    return AppTheme.secondaryInk
}

private func stringParams(_ params: [String: JSONValue]) -> [String: String] {
    Dictionary(uniqueKeysWithValues: params.compactMap { key, value in
        switch value {
        case .string(let text): return (key, text)
        case .number(let number):
            if number.rounded() == number { return (key, String(Int(number))) }
            return (key, String(number))
        case .bool(let flag): return (key, flag ? "true" : "false")
        default: return nil
        }
    })
}

private func liuYaoDisplayDate(_ record: LiuYaoImportRecord) -> String {
    let savedDate = record.date.trimmingCharacters(in: .whitespacesAndNewlines)
    if !savedDate.isEmpty { return savedDate }

    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let date = fractional.date(from: record.createdAt) ?? ISO8601DateFormatter().date(from: record.createdAt)
    guard let date else { return record.createdAt }

    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "zh_CN")
    formatter.timeZone = .current
    formatter.dateFormat = "yyyy/M/d HH:mm:ss"
    return formatter.string(from: date)
}

private func shortDate(_ value: String) -> String {
    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let date = fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    guard let date else { return value }
    return date.formatted(.dateTime.year().month().day().locale(Locale(identifier: "zh_CN")))
}
