/** 管理员邮箱，可设置其他用户为 VIP */
export const ADMIN_EMAIL = '892777353@qq.com';

export type VipDuration = '1m' | '3m' | '6m' | '1y' | 'lifetime';

/** 判断当前用户是否为有效 VIP（终身或未过期） */
export function isVip(vipExpiresAt: string | null | undefined): boolean {
  if (vipExpiresAt === null || vipExpiresAt === undefined) return true; // 终身
  const exp = new Date(vipExpiresAt).getTime();
  return exp > Date.now();
}

/** 根据期限计算 VIP 到期时间，lifetime 返回 null */
export function getVipExpiresAt(duration: VipDuration): Date | null {
  if (duration === 'lifetime') return null;
  const now = new Date();
  switch (duration) {
    case '1m':
      now.setMonth(now.getMonth() + 1);
      return now;
    case '3m':
      now.setMonth(now.getMonth() + 3);
      return now;
    case '6m':
      now.setMonth(now.getMonth() + 6);
      return now;
    case '1y':
      now.setFullYear(now.getFullYear() + 1);
      return now;
    default:
      return null;
  }
}
