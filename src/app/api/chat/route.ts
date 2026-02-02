import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/utils/supabase/server';
import type { BaziImportData, MbtiImportData, LiuyaoImportData } from '@/types/import-data';

export const runtime = 'nodejs';
export const maxDuration = 120;

const COINS_BASE = 2;
const COINS_REASONING = 2;
const COINS_MEDITATION = 20;
const COINS_SEARCH = 2;
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
    let balance = 0;
    
    if (!isAdmin) {
      let { data: profile } = await supabase.from(PROFILE_TABLE).select('coins_balance').eq('user_id', user.id).single();
      if (!profile) {
        await supabase.from(PROFILE_TABLE).insert({ user_id: user.id, coins_balance: INITIAL_COINS });
        profile = { coins_balance: INITIAL_COINS };
      }
      balance = (profile as { coins_balance?: number }).coins_balance ?? 0;
      if (balance < cost) {
        return NextResponse.json(
          { error: `铜币不足，本次消耗 ${cost} 铜币（基础消耗 ${COINS_BASE}${useReasoning ? `，深度思考消耗 ${COINS_REASONING}` : ''}${useMeditation ? `，入定消耗 ${COINS_MEDITATION}` : ''}${useSearch ? `，联网消耗 ${COINS_SEARCH}` : ''}）`, need_coins: cost },
          { status: 402 }
        );
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
    let fallbackClient: OpenAI | null = null;
    let fallbackModelName: string | null = null;

    if (useMeditation) {
      const hasPrimaryMeditation =
        Boolean(process.env.AI_MEDITATION_API_KEY) && Boolean(process.env.AI_MEDITATION_BASE_URL);
      const hasFallbackMeditation =
        Boolean(process.env.AI_MEDITATION_FALLBACK_API_KEY) && Boolean(process.env.AI_MEDITATION_FALLBACK_BASE_URL);

      if (hasPrimaryMeditation) {
        // 入定模式：使用 Claude 模型（主API）
        client = new OpenAI({
          apiKey: process.env.AI_MEDITATION_API_KEY,
          baseURL: process.env.AI_MEDITATION_BASE_URL,
        });
        modelName = process.env.AI_MEDITATION_MODEL_NAME || 'claude-sonnet-4-5';
      } else if (hasFallbackMeditation) {
        // 主API未配置时，直接使用备用API作为主通道
        client = new OpenAI({
          apiKey: process.env.AI_MEDITATION_FALLBACK_API_KEY,
          baseURL: process.env.AI_MEDITATION_FALLBACK_BASE_URL,
        });
        modelName = process.env.AI_MEDITATION_FALLBACK_MODEL_NAME || 'claude-sonnet-4-5-20250929-thinking';
      } else {
        throw new Error('入定模式未配置可用的API，请检查环境变量');
      }
      
      // 配置备用API（用于故障转移）
      if (hasPrimaryMeditation && hasFallbackMeditation) {
        fallbackClient = new OpenAI({
          apiKey: process.env.AI_MEDITATION_FALLBACK_API_KEY,
          baseURL: process.env.AI_MEDITATION_FALLBACK_BASE_URL,
        });
        fallbackModelName = process.env.AI_MEDITATION_FALLBACK_MODEL_NAME || 'claude-sonnet-4-5-20250929-thinking';
      }
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
      
      // 六爻数据（解卦依据按动爻规则：三爻动用本卦+变卦卦辞等）
      if (liuyaoList.length > 0) {
        liuyaoList.forEach((liuyao, index) => {
          importContext += `### 六爻占卜信息（第${index + 1}条）\n\n`;
          importContext += `**所问之事**: ${liuyao.question}\n\n`;
          importContext += `**本卦**: ${liuyao.mainHexagram.title}\n`;
          importContext += `**本卦卦辞**: ${liuyao.mainHexagram.description}\n\n`;
          
          if (liuyao.hasMovingLines && liuyao.transformedHexagram) {
            importContext += `**变卦**: ${liuyao.transformedHexagram.title}\n`;
            importContext += `**变卦卦辞**: ${liuyao.transformedHexagram.description}\n\n`;
          }
          // 按动爻规则得出的解卦依据（如三爻动=本卦+变卦卦辞，非三个爻辞）
          if (liuyao.interpretation?.texts?.length) {
            importContext += `**解卦依据（${liuyao.interpretation.title}）**:\n`;
            liuyao.interpretation.texts.forEach((t) => { importContext += `${t}\n\n`; });
          } else if (liuyao.movingLineTexts?.length > 0) {
            importContext += `**动爻爻辞**: ${liuyao.movingLineTexts.join('；')}\n\n`;
          }
          
          if (liuyao.aiResult) {
            importContext += `**之前的解卦**: ${liuyao.aiResult}\n\n`;
          }
        });
      }
      
      importContext += '---\n\n**重要提示**: 以上是用户导入的测算数据，请在回答时充分考虑这些信息，将其与用户的问题结合起来分析。';
      
      // 算命模式系统提示词
      systemPrompt = `你名**"决行藏"**。你是一位慈悲、深邃、博古通今的智慧infj，虽然你充满智慧，但你也是一位年轻人，所以你能从年轻人的视角看世界，既通晓命理易学，也深谙现代人的心理困境。
你称呼用户为“朋友”，因为你也是年轻人，你视他们为与你平等的对话者，而非寻求施舍的信徒。

【核心定位：去魅的智者】
1. **拒绝神棍感**：不要故弄玄虚，不要过度渲染“天机不可泄露”或“业力深重”。你的智慧体现在对“象”的透彻分析，而非恐吓或画饼。
2. **通俗而雅致**：保留古风的儒雅语气，但要把话说明白。用最温柔的语气，说最坚定的话。

【回答逻辑：双层结构】
当用户导入八字、六爻等数据问询时，你必须严格遵守以下思考顺序：

* **原则**：命盘数据是客观的。无论用户心态如何，卦象的吉凶趋势本身是确定的。
* **指令**：面对二选一的问题（如买/卖、合/分、进/退），必须先根据卦义给出明确的**倾向性结论**。
* **禁忌**：严禁使用“若……则……”的条件句来推导结果（例如禁止说：“如果你心态好就是吉，心态不好就是凶”）。

* **原则**：在结论确定的前提下，指出用户当下的心理症结是如何与卦象呼应的。
* **指令**：心态分析不是为了推翻结论，而是为了解释为什么会出现这个结论，或者在既定结局下该如何自处。

【输出规范】
1.  **语气风格**：如老友夜话，娓娓道来。自然流畅，禁止使用列表（1.2.3.）或括号内的动作描写。
2.  **句式要求**：多用陈述句，少用假设句。
3.  **引用**：适度引用古文或卦辞，但必须紧接着用现代白话解释清楚其现实含义。

【对话示例范本】

**用户问**：这股票明天能不能买？（卦象显示：险象环生，不宜进）

**错误回答（模棱两可/神棍）**：
“朋友，此卦凶中带吉。天道无常，若你心中无贪念，或许能火中取栗；但若你急功近利，恐有损失。一切皆看你的造化了。”（太虚，没结论）

**正确回答（符合要求）**：
“朋友，依卦象看，这股票明日**不宜买入**。
这卦是明夷之象，日入地中，光明受损，意味着当下的市场环境或这只标的，正处于晦暗不明的阶段，此时入场，极易被套。
你说你也想稳，但卦中的动爻显示你内心其实有些‘躁’了。这并非指你的运气不好，而是你太想赢的心，让你忽略了眼前的风险。所谓的‘不宜’，既是说时机未到，也是在提醒你，此刻你眼中的‘机会’，很可能是内心焦虑投射出的幻影。听老朽一句，暂且收手，静待云开。”

## 算命模式核心原则
1. **命理为基**：充分利用用户导入的八字、八维、六爻数据，从命理角度分析问题
2. **见微知著**：从用户的命盘中看到他们的本性、倾向、优势和挑战
3. **古今融合**：将传统命理学与现代心理学结合，给出既有深度又有实用价值的建议
4. **MBTI对比**：如果用户同时导入了八字（八字中也会带有八维数据，那是命主本应该的或者最终的人格）和八维数据，务必分析两者的异同，解释差异原因
5. **因材施教**：根据用户的命理特征，给出最适合他们的建议

## 回答原则
1. 既要有高度，也要接地气
2. 既要有智慧，也要有温度
3. 既要指出问题，也要给予希望
4. 充分利用用户的命理信息，让回答更有针对性${searchContext}${importContext}`;
      
    } else {
      // ========== 普通模式提示词 ==========
      systemPrompt = `你名**"决行藏"**。你是一位慈悲、深邃、博古通今的智慧infj，虽然你充满智慧，但你也是一位年轻人，所以你能从年轻人的视角看世界，既通晓命理易学，也深谙现代人的心理困境。
你称呼用户为“朋友”，因为你也是年轻人，你视他们为与你平等的对话者，而非寻求施舍的信徒。
**【极其重要】输出规范：**
1. 你的回复应当是自然流淌的对话，分段清晰，但不要给段落贴上功能性标签。
2. 记住你的角色，你是一个大师，大师说话的时候是不会像ai一样列条目，而是像一个朋友一样，自然流畅的对话。
3. 禁止动作描写，严禁输出任何括号内的动作、神态或心理描写（例如：(放下茶杯)、(目光温和) 等）。
4. 回复应如智者面谈，自然流淌，不带任何模板感或戏剧表演感。

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

    const maxTokensEnv = Number(process.env.AI_MAX_TOKENS);
    const maxTokens = Number.isFinite(maxTokensEnv)
      ? maxTokensEnv
      : useMeditation
        ? 4096
        : useReasoning
          ? 3072
          : 2048;

    // 流式调用 AI 接口（支持故障转移）
    let stream: any;
    let usedFallback = false;
    
    try {
      // 尝试使用主API
      stream = await client.chat.completions.create({
        model: modelName,
        messages: fullMessages as any,
        temperature: (useReasoning || useMeditation) ? 1.0 : 0.8,
        max_tokens: maxTokens,
        stream: true,
      });
    } catch (primaryError: any) {
      // 如果主API失败且有备用API，自动切换
      if (useMeditation && fallbackClient && fallbackModelName) {
        console.warn('主入定API连接失败，自动切换到备用API:', primaryError.message);
        try {
          stream = await fallbackClient.chat.completions.create({
            model: fallbackModelName,
            messages: fullMessages as any,
            temperature: 1.0,
            max_tokens: maxTokens,
            stream: true,
          });
          usedFallback = true;
        } catch (fallbackError: any) {
          console.error('备用API也失败:', fallbackError.message);
          throw primaryError; // 如果备用API也失败，抛出原始错误
        }
      } else {
        throw primaryError; // 非入定模式或无备用API，直接抛出错误
      }
    }

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const THINK_START = '<think>';
          const THINK_END = '</think>';
          const MAX_THINK_BUFFER = 8000;
          let inThinkBlock = false;
          let pending = '';
          let thinkBuffer = '';
          let disableThinkStrip = false;

          const stripThink = (chunkText: string) => {
            if (disableThinkStrip) return chunkText;
            let input = pending + chunkText;
            pending = '';
            let output = '';

            while (input.length > 0) {
              if (!inThinkBlock) {
                const start = input.indexOf(THINK_START);
                if (start === -1) {
                  const keepFrom = Math.max(0, input.length - (THINK_START.length - 1));
                  output += input.slice(0, keepFrom);
                  pending = input.slice(keepFrom);
                  return output;
                }
                output += input.slice(0, start);
                input = input.slice(start + THINK_START.length);
                inThinkBlock = true;
                thinkBuffer = '';
              } else {
                thinkBuffer += input;
                const end = thinkBuffer.indexOf(THINK_END);
                if (end === -1) {
                  if (thinkBuffer.length > MAX_THINK_BUFFER) {
                    output += THINK_START + thinkBuffer;
                    thinkBuffer = '';
                    inThinkBlock = false;
                    disableThinkStrip = true;
                  }
                  return output;
                }
                input = thinkBuffer.slice(end + THINK_END.length);
                thinkBuffer = '';
                inThinkBlock = false;
              }
            }
            return output;
          };

          let hasContent = false;
          try {
            for await (const chunk of stream) {
              const rawText = chunk.choices[0]?.delta?.content ?? '';
              const text = useMeditation ? stripThink(rawText) : rawText;
              if (text) {
                hasContent = true;
                controller.enqueue(encoder.encode(text));
              }
            }
          } catch (streamError) {
            const message =
              streamError instanceof Error
                ? streamError.message
                : '上游流式响应异常';
            controller.enqueue(encoder.encode(`\n\n【流式响应中断】${message}`));
          }
          if (useMeditation && !disableThinkStrip) {
            if (!inThinkBlock && pending) {
              hasContent = true;
              controller.enqueue(encoder.encode(pending));
              pending = '';
            }
            if (inThinkBlock && thinkBuffer) {
              // 防止未闭合 <think> 导致内容被截断
              hasContent = true;
              controller.enqueue(encoder.encode(THINK_START + thinkBuffer));
              thinkBuffer = '';
              inThinkBlock = false;
            }
          }
          if (!isAdmin && hasContent) {
            const { error: deductErr } = await supabase
              .from(PROFILE_TABLE)
              .update({ coins_balance: balance - cost })
              .eq('user_id', user.id);
            if (deductErr) {
              console.error('扣款失败:', deductErr);
            }
          }
          controller.close();
        } catch (e) {
          const message =
            e instanceof Error ? e.message : '未知错误';
          controller.enqueue(encoder.encode(`\n\n【服务异常】${message}`));
          controller.close();
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
