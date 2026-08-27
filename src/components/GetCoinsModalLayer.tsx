'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestAppStore } from '@/utils/iosEmbed';

export function GetCoinsModalLayer() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = () => {
      if (requestAppStore()) return;
      setOpen(true);
    };
    window.addEventListener('open-get-coins', handler);
    return () => window.removeEventListener('open-get-coins', handler);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-[#FBF9F4] p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-center text-xl font-serif text-stone-900">铜币与数字内容服务</h2>
        <div className="mt-5 space-y-3 text-sm leading-7 text-stone-600">
          <p>铜币是本站数字内容服务的使用额度，可用于 AI 对话、深度思考、联网检索与 AI 解卦。</p>
          <p>也可以一次开通终身 VIP（398 元），之后使用全部功能不再消耗铜币。</p>
          <p>购买时将进入支付宝或微信支付；支付成功后权益直接增加到当前账户，全程由系统自动完成。</p>
          <p>铜币不可转赠、交易、提现或兑换现金。</p>
        </div>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-stone-300 py-2.5 text-sm text-stone-600 hover:bg-white">
            稍后再看
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              if (requestAppStore()) return;
              router.push('/shop');
            }}
            className="flex-1 rounded-lg bg-stone-800 py-2.5 text-sm text-white hover:bg-stone-700"
          >
            查看服务包
          </button>
        </div>
      </div>
    </div>
  );
}
