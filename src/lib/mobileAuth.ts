import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

/**
 * Supabase auth client for native apps.
 *
 * Unlike the regular server helper, this explicitly forwards refreshed auth
 * cookies to the HTTP response so URLSession can keep a durable native session.
 */
export function createMobileAuthClient(request: NextRequest) {
  const pendingCookies: PendingCookie[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    },
  );

  function json(body: unknown, init?: ResponseInit) {
    const response = NextResponse.json(body, init);
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  }

  return { supabase, json };
}

