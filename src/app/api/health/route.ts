import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET() {
  return NextResponse.json(
    { status: 'ok', release: process.env.RELEASE_SHA || 'local', uptimeSeconds: Math.floor(process.uptime()) },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
