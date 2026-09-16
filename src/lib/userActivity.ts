import 'server-only';
import { after } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

const recent = new Map<string, number>();
const pending = new Map<string, Promise<boolean>>();
const INTERVAL = 60000;

// Only call with an ID returned by a verified auth.getUser().
export async function recordUserActivity(userId: string): Promise<boolean> {
  const now = Date.now();
  const day = new Date(now + 8 * 3600000).toISOString().slice(0, 10);
  const key = `${day}:${userId}`;
  if (now - (recent.get(key) || 0) < INTERVAL) return true;
  if (pending.has(key)) return pending.get(key)!;
  const task = (async () => {
    try {
      const { error } = await createAdminClient().rpc('record_user_activity', { p_user_id: userId });
      if (error) throw error;
      // Bound memory usage; the database remains the durable source of truth.
      if (recent.size > 10000) recent.clear();
      recent.set(key, now);
      return true;
    } catch {
      console.warn('User activity collection temporarily unavailable');
      return false;
    } finally { pending.delete(key); }
  })();
  pending.set(key, task);
  return task;
}

export function scheduleUserActivity(userId: string) {
  after(async () => { await recordUserActivity(userId); });
}
