import { adminJson, getConsoleAccess } from '@/lib/admin/access';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return adminJson({ access: await getConsoleAccess() }); }
  catch { return adminJson({ error: '身份暂时无法读取' }, 503); }
}
