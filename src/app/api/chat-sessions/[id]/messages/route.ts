import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// 保存消息到会话
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const body = await req.json();
    const { messages } = body;

    // 验证会话是否属于当前用户
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: '会话不存在或无权访问' }, { status: 404 });
    }

    // 批量插入消息
    const messagesToInsert = messages.map((msg: any) => ({
      session_id: sessionId,
      role: msg.role,
      content: msg.content,
      is_reasoning: msg.isReasoning || false,
    }));

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messagesToInsert)
      .select();

    if (error) {
      console.error('保存消息失败:', error);
      return NextResponse.json({ error: '保存消息失败' }, { status: 500 });
    }

    // 更新会话的 updated_at
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return NextResponse.json(data);
  } catch (error) {
    console.error('保存消息失败:', error);
    return NextResponse.json({ error: '保存消息失败' }, { status: 500 });
  }
}
