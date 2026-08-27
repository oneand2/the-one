---
name: the-one-design
description: the-one（一 · 见天地/见众生/见自己/决行藏）项目的前端设计美学规范——「宣纸水墨、东方留白」风格。当在本项目中设计、创建、重做或修改任何前端 UI（页面、组件、卡片、导航、弹层、表单）时使用，确保新界面与既有视觉体系一致。提供色彩、字体、排版、间距、圆角、阴影、动效、卦象图形语言等完整设计令牌与组件模式。
---

# the-one 设计美学：宣纸水墨 · 东方留白

为 the-one 项目做 UI 设计时遵循本规范。目标：**每一个新界面都像从同一张宣纸上长出来的**。

## 一句话美学

暖白宣纸为底（`#FBF9F4`），水墨石灰为字（stone 灰阶），宋体楷书为骨，卦象线条为符，五行 muted 色为点缀；发丝线分割、近乎不可见的阴影、克制的动效——**静、雅、留白多**。

## 硬性规则（不可违反）

1. **背景永远是宣纸暖白** `#FBF9F4`，卡片同底色，用发丝线 `rgba(0,0,0,0.07)` 而非深色描边区分层级。
2. **不用饱和色、不用彩色渐变、不用彩色图标底块**。唯一允许的"渐变"是边缘渗墨：用背景色自身的 `color-mix` 透明度渐变做顶部/底部溶边。
3. **字重全部 400**。层次感靠字号、颜色灰阶、字间距表达，不靠 bold。
4. **标题用宋体 serif，导航/副标用楷书 kaiti + 宽字距（0.08em–0.34em），干支用书法字体 Ma Shan Zheng**，正文用系统黑体。中文绝不用 italic。
5. **动效克制**：时长 0.2/0.3/0.45s，缓动 `cubic-bezier(0.32, 0.72, 0, 1)`，弹簧 stiffness 300 / damping 30。不用花哨入场动画、不用 hover 放大图片。
6. **图标不用 emoji**，用手绘感 SVG 线条或卦象矩形符号。

## 核心令牌（速查）

完整令牌见 `design/mobile-ui.tokens.json`（源）与 `src/generated/mobile-ui.css`（生成的 CSS 变量，统一前缀 `--ui-*`）。

| 类别 | 值 |
|------|-----|
| 底色 | `#FBF9F4`（宣纸）/ `#FDFCF9`（暖白）/ `#171717`（正文墨） |
| 墨色灰阶 | stone-900 `#1C1917` → stone-100 `#F5F5F4`；ink `#3D3935` |
| 点缀色 | 青玉 `#5B7A5B`、朱砂 `#8A4A4A`、泥金 `#B09F73` |
| 五行色 | 木 `#7A9B85` 火 `#BA6E65` 土 `#8B5F45` 金 `#B09F73` 水 `#6B7C97`（全部低饱和，仅用于干支/五行语义着色） |
| 发丝线 | `rgba(0,0,0,0.07)`；次一级 `rgba(0,0,0,0.05~0.06)` |
| 阴影 | `0 1px 3px rgba(0,0,0,0.04)`，透明度不超过 0.04 |
| 圆角 | 8 / 13 / 16~18 / 24 / pill 999 |
| 间距 | 4·8·12·16·24·32·40，段落 64，页边距 24，内容最大宽 448 |
| 动效 | 0.2/0.3/0.45s，`cubic-bezier(0.32,0.72,0,1)`，spring 300/30 |

## 排版刻度

- 页标题：宋体 30px / 400，可加 `letter-spacing: 0.12em`
- 眉标（eyebrow）：sans 10px、`tracking: 0.34em`、stone-400，中文时字间加空格（如「占 问 前 程」）
- 副标题/导航标签：楷书 13–14px、`tracking: 0.15em`
- 正文：sans 14px/24；辅助说明：11–12px、stone-500/70
- 按钮文字：sans 12px

## 签名式视觉元素

- **卦象 glyph**：100×100 viewBox 的纯 SVG 矩形（实线=整 rect、断线=两段 rect），`fill: currentColor`，色 `#2C2C2C`。页头 32px，导航 30px。阴阳爻组合即各 tab 图标。
- **干支着色**：天干地支逐字按五行色渲染（`ColoredGanZhi` 模式），非干支字用 `#6B6254`。
- **分割眉标行**：`<span eyebrow> + <span class="h-px flex-1 bg-stone-200/80">` 的发丝线分隔，替代卡片标题栏。
- **渗墨边缘**：页面顶/底用背景色透明渐变溶边（见 `globals.css` 的 `[data-ios-embed]::before/after`）。
- **隐藏滚动条**：全局 `scrollbar-width: none`；侧边栏用 5px 极淡自定义滚动条（stone 0.15 透明度）。

## 组件配方

详细代码片段见 [references/patterns.md](references/patterns.md)：

- **卡片**：`rounded-2xl` + 1px 发丝线 + `0 1px 3px rgba(0,0,0,0.04)`；嵌套重点卡用「`p-px` 外环 `ring-1 ring-stone-900/[0.055]` + 内层 `rounded-[17px] bg-[#fbf9f4] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]`」双壳。
- **导航激活指示**：framer-motion `layoutId` 小圆角短条（w-5 h-[3px] rounded-full，`#78716C`），spring 滑动。
- **底部弹层**：`border-radius: 24px 24px 0 0`、顶部 32×3 拖拽柄 `#D4CDC3`、眉标小字 + 圆形关闭钮。
- **骨架屏**：`bg-stone-100/80 animate-pulse`，不出现转圈 spinner 之外的 loading。
- ** chips/标签**：`rounded-full bg-stone-900/[0.045] px-2 py-0.5 text-[9px] tracking-[0.08em] text-stone-400`。
- **可按压行**：整行 `min-h-11`、`active:scale-[0.99]`、`transition 700ms cubic-bezier(0.32,0.72,0,1)`，圆形图标井 `#EBE3D8` 底 + `#7F6B59` 图标。

## 布局

- 移动优先：内容栏 `max-w-md`（448px）居中，页横向 padding 24px。
- 桌面端左侧 64px 主导航 + 可选 240px 无边框侧边栏（`border-r border-stone-200`），主内容不吃 margin 动画。
- 底部移动导航固定、纯白底无阴影，内容区 `padding-bottom: calc(60px + safe-area + 64px)` 避让。
- 所有间距考虑 `env(safe-area-inset-*)`。

## 反模式（不要出现）

- 蓝紫渐变、玻璃拟态、彩虹渐变装饰、彩色图标圆角方块
- 粗体字标题、阴影 >0.04 透明度、多层卡片套卡片
- 无意义的滚动揭示、fade-in-up、hover scale-105 图片
- emoji 图标、italic 中文、居中大 hero + 双 CTA + 三列特性卡模板
- 高饱和的五行色（五行色必须保持 muted）

## 工作方式

1. 写新 UI 前先查 `src/generated/mobile-ui.css` 里的 `--ui-*` 变量，能用变量就不写死值。
2. 改令牌只改 `design/mobile-ui.tokens.json` 再重新生成，不改 generated 文件。
3. 参考现有组件实现：`LunarCalendarCard`（卡片+干支着色）、`DailyFortuneCard`（双壳卡+弹层）、`MobileNav`/`page.tsx`（卦象 glyph+layoutId 指示条）、`login/login.module.css`（表单与 auth 页）。
