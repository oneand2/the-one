import SwiftUI
import UIKit

// 决行藏（ParityChatView）使用的共享控件。

struct MasterOrbView: View {
    let isActive: Bool
    @State private var breathing = false

    var body: some View {
        ZStack {
            Circle()
                .fill((isActive ? Color(red: 252 / 255, green: 211 / 255, blue: 77 / 255) : AppTheme.stone300).opacity(breathing ? (isActive ? 0.15 : 0.08) : 0))
                .frame(width: 128, height: 128)
                .scaleEffect(breathing ? 1.8 : 1)
                .blur(radius: 24)
                .animation(.easeInOut(duration: 4.5).repeatForever(autoreverses: true), value: breathing)

            ForEach(Array([CGFloat(128), CGFloat(96), CGFloat(64)].enumerated()), id: \.offset) { index, size in
                Circle()
                    .stroke(
                        (isActive
                            ? (index == 2 ? Color(red: 245 / 255, green: 158 / 255, blue: 11 / 255) : Color(red: 251 / 255, green: 191 / 255, blue: 36 / 255))
                            : AppTheme.stone300
                        ).opacity(
                            breathing
                                ? [0.30, 0.385, 0.52][index]
                                : [0.18, 0.245, 0.32][index]
                        ),
                        lineWidth: 1
                    )
                    .frame(width: size, height: size)
                    .scaleEffect(breathing ? [1.08, 1.05, 1.03][index] : 1)
                    .animation(
                        .easeInOut(duration: [5.0, 4.0, 3.5][index])
                            .repeatForever(autoreverses: true)
                            .delay(Double(index) * 0.5),
                        value: breathing
                    )
            }

            Circle()
                .fill(isActive ? Color(red: 245 / 255, green: 158 / 255, blue: 11 / 255) : AppTheme.stone400)
                .frame(width: 12, height: 12)
                .scaleEffect(isActive ? 1.1 : 1)
                .shadow(color: isActive ? Color(red: 251 / 255, green: 191 / 255, blue: 36 / 255).opacity(0.4) : .clear, radius: breathing ? 10 : 0)
                .animation(.easeInOut(duration: 3).repeatForever(autoreverses: true), value: breathing)
        }
        .frame(width: 128, height: 128)
        .animation(.easeInOut(duration: 0.7), value: isActive)
        .onAppear {
            breathing = true
        }
    }
}

struct LegacyModeChip: View {
    let title: String
    let cost: Int
    var showCost: Bool = true
    @Binding var isOn: Bool

    var body: some View {
        Button { isOn.toggle() } label: {
            HStack(spacing: 0) {
                Circle()
                    .fill(isOn ? Color.white : AppTheme.stone500)
                    .frame(width: 6, height: 6)
                    .padding(.trailing, 10)
                Text(title)
                    .font(.system(size: 11, weight: .light))
                    .tracking(2.2)
                if showCost {
                    HStack(spacing: 2) {
                        CopperCoinMark(size: 10)
                        Text("\(cost)")
                            .font(.system(size: 9, weight: .light))
                            .tracking(0.5)
                    }
                    .foregroundStyle(isOn ? Color.white.opacity(0.70) : legacyAmber.opacity(0.75))
                    .padding(.leading, 4)
                }
            }
            .foregroundStyle(isOn ? .white : AppTheme.stone700)
            .frame(width: 122, height: 32.5)
            .background(isOn ? AppTheme.headerGlyph : Color(red: 245 / 255, green: 242 / 255, blue: 237 / 255), in: Capsule())
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.35), value: isOn)
        .sensoryTap()
    }

    private var legacyAmber: Color {
        Color(red: 180 / 255, green: 83 / 255, blue: 9 / 255)
    }
}

struct CopperCoinMark: View {
    let size: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .stroke(lineWidth: size / 16)
                .padding(size * 0.125)
            Circle()
                .stroke(lineWidth: size / 20)
                .padding(size * 0.292)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

struct UsageTipOverlay: View {
    let close: () -> Void
    let dontShowAgain: () -> Void
    @EnvironmentObject private var profile: ProfileStore
    @State private var neverShow = false
    @State private var seconds = 10

    var body: some View {
        ZStack {
            Color.black.opacity(0.40).ignoresSafeArea()
                .onTapGesture { close() }

            VStack(spacing: 0) {
                Text("使用提示")
                    .font(.webSerif(20))
                    .foregroundStyle(AppTheme.stone800)
                    .tracking(0.5)
                Rectangle().fill(AppTheme.stone300).frame(width: 48, height: 1)
                    .padding(.top, 8)
                    .padding(.bottom, 24)

                VStack(alignment: .leading, spacing: 16) {
                    Text("为了获得更优质的回答，建议您：")
                        .font(.system(size: 14))
                    VStack(alignment: .leading, spacing: 12) {
                        TipBullet {
                            Text("开启").font(.system(size: 14)) + Text("六爻").font(.system(size: 14, weight: .semibold)) + Text("（已默认开启）之后再提问，可获得更精准的解卦分析。").font(.system(size: 14))
                        }
                        TipBullet {
                            if profile.profile?.isActiveVip == true {
                                Text("点击").font(.system(size: 14)) + Text("宗师模式").font(.system(size: 14, weight: .semibold)) + Text("可获得更深入、更准确的回答。宗师模式已默认开启。").font(.system(size: 14))
                            } else {
                                Text("点击").font(.system(size: 14)) + Text("宗师模式").font(.system(size: 14, weight: .semibold)) + Text("可获得更深入、更准确的回答（消耗 20 铜币）。宗师模式已默认开启，关闭宗师模式可以帮你节省大量铜币。").font(.system(size: 14))
                            }
                        }
                    }
                    .padding(.leading, 16)
                    .overlay(alignment: .leading) { Rectangle().fill(AppTheme.stone200).frame(width: 2) }
                }
                .foregroundStyle(AppTheme.stone700)
                .lineSpacing(6)
                .frame(maxWidth: .infinity, alignment: .leading)

                Button {
                    neverShow.toggle()
                } label: {
                    HStack(spacing: 8) {
                        RoundedRectangle(cornerRadius: 1)
                            .stroke(AppTheme.stone500, lineWidth: 1)
                            .frame(width: 16, height: 16)
                            .overlay {
                                if neverShow { Image(systemName: "checkmark").font(.system(size: 10, weight: .semibold)) }
                            }
                        Text("不再显示此提示")
                            .font(.system(size: 12))
                            .foregroundStyle(AppTheme.stone600)
                        Spacer()
                    }
                }
                .buttonStyle(.plain)
                // 原网页正文使用 24px 行高；原生字形实际少 8pt，补偿后复选框 y=511.5。
                .padding(.top, 30)

                Button {
                    if seconds == 0 {
                        if neverShow { dontShowAgain() }
                        else { close() }
                    }
                } label: {
                    Text(seconds > 0 ? "我已知晓（\(seconds) 秒后可点击）" : "我已知晓")
                        .font(.system(size: 14, weight: .medium))
                        .tracking(0.6)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(seconds > 0 ? AppTheme.stone400 : AppTheme.stone800, in: RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
                .padding(.top, 24)
            }
            .padding(32)
            // CSS 的 1px 边框参与内容盒计算；SwiftUI 描边不参与，补 1pt 保持 304pt 内容宽度。
            .padding(1)
            .frame(width: 370, height: 383, alignment: .top)
            .background(AppTheme.background, in: RoundedRectangle(cornerRadius: 16))
            .overlay { RoundedRectangle(cornerRadius: 16).stroke(AppTheme.stone200) }
            .compositingGroup()
            .shadow(color: .black.opacity(0.20), radius: 22, y: 10)
            .transition(.scale(scale: 0.90).combined(with: .opacity))
        }
        .task {
            while seconds > 0 {
                try? await Task.sleep(for: .seconds(1))
                if !Task.isCancelled { seconds -= 1 }
            }
        }
    }
}

private struct TipBullet<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Circle().fill(AppTheme.stone400).frame(width: 6, height: 6).padding(.top, 8)
            content
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct MessageBubble: View {
    let message: ChatMessage
    @State private var copied = false

    var body: some View {
        HStack {
            if message.role == .user { Spacer(minLength: 50) }
            ZStack(alignment: .bottomTrailing) {
                Group {
                    if let rich = try? AttributedString(markdown: message.content) { Text(rich) }
                    else { Text(message.content) }
                }
                .font(.kaiti(14))
                .lineSpacing(5)
                .foregroundStyle(AppTheme.ink)
                .padding(.horizontal, 15).padding(.vertical, 13)
                .padding(.bottom, message.role == .assistant ? 18 : 0)
                .background(message.role == .user ? AppTheme.hairline.opacity(0.75) : Color.clear, in: RoundedRectangle(cornerRadius: 10))
                .overlay {
                    if message.role == .assistant {
                        RoundedRectangle(cornerRadius: 10).stroke(AppTheme.hairline)
                    }
                }
                if message.role == .assistant {
                    Button {
                        UIPasteboard.general.string = message.content
                        copied = true
                        Task {
                            try? await Task.sleep(for: .seconds(2))
                            copied = false
                        }
                    } label: {
                        Image(systemName: copied ? "checkmark" : "square.on.square")
                            .font(.system(size: 11, weight: .light))
                            .foregroundStyle(AppTheme.stone400)
                            .padding(6)
                    }
                    .buttonStyle(.plain)
                    .padding(.trailing, 6).padding(.bottom, 4)
                }
            }
            .contextMenu {
                Button("复制") { UIPasteboard.general.string = message.content }
            }
            if message.role == .assistant { Spacer(minLength: 28) }
        }
    }
}

struct AIConsentView: View {
    let accept: () -> Void
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            FourSymbolGlyph(symbol: .juexingcang, width: 34, lineHeight: 6)
            Text("发送前，请确认数据使用方式")
                .font(.kaiti(25))
            Text("你发送的对话内容，以及你主动导入的排盘或测试数据，会传输给第三方 AI 服务提供方以生成回答。我们不会把支付信息发送给 AI，也不会将这些内容用于广告。")
                .font(.kaiti(15)).foregroundStyle(AppTheme.secondaryInk).lineSpacing(6)
            Text("你可以随时停止使用 AI 功能，并通过个人设置申请删除账户和相关数据。")
                .font(.kaiti(13)).foregroundStyle(AppTheme.muted)
            Button("理解并同意，继续发送", action: accept)
                .buttonStyle(.borderedProminent).tint(AppTheme.ink)
                .frame(maxWidth: .infinity)
            Button("暂不使用") { dismiss() }
                .frame(maxWidth: .infinity)
        }
        .padding(26)
        .background(AppTheme.background)
    }
}

struct ThinkingDots: View {
    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<3, id: \.self) { index in
                TimelineView(.animation(minimumInterval: 0.05, paused: false)) { timeline in
                    let t = timeline.date.timeIntervalSinceReferenceDate
                    let phase = (sin(t * .pi * 4 / 3 - Double(index) * 0.4) + 1) / 2
                    Circle()
                        .fill(AppTheme.stone400)
                        .frame(width: 6, height: 6)
                        .scaleEffect(1 + 0.3 * phase)
                        .opacity(0.3 + 0.4 * phase)
                }
            }
        }
    }
}

struct InsufficientCoinsOverlay: View {
    let needCoins: Int
    let onClose: () -> Void
    let onOpenStore: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.40).ignoresSafeArea().onTapGesture(perform: onClose)
            VStack(spacing: 0) {
                Text("铜币不足，本次需要 \(needCoins) 铜币。可选择铜币服务包，或开通终身 VIP 后不再消耗铜币。")
                    .font(.system(size: 15))
                    .foregroundStyle(AppTheme.stone800)
                    .multilineTextAlignment(.center)
                HStack(spacing: 12) {
                    Button("我知道了", action: onClose)
                        .font(.system(size: 14)).foregroundStyle(AppTheme.stone600)
                        .frame(maxWidth: .infinity).frame(height: 42)
                        .overlay { RoundedRectangle(cornerRadius: 8).stroke(AppTheme.stone300) }
                    Button("查看服务包", action: onOpenStore)
                        .font(.system(size: 14)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).frame(height: 42)
                        .background(AppTheme.stone800, in: RoundedRectangle(cornerRadius: 8))
                }
                .padding(.top, 24)
            }
            .padding(24)
            .frame(maxWidth: 360)
            .background(AppTheme.background, in: RoundedRectangle(cornerRadius: 16))
            .overlay { RoundedRectangle(cornerRadius: 16).stroke(AppTheme.stone200) }
        }
    }
}
