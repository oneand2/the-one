export const PAGE_SIZE = 25;
export const MODULES = ['overview', 'users', 'answers', 'comments', 'orders', 'reports', 'insights', 'settings'] as const;
export type AdminModule = typeof MODULES[number];
export type AdminRow = Record<string, string | number | boolean | null>;
export const SIGNUP_SOURCES = { email: '邮箱注册', wechat: '微信注册', apple: 'Apple 注册', legacy: '历史用户名注册', unknown: '未记录' } as const;
export type SignupSource = keyof typeof SIGNUP_SOURCES;
export type UserAnalytics = {
  days: number; start: string; end: string; trackingSince: string | null; activityAvailable: boolean;
  newUsers: number; activeUsers: number | null; loggedInUsers: number;
  daily: { date: string; newUsers: number; activeUsers: number | null }[];
  signupSources: { source: SignupSource; count: number }[];
};
export type AdminData = {
  rows?: AdminRow[]; total?: number; page?: number;
  stats?: Record<string, number | null>;
  trend?: { date: string; answers: number | null; comments: number | null }[];
  sources?: { name: string; count: number | null; ok: boolean }[];
  warnings?: string[]; updatedAt: string;
  usersAnalytics?: UserAnalytics;
};
export type AdminQuery = { view: AdminModule; page: number; q: string; status: string; channel: string; days: number; cohort: string; source: string };
