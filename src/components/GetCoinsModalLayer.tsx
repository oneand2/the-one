'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function GetCoinsModalLayer() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-get-coins', handler);
    return () => window.removeEventListener('open-get-coins', handler);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-[#FBF9F4] border border-stone-200 rounded-2xl shadow-xl max-w-2xl w-full p-6 font-sans max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-serif text-stone-800 mb-4 text-center">致每一位修行者</h2>
        <div className="text-stone-700 text-sm leading-relaxed mb-6 space-y-3">
          <p>朋友你好，见字如面。</p>
          <p>当今时代全球经济下行、地缘冲突不断、社会日渐撕裂，不确定性像雾一样笼罩着我们，信息的通畅不仅没有促进人与人的沟通，反而将我们置于巨大的回声室中，我们被裹挟在巨大的洪流里，变得越来越原子化，甚至看不清自己的背面。</p>
          <p>本网站取名为"二"，不只是因为它形似周易里的老阳，也是致敬杨德昌导演的《一一》——在这个科技愈发通畅、人却愈发原子化的剧变时代，一与一的相遇，即是二。在破碎中寻求理解，在动荡中寻找价值，是我们对抗虚无的唯一方式。</p>
          <p>您眼前所见的每一个像素、每一行代码、每一次AI的推演，都是我在无数个深夜里，一砖一瓦独自搭建的。这是一个人的工程，也是一场漫长的修行。</p>
          <p>由于我没有更大的精力和财力去开发支付系统，目前网站采用人工充值的方式维持运行。如果这个小小的角落让您加深了对自己的理解，抑或是让您在这个剧变的时代找到一丝丝安宁感，诚挚地希望您能支持一份力量。您的支持，将支撑我继续探索更多生存的可能，直到有一天，让我有能力让这里的内容向大家免费开放。如果您需要充值或对本网站有什么更好的建议，欢迎您添加我的联系方式。本人vx:<strong>CheGuevara-enfp</strong>。</p>
          <p>感谢相遇，祝你平安。</p>
        </div>
        <div className="mb-6 -mx-6">
          <img 
            src="/assets/image-56764bd4-4d90-4414-99f0-7eeb032e5f58.png" 
            alt="联系方式"
            className="w-full h-auto"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 py-2.5 rounded-lg border border-stone-300 text-stone-600 text-sm hover:bg-stone-50"
          >
            关闭
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push('/shop');
            }}
            className="flex-1 py-2.5 rounded-lg bg-stone-800 text-white text-sm hover:bg-stone-700"
          >
            前往兑换
          </button>
        </div>
      </div>
    </div>
  );
}
