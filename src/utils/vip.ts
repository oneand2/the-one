/** 管理员邮箱，可设置其他用户为 VIP */
export const ADMIN_EMAIL = '892777353@qq.com';

/** 终身 VIP 在数据库中的哨兵值（null 表示未设置过 VIP，不能当作终身） */
export const VIP_LIFETIME_SENTINEL = '9999-12-31T23:59:59.999Z';

export type VipDuration = '1m' | '3m' | '6m' | '1y' | 'lifetime';

/** 判断当前用户是否为有效 VIP（仅当明确为终身哨兵或未过期的到期日时才是 VIP；null/undefined = 非 VIP） */
export function isVip(vipExpiresAt: string | null | undefined): boolean {
  if (vipExpiresAt === null || vipExpiresAt === undefined) return false;
  if (vipExpiresAt === VIP_LIFETIME_SENTINEL) return true;
  const exp = new Date(vipExpiresAt).getTime();
  return exp > Date.now();
}

/** 是否为终身 VIP（仅哨兵值表示终身，null 不是） */
export function isLifetimeVip(vipExpiresAt: string | null | undefined): boolean {
  return vipExpiresAt === VIP_LIFETIME_SENTINEL;
}

/** 根据期限计算 VIP 到期时间；lifetime 返回哨兵字符串，其余返回 Date */
export function getVipExpiresAt(duration: VipDuration): Date | string {
  if (duration === 'lifetime') return VIP_LIFETIME_SENTINEL;
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
      return VIP_LIFETIME_SENTINEL;
  }
}
