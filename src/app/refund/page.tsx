import { LegalPage } from '@/components/LegalPage';
import { SITE_INFO } from '@/config/siteInfo';

export default function RefundPage() {
  return (
    <LegalPage eyebrow="REFUND & SUPPORT" title="退款与售后规则">
      <section>
        <h2>一、可以申请退款的情形</h2>
        <ul>
          <li>重复支付、金额异常或订单支付成功但铜币、终身 VIP 未到账。</li>
          <li>因本站故障导致已购买服务长期无法使用，且无法通过补发或恢复解决。</li>
          <li>购买后 7 日内，所购铜币尚未使用，可申请原路全额退款。</li>
          <li>购买后 7 日内仅使用部分铜币，可就未使用部分按本订单实际支付单价申请退款；赠送部分不折算现金。</li>
          <li>终身 VIP 若已开始使用站内需计费功能，通常按已交付的数字内容服务处理，除未开通成功或可验证的技术故障外，一般不再退款。</li>
        </ul>
      </section>
      <section>
        <h2>二、通常不支持退款的情形</h2>
        <p>已经消耗并完成交付的 AI 对话、分析或解读属于即时交付的数字内容，除内容未交付、与页面说明明显不符或存在可验证的技术故障外，通常不再退款。</p>
        <p>因用户账户被盗用、违反用户协议或自行删除内容造成的损失，将根据实际情况核验处理。</p>
      </section>
      <section>
        <h2>三、申请方式</h2>
        <p>请发送邮件至 {SITE_INFO.customerServiceEmail}，提供注册邮箱、商户订单号或支付宝交易号、支付金额、申请原因及必要截图。请勿发送支付密码、短信验证码或银行卡完整信息。</p>
      </section>
      <section>
        <h2>四、处理时间</h2>
        <p>我们通常会在 3 个工作日内完成核验并回复。审核通过后原路发起退款，实际到账时间以支付宝及银行处理进度为准。依法应当承担的消费者权益不因本规则而被排除。</p>
      </section>
    </LegalPage>
  );
}
