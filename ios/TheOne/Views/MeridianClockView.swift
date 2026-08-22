import SwiftUI

private struct MeridianPeriod {
    let name: String
    let meridian: String
    let summary: String
    let detail: String
    let phase: String
    let color: Color
}

private let meridianPeriods: [MeridianPeriod] = [
    .init(name: "子", meridian: "胆经当令", summary: "宜静卧养阳", detail: "此时一阳初生，必须入睡以保护微弱的阳气种子。", phase: "夜间 · 潜阳育阴", color: AppTheme.water),
    .init(name: "丑", meridian: "肝经当令", summary: "宜深眠藏血", detail: "肝藏血，人卧则血归于肝。此时只有深度睡眠，全身血液才能回流肝系统进行休养。", phase: "夜间 · 潜阳育阴", color: AppTheme.earth),
    .init(name: "寅", meridian: "肺经当令", summary: "宜安睡定气", detail: "肺朝百脉，正在重新分配气血，保持均匀的呼吸对身体至关重要。", phase: "夜间 · 潜阳育阴", color: AppTheme.wood),
    .init(name: "卯", meridian: "大肠经当令", summary: "宜起而排便", detail: "天地阳气升起，大肠蠕动最旺盛，是清理体内糟粕的最佳时机。", phase: "早晨 · 阳气生发", color: AppTheme.wood),
    .init(name: "辰", meridian: "胃经当令", summary: "宜温食饱腹", detail: "胃系统消化能力最强，进食温热且营养丰富的早餐最能化生气血。", phase: "早晨 · 阳气生发", color: AppTheme.earth),
    .init(name: "巳", meridian: "脾经当令", summary: "宜高效工作", detail: "脾将营养运化至全身，此时大脑供血最充足，是逻辑思维和创作的黄金时间。", phase: "早晨 · 阳气生发", color: AppTheme.fire),
    .init(name: "午", meridian: "心经当令", summary: "宜小憩养神", detail: "阴阳交替之时，心气最易波动，短暂的午休可以安抚心神。", phase: "中午 · 阴阳交替", color: AppTheme.fire),
    .init(name: "未", meridian: "小肠经当令", summary: "宜多饮清茶", detail: "小肠泌别清浊，此时摄入水分有助于精华的吸收和浊液的排泄。", phase: "中午 · 阴阳交替", color: AppTheme.earth),
    .init(name: "申", meridian: "膀胱经当令", summary: "宜适度运动", detail: "膀胱经气最足，也是人体记忆力最好的时段，无论是体力活动还是深度思考都很合适。", phase: "中午 · 阴阳交替", color: AppTheme.metal),
    .init(name: "酉", meridian: "肾经当令", summary: "宜静坐收心", detail: "肾主藏精，此时应停止剧烈消耗，让气血能量开始向体内储藏。", phase: "傍晚 · 收敛藏精", color: AppTheme.metal),
    .init(name: "戌", meridian: "心包经当令", summary: "宜闲谈悦心", detail: "心包保护心君，此时保持愉悦的情绪和放松的沟通，有助于理顺气机。", phase: "傍晚 · 收敛藏精", color: AppTheme.earth),
    .init(name: "亥", meridian: "三焦经当令", summary: "宜沐足宽心", detail: "三焦通百脉，通过温水泡脚或彻底放松，让全身气血归位，准备进入睡眠。", phase: "傍晚 · 收敛藏精", color: AppTheme.water)
]

struct MeridianClockView: View {
    @State private var appeared = false

    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { timeline in
            let date = timeline.date
            let components = Calendar.current.dateComponents([.hour, .minute], from: date)
            let hour = components.hour ?? 0
            let minute = components.minute ?? 0
            let index = ((hour + 1) / 2) % 12
            let period = meridianPeriods[index]

            VStack(spacing: 0) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("子午流注")
                            .font(.kaiti(20))
                            .foregroundStyle(AppTheme.lunarInk)
                        Text("经络当令 · 顺时养生")
                            .font(.system(size: 11))
                            .tracking(0.4)
                            .foregroundStyle(AppTheme.lunarMeta)
                    }
                    Spacer()
                    Text(String(format: "%02d:%02d", hour, minute))
                        .font(.system(size: 12))
                        .monospacedDigit()
                        .tracking(0.4)
                        .foregroundStyle(AppTheme.faint)
                        .padding(.top, 2)
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 8)

                MeridianDial(hour: hour, minute: minute, activeIndex: index, period: period)
                    .frame(maxWidth: 280)
                    .aspectRatio(260 / 252, contentMode: .fit)
                    .frame(maxWidth: .infinity)

                Rectangle()
                    .fill(Color.black.opacity(0.06))
                    .frame(height: 1)
                    .padding(.horizontal, 20)

                VStack(alignment: .leading, spacing: 0) {
                    Text(period.phase)
                        .font(.system(size: 10))
                        .tracking(2)
                        .foregroundStyle(AppTheme.faint)
                        .padding(.bottom, 8)
                    Text(period.summary)
                        .font(.kaiti(15))
                        .foregroundStyle(AppTheme.lunarInk)
                        .padding(.bottom, 6)
                    Text(period.detail)
                        .font(.kaiti(12.5))
                        .foregroundStyle(Color(red: 106 / 255, green: 99 / 255, blue: 90 / 255))
                        .lineSpacing(5)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 16)
            }
            .padding(1)
            .background(AppTheme.warmWhite, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.black.opacity(0.07), lineWidth: 1)
            }
            .shadow(color: Color.black.opacity(0.04), radius: 3, y: 1)
        }
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 14)
        .onAppear {
            withAnimation(.easeOut(duration: 0.55)) { appeared = true }
        }
    }
}

private struct MeridianDial: View {
    let hour: Int
    let minute: Int
    let activeIndex: Int
    let period: MeridianPeriod

    private let names = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]

    var body: some View {
        Canvas { context, size in
            let scale = size.width / 260
            let center = CGPoint(x: 130 * scale, y: 124 * scale)
            let radius = 112 * scale
            let labelRadius = 90 * scale
            let needleDegree = (Double(hour) + Double(minute) / 60) * 15
            let startDegree = Double(activeIndex * 30 - 15)
            let elapsed = min(normalize(needleDegree - startDegree), 30)

            var outerCircle = Path()
            outerCircle.addEllipse(in: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
            context.stroke(outerCircle, with: .color(.black.opacity(0.08)), lineWidth: scale)

            context.stroke(
                arcPath(center: center, radius: radius, start: startDegree, span: 30),
                with: .color(period.color.opacity(0.10)),
                style: StrokeStyle(lineWidth: 8 * scale, lineCap: .butt)
            )
            if elapsed > 0.5 {
                context.stroke(
                    arcPath(center: center, radius: radius, start: startDegree, span: elapsed),
                    with: .color(period.color.opacity(0.70)),
                    style: StrokeStyle(lineWidth: 2.2 * scale, lineCap: .round)
                )
            }

            for index in 0..<12 {
                let cardinal = [0, 3, 6, 9].contains(index)
                let outer = polar(Double(index * 30), radius: radius, center: center)
                let inner = polar(Double(index * 30), radius: radius - (cardinal ? 8 : 5) * scale, center: center)
                var tick = Path()
                tick.move(to: outer)
                tick.addLine(to: inner)
                context.stroke(tick, with: .color(.black.opacity(cardinal ? 0.22 : 0.10)), lineWidth: (cardinal ? 1.1 : 0.75) * scale)
            }

            let dot = polar(needleDegree, radius: radius, center: center)
            context.fill(Path(ellipseIn: CGRect(x: dot.x - 6.5 * scale, y: dot.y - 6.5 * scale, width: 13 * scale, height: 13 * scale)), with: .color(period.color.opacity(0.12)))
            context.fill(Path(ellipseIn: CGRect(x: dot.x - 3.5 * scale, y: dot.y - 3.5 * scale, width: 7 * scale, height: 7 * scale)), with: .color(period.color.opacity(0.82)))

            for index in 0..<12 {
                let active = index == activeIndex
                let cardinal = [0, 3, 6, 9].contains(index)
                let point = polar(Double(index * 30), radius: labelRadius, center: center)
                var text = Text(names[index])
                    .font(.kaiti((active ? 14 : cardinal ? 11 : 9.5) * scale))
                    .foregroundStyle(active ? AppTheme.lunarInk : .black.opacity(cardinal ? 0.38 : 0.18))
                if active { text = text.font(.custom("Kaiti SC", size: 14 * scale).weight(.medium)) }
                context.draw(context.resolve(text), at: point, anchor: .center)
            }

            context.fill(Path(ellipseIn: CGRect(x: center.x - 60 * scale, y: center.y - 60 * scale, width: 120 * scale, height: 120 * scale)), with: .color(AppTheme.warmWhite))

            context.draw(context.resolve(Text("\(period.name)时").font(.kaiti(21 * scale)).foregroundStyle(AppTheme.lunarInk)), at: CGPoint(x: center.x, y: center.y - 15 * scale), anchor: .center)
            context.draw(context.resolve(Text(period.meridian).font(.system(size: 11 * scale)).foregroundStyle(period.color)), at: CGPoint(x: center.x, y: center.y + 8 * scale), anchor: .center)

            var separator = Path()
            separator.move(to: CGPoint(x: center.x - 20 * scale, y: center.y + 22 * scale))
            separator.addLine(to: CGPoint(x: center.x + 20 * scale, y: center.y + 22 * scale))
            context.stroke(separator, with: .color(.black.opacity(0.10)), lineWidth: 0.5 * scale)
            context.draw(context.resolve(Text(period.summary).font(.kaiti(9.5 * scale)).foregroundStyle(.black.opacity(0.30))), at: CGPoint(x: center.x, y: center.y + 34 * scale), anchor: .center)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("当前时辰：\(period.name)时，\(period.meridian)")
    }

    private func polar(_ degree: Double, radius: CGFloat, center: CGPoint) -> CGPoint {
        let radians = (degree - 90) * .pi / 180
        return CGPoint(x: center.x + radius * cos(radians), y: center.y + radius * sin(radians))
    }

    private func normalize(_ degree: Double) -> Double {
        let value = degree.truncatingRemainder(dividingBy: 360)
        return value < 0 ? value + 360 : value
    }

    private func arcPath(center: CGPoint, radius: CGFloat, start: Double, span: Double) -> Path {
        var path = Path()
        let segments = max(2, Int(ceil(span)))
        for step in 0...segments {
            let degree = start + span * Double(step) / Double(segments)
            let point = polar(degree, radius: radius, center: center)
            if step == 0 { path.move(to: point) }
            else { path.addLine(to: point) }
        }
        return path
    }
}
