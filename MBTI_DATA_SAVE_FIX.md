# MBTI 数据保存修复说明

## 修复日期
2026-01-31

## 问题描述
用户发现八维认知雷达图（`functionStrengths`, `idealStrengths`）和异化提醒（`insights`）数据在保存后无法正确读取。

## 根本原因
报告页面 `/app/report/mbti/page.tsx` 在从 API 读取历史记录时，只构建了最基础的 `TestResult` 对象，缺少以下新增字段：
- `userSlots` - 用户功能位置分配（用于心灵星盘）
- `functionStrengths` - 功能能量强度（用于雷达图的实测数据）
- `idealStrengths` - 标准类型理论强度（用于雷达图的黄色参考线）
- `insights` - 异化检测结果（成长亮点和潜在风险）
- `fitScore` - 拟合度分数
- `shadowType` - 阴影人格类型

## 修复内容

### 1. 修改 `/src/app/report/mbti/page.tsx`

**修改前**：
```typescript
function buildTestResult(type: string, function_scores: Record<string, number>): TestResult {
  const scores: Record<string, number> = {};
  COGNITIVE_FUNCTIONS.forEach((f) => {
    scores[f] = typeof function_scores[f] === 'number' ? function_scores[f] : 0;
  });
  return {
    type: type as TestResult['type'],
    score: 0,
    shadowType: calculateShadowType(type as TestResult['type']),
    functionScores: scores as TestResult['functionScores'],
  };
}
```

**修改后**：
```typescript
function buildTestResult(data: {
  type: string;
  function_scores: Record<string, number>;
  user_slots?: unknown;
  function_strengths?: Record<string, number>;
  ideal_strengths?: Record<string, number>;
  insights?: unknown[];
  fit_score?: number;
  shadow_type?: string;
}): TestResult {
  const scores: Record<string, number> = {};
  COGNITIVE_FUNCTIONS.forEach((f) => {
    scores[f] = typeof data.function_scores[f] === 'number' ? data.function_scores[f] : 0;
  });
  
  return {
    type: data.type as TestResult['type'],
    score: data.fit_score || 0,
    shadowType: data.shadow_type ? (data.shadow_type as TestResult['type']) : calculateShadowType(data.type as TestResult['type']),
    functionScores: scores as TestResult['functionScores'],
    userSlots: data.user_slots as TestResult['userSlots'],
    functionStrengths: data.function_strengths as TestResult['functionStrengths'],
    idealStrengths: data.ideal_strengths as TestResult['idealStrengths'],
    insights: data.insights as TestResult['insights'],
    fitScore: data.fit_score,
  };
}
```

### 2. 添加调试日志

在 `MbtiTestView.tsx` 的 `handleSave` 函数中添加了 `console.log`，便于排查保存问题：

```typescript
const payload = {
  type: result.type,
  function_scores: result.functionScores,
  user_slots: result.userSlots,
  function_strengths: result.functionStrengths,
  ideal_strengths: result.idealStrengths,
  insights: result.insights,
  fit_score: result.score,
  shadow_type: result.shadowType,
};
console.log('保存MBTI数据:', payload);
```

在 `/app/report/mbti/page.tsx` 中也添加了读取日志：

```typescript
.then((data) => {
  console.log('读取到的MBTI数据:', data);
  setResult(buildTestResult(data));
})
```

## 数据库结构说明

**不需要修改数据库结构**。所有新增字段都保存在 `daoyoushuju` 表的 `input_data` JSONB 列中：

```sql
-- 表结构已正确配置
CREATE TABLE daoyoushuju (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,  -- 'mbti' 表示八维测试
  input_data JSONB,    -- 存储所有测试数据
  created_at TIMESTAMPTZ DEFAULT now()
);
```

`input_data` 中存储的完整结构：
```json
{
  "type": "INFJ",
  "function_scores": { "Ni": 45, "Fe": 38, ... },
  "user_slots": { ... },
  "function_strengths": { "Ni": 28.5, "Fe": 22.1, ... },
  "ideal_strengths": { "Ni": 25.0, "Fe": 20.0, ... },
  "insights": [
    {
      "type": "inferior_integration",
      "title": "成长亮点：劣势整合 (Se Integration)",
      "description": "恭喜！你的劣势功能...",
      "severity": "positive"
    }
  ],
  "fit_score": 92.5,
  "shadow_type": "ESTP"
}
```

## 测试验证步骤

1. **完成一次新的测试**
   - 访问首页，点击「八维」标签
   - 完成所有问题并提交
   - 查看结果页面，确认能看到：
     - ✅ 能量雷达图（双层：实测 + 标准）
     - ✅ 心灵星盘/曼陀罗（8个位置）
     - ✅ 成长亮点（绿色卡片）
     - ✅ 潜在风险（红色/黄色卡片）

2. **保存结果**
   - 点击「保存结果」按钮
   - 打开浏览器控制台，查看日志：
     ```
     保存MBTI数据: { type: "INFJ", function_scores: {...}, user_slots: {...}, ... }
     保存成功: { id: "...", type: "INFJ", created_at: "..." }
     ```

3. **查看历史记录**
   - 访问 `/my/mbti` 页面
   - 点击刚才保存的记录
   - 在浏览器控制台查看日志：
     ```
     读取到的MBTI数据: { type: "INFJ", function_scores: {...}, user_slots: {...}, function_strengths: {...}, ideal_strengths: {...}, insights: [...], ... }
     ```
   - 确认结果页面显示完整：
     - ✅ 雷达图包含双层数据
     - ✅ 星盘显示所有位置
     - ✅ 所有异化提醒都正确显示

4. **验证旧记录兼容性**
   - 如果有之前保存的旧记录（没有新字段）
   - 打开后应该能正常显示基础信息（类型、功能得分）
   - 新增的图表和提醒可能为空或使用默认值

## 相关文件

- `/src/components/MbtiTestView.tsx` - 主测试组件
- `/src/app/api/records/mbti/route.ts` - API 路由
- `/src/app/report/mbti/page.tsx` - 历史记录查看页面（**主要修复**）
- `/src/app/my/mbti/page.tsx` - 历史记录列表

## 技术要点

1. **JSONB 灵活性**：使用 JSONB 列存储所有测试数据，无需修改表结构即可添加新字段
2. **向后兼容**：通过可选字段（`?:`）确保旧数据依然能正常读取
3. **类型安全**：所有新字段都在 `TestResult` 接口中明确定义
4. **调试友好**：添加 console.log 便于追踪数据流

## 附加说明

- 所有16个MBTI类型的定制整合文案已完成
- 雷达图的黄色标准线已根据用户平均强度动态调整
- 任意点数分配功能已实现
- 异化检测能区分健康整合（阳面高分）和压力态（阴面高分）
