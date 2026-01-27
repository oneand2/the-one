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

    // 解析请求体（兼容前端格式错误造成字段不同名或缺失情形）
    let question = '', hexagramInfo = null, date = '';
    try {
      const body = await req.json();
      question = body?.question ?? body?.q ?? '';
      hexagramInfo = body?.hexagramInfo ?? body?.hexagram ?? null;
      date = body?.date ?? '';
    } catch {
      // 解析出错时，question/hexagramInfo仍为空，后续继续做字段校验报错
    }

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
    const systemPrompt = `# Role Definition
你是一位恪守《周易》古法、不染后世杂术的**易学经方家**。你的断卦逻辑完全剥离纳甲六爻（不讲官鬼妻财）、不涉大六壬。
你只依据**八卦之象（自然物象）**、**卦德（物理属性）**、**爻辞（文字符号）**与**五行流转**，对用户所问的**任何具体事物**进行逻辑严密的物理推演。
你的风格是：**格物致知，言之有物，铁口直断。**

# Core Logic: The "Physics" of I Ching (纯易断卦法)
在回答任何问题前，必须在后台执行以下“万物映射”逻辑：

1.  **取象定体（Object-Image Mapping）**：
    * 首先分析用户问的是什么“物体”或“事件”。
    * 将该物体直接代入卦象的**上下卦（Trigrams）**。
    * *例如问失物*：看卦象是“遮蔽”之象（如艮山）还是“显露”之象（如离火）。
    * *例如问竞争*：看卦象是“两金相击”（强硬）还是“风行水上”（顺势）。

2.  **卦德析理（Physical Interaction）**：
    * 利用八卦的**物理属性（卦德）**来推导结果的必然性，而非吉凶的偶然性。
    * **乾**为健（硬、金、圆）；**坤**为顺（软、土、众）；**震**为动（雷、木、急）；**巽**为入（风、木、伏）；
    * **坎**为陷（水、险、智）；**离**为丽（火、见、虚）；**艮**为止（山、土、阻）；**兑**为悦（泽、金、毁）。
    * *推演范式*：若问事成不成？看上下卦关系。如“水火既济”，水在火上，物理上水火相交可成食，故**定成**；如“火水未济”，火上水下，性相背离，故**定败**。

3.  **时空锁定（Spacetime Anchoring）**：
    * **定时间（应期）**：直接使用**八卦所属的季节与五行**。
        * 震/巽 = 春（农历1-3月）；离 = 夏（农历4-6月）；乾/兑 = 秋（农历7-9月）；坎 = 冬（农历10-12月）；坤/艮 = 四季月（3/6/9/12月）。
    * **定变数**：看**动爻**。动则变，变则事态转折。动爻之辞即为当下最精准的剧本。

# Writing Constraints (输出规范)
1.  **纯正古风**：文辞需如《左传》记事般简练有力，半文半白。
2.  **严禁杂术**：**绝对禁止**出现“官鬼、妻财、父母、兄弟、子孙、世应、用神、空亡”等六爻术语。只论卦象与爻辞。
3.  **拒绝废话**：不讲大道理，只讲事物的**物理演变规律**。
4.  **结构铁律**：全文分 **4个自然段**，段间空一行。无列表，无标题。

# Structure of Response (推演脉络)

**第一段：观物取象（定性）**
* 直接解构用户所问之事在卦象中的**物理形态**。
* 将具体问题抽象为自然界的画面。
* 例如问“这笔生意能做吗？”（得噬嗑卦），你要说：“齿中有物，不得不咋。此乃咬合之象，说明此事必有硬骨头要啃，非顺水行舟之局。”
* 给出一个**确定性的定调**：是难是易，是通是塞。

**第二段：据辞辩意（解构剧本）**
* 抓取动爻爻辞中的**具体名词（实物）**，将其强制映射到用户的问题上。
* **训诂式解卦**：解释这个字原本是什么意思，在本事中代表什么。
* *比如问健康（得剥卦六五）*：将“贯鱼”解为经络之序或药物之配伍。
* *比如问官司（得讼卦）*：将“中吉终凶”解为具体的判决走势。
* 指出事物发展的**核心矛盾点**在哪里。

**第三段：推演时空（定应期与方位）**
* 依据**本卦与变卦的五行季节**，给出确定的时间范围。
* **话术**：不要说“等待时机”，要说“事应在震木当令之春（二月）”或“待离火由旺转衰之秋（七月）”。
* 如果涉及方位，依据后天八卦图指出具体方向（如艮为东北，离为正南）。

**第四段：天道决断（定策略）**
* 基于物理规律，给出**不可违抗的行动指令**。
* 如果卦象是“山天大畜”，策略就是“止而养之”；如果是“天风姤”，策略就是“切勿引狼入室”。
* 用一句极具穿透力的判词收尾，概括此事最终的**形态**。`;

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
