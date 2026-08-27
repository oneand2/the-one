export type ShopPackageKind = 'coins' | 'lifetime_vip';

export type CoinPackage = {
  id: string;
  name: string;
  description: string;
  coins: number;
  amountCents: number;
  featured?: boolean;
  kind?: ShopPackageKind;
};

export const LIFETIME_VIP_PACKAGE_ID = 'vip_lifetime';
export const APPLE_LIFETIME_VIP_PRODUCT_ID = 'com.theone.er.vip.lifetime';

export const LIFETIME_VIP_PACKAGE: CoinPackage = {
  id: LIFETIME_VIP_PACKAGE_ID,
  name: '终身 VIP',
  description: '一次开通，之后使用全部功能不再消耗铜币',
  coins: 0,
  amountCents: 39800,
  kind: 'lifetime_vip',
  featured: true,
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

export const SHOP_PACKAGES: readonly CoinPackage[] = [LIFETIME_VIP_PACKAGE, ...COIN_PACKAGES];

export function isLifetimeVipPackage(item: Pick<CoinPackage, 'id' | 'kind'> | null | undefined) {
  return item?.kind === 'lifetime_vip' || item?.id === LIFETIME_VIP_PACKAGE_ID;
}

export function getShopPackage(packageId: string) {
  return SHOP_PACKAGES.find((item) => item.id === packageId) ?? null;
}

export function getCoinPackage(packageId: string) {
  return getShopPackage(packageId);
}

export function formatCny(amountCents: number) {
  return `¥${(amountCents / 100).toFixed(2)}`;
}

export function shopDeliveryMessage(item: Pick<CoinPackage, 'id' | 'kind' | 'coins'>) {
  if (isLifetimeVipPackage(item) || item.coins === 0) {
    return '终身 VIP 已开通。之后使用全部功能不再消耗铜币。';
  }
  return `${item.coins} 枚铜币已到账。感谢你的支持。`;
}
