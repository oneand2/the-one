'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function ShopPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleRedeem = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setMessage({ type: 'error', text: '请输入兑换码' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/shop/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: (data?.error as string) || '兑换失败' });
        return;
      }
      const added = (data?.added as number) ?? 0;
      setMessage({ type: 'success', text: (data?.message as string) || `成功到账 ${added} 铜币` });
      setCode('');
      window.dispatchEvent(new CustomEvent('coins-should-refresh'));
    } catch {
      setMessage({ type: 'error', text: '网络异常，请稍后重试' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F4] px-4 py-12">
      <div className="max-w-md mx-auto">
        <Link href="/" className="text-sm text-stone-500 hover:text-stone-800 font-sans inline-block mb-8">
          ← 返回首页
        </Link>
        <h1 className="text-2xl font-serif text-stone-800 mb-8">兑换码充值</h1>

        {/* 区域 A：购买指引 */}
        <section className="mb-10 p-6 rounded-xl bg-white/80 border border-stone-200">
          <h2 className="text-lg font-serif text-stone-800 mb-4 text-center">致每一位修行者</h2>
          <p className="text-stone-700 font-sans text-sm leading-relaxed mb-4 whitespace-pre-line">
            朋友你好，见字如面。
            {'\n\n'}
            当今时代全球经济下行、地缘冲突不断、社会日渐撕裂，不确定性像雾一样笼罩着我们，信息的通畅不仅没有促进人与人的沟通，反而将我们置于巨大的回声室中，我们被裹挟在巨大的洪流里，变得越来越原子化，甚至看不清自己的背面。
            {'\n\n'}
            本网站取名为"二"，不只是因为它形似周易里的老阳，也是致敬杨德昌导演的《一一》——在这个科技愈发通畅、人却愈发原子化的剧变时代，一与一的相遇，即是二。在破碎中寻求理解，在动荡中寻找价值，是我们对抗虚无的唯一方式。
            {'\n\n'}
            您眼前所见的每一个像素、每一行代码、每一次AI的推演，都是我在无数个深夜里，一砖一瓦独自搭建的。这是一个人的工程，也是一场漫长的修行。
            {'\n\n'}
            由于我没有更大的精力和财力去开发支付系统，目前网站采用人工充值的方式维持运行。如果这个小小的角落让您加深了对自己的理解，诚挚地希望您能支持一份力量。您的支持，将支撑我继续探索更多生存的可能，直到有一天，让我有能力让这里的智慧向大家免费开放。本人vx:<strong>CheGuevara-enfp</strong>。如果您需要充值或对本网站有什么更好的建议，欢迎您添加我的联系方式。
            {'\n\n'}
            感谢相遇，祝你平安。
          </p>
          <div className="flex justify-center mt-4">
            <img 
              src="/assets/image-56764bd4-4d90-4414-99f0-7eeb032e5f58.png" 
              alt="联系方式"
              className="max-w-full h-auto rounded-lg border border-stone-200"
              style={{ maxHeight: '300px' }}
            />
          </div>
        </section>

        {/* 区域 B：兑换 */}
        <section className="p-5 rounded-xl bg-white/80 border border-stone-200">
          <h2 className="text-sm font-sans text-stone-600 mb-3">兑换</h2>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
              placeholder="请输入兑换码"
              className="flex-1 px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-600"
              disabled={loading}
            />
            <button
              type="button"
              onClick={handleRedeem}
              disabled={loading}
              className="px-5 py-3 bg-stone-800 text-white font-sans text-sm rounded-lg hover:bg-stone-700 disabled:opacity-60 shrink-0"
            >
              {loading ? '兑换中…' : '立即兑换'}
            </button>
          </div>
          {message && (
            <p
              className={`text-sm font-sans ${
                message.type === 'success' ? 'text-green-700' : 'text-red-600'
              }`}
            >
              {message.text}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
