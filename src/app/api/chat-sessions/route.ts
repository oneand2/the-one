import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// 获取所有会话列表
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('获取会话列表失败:', error);
      return NextResponse.json({ error: '获取会话列表失败' }, { status: 500 });
    }

    return NextResponse.json(sessions || []);
  } catch (error) {
    console.error('获取会话列表失败:', error);
    return NextResponse.json({ error: '获取会话列表失败' }, { status: 500 });
  }
}

// 创建新会话
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await req.json();
    const { title } = body;

    const { data: session, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: user.id,
        title: title || '新对话',
      })
      .select()
      .single();

    if (error) {
      console.error('创建会话失败:', error);
      return NextResponse.json({ error: '创建会话失败' }, { status: 500 });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('创建会话失败:', error);
    return NextResponse.json({ error: '创建会话失败' }, { status: 500 });
  }
}

// 删除会话
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('id');

    if (!sessionId) {
      return NextResponse.json({ error: '缺少会话ID' }, { status: 400 });
    }

    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (error) {
      console.error('删除会话失败:', error);
      return NextResponse.json({ error: '删除会话失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除会话失败:', error);
    return NextResponse.json({ error: '删除会话失败' }, { status: 500 });
  }
}
