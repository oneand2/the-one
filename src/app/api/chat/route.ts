import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/utils/supabase/server';
import { isVip } from '@/utils/vip';
import type { BaziImportData, MbtiImportData, LiuyaoImportData, QianchengImportData } from '@/types/import-data';
import { retrieveRelevantNews } from '@/utils/newsRetrieval';

export const runtime = 'nodejs';
export const maxDuration = 120;

const COINS_BASE = 2;
const COINS_REASONING = 2;
const COINS_MEDITATION = 20;
const COINS_SEARCH = 2;
const PROFILE_TABLE = 'user_profiles';
const INITIAL_COINS = 300;

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

    // 管理员或 VIP 不消耗铜币
    const isAdmin = user.email === '892777353@qq.com';
    let { data: profile } = await supabase.from(PROFILE_TABLE).select('coins_balance, vip_expires_at').eq('user_id', user.id).single();
    if (!profile) {
      await supabase.from(PROFILE_TABLE).insert({ user_id: user.id, coins_balance: INITIAL_COINS });
      profile = { coins_balance: INITIAL_COINS, vip_expires_at: null };
    }
    const vip = isVip((profile as { vip_expires_at?: string | null }).vip_expires_at);
    const skipCoins = isAdmin || vip;
    let balance = (profile as { coins_balance?: number }).coins_balance ?? 0;

    if (!skipCoins) {
      if (balance < cost) {
        return NextResponse.json(
          { error: `铜币不足，本次消耗 ${cost} 铜币（基础消耗 ${COINS_BASE}${useReasoning ? `，深度思考消耗 ${COINS_REASONING}` : ''}${useMeditation ? `，宗师消耗 ${COINS_MEDITATION}` : ''}${useSearch ? `，联网消耗 ${COINS_SEARCH}` : ''}）`, need_coins: cost },
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

    if (useMeditation) {
      // 宗师模式只走原备用通道，不再尝试已弃用的主线路
      const meditationKey = process.env.AI_MEDITATION_FALLBACK_API_KEY;
      const meditationBaseURL = process.env.AI_MEDITATION_FALLBACK_BASE_URL;
      if (!meditationKey || !meditationBaseURL) {
        throw new Error('宗师模式未配置可用的API，请检查环境变量 AI_MEDITATION_FALLBACK_*');
      }
      client = new OpenAI({
        apiKey: meditationKey,
        baseURL: meditationBaseURL,
      });
      modelName = process.env.AI_MEDITATION_FALLBACK_MODEL_NAME || 'claude-sonnet-4-5-20250929-thinking';
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
    const qiancheng: QianchengImportData | undefined =
      importData?.qiancheng && importData.qiancheng.type === 'qiancheng' ? importData.qiancheng : undefined;
    const hasImportData = baziList.length > 0 || mbtiList.length > 0 || liuyaoList.length > 0;
    
    // 根据是否有导入数据，选择对应的系统提示词
    let systemPrompt: string;
    
    if (qiancheng) {
      // ========== 占问前程模式：借命理外壳的现实决策参考 ==========
      systemPrompt = await buildQianchengPrompt(supabase, qiancheng, searchContext);
    } else if (hasImportData) {
      // ========== 算命模式提示词 ==========
      let importContext = '\n\n## 用户导入的测算数据\n\n';
      
      // 八字数据
      if (baziList.length > 0) {
        baziList.forEach((bazi, index) => {
          importContext += `### 八字古典排盘信息（第${index + 1}条）\n\n`;
          importContext += `**四柱**: ${bazi.pillars.year.gan}${bazi.pillars.year.zhi}年 ${bazi.pillars.month.gan}${bazi.pillars.month.zhi}月 ${bazi.pillars.day.gan}${bazi.pillars.day.zhi}日 ${bazi.pillars.hour.gan}${bazi.pillars.hour.zhi}时\n\n`;
          importContext += `**日主**: ${bazi.pillars.day.gan}\n\n`;
          if (bazi.pattern) importContext += `**格局**: ${bazi.pattern}\n\n`;
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
          // 不注入八字能量分布/八维功能，避免模型据此推算或分析「八字推导的MBTI」
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
1. **格局与用神为纲（最重要）**：八字分析必须以「格局」和「用神」为核心抓手。开篇就要先把用户的**格局**（如正官格、食神格、从财格等）和**用神**（喜用五行/十神）讲清楚——明确说出"你是XX格、用神为XX"，并解释这意味着什么样的人生路数、什么能帮到你（用神）、什么会消耗你（忌神）。后续所有判断都要落回到格局与用神上，不能脱离它们空谈。
2. **命理为基**：充分利用用户导入的八字、八维、六爻数据，从命理角度分析问题
3. **见微知著**：从用户的命盘中看到他们的本性、倾向、优势和挑战
4. **古今融合**：将传统命理学与现代心理学结合，给出既有深度又有实用价值的建议
5. **因材施教**：根据用户的命理特征（尤其格局与用神），给出最适合他们的建议

**重要**：用户导入的八字数据中不包含「八字推导的MBTI」。你不得根据八字或任何能量分布推算、分析或主动提及「八字推导的MBTI」；仅当用户单独导入了「荣格八维测试」结果时，才可基于该测试结果讨论MBTI。

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

    const messagesToSend = messages;

    // 构建完整的消息列表（包含系统提示词）
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messagesToSend,
    ];

    const maxTokensEnv = Number(process.env.AI_MAX_TOKENS);
    const maxTokens = Number.isFinite(maxTokensEnv)
      ? maxTokensEnv
      : useMeditation
        ? 8192
        : qiancheng
          ? 4096 // 占问前程为三层结构长文，需更大预算避免被截断
          : useReasoning
            ? 4096
            : 3072;

    // 流式调用 AI 接口
    // 宗师模式：部分代理（如转发到 Anthropic）要求使用顶级 system 参数而非 messages 中的 system 消息
    const createParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming & {
      // 宗师线路的兼容代理接受顶级 system 字段，OpenAI 官方类型未声明它。
      system?: string;
    } = {
      model: modelName,
      messages: fullMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      temperature: (useReasoning || useMeditation) ? 1.0 : 0.8,
      max_tokens: maxTokens,
      stream: true,
      ...(useMeditation && { system: systemPrompt }),
    };

    const stream = await client.chat.completions.create(createParams);

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
          if (!skipCoins && hasContent) {
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

// ─────────────────────────────────────────────────────────────────────────────
// 占问前程提示词拼装
//
// 把「八字格局 + 命中新闻摘要 + 用户问题」拼成提示词，引导模型按三层结构输出：
//   ① 个人格局定调 ② 全年大势 ③ 前程指引
// 命理负责语言风格与代入感，真正价值来自新闻提炼的现实趋势；并带上合规措辞。
// ─────────────────────────────────────────────────────────────────────────────
async function buildQianchengPrompt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  q: QianchengImportData,
  searchContext: string
): Promise<string> {
  // 第 2 级漏斗：按问题检索近一年标题库，仅注入命中条目的摘要
  let keywords: string[] = [];
  let items: Array<{
    news_date: string;
    section: string | null;
    title: string;
    summary: string | null;
    source: string | null;
    url: string | null;
  }> = [];
  try {
    const res = await retrieveRelevantNews(supabase, q.question, { limit: 8, dayWindow: 365 });
    keywords = res.keywords;
    items = res.items;
  } catch (e) {
    console.warn('占问前程：新闻检索失败，将仅依据命理与一般现实考量作答:', e);
  }

  // 八字格局信息：优先用完整解析（与八字界面同一套逻辑），否则退回简版四柱
  let baziBlock = '';
  const bz = q.bazi;
  if (bz) {
    const bp = bz.pillars;
    baziBlock += `- 四柱：${bp.year.gan}${bp.year.zhi}年 ${bp.month.gan}${bp.month.zhi}月 ${bp.day.gan}${bp.day.zhi}日 ${q.hasHour ? `${bp.hour.gan}${bp.hour.zhi}时` : '时柱未知'}\n`;
    baziBlock += `- 日主：${bp.day.gan}\n`;
    if (bz.pattern) baziBlock += `- 格局：${bz.pattern}\n`;
    if (bz.strength) baziBlock += `- 强弱：${bz.strength}（强度 ${bz.strengthPercent?.toFixed?.(1) ?? bz.strengthPercent}%）\n`;
    if (bz.favorable?.length) baziBlock += `- 用神：${bz.favorable.join('、')}\n`;
    if (bz.unfavorable?.length) baziBlock += `- 忌神：${bz.unfavorable.join('、')}\n`;
    if (bz.shishenRatio && Object.keys(bz.shishenRatio).length > 0) {
      baziBlock += `- 十神比例：${Object.entries(bz.shishenRatio)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .map(([k, v]) => `${k} ${((v as number) * 100).toFixed(0)}%`)
        .join('、')}\n`;
    }
    if (bz.ganRatio && Object.keys(bz.ganRatio).length > 0) {
      baziBlock += `- 天干比例：${Object.entries(bz.ganRatio)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .map(([k, v]) => `${k} ${((v as number) * 100).toFixed(0)}%`)
        .join('、')}\n`;
    }
    if (bz.relationships) {
      const rels: string[] = [];
      if (bz.relationships.he?.length) rels.push(`合：${bz.relationships.he.join('、')}`);
      if (bz.relationships.chong?.length) rels.push(`冲：${bz.relationships.chong.join('、')}`);
      if (bz.relationships.xing?.length) rels.push(`刑：${bz.relationships.xing.join('、')}`);
      if (bz.relationships.hai?.length) rels.push(`害：${bz.relationships.hai.join('、')}`);
      if (rels.length) baziBlock += `- 八字关系：${rels.join('；')}\n`;
    }
  } else if (q.pillars) {
    const p = q.pillars;
    baziBlock += `- 四柱：${p.year.gan}${p.year.zhi}年 ${p.month.gan}${p.month.zhi}月 ${p.day.gan}${p.day.zhi}日 ${q.hasHour ? `${p.hour.gan}${p.hour.zhi}时` : '时柱未知'}\n`;
    baziBlock += `- 日主：${p.day.gan}\n`;
    if (q.yongshen) baziBlock += `- 用神：${q.yongshen}${q.yongshenWuxing ? `（${q.yongshenWuxing}）` : ''}\n`;
  }
  if (!q.hasHour) {
    baziBlock += `- 注意：出生时辰缺失，请弱化时柱、不要强行推断与时柱相关的细节。\n`;
  }
  if (q.name && !baziBlock.includes('称呼')) baziBlock += `- 称呼：${q.name}\n`;

  // 命中新闻：摘要（注入正文）+ 来源清单（供末尾标注，链接原样透传不杜撰）
  let newsBlock = '';
  let sourceBlock = '';
  if (items.length > 0) {
    newsBlock = items
      .map((it, i) => {
        const date = it.news_date ?? '';
        const sec = it.section ? `［${it.section}］` : '';
        const sum = (it.summary ?? '').trim();
        return `${i + 1}. ${sec}${it.title}（${date}${it.source ? ` · ${it.source}` : ''}）\n   摘要：${sum || '（无摘要）'}`;
      })
      .join('\n\n');
    sourceBlock = items
      .map((it, i) => `[${i + 1}] ${it.source ?? '来源不详'}｜${it.title}${it.url ? `：${it.url}` : ''}`)
      .join('\n');
  }

  const newsAvailability =
    items.length > 0
      ? `已检索到 ${items.length} 条与问题相关的近一年真实新闻（关键词：${keywords.join('、')}），如下：\n\n${newsBlock}`
      : `未检索到与问题高度相关的入库新闻。请如实说明「目前相关公开新闻有限」，不要编造任何新闻、数据或链接；可更多依靠个人格局与一般性的现实考量，但措辞需更谨慎、更克制。`;

  return `你名**"决行藏"**。这是一次「占问前程」：你借命理外壳，为朋友做现实决策参考。命理（用户的八字格局）负责语言风格与代入感，真正的价值来自近一年现实趋势的提炼。你称呼用户为"朋友"。

【最重要的定位】
- 这不是娱乐占卜，朋友可能真的据此做职业、投资等现实选择。落点必须是「基于近一年世间走向，针对其处境给的现实建议」，命理只是把它讲得有代入感。
- 严禁"两张皮"：不要命理说一段、新闻说一段互不相干。要让个人格局与现实大势真正叠加、互相印证。
- 去神棍化：透彻分析"象"，不恐吓、不画饼、不故弄玄虚。

【用户的前程问题】
${q.question}

【个人命理信息】
${baziBlock || '（用户未提供完整八字，可弱化命理细节）'}
【近一年现实新闻（第 2 级检索命中）】
${newsAvailability}

【输出结构：严格分为三层，依次呈现，层层收窄到可执行】
请用三个小标题分段输出，标题就用下面的方括号写法：

【个人格局定调】
这一层必须**先明确说出朋友的格局与用神**，这是整段解读的纲。务必清楚告诉他：
- 你的**格局**是什么（如正官格、食神格、从财格等${bz?.pattern ? `，本盘为「${bz.pattern}」` : ''}），这意味着怎样的人生路数与禀赋；
- 你的**用神**是什么（${bz?.favorable?.length ? `本盘用神为「${bz.favorable.join('、')}」` : '喜用五行/十神'}）——什么样的方向、环境、五行能帮到你（用神），什么会消耗你（忌神）。
再结合日主强弱、十神与天干比例、刑冲合害，落到这份命盘的具体特征上点出他的气质、擅长与不擅长，而非泛泛而谈。出生时辰缺失时弱化时柱、不强行推断。后面的「全年大势」「前程指引」都要回扣到这里的格局与用神。

【全年大势】
这是新闻趋势的主场。基于上面命中的真实新闻摘要，讲清近一年对应板块的现实走向（在涨在落、机会与风险在哪）。只用已给的新闻，不要编造数据或事件。若需要点到出处，可在行文中自然带过（如"近来新华社等也提到……"），不要生硬罗列。

【前程指引】
把个人格局与现实大势叠加，给出带命理口吻、但内核是现实判断的**具体、可执行**建议。这一层必须给出**明确的、敢于选边的结论**，不能模棱两可、不能两头都说好：
- **警惕"有相关新闻就肯定"的陷阱**：几乎任何方向都能找到看似支持它的新闻，所以"有支持性新闻"绝不等于"适合"。你要做的是**权衡利弊、两面对比**：哪一面与朋友的格局/用神更契合、哪一面在近一年大势里机会更大风险更小，然后**明确选出更优的那一个**。
- 若问题是"二选一"（如回老家 vs 去大城市）：必须**旗帜鲜明地选定一方**（例如"于你而言，更适合去大城市"），并讲清为什么是这一方、另一方差在哪，而不是说"两边都有道理"。
- 若问题是"是否/能不能"：必须给出**明确的"宜"或"不宜"**倾向，并说明关键依据与需要注意的节点、条件。
- 结论要落到朋友接下来到底该怎么做、注意什么、把握什么节点。

【结尾】
不要以"本次参考：……"之类的来源罗列收尾，也**不要说"仅供参考、最终还得你自己决定"这种把球踢回去的话**。请改为：先**斩钉截铁地重申你的明确答复**（适合哪一边 / 宜或不宜），再自然地补一句——"不过我手上知道的只有这些，如果你愿意把处境说得更具体些（比如你的行业、手上的资源、最在意什么、家里的牵绊），我给的答案也可能随之调整、给得更准。"语气如老友叮嘱，不要生硬。

【合规与措辞】
- 涉及投资时，只描述趋势与需要考量的因素，**不得给出确定性的买卖建议**。
- 风格如老友夜话，娓娓道来；适度引用但紧接白话解释；不要罗列 1.2.3.，不要括号内的动作神态描写。

${sourceBlock ? `【可在行文中自然引用的新闻来源（链接已核实，禁止改写或杜撰链接；无需逐条罗列，更不要以"本次参考"结尾）】\n${sourceBlock}\n` : ''}${searchContext}`;
}
