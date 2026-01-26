import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * 服务端 Supabase 客户端
 * 用于 Server Components、Server Actions、Route Handlers
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 在 Server Component 中 set 可能失败，可以忽略
            // 因为 middleware 会处理 cookie 设置
          }
        },
      },
    }
  );
}
