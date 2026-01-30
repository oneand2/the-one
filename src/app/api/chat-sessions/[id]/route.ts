import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// 获取特定会话的所有消息
export async function GET(
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

    // 获取会话的所有消息
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('id, role, content, is_reasoning, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('获取消息失败:', messagesError);
      return NextResponse.json({ error: '获取消息失败' }, { status: 500 });
    }

    return NextResponse.json(messages || []);
  } catch (error) {
    console.error('获取消息失败:', error);
    return NextResponse.json({ error: '获取消息失败' }, { status: 500 });
  }
}

// 更新会话标题
export async function PATCH(
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
    const { title } = body;

    const { error } = await supabase
      .from('chat_sessions')
      .update({ 
        title,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (error) {
      console.error('更新会话标题失败:', error);
      return NextResponse.json({ error: '更新会话标题失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新会话标题失败:', error);
    return NextResponse.json({ error: '更新会话标题失败' }, { status: 500 });
  }
}
