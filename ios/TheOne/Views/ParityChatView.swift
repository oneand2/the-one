import SwiftUI

/// 原 JueXingCangView 的原生状态流：会话、收藏/删除、导入、六爻拦截、
/// 三种思考模式、流式回复与消息持久化均与网页端保持同一接口约定。
struct ParityChatView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var profile: ProfileStore
    @EnvironmentObject private var flow: AppFlowStore
    @AppStorage("ai-data-sharing-consent") private var hasAIConsent = false
    @AppStorage("juexingcang-tip-dont-show") private var tipDismissed = false

    let isActive: Bool

    @State private var messages: [ChatMessage] = []
    @State private var sessions: [ChatSession] = []
    @State private var currentSessionID: String?
    @State private var input = ""
    @State private var isSending = false
    @State private var useReasoning = false
    @State private var useSearch = false
    @State private var meditationMode = true
    @State private var liuyaoMode = true
    @State private var liuyaoQuestion: String?
    @State private var yaos: [Int] = []
    @State private var liuyaoAnalysis: LiuYaoAnalysis?
    @State private var isCasting = false
    @State private var tossCoins: [Int]?
    @State private var importData: [String: Any] = [:]
    @State private var showHistory = false
    @State private var showImport = false
    @State private var showConsent = false
    @State private var showUsageTip = false
    @State private var pendingSolve = false
    @State private var pendingLiuYaoStart = false
    @State private var pendingBypassesLiuYao = false
    @State private var showMeditationWarning = false
    @State private var errorMessage: String?
    @State private var lastSendAt = Date.distantPast
    @State private var needCoins: Int?
    @State private var showCoinsModal = false
    @State private var showStore = false

    private var skipCoins: Bool { profile.profile?.isActiveVip == true }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    LegacyPageHeader(symbol: .juexingcang)
                    chatControls.padding(.horizontal, 48)

                    if let question = liuyaoQuestion {
                        EmbeddedLiuYaoCard(
                            question: question,
                            yaos: yaos,
                            analysis: liuyaoAnalysis,
                            isCasting: isCasting,
                            tossCoins: tossCoins,
                            cast: castNext,
                            solve: requestSolve,
                            cancel: resetLiuYao
                        )
                        .padding(.horizontal, 24).padding(.top, 30)
                    } else if messages.isEmpty {
                        emptyState.padding(.horizontal, 48)
                    } else {
                        LazyVStack(spacing: 16) {
                            ForEach(messages) { message in MessageBubble(message: message).id(message.id) }
                            if isSending {
                                HStack(spacing: 7) {
                                    ThinkingDots()
                                    Text("思忖中").font(.kaiti(12)).foregroundStyle(AppTheme.muted)
                                    Spacer()
                                }
                            }
                        }
                        .padding(.horizontal, 24).padding(.top, 34)
                    }

                    if let errorMessage {
                        Text(errorMessage).font(.kaiti(12)).foregroundStyle(AppTheme.cinnabar)
                            .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 24).padding(.top, 12)
                    }
                    composer.padding(.horizontal, 24).padding(.top, 28).padding(.bottom, 125)
                }
            }
            .onChange(of: messages) { _, value in
                if let last = value.last { withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo(last.id, anchor: .bottom) } }
            }
        }
        .background(AppTheme.background)
        .overlay {
            if showUsageTip {
                UsageTipOverlay(close: { showUsageTip = false }, dontShowAgain: { tipDismissed = true; showUsageTip = false })
                    .ignoresSafeArea()
            }
        }
        .sheet(isPresented: $showHistory) {
            ChatHistorySheet(
                sessions: sessions,
                select: { session in Task { await selectSession(session) } },
                favorite: { session in Task { await toggleFavorite(session) } },
                rename: { session, title in Task { await renameSession(session, title: title) } },
                delete: { session in Task { await deleteSession(session) } }
            )
        }
        .sheet(isPresented: $showImport) {
            ChatImportSheet(existing: importData) { selected in
                importData = selected
                showImport = false
            }
        }
        .sheet(isPresented: $showStore) { StoreView() }
        .overlay {
            if showCoinsModal, let needCoins {
                InsufficientCoinsOverlay(needCoins: needCoins, onClose: { showCoinsModal = false }) {
                    showCoinsModal = false
                    showStore = true
                }
            }
        }
        .sheet(isPresented: $showConsent) {
            AIConsentView {
                hasAIConsent = true
                showConsent = false
                if pendingSolve { pendingSolve = false; Task { await solveHexagram() } }
                else { Task { await dispatchInput(bypassLiuYao: pendingBypassesLiuYao) } }
            }.presentationDetents([.medium, .large])
        }
        .task {
            if auth.isAuthenticated { await loadSessions() }
            if isActive { await activate() }
            if !tipDismissed {
                try? await Task.sleep(for: .milliseconds(300))
                if isActive && !tipDismissed { withAnimation(.easeOut(duration: 0.25)) { showUsageTip = true } }
            }
        }
        .onChange(of: isActive) { _, active in
            if active { Task { await activate() } }
            else { resetConversation(resetModes: true) }
        }
        .onChange(of: auth.isAuthenticated) { _, loggedIn in
            if loggedIn {
                Task { await loadSessions() }
                resumePendingLiuYaoIfNeeded()
            } else {
                sessions = []; currentSessionID = nil
            }
        }
    }

    private var chatControls: some View {
        VStack(spacing: 0) {
            HStack {
                Button { Task { await loadSessions(); showHistory = true } } label: { Label("历史对话", systemImage: "line.3.horizontal") }
                Spacer()
                Button { resetConversation(resetModes: false) } label: { Label("新建对话", systemImage: "plus") }
            }
            .font(.system(size: 12)).foregroundStyle(AppTheme.stone500).padding(.horizontal, 16).frame(height: 28)

            HStack(spacing: 16) {
                LegacyModeChip(title: "深思", cost: 2, showCost: !skipCoins, isOn: Binding(
                    get: { useReasoning },
                    set: { value in
                        if value && meditationMode {
                            showMeditationWarning = true
                            Task {
                                try? await Task.sleep(for: .seconds(3))
                                showMeditationWarning = false
                            }
                        } else { useReasoning = value }
                    }
                ))
                LegacyModeChip(title: "联网", cost: 2, showCost: !skipCoins, isOn: $useSearch)
            }.padding(.top, 16)
            .overlay(alignment: .top) {
                if showMeditationWarning {
                    Text("宗师模式不可以使用深思功能哦")
                        .font(.system(size: 11)).tracking(1.3).foregroundStyle(AppTheme.stone700)
                        .padding(.horizontal, 16).padding(.vertical, 10)
                        .background(Color.white.opacity(0.96), in: RoundedRectangle(cornerRadius: 10))
                        .overlay { RoundedRectangle(cornerRadius: 10).stroke(AppTheme.stone200) }
                        .shadow(color: .black.opacity(0.10), radius: 8, y: 3)
                        .offset(y: -48)
                        .transition(.scale(scale: 0.95).combined(with: .opacity))
                }
            }
            LinearGradient(colors: [.clear, AppTheme.stone200, .clear], startPoint: .leading, endPoint: .trailing).frame(height: 1).padding(.top, 16)
            if !skipCoins {
                (Text("每问基础消耗 ").foregroundColor(AppTheme.stone500) + Text("2").foregroundColor(legacyAmber.opacity(0.8)) + Text(" 铜币").foregroundColor(AppTheme.stone500))
                    .font(.system(size: 10, weight: .light)).tracking(1.8).padding(.top, 16)
            } else {
                Text("VIP 使用全部功能不消耗铜币")
                    .font(.system(size: 10, weight: .light)).tracking(1.8).foregroundStyle(AppTheme.stone500).padding(.top, 16)
            }
            HStack(spacing: 6) {
                Text("点击中心圆球可\(meditationMode ? " 关闭 " : " 开启 ")宗师模式")
                if !skipCoins {
                    HStack(spacing: 4) { Text("宗师模式"); CopperCoinMark(size: 10); Text("20") }.foregroundStyle(legacyAmber.opacity(0.70))
                }
            }.font(.system(size: 9, weight: .light)).tracking(1.35).foregroundStyle(AppTheme.stone400).padding(.top, 8)
        }.padding(.top, 8).padding(.bottom, 16)
    }

    private var emptyState: some View {
        VStack(spacing: 0) {
            Button {
                meditationMode.toggle()
                if meditationMode { useReasoning = false }
            } label: { MasterOrbView(isActive: meditationMode) }
            .buttonStyle(.plain).padding(.bottom, 48)
            Text(meditationMode ? "天人合演" : "怀虚待问").font(.system(size: 16, weight: .light)).tracking(6.4).foregroundStyle(AppTheme.headerTitle)
            Text("知天之所为，知人之所为").font(.system(size: 12, weight: .light)).tracking(1.8).foregroundStyle(AppTheme.stone500).padding(.top, 20)
            if !skipCoins {
                HStack(spacing: 4) { Text("宗师模式"); CopperCoinMark(size: 12); Text("20") }
                    .font(.system(size: 10, weight: .light)).foregroundStyle(legacyAmber.opacity(0.80)).padding(.top, 6)
            }
            Button("导入测算数据") { guard auth.requireAuthentication() else { return }; showImport = true }
                .font(.system(size: 11)).tracking(1.5).foregroundStyle(AppTheme.stone600).padding(.top, 48)
            Text(importSummary).font(.system(size: 9)).tracking(1.4).foregroundStyle(AppTheme.stone300).padding(.top, 8)
        }.padding(.top, 83.5)
    }

    private var composer: some View {
        VStack(spacing: 12) {
            HStack(alignment: .bottom, spacing: 10) {
                TextField(liuyaoMode ? "请先写下所问之事…" : "请输入问题...", text: $input, axis: .vertical)
                    .font(.kaiti(14)).lineLimit(1...5).padding(.horizontal, 15).padding(.vertical, 13)
                    .background(AppTheme.background, in: RoundedRectangle(cornerRadius: 10))
                    .overlay { RoundedRectangle(cornerRadius: 10).stroke(AppTheme.hairline) }
                Button { submitTapped() } label: {
                    Image(systemName: "arrow.up").font(.system(size: 15, weight: .semibold)).foregroundStyle(AppTheme.background)
                        .frame(width: 43, height: 43).background(AppTheme.ink, in: Circle())
                }
                .disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
                .opacity(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.35 : 1)
            }
            if !importChips.isEmpty {
                HStack(spacing: 10) {
                    Circle().fill(AppTheme.stone400).frame(width: 4, height: 4)
                    Text(importChips.map(\.label).joined(separator: "　"))
                        .font(.system(size: 10, weight: .light)).tracking(1.5)
                        .foregroundStyle(AppTheme.stone600)
                    Spacer()
                    Button("更改") { showImport = true }
                    Rectangle().fill(AppTheme.stone300).frame(width: 1, height: 10)
                    Button("清空") { importData = [:] }
                }
                .font(.system(size: 10, weight: .light)).tracking(1.2)
                .foregroundStyle(AppTheme.stone500)
            }
            HStack(spacing: 12) {
                Button {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        liuyaoMode.toggle()
                        if !liuyaoMode { resetLiuYao() }
                    }
                } label: {
                    HStack(spacing: 5) { Circle().fill(liuyaoMode ? AppTheme.stone700 : AppTheme.stone300).frame(width: 6, height: 6); Text("起卦") }
                }
                Button { showImport = true } label: { Label("导入数据", systemImage: "tray.and.arrow.down") }
                Spacer()
            }.font(.system(size: 10)).tracking(1.2).foregroundStyle(AppTheme.muted)
        }
    }

    private var importChips: [(key: String, label: String)] {
        var chips: [(key: String, label: String)] = []
        if let items = importData["bazi"] as? [Any], !items.isEmpty { chips.append(("bazi", "八字×\(items.count)")) }
        if let items = importData["mbti"] as? [Any], !items.isEmpty { chips.append(("mbti", "八维×\(items.count)")) }
        if let items = importData["liuyao"] as? [Any], !items.isEmpty { chips.append(("liuyao", "六爻×\(items.count)")) }
        if importData["qiancheng"] != nil { chips.append(("qiancheng", "占问前程")) }
        return chips
    }

    private var importSummary: String {
        let labels = importChips.map(\.label)
        return labels.isEmpty ? "八字 · 八维 · 六爻" : labels.joined(separator: "　")
    }

    private var legacyAmber: Color { Color(red: 180 / 255, green: 83 / 255, blue: 9 / 255) }

    private func activate() async {
        guard let pending = flow.consumePendingChat() else { return }
        resetConversation(resetModes: false)
        importData = pending.importData
        input = pending.preset
        pendingBypassesLiuYao = pending.importData["qiancheng"] != nil
        if pendingBypassesLiuYao { liuyaoMode = false }
        if pending.autoSend {
            if hasAIConsent { await dispatchInput(bypassLiuYao: true) }
            else { showConsent = true }
        }
    }

    private func submitTapped() {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        if liuyaoMode && liuyaoQuestion == nil {
            beginLiuYao(with: text)
            return
        }
        pendingBypassesLiuYao = true
        if hasAIConsent { Task { await dispatchInput(bypassLiuYao: true) } }
        else { showConsent = true }
    }

    private func dispatchInput(bypassLiuYao: Bool) async {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        if liuyaoMode && liuyaoQuestion == nil && !bypassLiuYao {
            beginLiuYao(with: text)
            return
        }
        await performSend(text, suppliedImport: importData)
    }

    private func beginLiuYao(with text: String) {
        let question = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty else { return }
        if !auth.requireAuthentication() {
            pendingLiuYaoStart = true
            return
        }
        pendingLiuYaoStart = false
        liuyaoQuestion = question
        input = ""
        yaos = []
        liuyaoAnalysis = nil
    }

    private func resumePendingLiuYaoIfNeeded() {
        guard pendingLiuYaoStart, liuyaoMode, liuyaoQuestion == nil else { return }
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            pendingLiuYaoStart = false
            return
        }
        beginLiuYao(with: text)
    }

    private func performSend(_ text: String, suppliedImport: [String: Any]) async {
        guard auth.requireAuthentication(), !isSending else { return }
        guard Date().timeIntervalSince(lastSendAt) >= 0.8 else { return }
        lastSendAt = Date(); input = ""; errorMessage = nil; isSending = true

        let existingCount = messages.count
        let user = ChatMessage(role: .user, content: text)
        messages.append(user)
        let assistantID = UUID()
        messages.append(ChatMessage(id: assistantID, role: .assistant, content: ""))

        do {
            let sessionID = try await ensureSession(firstMessage: text)
            let payloadMessages = messages.dropLast().map { ["role": $0.role.rawValue, "content": $0.content] }
            var payload: [String: Any] = [
                "messages": payloadMessages,
                "useReasoning": useReasoning,
                "useMeditation": meditationMode,
                "useSearch": useSearch,
            ]
            if !suppliedImport.isEmpty { payload["importData"] = suppliedImport }
            try await APIClient.shared.streamText("/api/chat", json: payload) { chunk in
                guard let position = messages.firstIndex(where: { $0.id == assistantID }) else { return }
                messages[position].content += chunk
            }
            let answer = messages.first(where: { $0.id == assistantID })?.content ?? ""
            try await APIClient.shared.request("/api/chat-sessions/\(sessionID)/messages", method: .POST, json: ["messages": [
                ["role": "user", "content": text], ["role": "assistant", "content": answer],
            ]])
            if existingCount == 0 {
                try? await APIClient.shared.request("/api/chat-sessions/\(sessionID)", method: .PATCH, json: ["title": String(text.prefix(24))])
            }
            await loadSessions(); await profile.load()
        } catch let error as APIError where error.statusCode == 402 {
            messages.removeAll { $0.id == assistantID && $0.content.isEmpty }
            needCoins = error.needCoins ?? 2
            showCoinsModal = true
            errorMessage = nil
        } catch {
            messages.removeAll { $0.id == assistantID && $0.content.isEmpty }
            errorMessage = error.localizedDescription
        }
        isSending = false
    }

    private func ensureSession(firstMessage: String) async throws -> String {
        if let currentSessionID { return currentSessionID }
        let session: ChatSession = try await APIClient.shared.request("/api/chat-sessions", method: .POST, json: ["title": String(firstMessage.prefix(24))])
        currentSessionID = session.id
        return session.id
    }

    private func loadSessions() async {
        guard auth.isAuthenticated else { sessions = []; return }
        do { sessions = try await APIClient.shared.request("/api/chat-sessions") }
        catch let error as APIError where error.statusCode == 401 { sessions = [] }
        catch { errorMessage = error.localizedDescription }
    }

    private func selectSession(_ session: ChatSession) async {
        do {
            let stored: [StoredChatMessage] = try await APIClient.shared.request("/api/chat-sessions/\(session.id)")
            messages = stored.compactMap { value in
                guard let role = ChatMessage.Role(rawValue: value.role) else { return nil }
                return ChatMessage(role: role, content: value.content)
            }
            currentSessionID = session.id; importData = [:]; resetLiuYao(); showHistory = false
        } catch { errorMessage = error.localizedDescription }
    }

    private func toggleFavorite(_ session: ChatSession) async {
        do {
            try await APIClient.shared.request("/api/chat-sessions/\(session.id)", method: .PATCH, json: ["is_favorite": !session.isFavorite])
            await loadSessions()
        } catch { errorMessage = error.localizedDescription }
    }

    private func renameSession(_ session: ChatSession, title: String) async {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        do {
            try await APIClient.shared.request("/api/chat-sessions/\(session.id)", method: .PATCH, json: ["title": trimmed])
            await loadSessions()
        } catch { errorMessage = error.localizedDescription }
    }

    private func deleteSession(_ session: ChatSession) async {
        do {
            try await APIClient.shared.request("/api/chat-sessions", method: .DELETE, query: [URLQueryItem(name: "id", value: session.id)])
            if currentSessionID == session.id { resetConversation(resetModes: false) }
            await loadSessions()
        } catch { errorMessage = error.localizedDescription }
    }

    private func resetConversation(resetModes: Bool) {
        messages = []; input = ""; currentSessionID = nil; importData = [:]; errorMessage = nil; resetLiuYao(); liuyaoMode = true; pendingLiuYaoStart = false
        if resetModes { useSearch = false; useReasoning = false; meditationMode = true }
    }

    private func resetLiuYao() { liuyaoQuestion = nil; yaos = []; liuyaoAnalysis = nil; isCasting = false; tossCoins = nil; pendingLiuYaoStart = false }

    private func castNext() {
        guard auth.requireAuthentication() else { return }
        guard yaos.count < 6, !isCasting else { return }
        let coins = (0..<3).map { _ in Bool.random() ? 2 : 3 }
        let value = coins.reduce(0, +)
        isCasting = true
        tossCoins = coins
        Task {
            try? await Task.sleep(for: .milliseconds(2800))
            withAnimation(.spring(response: 0.55, dampingFraction: 0.70)) { yaos.append(value) }
            tossCoins = nil
            isCasting = false
            if yaos.count == 6 {
                do { liuyaoAnalysis = try await APIClient.shared.request("/api/mobile/liuyao", method: .POST, json: ["yaos": yaos]) }
                catch { errorMessage = error.localizedDescription }
            }
        }
    }

    private func requestSolve() {
        guard yaos.count == 6, liuyaoAnalysis != nil else { return }
        guard auth.requireAuthentication() else { return }
        if hasAIConsent { Task { await solveHexagram() } }
        else { pendingSolve = true; showConsent = true }
    }

    private func solveHexagram() async {
        guard auth.requireAuthentication() else { return }
        guard let question = liuyaoQuestion, let analysis = liuyaoAnalysis else { return }
        var liuyao: [String: Any] = [
            "type": "liuyao", "question": question,
            "yaos": yaos.enumerated().map { ["position": $0.offset + 1, "name": ["初爻", "二爻", "三爻", "四爻", "五爻", "上爻"][$0.offset], "value": $0.element, "isChanging": $0.element == 6 || $0.element == 9] as [String: Any] },
            "hasMovingLines": analysis.hasMovingLines, "movingLineTexts": analysis.movingLineTexts,
        ]
        if let main = analysis.mainHexagram { liuyao["mainHexagram"] = ["title": main.title, "description": main.description] }
        if let changed = analysis.transformedHexagram { liuyao["transformedHexagram"] = ["title": changed.title, "description": changed.description] }
        if let interpretation = analysis.interpretation { liuyao["interpretation"] = ["title": interpretation.title, "texts": interpretation.texts, "type": interpretation.type] }
        let recordInfo = encodableDictionary(analysis)
        if auth.isAuthenticated {
            try? await APIClient.shared.request("/api/records/liuyao", method: .POST, json: [
                "question": question, "hexagram_info": recordInfo, "date": ISO8601DateFormatter().string(from: Date()), "ai_result": "",
            ])
        }
        importData = ["liuyao": [liuyao]]
        resetLiuYao(); liuyaoMode = false
        await performSend("请帮我解卦", suppliedImport: importData)
    }
}

private struct ChatHistorySheet: View {
    @Environment(\.dismiss) private var dismiss
    let sessions: [ChatSession]
    let select: (ChatSession) -> Void
    let favorite: (ChatSession) -> Void
    let rename: (ChatSession, String) -> Void
    let delete: (ChatSession) -> Void
    @State private var editingID: String?
    @State private var editingTitle = ""

    var body: some View {
        NavigationStack {
            Group {
                if sessions.isEmpty { ContentUnavailableView("暂无历史对话", systemImage: "bubble.left.and.bubble.right") }
                else {
                    List {
                        ForEach(sessions) { session in
                            Button { select(session); dismiss() } label: {
                                HStack(spacing: 10) {
                                    if session.isFavorite {
                                        Image(systemName: "star.fill").font(.system(size: 11)).foregroundStyle(Color(red: 245 / 255, green: 158 / 255, blue: 11 / 255))
                                    }
                                    VStack(alignment: .leading, spacing: 5) {
                                        if editingID == session.id {
                                            TextField("对话标题", text: $editingTitle)
                                                .font(.system(size: 13))
                                                .onSubmit { commitRename(session) }
                                        } else {
                                            Text(session.title).font(.system(size: 13, weight: .medium)).foregroundStyle(AppTheme.stone800)
                                        }
                                        Text(session.updatedAt).font(.system(size: 11)).foregroundStyle(AppTheme.stone400)
                                    }
                                    Spacer()
                                }
                            }
                            .buttonStyle(.plain)
                            .swipeActions(edge: .leading) {
                                Button { favorite(session) } label: { Label(session.isFavorite ? "取消收藏" : "收藏", systemImage: "star") }.tint(AppTheme.gold)
                            }
                            .swipeActions {
                                Button(role: .destructive) { delete(session) } label: { Label("删除", systemImage: "trash") }
                                Button {
                                    editingID = session.id
                                    editingTitle = session.title
                                } label: { Label("重命名", systemImage: "pencil") }
                            }
                            .contextMenu {
                                Button(session.isFavorite ? "取消收藏" : "收藏") { favorite(session) }
                                Button("重命名") { editingID = session.id; editingTitle = session.title }
                                Button("删除", role: .destructive) { delete(session) }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .safeAreaInset(edge: .bottom) {
                        Text("\(sessions.count) 个对话")
                            .font(.system(size: 11)).foregroundStyle(AppTheme.stone400)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 20).padding(.vertical, 12)
                            .background(AppTheme.background)
                    }
                }
            }
            .background(AppTheme.background)
            .navigationTitle("历史对话")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } } }
        }.presentationDetents([.medium, .large])
    }

    private func commitRename(_ session: ChatSession) {
        rename(session, editingTitle)
        editingID = nil
    }
}

private struct EmbeddedLiuYaoCard: View {
    let question: String
    let yaos: [Int]
    let analysis: LiuYaoAnalysis?
    let isCasting: Bool
    let tossCoins: [Int]?
    let cast: () -> Void
    let solve: () -> Void
    let cancel: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            VStack(spacing: 5) { Text("所 问").font(.system(size: 9)).tracking(2.4).foregroundStyle(AppTheme.stone400); Text(question).font(.kaiti(16)).multilineTextAlignment(.center) }
            if let tossCoins {
                CoinTossAnimation(finalCoins: tossCoins)
            } else if yaos.isEmpty {
                Text("静心，六掷成卦").font(.kaiti(19)).foregroundStyle(AppTheme.stone600).frame(height: 80)
            } else {
                VStack(spacing: 10) {
                    ForEach(Array(yaos.reversed().enumerated()), id: \.offset) { offset, value in ParityCastLine(value: value, label: "第\(yaos.count - offset)爻") }
                }
            }
            if let tossCoins {
                Text(yaoName(tossCoins.reduce(0, +))).font(.system(size: 11)).tracking(1.6).foregroundStyle(AppTheme.stone400)
            } else if !yaos.isEmpty && yaos.count < 6 {
                Text("已摇 \(yaos.count) 爻，还需摇 \(6 - yaos.count) 次").font(.system(size: 11)).foregroundStyle(AppTheme.stone400)
            }
            if let main = analysis?.mainHexagram {
                VStack(spacing: 5) { Text("本卦 · \(main.title)").font(.webSerif(19)); if let changed = analysis?.transformedHexagram { Text("之卦 · \(changed.title)").font(.kaiti(13)).foregroundStyle(AppTheme.stone500) }; Text(analysis?.interpretation?.title ?? "").font(.kaiti(11)).foregroundStyle(AppTheme.stone400) }
            }
            HStack(spacing: 10) {
                Button("取消") { cancel() }.frame(maxWidth: .infinity).frame(height: 43).overlay { RoundedRectangle(cornerRadius: 9).stroke(AppTheme.stone300) }
                Button(yaos.count == 6 ? "请帮我解卦" : (isCasting ? "摇卦中..." : (yaos.isEmpty ? "摇卦起卦" : "摇第 \(yaos.count + 1) 爻"))) { yaos.count == 6 ? solve() : cast() }
                    .disabled(isCasting || (yaos.count == 6 && analysis == nil)).foregroundStyle(.white).frame(maxWidth: .infinity).frame(height: 43).background(AppTheme.ink, in: RoundedRectangle(cornerRadius: 9))
            }.font(.kaiti(13))
        }
        .padding(20).background(Color.white.opacity(0.48), in: RoundedRectangle(cornerRadius: 14)).overlay { RoundedRectangle(cornerRadius: 14).stroke(AppTheme.stone200) }
    }

    private func yaoName(_ value: Int) -> String {
        switch value {
        case 6: return "老阴"
        case 7: return "少阳"
        case 8: return "少阴"
        case 9: return "老阳"
        default: return ""
        }
    }
}

private struct CoinTossAnimation: View {
    let finalCoins: [Int]
    @State private var current = [2, 2, 2]
    @State private var animating = true

    var body: some View {
        HStack(spacing: 32) {
            ForEach(0..<3, id: \.self) { index in
                CoinFace(value: current.indices.contains(index) ? current[index] : 2)
                    .offset(y: animating ? -12 : 0)
                    .scaleEffect(animating ? 1.05 : 1)
                    .animation(.easeInOut(duration: 0.80).repeatForever(autoreverses: true).delay(Double(index) * 0.15), value: animating)
            }
        }
        .padding(.vertical, 28)
        .task {
            while !Task.isCancelled && animating {
                current = (0..<3).map { _ in Bool.random() ? 2 : 3 }
                try? await Task.sleep(for: .milliseconds(180))
            }
        }
        .onAppear {
            Task {
                try? await Task.sleep(for: .seconds(2))
                animating = false
                current = finalCoins
            }
        }
    }
}

private struct CoinFace: View {
    let value: Int
    var body: some View {
        Group {
            if value == 3 {
                Circle().fill(AppTheme.stone800)
            } else {
                Circle().stroke(AppTheme.stone800, lineWidth: 4)
            }
        }
        .frame(width: 48, height: 48)
    }
}

private struct ParityCastLine: View {
    let value: Int
    let label: String
    var body: some View {
        HStack(spacing: 12) {
            Text(label).font(.system(size: 9)).foregroundStyle(AppTheme.stone400).frame(width: 34)
            if value % 2 == 1 { Capsule().fill(value == 9 ? AppTheme.cinnabar : AppTheme.ink).frame(height: 6) }
            else { HStack(spacing: 16) { Capsule().fill(value == 6 ? AppTheme.cinnabar : AppTheme.ink); Capsule().fill(value == 6 ? AppTheme.cinnabar : AppTheme.ink) }.frame(height: 6) }
            Circle().fill(value == 6 || value == 9 ? AppTheme.cinnabar : .clear).frame(width: 6, height: 6)
        }.transition(.move(edge: .bottom).combined(with: .opacity))
    }
}

private func encodableDictionary<T: Encodable>(_ value: T) -> [String: Any] {
    guard let data = try? JSONEncoder().encode(value), let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
    return object
}
