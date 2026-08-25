import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { COIN_PACKAGES, LIFETIME_VIP_PACKAGE, formatCny } from '@/lib/payments/coinPackages';

export default function ServicePage() {
  return (
    <LegalPage eyebrow="SERVICE & PRICING" title="服务内容与计费说明">
      <section>
        <h2>一、服务是什么</h2>
        <p>“二”提供自我探索与数字内容服务，包括 AI 对话、荣格认知功能测试、八字排盘、六爻记录与相关文化内容。部分基础功能免费，调用 AI 生成内容的功能会消耗站内铜币。开通终身 VIP 后，全部功能不再消耗铜币。</p>
        <p>所有生成内容仅供文化体验、自我观察与一般信息参考，不构成医疗、心理诊断、法律、投资或其他专业意见，也不替代现实中的专业服务。</p>
      </section>
      <section>
        <h2>二、铜币用途</h2>
        <ul>
          <li>AI 对话基础消耗：每次 2 枚铜币。</li>
          <li>深度思考：在基础消耗上增加 2 枚铜币。</li>
          <li>联网检索：在基础消耗上增加 2 枚铜币。</li>
          <li>宗师模式：在基础消耗上增加 20 枚铜币。</li>
          <li>AI 解卦：每次 6 枚铜币。</li>
        </ul>
        <p>实际消耗会在用户发起服务前于页面显示；如后续调整计费，将提前更新本说明，不追溯影响已完成的消费。有效 VIP（含终身 VIP）使用上述功能时不消耗铜币。</p>
      </section>
      <section>
        <h2>三、铜币服务包与终身 VIP</h2>
        <ul>
          <li>{LIFETIME_VIP_PACKAGE.name}：{formatCny(LIFETIME_VIP_PACKAGE.amountCents)}；{LIFETIME_VIP_PACKAGE.description}。</li>
          {COIN_PACKAGES.map((item) => (
            <li key={item.id}>{item.name}：{item.coins} 枚铜币，{formatCny(item.amountCents)}；{item.description}。</li>
          ))}
        </ul>
        <p>铜币仅限当前账户在本网站使用，不可转赠、交易、提现或兑换现金。支付成功后由支付宝或微信支付异步通知本网站，系统直接向当前账户增加铜币或开通终身 VIP。</p>
      </section>
      <section>
        <h2>四、交付与查询</h2>
        <p>通常在支付宝或微信支付确认成功后即时到账。因网络延迟暂未到账时，请保留交易号并通过客服邮箱联系我们。你可以在网站右上角或个人设置中查看当前铜币余额与 VIP 状态。</p>
        <p><Link href="/shop" className="underline underline-offset-4">前往选择服务包</Link></p>
      </section>
    </LegalPage>
  );
}
