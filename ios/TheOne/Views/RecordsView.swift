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
                                NativeSurface(padding: 16) {
                                    HStack(spacing: 8) {
                                        NavigationLink {
                                            ClassicalReportView(params: stringParams(item.params))
                                        } label: {
                                            VStack(alignment: .leading, spacing: 7) {
                                                Text(classicalTitle(item)).font(.kaiti(17)).foregroundStyle(AppTheme.lunarInk)
                                                HStack(spacing: 8) {
                                                    if let gender = item.params["gender"]?.text, !gender.isEmpty {
                                                        Text(gender)
                                                            .font(.system(size: 9)).foregroundStyle(AppTheme.lunarMeta)
                                                            .padding(.horizontal, 7).padding(.vertical, 3)
                                                            .background(AppTheme.stone100.opacity(0.7), in: Capsule())
                                                    }
                                                    Text(classicalSubtitle(item)).font(.system(size: 10)).foregroundStyle(AppTheme.faint)
                                                }
                                            }
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                        }
                                        .buttonStyle(.plain)
                                        Button {
                                            Task { await deleteClassical(item.id) }
                                        } label: {
                                            Image(systemName: deletingID == item.id ? "hourglass" : "trash")
                                                .font(.system(size: 11)).foregroundStyle(AppTheme.stone300)
                                                .frame(width: 36, height: 36)
                                                .background(AppTheme.stone100.opacity(0.55), in: Circle())
                                        }
                                        .buttonStyle(.plain)
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
                        LazyVStack(spacing: UIContract.Spacing.sm) {
                            ForEach(items) { item in
                                NavigationLink {
                                    LiuYaoRecordDetailView(record: item)
                                } label: {
                                    NativeSurface(padding: 16) {
                                        VStack(alignment: .leading, spacing: 7) {
                                            if let main = item.hexagramInfo["mainHexagram"]?.text {
                                                Text(main).font(.system(size: 9)).tracking(1.4).foregroundStyle(AppTheme.lunarMeta)
                                            }
                                            Text(item.question.isEmpty ? "（未填写问题）" : item.question)
                                                .font(.kaiti(15)).foregroundStyle(AppTheme.lunarInk).lineLimit(2)
                                            HStack {
                                                Text(item.date.isEmpty ? shortDate(item.createdAt) : item.date)
                                                    .font(.system(size: 10)).foregroundStyle(AppTheme.faint)
                                                Spacer()
                                                Image(systemName: "chevron.right")
                                                    .font(.system(size: 9, weight: .semibold))
                                                    .foregroundStyle(AppTheme.stone300)
                                            }
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
            VStack(alignment: .leading, spacing: 0) {
                Text(record.date.isEmpty ? shortDate(record.createdAt) : record.date)
                    .font(.system(size: 11)).foregroundStyle(AppTheme.faint)
                    .padding(.bottom, 16)
                Divider().overlay(AppTheme.hairline)
                if !record.question.isEmpty {
                    Text("所 问").font(.system(size: 10)).tracking(2).foregroundStyle(AppTheme.faint).padding(.top, 18)
                    Text(record.question).font(.kaiti(16)).foregroundStyle(AppTheme.lunarInk).padding(.top, 8).padding(.bottom, 18)
                    Divider().overlay(AppTheme.hairline)
                }
                Text("卦 象").font(.system(size: 10)).tracking(2).foregroundStyle(AppTheme.faint).padding(.top, 18)
                Text(record.hexagramInfo["mainHexagram"]?.text ?? "—")
                    .font(.kaiti(20)).padding(.top, 6)
                if let transformed = record.hexagramInfo["transformedHexagram"]?.text, !transformed.isEmpty {
                    Text("变卦 \(transformed)").font(.kaiti(16)).foregroundStyle(AppTheme.stone600).padding(.top, 10)
                }
                Divider().overlay(AppTheme.hairline).padding(.top, 18)
                Text("解卦详析").font(.system(size: 10)).tracking(2).foregroundStyle(AppTheme.faint).padding(.top, 18)
                Text(record.aiResult.isEmpty ? "暂无解卦内容" : record.aiResult)
                    .font(.kaiti(14)).foregroundStyle(record.aiResult.isEmpty ? AppTheme.faint : AppTheme.stone700)
                    .lineSpacing(8).padding(.top, 8)
            }
            .padding(24)
        }
        .background(AppTheme.background)
        .navigationTitle("周易解卦")
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

private func classicalTitle(_ item: ClassicalRecord) -> String {
    let name = item.params["name"]?.text?.trimmingCharacters(in: .whitespaces) ?? ""
    if !name.isEmpty { return name }
    return classicalSubtitle(item).isEmpty ? "未命名" : classicalSubtitle(item)
}

private func classicalSubtitle(_ item: ClassicalRecord) -> String {
    let year = item.params["year"]?.text ?? ""
    let month = item.params["month"]?.text ?? ""
    let day = item.params["day"]?.text ?? ""
    if year.isEmpty { return shortDate(item.createdAt) }
    let hour = item.params["hour"]?.text ?? "?"
    let minute = (item.params["minute"]?.text ?? "00")
    let padded = minute.count == 1 ? "0\(minute)" : minute
    return "\(year)年\(month)月\(day)日 \(hour):\(padded)"
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

private func shortDate(_ value: String) -> String {
    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let date = fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    guard let date else { return value }
    return date.formatted(.dateTime.year().month().day().locale(Locale(identifier: "zh_CN")))
}
