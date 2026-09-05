import SwiftUI

enum BaguaPersonality {
    struct Dimension {
        let trigram: String
        let name: String
        let shortDescription: String
        /// 三爻自上而下；true 为阳爻，false 为阴爻。
        let lines: [Bool]

        var label: String { "\(trigram)·\(name)" }
    }

    struct DoorPosition {
        let door: String
        let role: String
        let layer: String
        let description: String
    }

    static let dimensions: [String: Dimension] = [
        "Te": Dimension(trigram: "乾", name: "行健", shortDescription: "决断与成事", lines: [true, true, true]),
        "Fi": Dimension(trigram: "坤", name: "守真", shortDescription: "价值与承载", lines: [false, false, false]),
        "Ne": Dimension(trigram: "震", name: "启变", shortDescription: "发想与开新", lines: [false, false, true]),
        "Si": Dimension(trigram: "巽", name: "浸润", shortDescription: "经验与积累", lines: [true, true, false]),
        "Ni": Dimension(trigram: "坎", name: "潜象", shortDescription: "洞察与预见", lines: [false, true, false]),
        "Se": Dimension(trigram: "离", name: "显象", shortDescription: "感知与临在", lines: [true, false, true]),
        "Ti": Dimension(trigram: "艮", name: "辨界", shortDescription: "分析与边界", lines: [true, false, false]),
        "Fe": Dimension(trigram: "兑", name: "和悦", shortDescription: "共情与交流", lines: [false, true, true]),
    ]

    static let displayOrder = ["Te", "Fi", "Ne", "Si", "Ni", "Se", "Ti", "Fe"]
    static let chartOrder = ["Se", "Si", "Ne", "Ni", "Te", "Ti", "Fe", "Fi"]

    static let doors = [
        DoorPosition(door: "开门", role: "主导", layer: "阳面", description: "最自然、最畅通的心智通道"),
        DoorPosition(door: "休门", role: "辅助", layer: "阳面", description: "调节、支持并稳定主导心势"),
        DoorPosition(door: "生门", role: "生发", layer: "阳面", description: "好奇、创造与尚在成长的力量"),
        DoorPosition(door: "景门", role: "向往", layer: "阳面", description: "既被吸引又尚未熟练掌握的远景"),
        DoorPosition(door: "惊门", role: "对立", layer: "阴面", description: "受到威胁时被唤起的警戒心势"),
        DoorPosition(door: "伤门", role: "批评", layer: "阴面", description: "用于纠错，也可能转为苛责与攻击"),
        DoorPosition(door: "杜门", role: "盲点", layer: "阴面", description: "难以觉察、容易受阻的心理通道"),
        DoorPosition(door: "死门", role: "深影", layer: "阴面", description: "极端压力下的瓦解与转化力量"),
    ]

    static let personalityNames: [String: String] = [
        "INFJ": "燃灯者", "ESTP": "涉川者", "INTJ": "独觉者", "INFP": "怀玉者",
        "ISFP": "游艺者", "INTP": "格物者", "ISTP": "游刃者", "ESFP": "采真者",
        "ENFP": "逍遥客", "ENTP": "纵横者", "ISTJ": "守常者", "ISFJ": "素心者",
        "ESFJ": "司礼者", "ESTJ": "司纲者", "ENTJ": "经纶者", "ENFJ": "渡人者",
    ]

    static let stacks: [String: [String]] = [
        "INFJ": ["Ni", "Fe", "Ti", "Se", "Ne", "Fi", "Te", "Si"],
        "INFP": ["Fi", "Ne", "Si", "Te", "Fe", "Ni", "Se", "Ti"],
        "INTJ": ["Ni", "Te", "Fi", "Se", "Ne", "Ti", "Fe", "Si"],
        "INTP": ["Ti", "Ne", "Si", "Fe", "Te", "Ni", "Se", "Fi"],
        "ISFJ": ["Si", "Fe", "Ti", "Ne", "Se", "Fi", "Te", "Ni"],
        "ISFP": ["Fi", "Se", "Ni", "Te", "Fe", "Si", "Ne", "Ti"],
        "ISTJ": ["Si", "Te", "Fi", "Ne", "Se", "Ti", "Fe", "Ni"],
        "ISTP": ["Ti", "Se", "Ni", "Fe", "Te", "Si", "Ne", "Fi"],
        "ENFJ": ["Fe", "Ni", "Se", "Ti", "Fi", "Ne", "Si", "Te"],
        "ENFP": ["Ne", "Fi", "Te", "Si", "Ni", "Fe", "Ti", "Se"],
        "ENTJ": ["Te", "Ni", "Se", "Fi", "Ti", "Ne", "Si", "Fe"],
        "ENTP": ["Ne", "Ti", "Fe", "Si", "Ni", "Te", "Fi", "Se"],
        "ESFJ": ["Fe", "Si", "Ne", "Ti", "Fi", "Se", "Ni", "Te"],
        "ESFP": ["Se", "Fi", "Te", "Ni", "Si", "Fe", "Ti", "Ne"],
        "ESTJ": ["Te", "Si", "Ne", "Fi", "Ti", "Se", "Ni", "Fe"],
        "ESTP": ["Se", "Ti", "Fe", "Ni", "Si", "Te", "Fi", "Ne"],
    ]

    static func dimension(for code: String?) -> Dimension? {
        guard let code else { return nil }
        return dimensions[code]
    }

    static func label(for code: String?) -> String {
        dimension(for: code)?.label ?? "未定"
    }

    static func personalityName(for type: String?) -> String {
        guard let type else { return "未定之象" }
        return personalityNames[type] ?? "未定之象"
    }

    static func present(_ source: String) -> String {
        var text = source
        for (type, name) in personalityNames {
            text = text.replacingOccurrences(of: type, with: "「\(name)」")
        }
        for (code, dimension) in dimensions {
            text = text.replacingOccurrences(of: code, with: dimension.label)
        }
        let replacements: [(String, String)] = [
            ("外向思维", "乾·行健"), ("外向思考", "乾·行健"), ("内向情感", "坤·守真"),
            ("外向直觉", "震·启变"), ("内向感觉", "巽·浸润"), ("内向直觉", "坎·潜象"),
            ("外向感觉", "离·显象"), ("内向思维", "艮·辨界"), ("内向思考", "艮·辨界"),
            ("外向情感", "兑·和悦"),
            ("主导功能", "开门心势"), ("第一功能", "开门心势"),
            ("辅助功能", "休门心势"), ("第二功能", "休门心势"),
            ("儿童功能", "生门心势"), ("第三功能", "生门心势"),
            ("劣势功能", "景门心势"), ("第四功能", "景门心势"),
            ("对立功能", "惊门心势"), ("第五功能", "惊门心势"),
            ("批评功能", "伤门心势"), ("第六功能", "伤门心势"),
            ("盲点功能", "杜门心势"), ("第七功能", "杜门心势"),
            ("恶魔功能", "死门心势"), ("第八功能", "死门心势"),
            ("荣格八维", "八卦人格"), ("八维认知功能", "八卦心势"),
            ("八维功能", "八卦心势"), ("认知功能", "心势"), ("功能栈", "八门心盘"),
            ("功能", "心势"), ("八维", "八卦"), ("MBTI", "八卦人格"), ("mbti", "八卦人格"),
            ("-Mask", "之面"), ("-Awakening", "觉醒"), ("-Grounding", "扎根"), ("-Enhancement", "增强"),
            ("Grip（抓取）", "景门失衡"), ("Grip", "景门失衡"), ("Door Slam", "断联"),
        ]
        for (old, new) in replacements {
            text = text.replacingOccurrences(of: old, with: new)
        }
        return text
    }
}

struct NativeBaguaGlyph: View {
    let code: String
    var width: CGFloat = 28
    var lineHeight: CGFloat = 2
    var color: Color = AppTheme.stone700

    var body: some View {
        let lines = BaguaPersonality.dimension(for: code)?.lines ?? [true, true, true]
        VStack(spacing: lineHeight * 1.65) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, isYang in
                if isYang {
                    Capsule().fill(color).frame(width: width, height: lineHeight)
                } else {
                    HStack(spacing: width * 0.18) {
                        Capsule().fill(color)
                        Capsule().fill(color)
                    }
                    .frame(width: width, height: lineHeight)
                }
            }
        }
        .frame(width: width, height: max(12, lineHeight * 7))
        .accessibilityLabel(BaguaPersonality.label(for: code))
    }
}
