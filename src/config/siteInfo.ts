export const SITE_INFO = {
  name: '二',
  operatorName: process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim() || '二网站运营者',
  customerServiceEmail:
    process.env.NEXT_PUBLIC_CUSTOMER_SERVICE_EMAIL?.trim() || '892777353@qq.com',
  icpNumber: process.env.NEXT_PUBLIC_ICP_NUMBER?.trim() || '',
  publicSecurityNumber: process.env.NEXT_PUBLIC_PUBLIC_SECURITY_NUMBER?.trim() || '',
  domain: 'www.the-one-and-the-two.com',
} as const;
