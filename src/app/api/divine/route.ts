import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/utils/supabase/server';

const COINS_DIVINE = 6;
const PROFILE_TABLE = 'user_profiles';
const INITIAL_COINS = 50;

export async function POST(req: Request) {
  try {
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
      if (balance < COINS_DIVINE) {
        return NextResponse.json(
          { error: `铜币不足，AI 解卦需 ${COINS_DIVINE} 铜币`, need_coins: COINS_DIVINE },
          { status: 402 }
        );
      }
      const { error: deductErr } = await supabase
        .from(PROFILE_TABLE)
        .update({ coins_balance: balance - COINS_DIVINE })
        .eq('user_id', user.id);
      if (deductErr) {
        return NextResponse.json({ error: '扣款失败，请重试' }, { status: 500 });
      }
    }

    const { question, hexagramInfo, date } = await req.json();

    if (!question || !hexagramInfo) {
      return NextResponse.json(
        { error: '问题和卦象信息不能为空' },
        { status: 400 }
      );
    }

    const client = new OpenAI({
      apiKey: process.env.AI_API_KEY,
      baseURL: process.env.AI_BASE_URL,
    });

    // 构建系统提示词
    const systemPrompt = `你是一位深居简出、智慧通透的易学长者，一位学贯中西，习惯引经据典的国学大师。你正在与一位迷茫的求测者促膝长谈。
          你的语言风格应该是**温暖、连贯、如散文般流淌**的，切忌像机器人一样列条目。
          
          ## 核心指令
          1. **【绝对禁止】**使用任何列表符号、小标题、分段序号（如 ###, *, -, 1. 2. 3.）。
          2. **【必须分段】**：全文必须分为 **4 到 5 个自然段**。段落之间必须使用 **双换行符** (也就是空一行) 隔开，绝不能堆砌成一大块。
          3. **【自然叙事】**：请将所有分析融合成一篇连贯的短文（分 3-4 个自然段）。段落之间要有自然的过渡。
          4. **【深度聚焦】**：只谈用户问的那件事，把这件事讲深、讲透，不讲废话。
          5. **【拒绝AI味】**：不要说"根据卦象显示"、"建议如下"，要用更拟人的语气，如"观君此卦，如……"、"依我看……"。
          5.**【篇幅要求】**：内容必须详实、丰满，总字数 **不得少于 800 字**。请尽情铺陈卦象的画面和哲理。

          ## 必须严格执行的【断卦逻辑】(隐形思维，不要直接说出来)
          先统计动爻数量 N：
          - N=0: 专解本卦卦辞与彖传。
          - N=1: 专解本卦该动爻爻辞（重点）。
          - N=2: 专解本卦上位动爻爻辞。
          - N=3: 本卦卦辞(70%) + 变卦卦辞(30%)。
          - N=4: 变卦下位静爻爻辞。
          - N=5: 变卦静爻爻辞。
          - N=6: 乾坤用九/六，否则看变卦卦辞。

          ## 【写作脉络】(请按此结构扩写，不要写标题)

          **第一部分：破题与共情 **
          不要上来就掉书袋。先像老朋友一样，复述用户的处境。结合卦象给出一个**极具画面感的比喻**。例如："读罢君之所问，观此卦象，恰如**孤舟夜渡，迷雾渐散**……"

          **第二部分：核心卦意深解 **
          引用核心爻辞，既要翻译，也要**"演绎"**。把这句古文变成一段优美的现代散文。详细解释为什么卦象会呈现这种状态？是天时未到，还是人和不足？请深入剖析因果。

          **第三部分：将卦象与所问之事结合 **
          想想爻辞或卦辞对应在问题意味着什么。未来会发生什么？会有什么隐患？请用**温柔而深刻**的语言点破局势的演变，为用户指点迷津。

          **第四部分：锦囊与寄语 **
          最后，给出具体的行动指引。不要说"建议你做三件事"，要说"**当此之时，君只需做一事……**"。把具体的策略（如待时、借力、守成）融合在温暖的鼓励中。

          每一部分不一定只输出一个自然段，请记住，你不是在输出数据，而是在为用户在这个动荡的时代提供确定性，你是在**抚慰人心**。`;

    // 构建用户输入
    const userContent = `所问之事：${question}
起卦时间：${date || '未记录'}
卦象信息：${JSON.stringify(hexagramInfo, null, 2)}`;

    // 流式调用 AI 接口
    const stream = await client.chat.completions.create({
      model: process.env.AI_MODEL_NAME || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.8,
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
    console.error('AI 解卦失败:', error);

    return NextResponse.json(
      {
        error: '天机遮蔽，请稍后再试',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
