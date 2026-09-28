import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Keep readiness independent of external services so a provider outage cannot
// take a healthy application out of service during a release.
export function GET() {
  return NextResponse.json(
    { status: 'ok', release: process.env.RELEASE_SHA || 'local', uptimeSeconds: Math.floor(process.uptime()) },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
