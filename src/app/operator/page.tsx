import { LegalPage } from '@/components/LegalPage';
import { SITE_INFO } from '@/config/siteInfo';

export default function OperatorPage() {
  return (
    <LegalPage eyebrow="OPERATOR INFORMATION" title="经营者与联系信息">
      <section>
        <h2>网站信息</h2>
        <ul>
          <li>网站名称：{SITE_INFO.name}</li>
          <li>经营者：{SITE_INFO.operatorName}</li>
          <li>网站域名：{SITE_INFO.domain}</li>
          {SITE_INFO.icpNumber && <li>ICP备案号：{SITE_INFO.icpNumber}</li>}
          {SITE_INFO.publicSecurityNumber && <li>公安备案号：{SITE_INFO.publicSecurityNumber}</li>}
        </ul>
      </section>
      <section>
        <h2>经营内容</h2>
        <p>本站提供自我探索、心理类型测试、传统文化工具与 AI 辅助生成的数字内容服务。收费项目为站内数字内容服务额度，具体价格和交付方式在购买页面明示。</p>
      </section>
      <section>
        <h2>客户服务</h2>
        <p>客服邮箱：{SITE_INFO.customerServiceEmail}</p>
        <p>受理范围包括账户、支付、退款、隐私与内容反馈。通常在 3 个工作日内回复；涉及个人信息权利请求的，通常在 15 个工作日内答复。</p>
      </section>
    </LegalPage>
  );
}
