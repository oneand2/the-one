import SwiftUI

private struct BaziMetadata: Decodable {
    let provinces: [String]
    let cities: [String: [String]]
}

private struct BaziSheetCache: Codable {
    let mode: String
    let calendarType: String
    let gender: String
    let name: String
    let year: Int
    let month: Int
    let day: Int
    let hour: Int
    let minute: Int
    let leapMonth: Bool
    let directPillars: [String]
    let province: String
    let city: String
    let quickDateText: String
    let quickBaziText: String
}

struct DailyFortuneNativeCard: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var records: [ClassicalRecord] = []
    @State private var saved: SavedDailyFortune?
    @State private var fortune: DailyFortuneResponse?
    @State private var isLoading = false
    @State private var showPicker = false
    @State private var showBreakdown = false
    @State private var errorMessage: String?

    private let storageKey = "daily-fortune-data-v2"

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let saved, let fortune {
                HStack(alignment: .center, spacing: 18) {
                    DailyScoreRing(score: fortune.finalScore, color: Color(hex: fortune.level.color) ?? AppTheme.jade)
                    VStack(alignment: .leading, spacing: 7) {
                        Text(saved.name?.isEmpty == false ? saved.name! : "今日能量")
                            .font(.kaiti(18)).foregroundStyle(AppTheme.stone800)
                        Text("\(fortune.dayPillar)日 · 用神 \(saved.yongshen)\(fortune.yongshenWuxing)")
                            .font(.kaiti(12)).foregroundStyle(AppTheme.stone500)
                        Text(fortune.level.label)
                            .font(.system(size: 10)).tracking(1.5)
                            .foregroundStyle(Color(hex: fortune.level.color) ?? AppTheme.stone700)
                            .padding(.horizontal, 9).padding(.vertical, 4)
                            .background(AppTheme.stone200.opacity(0.55), in: Capsule())
                    }
                    Spacer()
                    Button("修改") { Task { await openPicker() } }
                        .font(.system(size: 10)).foregroundStyle(AppTheme.stone500)
                }

                Button { withAnimation(.easeInOut(duration: 0.25)) { showBreakdown.toggle() } } label: {
                    HStack {
                        Text("能量明细").font(.system(size: 11)).tracking(1.2)
                        Spacer()
                        Image(systemName: showBreakdown ? "chevron.up" : "chevron.down").font(.system(size: 9))
                    }
                    .foregroundStyle(AppTheme.stone500)
                }.buttonStyle(.plain)

                if showBreakdown {
                    VStack(spacing: 9) {
                        ForEach(fortune.items) { item in
                            HStack {
                                Text(item.label).frame(width: 62, alignment: .leading)
                                Text("\(item.stem) · \(item.wx)")
                                Spacer()
                                Text(item.relation).foregroundStyle(relationColor(item.relation))
                                Text(item.contribution.formatted(.number.precision(.fractionLength(1))))
                                    .frame(width: 35, alignment: .trailing)
                            }
                            .font(.kaiti(11.5)).foregroundStyle(AppTheme.stone700)
                        }
                    }
                    .padding(13)
                    .background(Color.black.opacity(0.025), in: RoundedRectangle(cornerRadius: 10))
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }

            } else {
                Text("选取一份八字排盘，以日柱与用神推演今日能量。")
                    .font(.kaiti(11.5)).foregroundStyle(Color(red: 138 / 255, green: 129 / 255, blue: 117 / 255))
                Button { Task { await openPicker() } } label: {
                    HStack {
                        LegacyFortuneCalendarIcon()
                        Text("从我的八字排盘中选择")
                        Spacer()
                        if isLoading { ProgressView().controlSize(.small) }
                        else if !records.isEmpty {
                            Text("\(records.count)条")
                                .font(.system(size: 9.5)).foregroundStyle(Color(red: 158 / 255, green: 149 / 255, blue: 136 / 255))
                                .padding(.horizontal, 7).padding(.vertical, 3).background(Color.black.opacity(0.06), in: Capsule())
                        }
                        Image(systemName: "chevron.right").font(.system(size: 10)).foregroundStyle(AppTheme.faint)
                    }
                    .font(.kaiti(12.5)).foregroundStyle(AppTheme.lunarText)
                    .padding(.horizontal, 16).frame(height: 48.75)
                    .background(Color.black.opacity(0.025), in: RoundedRectangle(cornerRadius: 12))
                    .overlay { RoundedRectangle(cornerRadius: 12).stroke(Color.black.opacity(0.08)) }
                }.buttonStyle(.plain)
            }

            if let errorMessage { Text(errorMessage).font(.kaiti(11.5)).foregroundStyle(AppTheme.cinnabar) }
        }
        .padding(20).padding(1)
        .background(AppTheme.background, in: RoundedRectangle(cornerRadius: 16))
        .overlay { RoundedRectangle(cornerRadius: 16).stroke(Color.black.opacity(0.07)) }
        .shadow(color: .black.opacity(0.04), radius: 3, y: 1)
        .task {
            await restore()
            if saved == nil { await preloadRecords() }
        }
        .sheet(isPresented: $showPicker) {
            NavigationStack {
                Group {
                    if isLoading { ProgressView("正在读取排盘…") }
                    else if records.isEmpty {
                        ContentUnavailableView("还没有八字排盘", systemImage: "calendar", description: Text("请先在下方命盘排演中保存一份排盘。"))
                    } else {
                        List(records) { record in
                            Button { Task { await choose(record) } } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(recordTitle(record)).font(.kaiti(16)).foregroundStyle(AppTheme.stone800)
                                    Text(recordSubtitle(record)).font(.system(size: 11)).foregroundStyle(AppTheme.stone500)
                                }.padding(.vertical, 5)
                            }
                        }
                    }
                }
                .navigationTitle("选择八字排盘")
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { showPicker = false } } }
            }
            .presentationDetents([.medium, .large])
        }
    }

    private func restore() async {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let value = try? JSONDecoder().decode(SavedDailyFortune.self, from: data) else { return }
        saved = value
        await calculateToday(value)
    }

    private func openPicker() async {
        guard auth.requireAuthentication() else { return }
        showPicker = true
        await loadRecords()
    }

    private func preloadRecords() async {
        guard auth.isAuthenticated else { return }
        await loadRecords()
    }

    private func loadRecords() async {
        isLoading = true
        defer { isLoading = false }
        do { records = try await APIClient.shared.request("/api/records/classical") }
        catch { errorMessage = error.localizedDescription }
    }

    private func choose(_ record: ClassicalRecord) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response: NativeBaziFortuneResponse = try await APIClient.shared.request(
                "/api/mobile/bazi", method: .POST,
                json: ["action": "fortune-record", "params": record.params.mapValues(\.anyValue)]
            )
            guard !response.yongshen.isEmpty, response.yongshen != "无" else {
                errorMessage = "暂无法推算用神，建议重新排盘后再试"
                return
            }
            let value = SavedDailyFortune(name: response.name, yongshen: response.yongshen, pillars: response.pillars, hasHour: response.hasHour, bazi: response.importData)
            saved = value
            if let data = try? JSONEncoder().encode(value) { UserDefaults.standard.set(data, forKey: storageKey) }
            showPicker = false
            await calculateToday(value)
        } catch { errorMessage = error.localizedDescription }
    }

    private func calculateToday(_ value: SavedDailyFortune) async {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        do {
            fortune = try await APIClient.shared.request("/api/mobile/daily-fortune", method: .POST, json: [
                "year": parts.year ?? 2000, "month": parts.month ?? 1, "day": parts.day ?? 1, "yongshen": value.yongshen,
            ])
        } catch { errorMessage = error.localizedDescription }
    }

    private func relationColor(_ relation: String) -> Color {
        switch relation {
        case "用神": return Color(hex: "#4e7c4a") ?? AppTheme.jade
        case "生用神": return Color(hex: "#5a7a9a") ?? AppTheme.water
        case "泄用神": return Color(hex: "#8a7a5a") ?? AppTheme.earth
        case "克用神": return Color(hex: "#9a4a4a") ?? AppTheme.cinnabar
        case "被克": return Color(hex: "#8a6a5a") ?? AppTheme.earth
        default: return AppTheme.stone400
        }
    }

    private func recordTitle(_ record: ClassicalRecord) -> String {
        let name = record.params["name"]?.text?.trimmingCharacters(in: .whitespaces) ?? ""
        if record.params["mode"]?.text == "bazi" {
            let gans = record.params["gans"]?.text?.replacingOccurrences(of: ",", with: "") ?? ""
            let zhis = record.params["zhis"]?.text?.replacingOccurrences(of: ",", with: "") ?? ""
            return (name.isEmpty ? "" : name + " · ") + gans + " " + zhis
        }
        return name.isEmpty ? "八字排盘" : name
    }

    private func recordSubtitle(_ record: ClassicalRecord) -> String {
        let year = record.params["year"]?.text ?? ""
        let month = record.params["month"]?.text ?? ""
        let day = record.params["day"]?.text ?? ""
        return year.isEmpty ? record.createdAt : "\(year)年\(month)月\(day)日"
    }
}

struct BaziSheetNativeCard: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var flow: AppFlowStore

    private enum InputMode: String, CaseIterable { case date = "日期排盘", pillars = "八字排盘" }
    private enum CalendarType: String, CaseIterable { case solar = "公历", lunar = "农历" }
    private enum Gender: String { case male = "乾造", female = "坤造" }

    @State private var mode: InputMode = .date
    @State private var calendarType: CalendarType = .solar
    @State private var gender: Gender = .male
    @State private var name = ""
    @State private var year = 2000
    @State private var month = 1
    @State private var day = 1
    @State private var hour = 12
    @State private var minute = 0
    @State private var leapMonth = false
    @State private var directPillars = ["", "", "", ""]
    @State private var quickDateText = ""
    @State private var quickBaziText = ""
    @State private var province = ""
    @State private var city = ""
    @State private var metadata: BaziMetadata?
    @State private var showBirthPicker = false
    @State private var showLocationPicker = false
    @State private var isWorking = false
    @State private var classicalSaveParams: [String: Any] = [:]
    @State private var showClassicalResult = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("八字命理").font(.kaiti(20)).tracking(4).foregroundStyle(AppTheme.stone800)
            Text("填入即可排盘 · 已校准真太阳时")
                .font(.system(size: 11)).tracking(0.66).foregroundStyle(AppTheme.stone400.opacity(0.9)).padding(.top, 6)

            paritySegment(items: InputMode.allCases, selection: $mode)
                .padding(.top, 16).padding(.bottom, 20)
            Divider().overlay(AppTheme.stone200.opacity(0.7)).padding(.bottom, 16)

            HStack(spacing: 12) {
                TextField("姓名 / 备注", text: $name)
                    .font(.kaiti(14)).padding(.horizontal, 16).frame(height: 53.5)
                    .overlay { RoundedRectangle(cornerRadius: 12).stroke(AppTheme.stone200) }
                HStack(spacing: 4) {
                    ParityGenderButton(title: "乾造", subtitle: "男", selected: gender == .male) { gender = .male }
                    ParityGenderButton(title: "坤造", subtitle: "女", selected: gender == .female) { gender = .female }
                }
                .padding(4).frame(width: 124, height: 53.5)
                .background(AppTheme.stone200.opacity(0.30), in: RoundedRectangle(cornerRadius: 12))
            }

            if mode == .date {
                Button { showBirthPicker = true } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("出生时间").font(.system(size: 10, weight: .medium)).tracking(1.2).foregroundStyle(AppTheme.stone400)
                            Text("\(year)年\(month)月\(day)日 \(String(format: "%02d:%02d", hour, minute)) · \(calendarType.rawValue)")
                                .font(.kaiti(13.5)).foregroundStyle(AppTheme.ink)
                        }
                        Spacer(); ParityChevron()
                    }.padding(.horizontal, 16).frame(height: 67.5)
                    .overlay { RoundedRectangle(cornerRadius: 12).stroke(AppTheme.stone200) }
                }.buttonStyle(.plain).padding(.top, 12)
            } else {
                HStack(spacing: 8) {
                    TextField("快速输入，如：甲子乙丑丙寅丁卯", text: $quickBaziText)
                        .font(.kaiti(12)).textInputAutocapitalization(.never)
                    Button("识别") { parseQuickBazi() }.font(.system(size: 11)).foregroundStyle(AppTheme.stone600)
                }
                .padding(.horizontal, 12).frame(height: 42)
                .background(Color.black.opacity(0.018), in: RoundedRectangle(cornerRadius: 8))
                .overlay { RoundedRectangle(cornerRadius: 8).stroke(AppTheme.stone200) }
                .padding(.top, 12)

                HStack(spacing: 7) {
                    ForEach(0..<4, id: \.self) { position in
                        VStack(spacing: 5) {
                            Text(["年柱", "月柱", "日柱", "时柱"][position]).font(.system(size: 8)).foregroundStyle(AppTheme.faint)
                            TextField("甲子", text: Binding(get: { directPillars[position] }, set: { directPillars[position] = String($0.prefix(2)) }))
                                .font(.kaiti(16)).multilineTextAlignment(.center).textInputAutocapitalization(.never)
                        }.frame(maxWidth: .infinity).frame(height: 55)
                        .overlay { RoundedRectangle(cornerRadius: 7).stroke(AppTheme.stone200) }
                    }
                }.padding(.top, 8)
            }

            if mode == .date {
                Button { showLocationPicker = true } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "mappin.and.ellipse").font(.system(size: 13)).foregroundStyle(AppTheme.lunarMeta)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("出生地").font(.system(size: 10, weight: .medium)).tracking(1.2).foregroundStyle(AppTheme.stone400)
                            Text(province.isEmpty ? "出生地（可不填）" : "\(province) · \(city)")
                                .font(.system(size: 13.5)).foregroundStyle(province.isEmpty ? AppTheme.lunarDate : AppTheme.ink)
                        }
                        Spacer(); ParityChevron()
                    }.padding(.horizontal, 16).frame(height: 67.5)
                    .overlay { RoundedRectangle(cornerRadius: 12).stroke(AppTheme.stone200) }
                }.buttonStyle(.plain).padding(.top, 12)
            }

            if let errorMessage { Text(errorMessage).font(.kaiti(11.5)).foregroundStyle(AppTheme.cinnabar).padding(.top, 10) }

            HStack(spacing: 10) {
                Button { Task { await classical() } } label: {
                    Text("古典排盘").font(.kaiti(13)).tracking(0.65).foregroundStyle(AppTheme.stone600)
                        .frame(maxWidth: .infinity).frame(height: 41.5)
                        .overlay { RoundedRectangle(cornerRadius: 8).stroke(AppTheme.stone300.opacity(0.9)) }
                }
                Button { Task { await analyzeWithAI() } } label: {
                    HStack(spacing: 6) {
                        if isWorking { ProgressView().tint(.white).controlSize(.small) }
                        Text("AI 解析")
                    }
                    .font(.kaiti(13)).tracking(0.65).foregroundStyle(Color(red: 245 / 255, green: 242 / 255, blue: 237 / 255))
                    .frame(maxWidth: .infinity).frame(height: 41.5).background(AppTheme.ink, in: RoundedRectangle(cornerRadius: 8))
                }
                .disabled(isWorking)
            }.padding(.top, 20)
        }
        .padding(.horizontal, 20).padding(.top, 24).padding(.bottom, 20).padding(1)
        .background(AppTheme.background, in: RoundedRectangle(cornerRadius: 22))
        .overlay { RoundedRectangle(cornerRadius: 22).stroke(AppTheme.stone200.opacity(0.8)) }
        .task { restoreCache(); await loadMetadata() }
        .onChange(of: cacheSignature) { _, _ in saveCache() }
        .sheet(isPresented: $showBirthPicker) { birthPicker }
        .sheet(isPresented: $showLocationPicker) { locationPicker }
        .sheet(isPresented: $showClassicalResult) {
            NavigationStack {
                ClassicalReportView(params: stringifyParams(classicalSaveParams))
            }
        }
    }

    private func paritySegment<T: RawRepresentable & Hashable>(items: [T], selection: Binding<T>) -> some View where T.RawValue == String {
        HStack(spacing: 0) {
            ForEach(items, id: \.self) { item in
                Button { withAnimation(.easeInOut(duration: 0.22)) { selection.wrappedValue = item } } label: {
                    Text(item.rawValue).font(.system(size: 12)).tracking(1.2)
                        .foregroundStyle(selection.wrappedValue == item ? AppTheme.stone800 : AppTheme.stone500)
                        .frame(maxWidth: .infinity).frame(height: 38)
                        .background(selection.wrappedValue == item ? AppTheme.background : Color.clear, in: RoundedRectangle(cornerRadius: 8))
                        .shadow(color: selection.wrappedValue == item ? .black.opacity(0.08) : .clear, radius: 2, y: 1)
                }.buttonStyle(.plain)
            }
        }.padding(4).padding(1).background(AppTheme.stone200.opacity(0.32), in: RoundedRectangle(cornerRadius: 12))
    }

    private var birthPicker: some View {
        NavigationStack {
            Form {
                Picker("历法", selection: $calendarType) { ForEach(CalendarType.allCases, id: \.self) { Text($0.rawValue).tag($0) } }
                    .pickerStyle(.segmented)
                Section("快速输入") {
                    HStack {
                        TextField("1995年6月15日12时30分", text: $quickDateText)
                            .keyboardType(.numbersAndPunctuation)
                        Button("识别") { parseQuickDate() }
                    }
                    Text("支持 1995-6-15 12:30、1995/6/15 或中文年月日。")
                        .font(.system(size: 10)).foregroundStyle(AppTheme.stone400)
                }
                Picker("年份", selection: $year) { ForEach(1900...2050, id: \.self) { Text("\($0)年").tag($0) } }
                Picker("月份", selection: $month) { ForEach(1...12, id: \.self) { Text("\($0)月").tag($0) } }
                Picker("日期", selection: $day) { ForEach(1...(calendarType == .lunar ? 30 : daysInSelectedMonth), id: \.self) { Text("\($0)日").tag($0) } }
                Picker("小时", selection: $hour) { ForEach(0...23, id: \.self) { Text(String(format: "%02d时", $0)).tag($0) } }
                Picker("分钟", selection: $minute) { ForEach(0...59, id: \.self) { Text(String(format: "%02d分", $0)).tag($0) } }
                if calendarType == .lunar { Toggle("闰月", isOn: $leapMonth) }
            }
            .navigationTitle("出生时间")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("确定") { day = min(day, calendarType == .lunar ? 30 : daysInSelectedMonth); showBirthPicker = false } } }
        }.presentationDetents([.large])
    }

    private var locationPicker: some View {
        NavigationStack {
            Form {
                Picker("省份 / 地区", selection: $province) {
                    Text("不填写").tag("")
                    ForEach(metadata?.provinces ?? [], id: \.self) { Text($0).tag($0) }
                }
                if !province.isEmpty {
                    Picker("城市 / 时区", selection: $city) {
                        ForEach(metadata?.cities[province] ?? [], id: \.self) { Text($0).tag($0) }
                    }
                }
            }
            .onChange(of: province) { _, value in city = metadata?.cities[value]?.first ?? "" }
            .navigationTitle("选择出生地")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("清除") { province = ""; city = ""; showLocationPicker = false } }
                ToolbarItem(placement: .confirmationAction) { Button("确定") { showLocationPicker = false } }
            }
        }.presentationDetents([.medium, .large])
    }

    private var daysInSelectedMonth: Int {
        Calendar(identifier: .gregorian).range(of: .day, in: .month, for: Calendar.current.date(from: DateComponents(year: year, month: month)) ?? Date())?.count ?? 30
    }

    private var cacheSignature: String {
        [mode.rawValue, calendarType.rawValue, gender.rawValue, name, String(year), String(month), String(day), String(hour), String(minute), String(leapMonth), directPillars.joined(), province, city, quickDateText, quickBaziText].joined(separator: "|")
    }

    private func parseQuickDate() {
        let values = quickDateText.split(whereSeparator: { !$0.isNumber }).compactMap { Int($0) }
        guard values.count >= 3, (1900...2050).contains(values[0]), (1...12).contains(values[1]) else {
            errorMessage = "未识别到有效年月日"; return
        }
        year = values[0]; month = values[1]; day = max(1, min(calendarType == .lunar ? 30 : daysInSelectedMonth, values[2]))
        if values.count > 3 { hour = max(0, min(23, values[3])) }
        if values.count > 4 { minute = max(0, min(59, values[4])) }
        errorMessage = nil
    }

    private func parseQuickBazi() {
        let clean = quickBaziText.filter { !$0.isWhitespace }
        guard clean.count >= 8 else { errorMessage = "请输入完整的四柱八字"; return }
        let chars = Array(clean.prefix(8))
        directPillars = stride(from: 0, to: 8, by: 2).map { String(chars[$0...($0 + 1)]) }
        guard directInput() != nil else { errorMessage = "干支无效或阴阳不相配"; return }
        errorMessage = nil
    }

    private func saveCache() {
        let value = BaziSheetCache(
            mode: mode.rawValue, calendarType: calendarType.rawValue, gender: gender.rawValue, name: name,
            year: year, month: month, day: day, hour: hour, minute: minute, leapMonth: leapMonth,
            directPillars: directPillars, province: province, city: city,
            quickDateText: quickDateText, quickBaziText: quickBaziText
        )
        if let data = try? JSONEncoder().encode(value) { UserDefaults.standard.set(data, forKey: "bazi-input-cache-v1") }
    }

    private func restoreCache() {
        guard let data = UserDefaults.standard.data(forKey: "bazi-input-cache-v1"),
              let value = try? JSONDecoder().decode(BaziSheetCache.self, from: data) else { return }
        mode = InputMode(rawValue: value.mode) ?? .date
        calendarType = CalendarType(rawValue: value.calendarType) ?? .solar
        gender = Gender(rawValue: value.gender) ?? .male
        name = value.name; year = value.year; month = value.month; day = value.day; hour = value.hour; minute = value.minute
        leapMonth = value.leapMonth; directPillars = value.directPillars.count == 4 ? value.directPillars : ["", "", "", ""]
        province = value.province; city = value.city; quickDateText = value.quickDateText; quickBaziText = value.quickBaziText
    }

    private func loadMetadata() async {
        do { metadata = try await APIClient.shared.request("/api/mobile/bazi") }
        catch { /* 出生地为可选项，元数据失败不阻塞排盘 */ }
    }

    private func directInput() -> [String: Any]? {
        let gans = "甲乙丙丁戊己庚辛壬癸"
        let zhis = "子丑寅卯辰巳午未申酉戌亥"
        let yangGan = "甲丙戊庚壬"
        let yangZhi = "子寅辰午申戌"
        guard directPillars.allSatisfy({ $0.count == 2 }) else { return nil }
        var selectedGans: [String] = [], selectedZhis: [String] = []
        for pair in directPillars {
            let chars = Array(pair)
            let gan = String(chars[0]), zhi = String(chars[1])
            guard gans.contains(gan), zhis.contains(zhi), yangGan.contains(gan) == yangZhi.contains(zhi) else { return nil }
            selectedGans.append(gan); selectedZhis.append(zhi)
        }
        return ["year": 2000, "month": 1, "day": 1, "hour": 0, "minute": 0, "directBazi": ["gans": selectedGans, "zhis": selectedZhis]]
    }

    private func requestInput() -> [String: Any]? {
        if mode == .pillars { return directInput() }
        let location: [String: Any]? = province.isEmpty || city.isEmpty ? nil : ["province": province, "city": city]
        if calendarType == .lunar {
            var lunar: [String: Any] = ["year": year, "month": month, "day": day, "hour": hour, "minute": minute, "isLeapMonth": leapMonth]
            if let location { lunar["location"] = location }
            return ["calendarType": "lunar", "lunar": lunar]
        }
        var input: [String: Any] = ["year": year, "month": month, "day": day, "hour": hour, "minute": minute]
        if let location { input["location"] = location }
        return ["input": input]
    }

    private func requestBody(action: String) -> [String: Any]? {
        guard var body = requestInput() else { return nil }
        body["action"] = action
        body["context"] = [
            "name": name, "gender": gender.rawValue,
            "birthDate": mode == .date ? "\(year)年\(month)月\(day)日 \(String(format: "%02d:%02d", hour, minute))" : "",
        ]
        return body
    }

    private func classical() async {
        guard requestBody(action: "report") != nil else { errorMessage = "请输入四组有效干支，且阴阳必须相配"; return }
        guard let body = requestBody(action: "analyze") else { errorMessage = "请输入四组有效干支，且阴阳必须相配"; return }
        isWorking = true; defer { isWorking = false }
        do {
            let response: NativeBaziAnalysisResponse = try await APIClient.shared.request("/api/mobile/bazi", method: .POST, json: body)
            classicalSaveParams = response.recordParams.mapValues(\.anyValue)
            showClassicalResult = true
        } catch { errorMessage = error.localizedDescription }
    }

    private func analyzeWithAI() async {
        guard let body = requestBody(action: "analyze") else { errorMessage = "请输入四组有效干支，且阴阳必须相配"; return }
        isWorking = true; defer { isWorking = false }
        do {
            let response: NativeBaziAnalysisResponse = try await APIClient.shared.request("/api/mobile/bazi", method: .POST, json: body)
            flow.openChat(preset: "请帮我解析该八字", importData: ["bazi": [response.importData.mapValues(\.anyValue)]], autoSend: true)
        } catch { errorMessage = error.localizedDescription }
    }

    private func stringifyParams(_ params: [String: Any]) -> [String: String] {
        Dictionary(uniqueKeysWithValues: params.map { key, value in
            if let text = value as? String { return (key, text) }
            if let number = value as? Int { return (key, String(number)) }
            if let number = value as? Double {
                if number.rounded() == number { return (key, String(Int(number))) }
                return (key, String(number))
            }
            if let flag = value as? Bool { return (key, flag ? "true" : "false") }
            return (key, "\(value)")
        })
    }
}

struct MBTIParityEntryCard: View {
    @EnvironmentObject private var flow: AppFlowStore
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text("荣格八维").font(.kaiti(17)).tracking(1.7)
                Text("COGNITIVE").font(.system(size: 9)).tracking(2.52).foregroundStyle(AppTheme.stone400)
            }
            Text("认知功能 · 心智图谱").font(.system(size: 11)).tracking(1.76).foregroundStyle(AppTheme.stone400).padding(.top, 16)
            HStack(spacing: 0) {
                ForEach(["Ni", "Ne", "Si", "Se", "Ti", "Te", "Fi", "Fe"], id: \.self) { item in
                    Text(item).font(.system(size: 11)).tracking(0.66).foregroundStyle(AppTheme.stone500).frame(maxWidth: .infinity)
                }
            }.frame(height: 38.5).overlay(alignment: .top) { Divider().overlay(AppTheme.hairline) }
                .overlay(alignment: .bottom) { Divider().overlay(AppTheme.hairline) }.padding(.top, 16).padding(.bottom, 16)
            Text("从八个认知功能开始，观察你如何感知、判断、行动与回避。")
                .font(.kaiti(12.5)).foregroundStyle(AppTheme.stone600).lineSpacing(11).frame(height: 56, alignment: .topLeading)
            Button { flow.openMBTI() } label: {
                HStack(spacing: 8) { Text("开始测试").font(.system(size: 13)).tracking(1.82); Image(systemName: "arrow.right").font(.system(size: 16)) }
                    .frame(maxWidth: .infinity).foregroundStyle(AppTheme.background).frame(height: 43.5)
                    .background(AppTheme.ink, in: RoundedRectangle(cornerRadius: 9))
            }.buttonStyle(.plain).padding(.top, 20)
        }
        .padding(20).padding(1).background(AppTheme.background, in: RoundedRectangle(cornerRadius: 8))
        .overlay { RoundedRectangle(cornerRadius: 8).stroke(AppTheme.stone200.opacity(0.8)) }
        .shadow(color: .black.opacity(0.035), radius: 3, y: 1)
    }
}

private struct DailyScoreRing: View {
    let score: Double
    var color: Color = AppTheme.jade
    var body: some View {
        ZStack {
            Circle().trim(from: 0.08, to: 0.92).stroke(AppTheme.stone200, style: StrokeStyle(lineWidth: 5, lineCap: .round)).rotationEffect(.degrees(90))
            Circle().trim(from: 0.08, to: 0.08 + 0.84 * score / 100).stroke(color, style: StrokeStyle(lineWidth: 5, lineCap: .round)).rotationEffect(.degrees(90))
            VStack(spacing: 1) { Text(score.formatted(.number.precision(.fractionLength(score.rounded() == score ? 0 : 1)))).font(.system(size: 21, weight: .medium)); Text("能量").font(.system(size: 8)).foregroundStyle(AppTheme.stone400) }
        }.frame(width: 82, height: 82)
    }
}

private struct LegacyFortuneCalendarIcon: View {
    var body: some View { Image(systemName: "calendar").font(.system(size: 13, weight: .light)).foregroundStyle(AppTheme.lunarMeta).frame(width: 16) }
}

private struct ParityChevron: View {
    var body: some View { Image(systemName: "chevron.right").font(.system(size: 10, weight: .semibold)).foregroundStyle(AppTheme.stone400).frame(width: 28, height: 28).background(AppTheme.stone200.opacity(0.35), in: Circle()) }
}

private struct ParityGenderButton: View {
    let title: String
    let subtitle: String
    let selected: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) { Text(title).font(.kaiti(14)).tracking(1.1); Text(subtitle).font(.system(size: 9)).tracking(1.6) }
                .foregroundStyle(selected ? AppTheme.stone800 : AppTheme.stone400).frame(maxWidth: .infinity).frame(maxHeight: .infinity)
                .background(selected ? AppTheme.background : Color.clear, in: RoundedRectangle(cornerRadius: 8))
        }.buttonStyle(.plain)
    }
}
