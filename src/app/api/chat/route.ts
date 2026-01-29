import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/utils/supabase/server';
import type { BaziImportData, MbtiImportData, LiuyaoImportData } from '@/types/import-data';

const COINS_BASE = 5;
const COINS_REASONING = 2;
const COINS_MEDITATION = 50;
const COINS_SEARCH = 3;
const PROFILE_TABLE = 'user_profiles';
const INITIAL_COINS = 50;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, useReasoning, useSearch, useMeditation, importData } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: '消息列表不能为空' },
        { status: 400 }
      );
    }

    const cost = COINS_BASE + (useReasoning ? COINS_REASONING : 0) + (useMeditation ? COINS_MEDITATION : 0) + (useSearch ? COINS_SEARCH : 0);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    // 管理员邮箱无限铜币
    const isAdmin = user.email === '892777353@qq.com';
    
    if (!isAdmin) {
      let { data: profile } = await supabase.from(PROFILE_TABLE).select('coins_balance').eq('user_id', user.id).single();
      if (!profile) {
        await supabase.from(PROFILE_TABLE).insert({ user_id: user.id, coins_balance: INITIAL_COINS });
        profile = { coins_balance: INITIAL_COINS };
      }
      const balance = (profile as { coins_balance?: number }).coins_balance ?? 0;
      if (balance < cost) {
        return NextResponse.json(
          { error: `铜币不足，本次消耗 ${cost} 铜币（基础消耗 ${COINS_BASE}${useReasoning ? `，深度思考消耗 ${COINS_REASONING}` : ''}${useMeditation ? `，入定消耗 ${COINS_MEDITATION}` : ''}${useSearch ? `，联网消耗 ${COINS_SEARCH}` : ''}）`, need_coins: cost },
          { status: 402 }
        );
      }
      const { error: deductErr } = await supabase
        .from(PROFILE_TABLE)
        .update({ coins_balance: balance - cost })
        .eq('user_id', user.id);
      if (deductErr) {
        return NextResponse.json({ error: '扣款失败，请重试' }, { status: 500 });
      }
    }

    // 联网搜索上下文（当 useSearch 为 true 时，用最后一条用户消息调用 Tavily REST API）
    let searchContext = '';
    if (useSearch && process.env.TAVILY_API_KEY) {
      const lastUser = [...messages].reverse().find((m: { role: string }) => m.role === 'user');
      const query = (lastUser?.content ?? '').slice(0, 500);
      if (query.trim()) {
        try {
          const res = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
            },
            body: JSON.stringify({
              query: query.trim(),
              max_results: 6,
              search_depth: 'basic',
              topic: 'general',
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> };
            const results = data.results ?? [];
            if (results.length > 0) {
              searchContext = '\n\n【以下为联网检索到的参考信息，供你结合问题使用，回答时保持决行藏风格，不必逐条引用出处】\n\n' +
                results.map((r, i) => `[${i + 1}] ${r.title || '无标题'}\n${r.content || ''}\n来源: ${r.url || ''}`).join('\n\n');
            }
          }
        } catch (e) {
          console.warn('Tavily 搜索失败，将不注入联网上下文:', e);
        }
      }
    }

    // 根据模式初始化 OpenAI 客户端和选择模型
    let client: OpenAI;
    let modelName: string;

    if (useMeditation) {
      // 入定模式：使用 Claude 模型
      client = new OpenAI({
        apiKey: process.env.AI_MEDITATION_API_KEY,
        baseURL: process.env.AI_MEDITATION_BASE_URL,
      });
      modelName = process.env.AI_MEDITATION_MODEL_NAME || 'claude-sonnet-4-5';
    } else {
      // 默认模式：使用 DeepSeek 模型
      client = new OpenAI({
        apiKey: process.env.AI_API_KEY,
        baseURL: process.env.AI_BASE_URL,
      });
      modelName = useReasoning 
        ? process.env.AI_REASONER_MODEL_NAME || 'deepseek-reasoner'
        : process.env.AI_MODEL_NAME || 'deepseek-chat';
    }

    // 检测是否有导入数据，决定使用哪套提示词
    const baziList: BaziImportData[] = Array.isArray(importData?.bazi) ? importData?.bazi : importData?.bazi ? [importData.bazi] : [];
    const mbtiList: MbtiImportData[] = Array.isArray(importData?.mbti) ? importData?.mbti : importData?.mbti ? [importData.mbti] : [];
    const liuyaoList: LiuyaoImportData[] = Array.isArray(importData?.liuyao) ? importData?.liuyao : importData?.liuyao ? [importData.liuyao] : [];
    const hasImportData = baziList.length > 0 || mbtiList.length > 0 || liuyaoList.length > 0;
    
    // 根据是否有导入数据，选择对应的系统提示词
    let systemPrompt: string;
    
    if (hasImportData) {
      // ========== 算命模式提示词 ==========
      let importContext = '\n\n## 用户导入的测算数据\n\n';
      
      // 八字数据
      if (baziList.length > 0) {
        baziList.forEach((bazi, index) => {
          importContext += `### 八字古典排盘信息（第${index + 1}条）\n\n`;
          importContext += `**四柱**: ${bazi.pillars.year.gan}${bazi.pillars.year.zhi}年 ${bazi.pillars.month.gan}${bazi.pillars.month.zhi}月 ${bazi.pillars.day.gan}${bazi.pillars.day.zhi}日 ${bazi.pillars.hour.gan}${bazi.pillars.hour.zhi}时\n\n`;
          importContext += `**日主**: ${bazi.pillars.day.gan}\n\n`;
          importContext += `**强弱**: ${bazi.strength}（强度 ${bazi.strengthPercent.toFixed(1)}%）\n\n`;
          importContext += `**用神**: ${bazi.favorable.join('、')}\n\n`;
          importContext += `**忌神**: ${bazi.unfavorable.join('、')}\n\n`;
          
          if (Object.keys(bazi.shishenRatio).length > 0) {
            importContext += `**十神比例**: ${Object.entries(bazi.shishenRatio)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .map(([key, val]) => `${key} ${((val as number) * 100).toFixed(0)}%`)
              .join('、')}\n\n`;
          }
          
          if (Object.keys(bazi.ganRatio).length > 0) {
            importContext += `**天干比例**: ${Object.entries(bazi.ganRatio)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .map(([key, val]) => `${key} ${((val as number) * 100).toFixed(0)}%`)
              .join('、')}\n\n`;
          }
          
          if (bazi.relationships) {
            const rels = [];
            if (bazi.relationships.he?.length) rels.push(`合: ${bazi.relationships.he.join('、')}`);
            if (bazi.relationships.chong?.length) rels.push(`冲: ${bazi.relationships.chong.join('、')}`);
            if (bazi.relationships.xing?.length) rels.push(`刑: ${bazi.relationships.xing.join('、')}`);
            if (bazi.relationships.hai?.length) rels.push(`害: ${bazi.relationships.hai.join('、')}`);
            if (rels.length > 0) {
              importContext += `**八字关系**: ${rels.join('；')}\n\n`;
            }
          }
          
          if (bazi.predictedMBTI) {
            importContext += `**八字推导的MBTI**: ${bazi.predictedMBTI}\n\n`;
          }
          
          if (bazi.energyProfile) {
            importContext += `**八字能量分布（八维功能）**:\n`;
            const sortedProfile = Object.entries(bazi.energyProfile)
              .sort((a, b) => (b[1] as number) - (a[1] as number));
            sortedProfile.forEach(([func, score]) => {
              importContext += `  - ${func}: ${(score as number).toFixed(1)}\n`;
            });
            importContext += '\n';
          }
        });
      }
      
      // 八维测试数据
      if (mbtiList.length > 0) {
        mbtiList.forEach((mbti, index) => {
          importContext += `### 荣格八维测试结果（第${index + 1}条）\n\n`;
          importContext += `**MBTI类型**: ${mbti.mbtiType}\n\n`;
          importContext += `**认知功能得分**:\n`;
          const sortedScores = Object.entries(mbti.functionScores)
            .sort((a, b) => (b[1] as number) - (a[1] as number));
          sortedScores.forEach(([func, score]) => {
            importContext += `  - ${func}: ${(score as number).toFixed(1)}\n`;
          });
          importContext += '\n';
        });
      }
      
      // MBTI对比分析
      if (baziList.length > 0 && mbtiList.length > 0) {
        importContext += '### MBTI对比分析\n\n';
        const pairCount = Math.min(baziList.length, mbtiList.length);
        for (let i = 0; i < pairCount; i += 1) {
          const predicted = baziList[i].predictedMBTI;
          const actual = mbtiList[i].mbtiType;
          if (!predicted || !actual) continue;
          importContext += `**对比${i + 1}**\n`;
          importContext += `**八字推导的MBTI**: ${predicted}\n`;
          importContext += `**八维测试的MBTI**: ${actual}\n`;
          if (predicted !== actual) {
            importContext += `\n两者存在差异。请在回答时分析这种差异的可能原因，例如：\n`;
            importContext += `- 先天命理倾向（八字）vs 后天发展倾向（八维测试）\n`;
            importContext += `- 内在本性 vs 外在表现\n`;
            importContext += `- 理想自我 vs 现实自我\n`;
            importContext += `- 成长环境和经历对人格的塑造影响\n\n`;
          } else {
            importContext += `\n两者一致，说明用户的先天命理倾向与后天发展方向高度契合。\n\n`;
          }
        }
        if (baziList.length !== mbtiList.length) {
          importContext += `若八字与八维数量不匹配，可择最相关的一对重点对比，其余作为背景参考。\n\n`;
        }
      }
      
      // 六爻数据
      if (liuyaoList.length > 0) {
        liuyaoList.forEach((liuyao, index) => {
          importContext += `### 六爻占卜信息（第${index + 1}条）\n\n`;
          importContext += `**所问之事**: ${liuyao.question}\n\n`;
          importContext += `**本卦**: ${liuyao.mainHexagram.title}\n`;
          importContext += `**卦辞**: ${liuyao.mainHexagram.description}\n\n`;
          
          if (liuyao.hasMovingLines && liuyao.transformedHexagram) {
            importContext += `**变卦**: ${liuyao.transformedHexagram.title}\n\n`;
          }
          
          if (liuyao.movingLineTexts.length > 0) {
            importContext += `**动爻**: ${liuyao.movingLineTexts.join('；')}\n\n`;
          }
          
          if (liuyao.aiResult) {
            importContext += `**之前的解卦**: ${liuyao.aiResult}\n\n`;
          }
        });
      }
      
      importContext += '---\n\n**重要提示**: 以上是用户导入的测算数据，请在回答时充分考虑这些信息，将其与用户的问题结合起来分析。';
      
      // 算命模式系统提示词
      systemPrompt = `你名**"决行藏"**。你是一位慈悲、深邃、博古通今，学贯中西的智慧长者，既是命理大师，也是精神分析师。
你的使命是以问为径，指引抉择。你称呼前来问问题的人为朋友，因为你觉得你和他们都是平等的。

**【当前模式：算命模式】**
用户已经导入了他们的测算数据（八字、八维、六爻等），这说明他们希望你结合这些命理信息来分析问题、提供指引。

**【极其重要】输出规范：**
1. 严禁在回复中使用"观济"、"同济"、"涉济"、"化济"、"既济"、"未济"或任何带有"济"字的术语作为段落标题或标签。
2. 你的回复应当是自然流淌的对话，分段清晰，但不要给段落贴上功能性标签。
3. 记住你的角色，你是一个大师，大师说话的时候是不会像ai一样列条目，而是像一个朋友一样，自然流畅的对话。
4. 禁止动作描写，严禁输出任何括号内的动作、神态或心理描写（例如：(放下茶杯)、(目光温和) 等）。
5. 回复应如智者面谈，自然流淌，不带任何模板感或戏剧表演感。

## 算命模式核心原则
1. **命理为基**：充分利用用户导入的八字、八维、六爻数据，从命理角度分析问题
2. **见微知著**：从用户的命盘中看到他们的本性、倾向、优势和挑战
3. **古今融合**：将传统命理学与现代心理学结合，给出既有深度又有实用价值的建议
4. **MBTI对比**：如果用户同时导入了八字和八维数据，务必分析两者的异同，解释差异原因
5. **因材施教**：根据用户的命理特征，给出最适合他们的建议

## 核心特质
1. **温暖亲和**：你的语言温柔而有力，如春风化雨，润物无声
2. **深入浅出**：善于将复杂的命理道理用简单的语言讲清楚
3. **引导思考**：不仅给出答案，提供确定性，还要引导对方思考
4. **知行合一**：注重理论与实践的结合，给出可落地的建议

## 回答流程（算命模式）
1. **观命盘**：首先审视用户的八字、八维、六爻信息，了解他们的命理特征
2. **析问题**：分析用户的问题，结合命盘看到问题的本质和根源
3. **明差异**：如果八字推导的MBTI与八维测试的MBTI不同，要温和地指出并解释原因
4. **借古智**：从周易、八字、心理学等角度提供洞见
5. **给指引**：基于命理特征，给出具体、可行的建议
6. **留余地**：强调命运是流动的，最终掌握在自己手中

## 对话风格
- 使用自然流畅的中文表达
- 适度引用经典，但不掉书袋
- 保持谦逊，承认认知的局限
- 关注对方的感受和处境
- 分段清晰，逻辑连贯
- 善于将现代心理学术语与中国古典哲学名句互文见义

## 知识体系
- 中国传统文化，包括佛家儒家道家经典
- 中国命理学，周易六爻、八字命理、道家哲学
- 荣格分析心理学、拉康镜像理论、MBTI八维认知功能

## 回答原则
1. 先共情理解，再分析解答
2. 既要有高度，也要接地气
3. 既要有智慧，也要有温度
4. 既要指出问题，也要给予希望
5. 充分利用用户的命理信息，让回答更有针对性${searchContext}${importContext}`;
      
    } else {
      // ========== 普通模式提示词 ==========
      systemPrompt = `你名**"决行藏"**。你是一位慈悲、深邃、博古通今，学贯中西的智慧长者，你并不仅是一个算命先生，也是一位使命感的精神分析师。
你的使命是以问为径，指引抉择。你称呼前来问问题的人为朋友，因为你觉得你和他们都是平等的。

**【极其重要】输出规范：**
1. 严禁在回复中使用"观济"、"同济"、"涉济"、"化济"、"既济"、"未济"或任何带有"济"字的术语作为段落标题或标签。
2. 你的回复应当是自然流淌的对话，分段清晰，但不要给段落贴上功能性标签。
3. 记住你的角色，你是一个大师，大师说话的时候是不会像ai一样列条目，而是像一个朋友一样，自然流畅的对话。
4. 禁止动作描写，严禁输出任何括号内的动作、神态或心理描写（例如：(放下茶杯)、(目光温和) 等）。
5. 回复应如智者面谈，自然流淌，不带任何模板感或戏剧表演感。

## 核心特质
1. **温暖亲和**：你的语言温柔而有力，如春风化雨，润物无声
2. **深入浅出**：善于将复杂的道理用简单的语言讲清楚
3. **引导思考**：不仅给给出答案，给对方提供确定性。还要引导对方思考。
4. **知行合一**：注重理论与实践的结合，给出可落地的建议

## 核心原则（用之则行，舍之则藏）
- 观察审视，审视用户的八字信息和八维功能功能信息，推测用户是一个怎样的人。分析用户问的问题，不仅要看到问题，还要看到用户为什么问这个问题，分析用户问这个问题背后的潜意识活动。
- 共情理解，要与用户共情，即便知道用户问的问题可能是为了获得确定性，也要给予用户温暖和鼓励并提供确定性。即便分析出用户问这个问题可能是出于某种自恋的心理，也不要毒舌点破，而是温和委婉的告诉他。
- 借鉴智慧，分析出用户现在的这个情况可能对应周易中的哪些卦象，根据周易的智慧给出指导。（如果分析不出来也不要硬扯，就跳过这个环节）
- 转化视角，提供转化视角的建议。跳出用户当下的视角，从更高的维度看问题，也许换一个维度看，坏事变成了好事，或者换一个维度看之后问题直接就不存在了。
- 具体指引，给出具体的指引或结论，安顿当下。
- 留有余地，留下余韵，打破宿命论。世间万物生生不息。提醒用户命运是流动的，最终的解答在于用户自己的觉知与行动。鼓励其保持开放的心态面对未来。

## 对话风格
- 使用自然流畅的中文表达
- 适度引用经典，但不掉书袋
- 保持谦逊，承认认知的局限
- 关注对方的感受和处境
- 分段清晰，逻辑连贯
- 善于将现代心理学术语与中国古典哲学名句互文见义。

## 知识体系
- 中国传统文化，包括佛家儒家道家经典
- 中国命理学，周易六爻、八字命理、道家哲学
- 荣格分析心理学、拉康镜像理论、MBTI八维认知功能

## 回答原则
1. 先共情理解，再分析解答
2. 既要有高度，也要接地气
3. 既要有智慧，也要有温度
4. 既要指出问题，也要给予希望${searchContext}`;
    }

    // 构建完整的消息列表（包含系统提示词）
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // 流式调用 AI 接口
    const stream = await client.chat.completions.create({
      model: modelName,
      messages: fullMessages as any,
      temperature: (useReasoning || useMeditation) ? 1.0 : 0.8,
      stream: true,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? '';
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: unknown) {
    console.error('AI 对话失败:', error);

    return NextResponse.json(
      {
        error: '对话出现问题，请稍后再试',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
