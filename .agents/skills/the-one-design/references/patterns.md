# the-one 组件配方（可直接套用的代码模式）

所有片段来自项目现有实现，新组件按此拼装配色与结构。CSS 变量前缀 `--ui-*` 见 `src/generated/mobile-ui.css`。

## 目录

- 基础卡片
- 双壳重点卡（ring 嵌套）
- 分割眉标行
- 卦象 glyph
- 干支五行着色
- 导航激活指示条（layoutId）
- 底部弹层（bottom sheet）
- chips / 标签
- 可按压操作行
- 骨架屏
- 渗墨边缘
- 声明/免责文字
- 页头结构

## 基础卡片

```tsx
<div
  className="w-full mb-8 rounded-2xl"
  style={{
    background: '#fbf9f4',
    border: '1px solid rgba(0,0,0,0.07)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  }}
>
```

## 双壳重点卡（ring 嵌套）

用于需要强调的核心卡（如运势主卡）：外环 1px padding + 极淡 ring，内层宣纸底 + 顶部内高光。

```tsx
<div className="mb-8 w-full rounded-[18px] bg-stone-900/[0.025] p-px ring-1 ring-stone-900/[0.055]">
  <div className="relative overflow-hidden rounded-[17px] bg-[#fbf9f4] px-5 pb-5 pt-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
    {/* 内容 */}
  </div>
</div>
```

## 分割眉标行

替代卡片标题栏的分区方式：小字眉标 + 发丝线拉满。

```tsx
<div className="mb-4 mt-9 flex items-center gap-3">
  <span className="font-sans text-[10px] tracking-[0.34em] text-stone-400">今日见闻</span>
  <span className="h-px flex-1 bg-stone-200/80" />
</div>
```

## 卦象 glyph

100×100 viewBox，实线=整 rect、断线=两段 rect（x=0/w=44 与 x=56/w=44），`fill="currentColor"`。页头 `w-8 h-8 text-[#2c2c2c]`，导航 `w-[30px] h-[30px]`。

```tsx
// 断-断（见天地）
<svg viewBox="0 0 100 100" fill="currentColor">
  <rect x="0" y="20" width="44" height="20" /><rect x="56" y="20" width="44" height="20" />
  <rect x="0" y="60" width="44" height="20" /><rect x="56" y="60" width="44" height="20" />
</svg>
// 断-实（见众生）：上双 rect，下 width=100
// 实-断（见自己）：上 width=100，下双 rect
// 实-实（决行藏）：两条 width=100，rx=1
```

## 干支五行着色

```tsx
const WUXING_COLOR: Record<string, string> = {
  '庚': '#B09F73', '辛': '#B09F73', '申': '#B09F73', '酉': '#B09F73', // 金
  '甲': '#7A9B85', '乙': '#7A9B85', '寅': '#7A9B85', '卯': '#7A9B85', // 木
  '壬': '#6B7C97', '癸': '#6B7C97', '子': '#6B7C97', '亥': '#6B7C97', // 水
  '丙': '#BA6E65', '丁': '#BA6E65', '巳': '#BA6E65', '午': '#BA6E65', // 火
  '戊': '#8B5F45', '己': '#8B5F45', '辰': '#8B5F45', '戌': '#8B5F45',
  '丑': '#8B5F45', '未': '#8B5F45', // 土
};

function ColoredGanZhi({ str, defaultColor = '#6b6254' }) {
  return str.split('').map((ch, i) => (
    <span key={i} style={{ color: WUXING_COLOR[ch] ?? defaultColor }}>{ch}</span>
  ));
}
```

书法干支加 className `font-calligraphy`（Ma Shan Zheng）。

## 导航激活指示条（layoutId）

```tsx
{isActive && (
  <motion.div
    layoutId="mobileActiveIndicator"
    className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-[3px] rounded-full"
    style={{ backgroundColor: '#78716c' }}
    initial={false}
    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
  />
)}
```

选中色 `#57534E`，未选中 `#A8A29E`；导航标签楷书 13px `tracking-[0.15em]`。

## 底部弹层（bottom sheet）

```tsx
<motion.div
  style={{ maxHeight: '80dvh', background: '#faf8f4', borderRadius: '24px 24px 0 0' }}
>
  {/* 拖拽柄 */}
  <div className="w-8 h-[3px] rounded-full" style={{ background: '#d4cdc3' }} />
  {/* 眉标 */}
  <span className="text-[10px] font-sans tracking-[0.34em]" style={{ color: '#a39888' }}>
    标 题
  </span>
  {/* 关闭钮 */}
  <button className="w-7 h-7 flex items-center justify-center rounded-full transition-colors hover:bg-stone-100" />
</motion.div>
```

## chips / 标签

```tsx
<span className="rounded-full bg-stone-900/[0.045] px-2 py-0.5 font-sans text-[9px] tracking-[0.08em] text-stone-400">
  标签
</span>
```

五行小方签：`text-[9.5px] px-1.5 py-0.5 rounded`，背景为五行色 8–12% 透明度，文字为五行色本体。

## 可按压操作行

```tsx
<button className="group mt-4 flex min-h-11 w-full items-center gap-4 py-1 font-sans text-[11px] tracking-[0.16em] text-stone-600 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.99]">
  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ebe3d8] text-[#7f6b59] ring-1 ring-inset ring-[#dfd3c5] transition-all duration-700 group-hover:translate-y-0.5 group-hover:bg-[#dfd3c5]">
    {/* SVG 图标 */}
  </span>
  按钮文字
</button>
```

加载中图标井内放 `h-3.5 w-3.5 rounded-full border border-stone-300 border-t-stone-600 animate-spin`。

## 骨架屏

```tsx
<div className="w-[104px] h-[104px] rounded-full bg-stone-100/80 animate-pulse" />
<div className="h-7 bg-stone-100/80 rounded-lg animate-pulse w-24" />
<div className="h-3.5 bg-stone-100/60 rounded animate-pulse w-32" />
```

## 渗墨边缘

页面顶/底溶边（fixed、pointer-events-none、z-20）：

```css
.edge-top {
  height: 4.25rem;
  background: linear-gradient(
    to bottom,
    #fbf9f4 0%,
    color-mix(in srgb, #fbf9f4 86%, transparent) 28%,
    color-mix(in srgb, #fbf9f4 42%, transparent) 62%,
    transparent 100%
  );
}
```

底部同式 `to top`，高度 5rem。

## 声明/免责文字

```tsx
<div className="flex items-start gap-2 text-[11px] leading-relaxed">
  <span className="text-stone-400/50 flex-shrink-0">|</span>
  <p className="text-stone-500/70 font-sans tracking-wide">
    <span className="text-stone-600/60">声明</span>
    <span className="text-stone-400/50 mx-1.5">·</span>
    正文……
  </p>
</div>
```

## 页头结构

卦象 glyph（32px）→ 宋体标题（30px `#333`）→ 副标（14px stone-600），均居中，glyph 距标题 16px、标题距副标 16px，页头上下留白各约 64px。

```tsx
<h1 className="text-3xl font-serif text-[#333333] leading-tight">见天地</h1>
<p className="text-sm text-stone-600 font-sans text-center">世间即道场，人生是修行</p>
```
