import Foundation

struct NativeUser: Codable, Identifiable {
    let id: String
    let email: String
    let nickname: String
}

struct AuthResponse: Decodable {
    let authenticated: Bool?
    let needsVerification: Bool?
    let email: String?
    let user: NativeUser?
}

struct Profile: Decodable {
    let nickname: String
    let coinsBalance: Int
    let inviteCode: String?
    let vipExpiresAt: String?
    let juexingcangMeditationDefault: Bool?

    enum CodingKeys: String, CodingKey {
        case nickname
        case coinsBalance = "coins_balance"
        case inviteCode = "invite_code"
        case vipExpiresAt = "vip_expires_at"
        case juexingcangMeditationDefault = "juexingcang_meditation_default"
    }

    var meditationDefaultEnabled: Bool { juexingcangMeditationDefault ?? true }

    private static let lifetimeSentinel = "9999-12-31T23:59:59.999Z"

    var isLifetimeVip: Bool {
        guard let vipExpiresAt else { return false }
        if vipExpiresAt == Self.lifetimeSentinel { return true }
        guard let expiry = Self.parseDate(vipExpiresAt) else { return false }
        return expiry >= Date(timeIntervalSince1970: 4_070_908_800) // 2099-01-01 UTC
    }

    var isActiveVip: Bool {
        guard let vipExpiresAt else { return false }
        if isLifetimeVip { return true }
        return Self.parseDate(vipExpiresAt).map { $0 > Date() } ?? false
    }

    var vipBadgeText: String {
        if isLifetimeVip { return "VIP" }
        guard let vipExpiresAt, let expiry = Self.parseDate(vipExpiresAt) else { return "VIP" }
        let startOfToday = Calendar.current.startOfDay(for: Date())
        let days = Int(ceil(expiry.timeIntervalSince(startOfToday) / 86_400))
        return days > 0 && days < 30 ? "\(days)天VIP" : "VIP"
    }

    var vipDetailText: String {
        if isLifetimeVip { return "终身VIP" }
        guard let vipExpiresAt, let expiry = Self.parseDate(vipExpiresAt) else { return "VIP" }
        let startOfToday = Calendar.current.startOfDay(for: Date())
        let days = Int(ceil(expiry.timeIntervalSince(startOfToday) / 86_400))
        return days > 0 ? "\(days)天 VIP" : "VIP"
    }

    private static func parseDate(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) { return date }
        let plain = ISO8601DateFormatter()
        return plain.date(from: value)
    }
}

struct DailyDrawResponse: Decodable {
    let periodKey: String
    let draw: DailyDraw?
}

struct DailyDraw: Decodable, Identifiable {
    let id: String
    let hexagramIndex: Int
    let createdAt: String
}

struct WorldNewsResponse: Decodable {
    let requestedDate: String
    let earliestYear: Int
    let isYesterdayFallback: Bool
    let newsDate: String?
    let items: [WorldNewsItem]
}

struct WorldNewsItem: Decodable, Identifiable {
    let section: String
    let title: String
    let summary: String
    let source: String?
    let url: String?

    var id: String { section + "|" + title }
}

struct AlmanacResponse: Decodable {
    let lunarTitle: String
    let yearGanZhi: String
    let monthGanZhi: String
    let dayGanZhi: String
    let zodiac: String
    let weekDay: String
    let yi: [String]
    let ji: [String]
    let yearPillar: String
    let monthPillar: String
    let dayPillar: String
    let timePillar: String
    let currentZhi: String
    let tianShen: String
    let tianShenType: String
    let zhiXing: String
    let dayNaYin: String
    let chongShengXiao: String
    let sha: String
    let xiu: String?
    let xiuGong: String?
    let xiuZheng: String?
    let xiuAnimal: String?
    let shiChen: [ShiChenInfo]?
}

struct ShiChenInfo: Decodable, Identifiable {
    let ganZhi: String
    let zhi: String
    let luck: String
    let reason: String
    let range: String
    var id: String { ganZhi + range }
}

struct Pillar: Codable {
    let gan: String
    let zhi: String
    let wuxing: String
    var label: String { gan + zhi }
}

struct FourPillars: Codable {
    let year: Pillar
    let month: Pillar
    let day: Pillar
    let hour: Pillar
}

struct DayMaster: Codable {
    let gan: String
    let wuxing: String
    let tenGod: String
}

struct BaziResult: Codable {
    let pillars: FourPillars
    let dayMaster: DayMaster
    let nayin: [String: String]
    let shenSha: [String: [String]]
    let kongWang: [String: String]
}

struct SimplePillar: Codable {
    let gan: String
    let zhi: String
}

struct SimpleFourPillars: Codable {
    let year: SimplePillar
    let month: SimplePillar
    let day: SimplePillar
    let hour: SimplePillar
}

struct NativeBaziAnalysis: Codable {
    let pillars: SimpleFourPillars
    let pattern: String
    let strength: String
    let peerEnergyPercent: Double
    let climateGod: String
    let trueGod: String
}

struct NativeBaziAnalysisResponse: Codable {
    let analysis: NativeBaziAnalysis
    let classical: BaziResult
    let importData: [String: JSONValue]
    let recordParams: [String: JSONValue]
}

struct NativeBaziFortuneResponse: Codable {
    let analysis: NativeBaziAnalysis
    let importData: [String: JSONValue]
    let yongshen: String
    let pillars: SimpleFourPillars
    let hasHour: Bool
    let name: String?
}

struct DailyFortuneItem: Codable, Identifiable {
    let label: String
    let stem: String
    let wx: String
    let proportion: Double
    let maxPoints: Double
    let contribution: Double
    let relation: String
    var id: String { label + stem }
}

struct DailyFortuneLevel: Codable {
    let label: String
    let color: String
}

struct DailyFortuneResponse: Codable {
    let dayPillar: String
    let dayGan: String
    let dayZhi: String
    let yongshen: String
    let yongshenWuxing: String
    let items: [DailyFortuneItem]
    let totalAdj: Double
    let finalScore: Double
    let level: DailyFortuneLevel
}

struct SavedDailyFortune: Codable {
    let name: String?
    let yongshen: String
    let pillars: SimpleFourPillars
    let hasHour: Bool
    let bazi: [String: JSONValue]
}

struct RecordItem: Identifiable, Decodable {
    let id: String
    let createdAt: String
    let title: String
    let detail: String
}

enum JSONValue: Codable, Hashable {
    case string(String), number(Double), bool(Bool), object([String: JSONValue]), array([JSONValue]), null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode(Double.self) { self = .number(value) }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode([String: JSONValue].self) { self = .object(value) }
        else { self = .array(try container.decode([JSONValue].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    var text: String? {
        switch self {
        case .string(let value): value
        case .number(let value): value.formatted()
        case .bool(let value): value ? "是" : "否"
        default: nil
        }
    }

    var anyValue: Any {
        switch self {
        case .string(let value): value
        case .number(let value): value
        case .bool(let value): value
        case .object(let value): value.mapValues(\.anyValue)
        case .array(let value): value.map(\.anyValue)
        case .null: NSNull()
        }
    }
}

struct ClassicalRecord: Decodable, Identifiable {
    let id: String
    let params: [String: JSONValue]
    let createdAt: String
    enum CodingKeys: String, CodingKey { case id, params; case createdAt = "created_at" }
}

struct MBTIRecord: Decodable, Identifiable {
    let id: String
    let type: String
    let createdAt: String
    enum CodingKeys: String, CodingKey { case id, type; case createdAt = "created_at" }
}

struct MBTIImportRecord: Decodable, Identifiable {
    let id: String
    let type: String
    let functionScores: [String: Double]
    let createdAt: String
    enum CodingKeys: String, CodingKey {
        case id, type
        case functionScores = "function_scores"
        case createdAt = "created_at"
    }
}

struct LiuYaoRecord: Decodable, Identifiable {
    let id: String
    let question: String
    let createdAt: String
    enum CodingKeys: String, CodingKey { case id, question; case createdAt = "created_at" }
}

struct LiuYaoImportRecord: Decodable, Identifiable {
    let id: String
    let question: String
    let hexagramInfo: [String: JSONValue]
    let date: String
    let aiResult: String
    let createdAt: String
    enum CodingKeys: String, CodingKey {
        case id, question, date
        case hexagramInfo = "hexagram_info"
        case aiResult = "ai_result"
        case createdAt = "created_at"
    }
}

struct ChatMessage: Identifiable, Equatable {
    enum Role: String { case user, assistant }
    let id: UUID
    let role: Role
    var content: String

    init(id: UUID = UUID(), role: Role, content: String) {
        self.id = id
        self.role = role
        self.content = content
    }
}

struct ChatSession: Decodable, Identifiable, Equatable {
    let id: String
    var title: String
    let createdAt: String
    let updatedAt: String
    var isFavorite: Bool

    enum CodingKeys: String, CodingKey {
        case id, title
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case isFavorite = "is_favorite"
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        title = try values.decodeIfPresent(String.self, forKey: .title) ?? "新对话"
        createdAt = try values.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        updatedAt = try values.decodeIfPresent(String.self, forKey: .updatedAt) ?? createdAt
        isFavorite = try values.decodeIfPresent(Bool.self, forKey: .isFavorite) ?? false
    }
}

struct StoredChatMessage: Decodable, Identifiable {
    let id: String
    let role: String
    let content: String
    let isReasoning: Bool?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, role, content
        case isReasoning = "is_reasoning"
        case createdAt = "created_at"
    }
}

struct MBTIQuestionEnvelope: Decodable { let questions: [MBTIQuestion] }

struct MBTIQuestion: Decodable, Identifiable {
    let id: Int
    let category: String
    let question: String
    var options: [MBTIOption]
}

struct MBTIOption: Decodable, Identifiable {
    let id: String
    let text: String
    let targetTypes: [String]
    let weight: Int
    enum CodingKeys: String, CodingKey {
        case id, text, weight
        case targetTypes = "target_types"
    }
}

struct MBTIFunctionDetail: Decodable, Identifiable {
    let pos: String
    let title: String
    let logic: String
    let lesson: String
    var id: String { pos + title }
}

struct MBTITypeDetail: Decodable {
    let id: String
    let name: String
    let slogan: String
    let origin: String
    let guide: String
    let deepProfile: String
    let strengths: String
    let weaknesses: String
    let shadow: String
    let advice: String
    let functions: [MBTIFunctionDetail]
    enum CodingKeys: String, CodingKey {
        case id, name, slogan, origin, guide, strengths, weaknesses, shadow, advice, functions
        case deepProfile = "deep_profile"
    }
}

struct MBTIUserSlot: Decodable {
    let function: String
    let score: Double
    let hasConflict: Bool?
    let conflictWith: String?

    enum CodingKeys: String, CodingKey {
        case function, score, hasConflict, conflictWith
        case hasConflictSnake = "has_conflict"
        case conflictWithSnake = "conflict_with"
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        function = try values.decodeIfPresent(String.self, forKey: .function) ?? "—"
        score = try values.decodeIfPresent(Double.self, forKey: .score) ?? 0
        hasConflict = try values.decodeIfPresent(Bool.self, forKey: .hasConflict)
            ?? values.decodeIfPresent(Bool.self, forKey: .hasConflictSnake)
        conflictWith = try values.decodeIfPresent(String.self, forKey: .conflictWith)
            ?? values.decodeIfPresent(String.self, forKey: .conflictWithSnake)
    }
}

struct MBTITestResult: Decodable {
    let type: String
    let score: Double
    let fitScore: Double
    let shadowType: String
    let functionScores: [String: Double]
    let functionStrengths: [String: Double]
    let idealStrengths: [String: Double]
    let userSlots: [String: MBTIUserSlot]
    let detail: MBTITypeDetail?

    init(
        type: String,
        score: Double,
        fitScore: Double,
        shadowType: String,
        functionScores: [String: Double],
        functionStrengths: [String: Double],
        idealStrengths: [String: Double],
        userSlots: [String: MBTIUserSlot],
        detail: MBTITypeDetail?
    ) {
        self.type = type
        self.score = score
        self.fitScore = fitScore
        self.shadowType = shadowType
        self.functionScores = functionScores
        self.functionStrengths = functionStrengths
        self.idealStrengths = idealStrengths
        self.userSlots = userSlots
        self.detail = detail
    }
}

struct IChingHexagram: Codable {
    let code: String
    let name: String
    let title: String
    let description: String
    let lines: [String]
}

struct IChingInterpretation: Codable {
    let title: String
    let texts: [String]
    let type: String
}

struct LiuYaoAnalysis: Codable {
    let mainHexagram: IChingHexagram?
    let transformedHexagram: IChingHexagram?
    let movingLineTexts: [String]
    let movingPositions: [Int]
    let hasMovingLines: Bool
    let interpretation: IChingInterpretation?
}
