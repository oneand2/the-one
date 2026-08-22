import SwiftUI
import UIKit

enum AppTheme {
    // 所有设计值由 design/mobile-ui.tokens.json 生成，禁止在此处再手工抄色值。
    private static func token(_ value: String) -> Color {
        Color(hex: value) ?? .clear
    }

    static let background = token(UIContract.Colors.background)
    static let ink = token(UIContract.Colors.ink)
    static let headerGlyph = token(UIContract.Colors.headerGlyph)
    static let headerTitle = token(UIContract.Colors.headerTitle)
    static let stone800 = token(UIContract.Colors.stone800)
    static let stone700 = token(UIContract.Colors.stone700)
    static let stone600 = token(UIContract.Colors.stone600)
    static let stone500 = token(UIContract.Colors.stone500)
    static let stone400 = token(UIContract.Colors.stone400)
    static let stone300 = token(UIContract.Colors.stone300)
    static let stone200 = token(UIContract.Colors.stone200)
    static let stone100 = token(UIContract.Colors.stone100)
    static let secondaryInk = token(UIContract.Colors.secondaryInk)
    static let muted = token(UIContract.Colors.stone500)
    static let faint = token(UIContract.Colors.faint)
    static let authMuted = token(UIContract.Colors.authMuted)
    static let authFaint = token(UIContract.Colors.authFaint)
    static let authLine = token(UIContract.Colors.authLine)
    static let lunarInk = token(UIContract.Colors.lunarInk)
    static let lunarMeta = token(UIContract.Colors.lunarMeta)
    static let lunarDate = token(UIContract.Colors.lunarDate)
    static let lunarText = token(UIContract.Colors.lunarText)
    static let paper = background
    static let warmWhite = token(UIContract.Colors.warmWhite)
    static let jade = token(UIContract.Colors.jade)
    static let jadeLight = token(UIContract.Colors.jadeLight)
    static let cinnabar = token(UIContract.Colors.cinnabar)
    static let gold = token(UIContract.Colors.gold)
    static let hairline = Color.black.opacity(UIContract.Alpha.hairline)

    static let wood = token(UIContract.Colors.wood)
    static let fire = token(UIContract.Colors.fire)
    static let earth = token(UIContract.Colors.earth)
    static let metal = token(UIContract.Colors.metal)
    static let water = token(UIContract.Colors.water)
}

extension Color {
    init?(hex: String) {
        var raw = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if raw.hasPrefix("#") { raw.removeFirst() }
        guard raw.count == 6, let value = UInt64(raw, radix: 16) else { return nil }
        self.init(
            red: Double((value >> 16) & 0xff) / 255,
            green: Double((value >> 8) & 0xff) / 255,
            blue: Double(value & 0xff) / 255
        )
    }
}

extension Font {
    static func kaiti(_ size: CGFloat) -> Font {
        .custom("Kaiti SC", size: size)
    }

    static func webSerif(_ size: CGFloat) -> Font {
        .custom("Songti SC", size: size)
    }
}

struct AmbientBackground: View {
    var body: some View {
        AppTheme.background.ignoresSafeArea()
    }
}

struct GlassCard<Content: View>: View {
    var padding: CGFloat = 20
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .background(AppTheme.background, in: RoundedRectangle(cornerRadius: UIContract.Radii.medium, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: UIContract.Radii.medium, style: .continuous)
                    .stroke(AppTheme.hairline, lineWidth: 1)
            }
            .shadow(color: Color.black.opacity(UIContract.Alpha.softShadow), radius: 4, y: 2)
    }
}

/// 原生页面统一使用的暖白内容面板；材质、细线与网页移动端卡片保持一致。
struct NativeSurface<Content: View>: View {
    var padding: CGFloat = UIContract.Spacing.md
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .background(
                AppTheme.warmWhite,
                in: RoundedRectangle(cornerRadius: UIContract.Radii.medium, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: UIContract.Radii.medium, style: .continuous)
                    .stroke(AppTheme.hairline, lineWidth: 1)
            }
            .shadow(color: Color.black.opacity(UIContract.Alpha.softShadow), radius: 8, y: 2)
    }
}

struct NativeSheetHeader: View {
    let title: String
    var subtitle: String? = nil
    var close: (() -> Void)? = nil

    var body: some View {
        HStack(alignment: .top, spacing: UIContract.Spacing.md) {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.webSerif(26))
                    .foregroundStyle(AppTheme.stone800)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(AppTheme.stone500)
                        .lineSpacing(3)
                }
            }
            Spacer(minLength: 12)
            if let close {
                Button(action: close) {
                    Image(systemName: "xmark")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(AppTheme.stone500)
                        .frame(width: 36, height: 36)
                        .background(AppTheme.warmWhite, in: Circle())
                        .overlay { Circle().stroke(AppTheme.hairline, lineWidth: 1) }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("关闭")
                .sensoryTap()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct NativeSectionHeading: View {
    let title: String
    var detail: String? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(title)
                .font(.system(size: 11, weight: .medium))
                .tracking(2.2)
                .foregroundStyle(AppTheme.stone500)
            if let detail {
                Text(detail)
                    .font(.system(size: 10))
                    .foregroundStyle(AppTheme.faint)
            }
            Rectangle().fill(AppTheme.hairline).frame(height: 1)
        }
    }
}

struct NativeMenuRow: View {
    let title: String
    var detail: String? = nil
    var icon: String? = nil
    var tint: Color = AppTheme.stone500
    var showsChevron = true

    var body: some View {
        HStack(spacing: 13) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(tint)
                    .frame(width: 30, height: 30)
                    .background(tint.opacity(0.075), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 14))
                    .foregroundStyle(AppTheme.stone800)
                if let detail {
                    Text(detail)
                        .font(.system(size: 10))
                        .foregroundStyle(AppTheme.stone400)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 10)
            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(AppTheme.stone300)
            }
        }
        .frame(minHeight: 48)
        .contentShape(Rectangle())
    }
}

struct NativeEmptyState: View {
    let symbol: FourSymbol
    let title: String
    let detail: String

    var body: some View {
        VStack(spacing: 16) {
            FourSymbolGlyph(symbol: symbol, width: 30, lineHeight: 5, color: AppTheme.stone300)
            Text(title).font(.webSerif(18)).foregroundStyle(AppTheme.stone600)
            Text(detail)
                .font(.system(size: 12))
                .foregroundStyle(AppTheme.stone400)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, UIContract.Spacing.section)
        .padding(.horizontal, UIContract.Spacing.lg)
    }
}

struct SectionTitle: View {
    let eyebrow: String
    let title: String

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(eyebrow.uppercased())
                .font(.system(size: UIContract.Typography.sectionEyebrow.size))
                .tracking(UIContract.Typography.sectionEyebrow.letterSpacing)
                .foregroundStyle(AppTheme.muted)
            Text(title)
                .font(.kaiti(24))
                .tracking(2)
                .foregroundStyle(AppTheme.ink)
        }
    }
}

enum FourSymbol: String, CaseIterable {
    case guanshi, wendao, guanxin, juexingcang

    var title: String {
        UIContract.screens[rawValue]?.title ?? rawValue
    }

    var subtitle: String {
        UIContract.screens[rawValue]?.subtitle ?? ""
    }

    var lines: [(Bool, Bool)] {
        switch self {
        case .guanshi: [(true, true), (true, true)]
        case .wendao: [(true, true), (false, false)]
        case .guanxin: [(false, false), (true, true)]
        case .juexingcang: [(false, false), (false, false)]
        }
    }
}

struct FourSymbolGlyph: View {
    let symbol: FourSymbol
    var width: CGFloat = 32
    var lineHeight: CGFloat = 6
    var color: Color = AppTheme.ink

    var body: some View {
        Canvas { context, _ in
            for (index, halves) in symbol.lines.enumerated() {
                let y = width * (index == 0 ? 0.20 : 0.60)
                if halves.0 {
                    context.fill(Path(CGRect(x: 0, y: y, width: width * 0.44, height: lineHeight)), with: .color(color))
                    context.fill(Path(CGRect(x: width * 0.56, y: y, width: width * 0.44, height: lineHeight)), with: .color(color))
                } else {
                    context.fill(Path(CGRect(x: 0, y: y, width: width, height: lineHeight)), with: .color(color))
                }
            }
        }
        .frame(width: width, height: width)
        .accessibilityHidden(true)
    }
}

struct LegacyPageHeader: View {
    let symbol: FourSymbol
    var title: String? = nil
    var subtitle: String? = nil

    var body: some View {
        VStack(spacing: 0) {
            FourSymbolGlyph(
                symbol: symbol,
                width: UIContract.Header.glyphSize,
                lineHeight: UIContract.Header.glyphLineHeight,
                color: AppTheme.headerGlyph
            )
            Text(title ?? symbol.title)
                .font(.webSerif(UIContract.Typography.pageTitle.size))
                .tracking(UIContract.Typography.pageTitle.letterSpacing)
                .foregroundStyle(AppTheme.headerTitle)
                .frame(height: UIContract.Typography.pageTitle.lineHeight)
                .padding(.top, UIContract.Header.glyphToTitle)
            Text(subtitle ?? symbol.subtitle)
                .font(.system(size: UIContract.Typography.pageSubtitle.size))
                .tracking(UIContract.Typography.pageSubtitle.letterSpacing)
                .foregroundStyle(AppTheme.stone600)
                .frame(height: UIContract.Typography.pageSubtitle.lineHeight)
                .padding(.top, UIContract.Header.titleToSubtitle)
        }
        .frame(maxWidth: .infinity)
        // iPhone 17 Pro 顶部安全区约 59pt；补 5pt 后与网页 SVG 的 y=64 对齐。
        .padding(.top, UIContract.Header.nativeSafeOffset)
        .padding(.bottom, UIContract.Header.bottom)
    }
}

struct LegacySectionLabel: View {
    let title: String
    var side: String? = nil

    var body: some View {
        HStack(spacing: 12) {
            Text(title)
                .font(.system(size: UIContract.Typography.sectionEyebrow.size))
                .tracking(UIContract.Typography.sectionEyebrow.letterSpacing)
                .foregroundStyle(AppTheme.muted)
            if let side {
                Text(side)
                    .font(.system(size: 10))
                    .tracking(1.8)
                    .foregroundStyle(AppTheme.stone300)
            }
            Rectangle().fill(AppTheme.hairline).frame(height: 1)
        }
    }
}

extension View {
    func sensoryTap() -> some View {
        simultaneousGesture(TapGesture().onEnded {
            UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        })
    }
}
