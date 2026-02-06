import { createBrowserClient } from '@supabase/ssr';

/**
 * 浏览器端 Supabase 客户端
 * 用于客户端组件和客户端操作
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      '缺少 Supabase 环境变量：请在项目根目录 .env.local 中配置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }
  try {
    return createBrowserClient(url, key);
  } catch (e) {
    // Chrome 等浏览器在无痕/隐私模式下 localStorage 可能不可用，导致 createBrowserClient 抛错
    if (typeof window !== 'undefined' && e instanceof Error && (e.name === 'SecurityError' || e.name === 'QuotaExceededError')) {
      throw new Error('BROWSER_STORAGE_UNAVAILABLE');
    }
    throw e;
  }
}
