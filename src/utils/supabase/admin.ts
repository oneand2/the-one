import { createClient } from '@supabase/supabase-js';

/**
 * 仅用于服务端、且需跨用户操作时使用（如邀请人加 200 铜币）。
 * 需在 .env 中配置 SUPABASE_SERVICE_ROLE_KEY。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
