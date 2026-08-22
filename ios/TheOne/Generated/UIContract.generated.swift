// Generated from design/mobile-ui.tokens.json. Do not edit.
import Foundation

enum UIContract {
    static let version = 1
    static let referenceViewportWidth: CGFloat = 402
    static let referenceViewportHeight: CGFloat = 874
    static let contentMaxWidth: CGFloat = 448

    struct TextStyle {
        let family: String
        let size: CGFloat
        let lineHeight: CGFloat
        let letterSpacing: CGFloat
        let weight: Int
    }

    struct Screen {
        let title: String
        let subtitle: String
        let symbol: String
    }

    enum Colors {
        static let background = "#FBF9F4"
        static let foreground = "#171717"
        static let ink = "#3D3935"
        static let headerGlyph = "#2C2C2C"
        static let headerTitle = "#333333"
        static let stone900 = "#1C1917"
        static let stone800 = "#292524"
        static let stone700 = "#44403C"
        static let stone600 = "#57534E"
        static let stone500 = "#78716C"
        static let stone400 = "#A8A29E"
        static let stone300 = "#D6D3D1"
        static let stone200 = "#E7E5E4"
        static let stone100 = "#F5F5F4"
        static let secondaryInk = "#57534E"
        static let faint = "#C4BDB0"
        static let authMuted = "#8A8175"
        static let authFaint = "#B5AD9E"
        static let authLine = "#E8E3D8"
        static let lunarInk = "#1E1C18"
        static let lunarMeta = "#A39888"
        static let lunarDate = "#B5AD9E"
        static let lunarText = "#4A4642"
        static let warmWhite = "#FDFCF9"
        static let jade = "#5B7A5B"
        static let jadeLight = "#7A9B85"
        static let cinnabar = "#8A4A4A"
        static let gold = "#B09F73"
        static let wood = "#7A9B85"
        static let fire = "#BA6E65"
        static let earth = "#8B5F45"
        static let metal = "#B09F73"
        static let water = "#6B7C97"
    }

    enum Alpha {
        static let hairline: Double = 0.07
        static let softShadow: Double = 0.035
        static let pressedFill: Double = 0.2
        static let disabled: Double = 0.45
    }

    enum Spacing {
        static let xxs: CGFloat = 4
        static let xs: CGFloat = 8
        static let sm: CGFloat = 12
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
        static let xxl: CGFloat = 40
        static let section: CGFloat = 64
        static let pageHorizontal: CGFloat = 24
        static let contentBottom: CGFloat = 128
    }

    enum Radii {
        static let small: CGFloat = 8
        static let medium: CGFloat = 13
        static let large: CGFloat = 24
        static let pill: CGFloat = 999
    }

    enum Typography {
        static let pageTitle = TextStyle(family: "serif", size: 30, lineHeight: 37.5, letterSpacing: 0, weight: 400)
        static let pageSubtitle = TextStyle(family: "sans", size: 14, lineHeight: 20, letterSpacing: 0, weight: 400)
        static let navigationLabel = TextStyle(family: "kaiti", size: 13, lineHeight: 19.5, letterSpacing: 1.95, weight: 400)
        static let sectionEyebrow = TextStyle(family: "sans", size: 10, lineHeight: 15, letterSpacing: 3.4, weight: 400)
        static let body = TextStyle(family: "sans", size: 14, lineHeight: 24, letterSpacing: 0, weight: 400)
        static let caption = TextStyle(family: "sans", size: 12, lineHeight: 18, letterSpacing: 0, weight: 400)
        static let button = TextStyle(family: "sans", size: 12, lineHeight: 18, letterSpacing: 0, weight: 400)
    }

    enum Header {
        static let webTop: CGFloat = 64
        static let webBottom: CGFloat = 64
        static let embedTop: CGFloat = 64
        static let nativeSafeOffset: CGFloat = 5
        static let glyphSize: CGFloat = 32
        static let glyphLineHeight: CGFloat = 6.4
        static let glyphToTitle: CGFloat = 16
        static let titleToSubtitle: CGFloat = 16
        static let bottom: CGFloat = 61.5
    }

    enum Navigation {
        static let iconSize: CGFloat = 30
        static let iconLabelGap: CGFloat = 6
        static let itemVerticalPadding: CGFloat = 8
        static let barHorizontalPadding: CGFloat = 16
        static let barVerticalPadding: CGFloat = 8
        static let safeAreaMinimum: CGFloat = 8
        static let indicatorWidth: CGFloat = 20
        static let indicatorHeight: CGFloat = 3
        static let minimumTapWidth: CGFloat = 68
        static let minimumTapHeight: CGFloat = 56
    }

    enum Motion {
        static let fast: Double = 0.2
        static let standard: Double = 0.3
        static let slow: Double = 0.45
        static let springStiffness: Double = 300
        static let springDamping: Double = 30
    }

    static let screens: [String: Screen] = [
        "guanshi": Screen(title: "见天地", subtitle: "世界会越来越好，你也是", symbol: "broken-broken"),
        "wendao": Screen(title: "见众生", subtitle: "观点广场，待续", symbol: "broken-solid"),
        "guanxin": Screen(title: "见自己", subtitle: "知己即知天，请成为自己的答案", symbol: "solid-broken"),
        "bazi": Screen(title: "八字命理", subtitle: "知己即知天，请成为自己的答案", symbol: "solid-broken"),
        "mbti": Screen(title: "荣格八维", subtitle: "知己即知天，请成为自己的答案", symbol: "solid-broken"),
        "juexingcang": Screen(title: "决行藏", subtitle: "用之则行，舍之则藏", symbol: "solid-solid")
    ]
}
