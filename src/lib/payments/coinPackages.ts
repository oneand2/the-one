export type CoinPackage = {
  id: string;
  name: string;
  description: string;
  coins: number;
  amountCents: number;
  featured?: boolean;
};

export const COIN_PACKAGES: readonly CoinPackage[] = [
  {
    id: 'insight_100',
    name: '初见',
    description: '适合轻量体验 AI 对话与解读服务',
    coins: 100,
    amountCents: 990,
  },
  {
    id: 'insight_360',
    name: '深观',
    description: '适合持续使用与多轮深入交流',
    coins: 360,
    amountCents: 2990,
    featured: true,
  },
  {
    id: 'insight_800',
    name: '长明',
    description: '适合长期使用站内数字内容服务',
    coins: 800,
    amountCents: 5990,
  },
] as const;

export function getCoinPackage(packageId: string) {
  return COIN_PACKAGES.find((item) => item.id === packageId) ?? null;
}

export function formatCny(amountCents: number) {
  return `¥${(amountCents / 100).toFixed(2)}`;
}
