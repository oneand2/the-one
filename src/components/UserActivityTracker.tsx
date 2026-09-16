'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

// Foreground visits and interactions only. No IP, URL, or content is collected.
export function UserActivityTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith('/admin') || pathname.startsWith('/login')) return;
    let disposed = false;
    let userId: string | null = null;
    let lastSuccess = 0;
    let lastDay = '';
    let retryAfter = 0;
    let busy = false;
    let client: ReturnType<typeof createClient>;
    try { client = createClient(); } catch { return; }
    const send = async () => {
      const now = Date.now();
      const day = new Date(now + 8 * 3600000).toISOString().slice(0, 10);
      if (disposed || busy || !userId || document.visibilityState !== 'visible' || now < retryAfter || (day === lastDay && now - lastSuccess < 300000)) return;
      busy = true;
      try {
        const response = await fetch('/api/user/activity', { method: 'POST', cache: 'no-store', credentials: 'same-origin' });
        if (response.ok) { lastSuccess = now; lastDay = day; }
        else retryAfter = now + 60000;
      } catch { retryAfter = now + 60000; }
      finally { busy = false; }
    };
    // Session is only a hint to avoid anonymous requests; the server verifies it.
    void client.auth.getSession().then(({ data }) => {
      if (disposed) return;
      userId = data.session?.user.id || null;
      void send();
    }).catch(() => {});
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        const next = session?.user.id || null;
        if (next !== userId) { lastSuccess = 0; lastDay = ''; }
        userId = next;
        if (event !== 'SIGNED_OUT') void send();
      }
    });
    const interact = (event: Event) => { if (event.isTrusted) void send(); };
    const events = ['pointerdown', 'keydown', 'scroll', 'visibilitychange'];
    events.forEach(event => document.addEventListener(event, interact, { passive: true }));
    return () => {
      disposed = true;
      listener.subscription.unsubscribe();
      events.forEach(event => document.removeEventListener(event, interact));
    };
  }, [pathname]);
  return null;
}
