export const PAGE_SIZE = 25;
export const MODULES = ['overview', 'users', 'answers', 'comments', 'orders', 'reports', 'insights', 'settings'] as const;
export type AdminModule = typeof MODULES[number];
export type AdminRow = Record<string, string | number | boolean | null>;
export type AdminData = {
  rows?: AdminRow[]; total?: number; page?: number;
  stats?: Record<string, number | null>;
  trend?: { date: string; answers: number | null; comments: number | null }[];
  sources?: { name: string; count: number | null; ok: boolean }[];
  warnings?: string[]; updatedAt: string;
};
export type AdminQuery = { view: AdminModule; page: number; q: string; status: string; channel: string };
