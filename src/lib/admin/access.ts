import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { resolveConsoleAccess } from '@/lib/ambassadors/server';
import { isAdminIdentity } from './policy';

export async function getAdminUser() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError' && error.status !== 401 && error.status !== 403) throw new Error('登录服务暂时不可用');
  if (error || !isAdminIdentity(user)) return null;
  return user;
}

export function adminJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' } });
}

export { isSameOrigin } from './policy';

export async function getConsoleAccess() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError' && error.status !== 401 && error.status !== 403) throw new Error('登录服务暂时不可用');
  if (error || !user) return null;
  const access = await resolveConsoleAccess(createAdminClient(), user);
  return access ? { ...access, userId: user.id } : null;
}
