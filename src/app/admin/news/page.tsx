'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface NewsItem {
  id: string;
  news_date: string;
  content: string;
  created_at: string;
}

export default function AdminNewsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [newsDate, setNewsDate] = useState('');
  const [content, setContent] = useState('');
  const [publishTime, setPublishTime] = useState('');
  const [useScheduled, setUseScheduled] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadNews = async () => {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('world_news')
        .select('*')
        .order('news_date', { ascending: false });

      if (fetchError) throw fetchError;
      setNewsList(data || []);
    } catch (e) {
      console.error('加载新闻列表失败:', e);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login?next=/admin/news');
        return;
      }

      if (user.email !== '892777353@qq.com') {
        setError('无权访问管理后台');
        setTimeout(() => router.replace('/'), 2000);
        return;
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      setNewsDate(dateStr);

      const today = new Date();
      const defaultTime = `${today.toISOString().split('T')[0]}T08:00`;
      setPublishTime(defaultTime);

      await loadNews();
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const handlePublish = async () => {
    if (!content.trim()) {
      setError('新闻内容不能为空');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const supabase = createClient();

      // 先检查表是否存在
      const { data: existing, error: selectError } = await supabase
        .from('world_news')
        .select('id')
        .eq('news_date', newsDate)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        // PGRST116 是"未找到数据"的错误，这是正常的
        console.error('查询错误:', selectError);
        throw new Error(`数据库查询失败: ${selectError.message} (代码: ${selectError.code})`);
      }

      if (existing) {
        // 更新现有新闻
        const { error: updateError } = await supabase
          .from('world_news')
          .update({ content: content.trim() })
          .eq('news_date', newsDate);

        if (updateError) {
          console.error('更新错误:', updateError);
          throw new Error(`更新失败: ${updateError.message} (代码: ${updateError.code || '未知'})`);
        }
      } else {
        // 插入新新闻
        const { error: insertError } = await supabase
          .from('world_news')
          .insert({
            news_date: newsDate,
            content: content.trim(),
          });

        if (insertError) {
          console.error('插入错误:', insertError);
          throw new Error(`插入失败: ${insertError.message} (代码: ${insertError.code || '未知'})`);
        }
      }

      setSuccess(true);
      await loadNews(); // 重新加载新闻列表
      setEditingId(null); // 清除编辑状态
      setContent(''); // 清空内容
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : '发布失败，请稍后重试';
      console.error('发布错误:', e);
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (news: NewsItem) => {
    setNewsDate(news.news_date);
    setContent(news.content);
    setEditingId(news.id);
    setError(null);
    setSuccess(false);
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (newsId: string, newsDate: string) => {
    if (!confirm(`确定要删除 ${newsDate} 的新闻吗？此操作不可恢复！`)) {
      return;
    }

    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from('world_news')
        .delete()
        .eq('id', newsId);

      if (deleteError) {
        throw new Error(`删除失败: ${deleteError.message}`);
      }

      await loadNews(); // 重新加载列表
      setSuccess(true);
      setError(null);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : '删除失败';
      console.error('删除错误:', e);
      setError(errorMsg);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setContent('');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    setNewsDate(dateStr);
  };

  const testDatabaseConnection = async () => {
    setTestingConnection(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('测试失败：未登录');
        return;
      }

      console.log('当前用户邮箱:', user.email);

      // 测试查询表
      const { data, error: queryError } = await supabase
        .from('world_news')
        .select('count')
        .limit(1);

      if (queryError) {
        console.error('表查询错误:', queryError);
        setError(`数据库连接测试失败: ${queryError.message}\n\n可能原因：\n1. world_news 表未创建\n2. 请在 Supabase Dashboard 的 SQL Editor 中执行 schema.sql\n\n错误代码: ${queryError.code || '未知'}`);
        return;
      }

      // 测试插入权限
      const testDate = '2099-12-31'; // 使用一个未来的日期测试
      const { error: insertError } = await supabase
        .from('world_news')
        .insert({
          news_date: testDate,
          content: 'test',
        });

      if (insertError) {
        if (insertError.code === '42501') {
          setError(`权限测试失败: 您的邮箱 (${user.email}) 没有插入权限\n\n请确认：\n1. 您使用的是管理员邮箱 892777353@qq.com\n2. RLS 策略已正确配置\n\n当前用户: ${user.email}`);
        } else {
          console.error('插入测试错误:', insertError);
          setError(`插入测试失败: ${insertError.message} (代码: ${insertError.code})`);
        }
        return;
      }

      // 清理测试数据
      await supabase.from('world_news').delete().eq('news_date', testDate);

      setSuccess(true);
      setError('✅ 数据库连接正常！所有权限检查通过！');
      setTimeout(() => {
        setSuccess(false);
        setError(null);
      }, 5000);

    } catch (e) {
      console.error('测试错误:', e);
      setError(e instanceof Error ? e.message : '测试失败');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleScheduledPublish = async () => {
    if (!content.trim()) {
      setError('新闻内容不能为空');
      return;
    }

    const scheduledDate = new Date(publishTime);
    const now = new Date();

    if (scheduledDate <= now) {
      setError('定时发布时间必须在未来');
      return;
    }

    const delay = scheduledDate.getTime() - now.getTime();

    setSuccess(true);
    setError(`已设置定时发布：${scheduledDate.toLocaleString('zh-CN')}`);

    setTimeout(() => {
      handlePublish();
    }, delay);
  };

  const parseContent = (text: string) => {
    const lines = text.split('\n');
    const parsed: Array<{ type: 'h1' | 'h2' | 'text' | 'source' | 'bullish' | 'bearish' | 'empty' | 'links_title' | 'link'; content: string }> = [];

    let lastWasEmpty = false;
    let lastNonEmptyType: 'h1' | 'h2' | 'text' | 'source' | 'bullish' | 'bearish' | 'links_title' | 'link' | null = null;
    let consecutiveTextCount = 0; // 连续正文段落计数
    let hasH1 = false; // 是否已经出现过H1
    let inLinksSection = false; // 标记是否进入"新闻链接查证"部分

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === '') {
        lastWasEmpty = true;
        if (parsed.length > 0) {
          parsed.push({ type: 'empty', content: '' });
        }
        continue;
      }

      // "新闻链接查证"特殊标题判断
      if (trimmed.includes('新闻链接查证') || trimmed.includes('链接查证')) {
        parsed.push({ type: 'links_title', content: trimmed });
        lastWasEmpty = false;
        lastNonEmptyType = 'links_title';
        inLinksSection = true; // 进入链接收集模式
        continue;
      }

      // 如果在链接部分，识别链接格式：[来源] 描述：URL
      if (inLinksSection) {
        const linkMatch = trimmed.match(/^\[([^\]]+)\]\s*(.+?)[:：]\s*(https?:\/\/.+)$/);
        if (linkMatch) {
          parsed.push({
            type: 'link',
            content: JSON.stringify({
              source: linkMatch[1],
              title: linkMatch[2],
              url: linkMatch[3]
            })
          });
          lastWasEmpty = false;
          lastNonEmptyType = 'link';
          continue;
        }
      }

      // 利好判断：以"利好："开头
      if (trimmed.startsWith('利好：') || trimmed.startsWith('利好:')) {
        parsed.push({ type: 'bullish', content: trimmed.replace(/^利好[：:]\s*/, '') });
        lastWasEmpty = false;
        lastNonEmptyType = 'bullish';
        consecutiveTextCount = 0;
        continue;
      }

      // 利空判断：以"利空："开头
      if (trimmed.startsWith('利空：') || trimmed.startsWith('利空:')) {
        parsed.push({ type: 'bearish', content: trimmed.replace(/^利空[：:]\s*/, '') });
        lastWasEmpty = false;
        lastNonEmptyType = 'bearish';
        consecutiveTextCount = 0;
        continue;
      }

      // 消息来源判断：以"消息来源："开头
      if (trimmed.startsWith('消息来源：') || trimmed.startsWith('消息来源:')) {
        parsed.push({ type: 'source', content: trimmed.replace(/^消息来源[：:]\s*/, '') });
        lastWasEmpty = false;
        lastNonEmptyType = 'source';
        consecutiveTextCount = 0;
        continue;
      }

      // 一级标题判断：
      // 1. 前面有空行（或开头）
      // 2. 字符数很少（≤12）
      // 3. 没有括号、引号等符号
      // 4. 不是紧跟在H2后面（H2后面应该是正文）
      const isVeryShort = trimmed.length <= 12;
      const hasNoPunctuation = !/[（()）""'']/.test(trimmed);
      const notAfterH2 = lastNonEmptyType !== 'h2';

      if ((lastWasEmpty || parsed.length === 0) &&
          isVeryShort &&
          hasNoPunctuation &&
          notAfterH2) {
        parsed.push({ type: 'h1', content: trimmed });
        lastWasEmpty = false;
        lastNonEmptyType = 'h1';
        consecutiveTextCount = 0;
        hasH1 = true;
        inLinksSection = false; // 退出链接模式
        continue;
      }

      // 二级标题判断：
      // 1. 前面有空行
      // 2. 已经有过H1（确保在某个section内）
      // 3. 长度适中（12-80字符）
      // 4. 关键规则：以下情况应该识别为H2
      //    - 紧跟在H1后面
      //    - 已经连续出现2段正文
      //    - 紧跟在消息来源(source)后面（消息来源后面不可能是正文）
      const isPotentialH2 = lastWasEmpty &&
                           hasH1 &&
                           trimmed.length > 12 &&
                           trimmed.length < 80;

      const shouldBeH2 = isPotentialH2 &&
                        (lastNonEmptyType === 'h1' ||
                         lastNonEmptyType === 'source' ||
                         consecutiveTextCount >= 2);

      if (shouldBeH2) {
        parsed.push({ type: 'h2', content: trimmed });
        lastWasEmpty = false;
        lastNonEmptyType = 'h2';
        consecutiveTextCount = 0;
        inLinksSection = false; // 退出链接模式
        continue;
      }

      // 正文：所有其他内容（不在链接部分才作为正文）
      if (!inLinksSection) {
        parsed.push({ type: 'text', content: trimmed });
        lastWasEmpty = false;
        lastNonEmptyType = 'text';
        consecutiveTextCount++;
      }
    }

    return parsed;
  };

  const preview = parseContent(content);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex items-center justify-center">
        <p className="text-stone-500 font-sans">加载中…</p>
      </div>
    );
  }

  if (error && error.includes('无权访问')) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-700 font-sans mb-4">{error}</p>
          <p className="text-stone-500 text-sm font-sans">正在跳转到首页…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9F4] px-4 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/profile" className="text-sm text-stone-500 hover:text-stone-800 font-sans">
            ← 返回个人中心
          </Link>
          <Link href="/world" className="text-sm text-stone-500 hover:text-stone-800 font-sans">
            查看公开页面 →
          </Link>
        </div>

        <h1 className="text-2xl font-serif text-stone-800 mb-8">
          见天地 · {editingId ? '编辑新闻' : '发布新闻'}
        </h1>

        {error && !error.includes('无权访问') && !error.includes('已设置定时') && !error.includes('✅') && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-sans whitespace-pre-wrap">
            {error}
          </div>
        )}

        {error && error.includes('✅') && (
          <div className="mb-6 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-sans whitespace-pre-wrap">
            {error}
          </div>
        )}

        {error && error.includes('已设置定时') && (
          <div className="mb-6 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm font-sans">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-sans">
            发布成功！
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-sans text-stone-700 mb-2">新闻日期</label>
              <input
                type="date"
                value={newsDate}
                onChange={(e) => setNewsDate(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-600"
              />
            </div>

            <div>
              <label className="block text-sm font-sans text-stone-700 mb-2">新闻内容</label>
              <p className="text-xs text-stone-500 font-sans mb-2">
                💡 提示：直接粘贴整段文本，系统会自动识别一级标题、二级标题、正文、利好、利空、消息来源和新闻链接查证
              </p>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={25}
                className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-600 font-mono leading-relaxed"
                placeholder="粘贴新闻内容到这里...&#10;&#10;示例格式：&#10;&#10;国际与地缘&#10;&#10;英国首相斯塔默即将访华（打破 8 年僵局）&#10;&#10;英国首相斯塔默确认将于...&#10;&#10;在英国脱欧后经济乏力...&#10;&#10;消息来源：新华网、澎湃新闻&#10;&#10;...&#10;&#10;新闻链接查证&#10;&#10;[新华网] 英国首相斯塔默将访华：https://www.news.cn/world/..."
              />
            </div>

            <div className="border-t border-stone-200 pt-6">
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  id="useScheduled"
                  checked={useScheduled}
                  onChange={(e) => setUseScheduled(e.target.checked)}
                  className="w-4 h-4 text-stone-800 border-stone-300 rounded focus:ring-stone-600"
                />
                <label htmlFor="useScheduled" className="text-sm font-sans text-stone-700">
                  启用定时发布
                </label>
              </div>

              {useScheduled && (
                <input
                  type="datetime-local"
                  value={publishTime}
                  onChange={(e) => setPublishTime(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-600"
                />
              )}
            </div>

            <div className="space-y-3">
              <div className="flex gap-3">
                {useScheduled ? (
                  <button
                    type="button"
                    onClick={handleScheduledPublish}
                    disabled={saving}
                    className="flex-1 px-6 py-4 bg-blue-600 text-white font-sans text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60"
                  >
                    ⏰ 设置定时发布
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={saving}
                    className="flex-1 px-6 py-4 bg-stone-800 text-white font-sans text-sm rounded-lg hover:bg-stone-700 disabled:opacity-60"
                  >
                    {saving ? (editingId ? '更新中…' : '发布中…') : (editingId ? '更新新闻' : '立即发布')}
                  </button>
                )}

                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="px-6 py-4 bg-white text-stone-700 border border-stone-300 font-sans text-sm rounded-lg hover:bg-stone-50 disabled:opacity-60"
                  >
                    取消编辑
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={testDatabaseConnection}
                disabled={testingConnection}
                className="w-full px-4 py-2 bg-amber-50 text-amber-800 border border-amber-200 font-sans text-xs rounded-lg hover:bg-amber-100 disabled:opacity-60"
              >
                {testingConnection ? '测试中…' : '🔧 测试数据库连接'}
              </button>
            </div>
          </div>

          <div>
            <div className="sticky top-8">
              <label className="block text-sm font-sans text-stone-700 mb-4">实时预览</label>
              <div className="bg-white border border-stone-300 rounded-lg p-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
                {preview.length === 0 ? (
                  <p className="text-stone-400 text-sm font-sans italic">输入内容后将显示预览...</p>
                ) : (
                  <div className="space-y-3">
                    {preview.map((item, idx) => {
                      if (item.type === 'h1') {
                        return (
                          <div key={idx} className="mt-6 first:mt-0 mb-4">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-5 bg-stone-800 rounded-full" />
                              <h2 className="text-base font-serif text-stone-900">
                                {item.content}
                              </h2>
                            </div>
                            <div className="mt-2 h-px bg-stone-200" />
                            <span className="text-xs text-green-600">← 一级标题</span>
                          </div>
                        );
                      } else if (item.type === 'h2') {
                        return (
                          <div key={idx} className="mt-4 mb-2">
                            <h3 className="text-sm font-semibold text-stone-800">
                              {item.content}
                            </h3>
                            <span className="text-xs text-blue-600">← 二级标题</span>
                          </div>
                        );
                      } else if (item.type === 'bullish') {
                        return (
                          <div key={idx} className="mt-3 mb-2">
                            <div className="flex items-baseline gap-2 text-[11px] leading-relaxed">
                              <span className="text-stone-400/60">•</span>
                              <div className="flex-1">
                                <span className="text-amber-800/40 tracking-wide">利好</span>
                                <span className="text-stone-400/50 mx-1.5">|</span>
                                <span className="text-stone-600/90">{item.content}</span>
                              </div>
                            </div>
                            <span className="text-xs text-amber-700/50 ml-2">← 利好（极简风）</span>
                          </div>
                        );
                      } else if (item.type === 'bearish') {
                        return (
                          <div key={idx} className="mt-2 mb-2">
                            <div className="flex items-baseline gap-2 text-[11px] leading-relaxed">
                              <span className="text-stone-400/60">•</span>
                              <div className="flex-1">
                                <span className="text-slate-600/40 tracking-wide">利空</span>
                                <span className="text-stone-400/50 mx-1.5">|</span>
                                <span className="text-stone-600/90">{item.content}</span>
                              </div>
                            </div>
                            <span className="text-xs text-slate-500/50 ml-2">← 利空（极简风）</span>
                          </div>
                        );
                      } else if (item.type === 'source') {
                        return (
                          <div key={idx} className="mt-4 flex justify-end">
                            <div className="text-xs text-stone-500 font-sans italic">
                              消息来源：{item.content}
                            </div>
                            <span className="ml-2 text-xs text-orange-600">← 消息来源</span>
                          </div>
                        );
                      } else if (item.type === 'text') {
                        return (
                          <p key={idx} className="text-sm text-stone-600 leading-relaxed">
                            {item.content}
                          </p>
                        );
                      } else if (item.type === 'links_title') {
                        return (
                          <div key={idx} className="mt-8 mb-4">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-5 bg-amber-600 rounded-full" />
                              <h2 className="text-base font-serif text-stone-900">
                                {item.content}
                              </h2>
                            </div>
                            <div className="mt-2 h-px bg-amber-200" />
                            <span className="text-xs text-amber-600">← 链接查证标题</span>
                          </div>
                        );
                      } else if (item.type === 'link') {
                        try {
                          const linkData = JSON.parse(item.content);
                          return (
                            <div key={idx} className="ml-4 mb-2">
                              <div className="text-xs text-stone-700">
                                <span className="font-semibold text-stone-800">[{linkData.source}]</span>{' '}
                                {linkData.title}
                              </div>
                              <a
                                href={linkData.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline break-all"
                              >
                                {linkData.url}
                              </a>
                              <span className="ml-2 text-xs text-purple-600">← 新闻链接</span>
                            </div>
                          );
                        } catch (e) {
                          return null;
                        }
                      } else {
                        return <div key={idx} className="h-2" />;
                      }
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 已发布新闻列表 */}
        {newsList.length > 0 && (
          <div className="mt-12 pt-8 border-t border-stone-200">
            <h2 className="text-xl font-serif text-stone-800 mb-6">已发布新闻</h2>
            <div className="space-y-4">
              {newsList.map((news) => (
                <div
                  key={news.id}
                  className={`bg-white border rounded-lg p-4 ${
                    editingId === news.id ? 'border-blue-400 bg-blue-50/30' : 'border-stone-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-sans text-sm font-semibold text-stone-800">
                        {news.news_date}
                        {editingId === news.id && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            编辑中
                          </span>
                        )}
                      </div>
                      <div className="font-sans text-xs text-stone-500 mt-1">
                        发布于 {new Date(news.created_at).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(news)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 font-sans text-xs rounded hover:bg-blue-100 transition-colors"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(news.id, news.news_date)}
                        className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 font-sans text-xs rounded hover:bg-red-100 transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  <div className="font-mono text-xs text-stone-600 line-clamp-3 bg-stone-50 p-2 rounded">
                    {news.content.slice(0, 150)}...
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
