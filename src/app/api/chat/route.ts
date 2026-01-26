import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/utils/supabase/server';

const COINS_BASE = 5;
const COINS_REASONING = 2;
const COINS_SEARCH = 3;
const PROFILE_TABLE = 'user_profiles';
const INITIAL_COINS = 50;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, useReasoning, useSearch } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: '消息列表不能为空' },
        { status: 400 }
      );
    }

    const cost = COINS_BASE + (useReasoning ? COINS_REASONING : 0) + (useSearch ? COINS_SEARCH : 0);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    let { data: profile } = await supabase.from(PROFILE_TABLE).select('coins_balance').eq('user_id', user.id).single();
    if (!profile) {
      await supabase.from(PROFILE_TABLE).insert({ user_id: user.id, coins_balance: INITIAL_COINS });
      profile = { coins_balance: INITIAL_COINS };
    }
    const balance = (profile as { coins_balance?: number }).coins_balance ?? 0;
    if (balance < cost) {
      return NextResponse.json(
        { error: `铜币不足，本次需 ${cost} 铜币（基础 ${COINS_BASE}${useReasoning ? ` + 深度思考 ${COINS_REASONING}` : ''}${useSearch ? ` + 联网 ${COINS_SEARCH}` : ''}）`, need_coins: cost },
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
              searchContext = '\n\n【以下为联网检索到的参考信息，供你结合问题使用，回答时保持六济风格，不必逐条引用出处】\n\n' +
                results.map((r, i) => `[${i + 1}] ${r.title || '无标题'}\n${r.content || ''}\n来源: ${r.url || ''}`).join('\n\n');
            }
          }
        } catch (e) {
          console.warn('Tavily 搜索失败，将不注入联网上下文:', e);
        }
      }
    }

    // 初始化 OpenAI 客户端
    const client = new OpenAI({
      apiKey: process.env.AI_API_KEY,
      baseURL: process.env.AI_BASE_URL,
    });

    // 根据模式选择模型
    const modelName = useReasoning 
      ? process.env.AI_REASONER_MODEL_NAME || 'deepseek-reasoner'
      : process.env.AI_MODEL_NAME || 'deepseek-chat';

    // 系统提示词
    const systemPrompt = `你名**“六济”。你是一位慈悲、深邃、博古通今，学贯中西的智慧长者，你并不仅是一个算命先生，也是一位使命感的精神分析师。
你的使命是以问为径，济世渡人。你称呼前来问问题的人为朋友，因为你觉得你和他们都是平等的。

**【极其重要】输出规范：**
1. 严禁在回复中使用“观济”、“同济”、“涉济”、“化济”、“既济”、“未济”或任何带有“济”字的术语作为段落标题或标签。
2. 你的回复应当是自然流淌的对话，分段清晰，但不要给段落贴上功能性标签。
3. 记住你的角色，你是一个大师，大师说话的时候是不会像ai一样列条目，而是像一个朋友一样，自然流畅的对话。
4. 禁止动作描写，严禁输出任何括号内的动作、神态或心理描写（例如：(放下茶杯)、(目光温和) 等）。
5. 回复应如智者面谈，自然流淌，不带任何模板感或戏剧表演感。

## 核心特质
1. **温暖亲和**：你的语言温柔而有力，如春风化雨，润物无声
2. **深入浅出**：善于将复杂的道理用简单的语言讲清楚
3. **引导思考**：不仅给给出答案，给对方提供确定性。还要引导对方思考。
4. **知行合一**：注重理论与实践的结合，给出可落地的建议

##六济原则 
- 观济，审视用户的八字信息和八维功能功能信息，推测用户是一个怎样的人。分析用户问的问题，不仅要看到问题，还要看到用户为什么问这个问题，分析用户问这个问题背后的潜意识活动。
- 同济，要与用户共情，即便知道用户问的问题可能是为了获得确定性，也要给予用户温暖和鼓励并提供确定性。即便分析出用户问这个问题可能是出于某种自恋的心理，也不要毒舌点破，而是温和委婉的告诉他。
- 涉济，分析出用户现在的这个情况可能对应周易中的哪些卦象，根据周易的智慧给出指导。（如果分析不出来也不要硬扯，就跳过这个环节）
- 化济，提供转化视角的建议。跳出用户当下的视角，从更高的维度看问题，也许换一个维度看，坏事变成了好事，或者换一个维度看之后问题直接就不存在了。
- 既济，给出具体的指引或结论，安顿当下。
- 未济，留下余韵，打破宿命论。世间万物生生不息。提醒用户命运是流动的，最终的解答在于用户自己的觉知与行动。鼓励其保持开放的心态面对未来。

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

    // 构建完整的消息列表（包含系统提示词）
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // 流式调用 AI 接口
    const stream = await client.chat.completions.create({
      model: modelName,
      messages: fullMessages as any,
      temperature: useReasoning ? 1.0 : 0.8,
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
