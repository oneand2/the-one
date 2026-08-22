import SwiftUI

struct ChatImportSheet: View {
    @Environment(\.dismiss) private var dismiss
    let existing: [String: Any]
    let completion: ([String: Any]) -> Void

    @State private var baziRecords: [ClassicalRecord] = []
    @State private var mbtiRecords: [MBTIImportRecord] = []
    @State private var liuyaoRecords: [LiuYaoImportRecord] = []
    @State private var selectedBazi: Set<String> = []
    @State private var selectedMBTI: Set<String> = []
    @State private var selectedLiuYao: Set<String> = []
    @State private var isLoading = true
    @State private var isApplying = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading { ProgressView("正在读取测算记录…") }
                else {
                    List {
                        importSection("八字", records: baziRecords, selection: $selectedBazi) { record in
                            baziLabel(record)
                        }
                        importSection("八维", records: mbtiRecords, selection: $selectedMBTI) { record in
                            "\(record.type) · \(shortDate(record.createdAt))"
                        }
                        importSection("六爻", records: liuyaoRecords, selection: $selectedLiuYao) { record in
                            (record.question.isEmpty ? "未写所问" : record.question) + " · " + shortDate(record.createdAt)
                        }
                        if let errorMessage { Text(errorMessage).font(.kaiti(12)).foregroundStyle(AppTheme.cinnabar) }
                    }
                }
            }
            .navigationTitle("导入测算数据")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isApplying ? "导入中…" : "导入") { Task { await apply() } }
                        .disabled(isApplying || selectionCount == 0)
                }
            }
        }
        .task { await load() }
        .presentationDetents([.large])
    }

    private var selectionCount: Int { selectedBazi.count + selectedMBTI.count + selectedLiuYao.count }

    private func importSection<Record: Identifiable>(
        _ title: String,
        records: [Record],
        selection: Binding<Set<String>>,
        label: @escaping (Record) -> String
    ) -> some View where Record.ID == String {
        Section(title) {
            if records.isEmpty { Text("暂无记录").font(.kaiti(12)).foregroundStyle(AppTheme.stone400) }
            ForEach(records) { record in
                Button {
                    if selection.wrappedValue.contains(record.id) { selection.wrappedValue.remove(record.id) }
                    else { selection.wrappedValue.insert(record.id) }
                } label: {
                    HStack {
                        Image(systemName: selection.wrappedValue.contains(record.id) ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(selection.wrappedValue.contains(record.id) ? AppTheme.stone700 : AppTheme.stone300)
                        Text(label(record)).font(.kaiti(14)).foregroundStyle(AppTheme.stone700)
                    }
                }
            }
        }
    }

    private func load() async {
        isLoading = true; defer { isLoading = false }
        do {
            baziRecords = try await APIClient.shared.request("/api/records/classical")
            mbtiRecords = try await APIClient.shared.request("/api/records/mbti")
            liuyaoRecords = try await APIClient.shared.request("/api/records/liuyao")
        } catch { errorMessage = error.localizedDescription }
    }

    private func apply() async {
        isApplying = true; defer { isApplying = false }
        var result = existing
        var baziItems = existing["bazi"] as? [Any] ?? []
        var mbtiItems = existing["mbti"] as? [Any] ?? []
        var liuyaoItems = existing["liuyao"] as? [Any] ?? []
        do {
            for record in baziRecords where selectedBazi.contains(record.id) {
                let response: NativeBaziAnalysisResponse = try await APIClient.shared.request(
                    "/api/mobile/bazi", method: .POST,
                    json: ["action": "analyze", "params": record.params.mapValues(\.anyValue)]
                )
                baziItems.append(response.importData.mapValues(\.anyValue))
            }
            for record in mbtiRecords where selectedMBTI.contains(record.id) {
                mbtiItems.append([
                    "type": "mbti", "mbtiType": record.type,
                    "functionScores": record.functionScores, "testDate": record.createdAt,
                ] as [String: Any])
            }
            for record in liuyaoRecords where selectedLiuYao.contains(record.id) {
                var item = record.hexagramInfo.mapValues(\.anyValue)
                item["type"] = "liuyao"; item["question"] = record.question
                item["aiResult"] = record.aiResult; item["divineDate"] = record.date
                liuyaoItems.append(item)
            }
            if !baziItems.isEmpty { result["bazi"] = baziItems }
            if !mbtiItems.isEmpty { result["mbti"] = mbtiItems }
            if !liuyaoItems.isEmpty { result["liuyao"] = liuyaoItems }
            completion(result)
        } catch { errorMessage = error.localizedDescription }
    }

    private func baziLabel(_ record: ClassicalRecord) -> String {
        let name = record.params["name"]?.text ?? ""
        if record.params["mode"]?.text == "bazi" {
            let gans = record.params["gans"]?.text?.replacingOccurrences(of: ",", with: "") ?? ""
            let zhis = record.params["zhis"]?.text?.replacingOccurrences(of: ",", with: "") ?? ""
            return (name.isEmpty ? "" : name + " · ") + gans + " " + zhis
        }
        let year = record.params["year"]?.text ?? ""
        let month = record.params["month"]?.text ?? ""
        let day = record.params["day"]?.text ?? ""
        return (name.isEmpty ? "" : name + " · ") + "\(year)年\(month)月\(day)日"
    }

    private func shortDate(_ raw: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: raw) else { return raw }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}
