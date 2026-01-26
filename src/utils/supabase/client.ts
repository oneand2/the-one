import { createBrowserClient } from '@supabase/ssr';

/**
 * 浏览器端 Supabase 客户端
 * 用于客户端组件和客户端操作
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
