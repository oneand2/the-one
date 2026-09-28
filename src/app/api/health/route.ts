import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export function GET() {
  return NextResponse.json({ status: 'ok', release: process.env.RELEASE_SHA || 'local' }, { headers: { 'Cache-Control': 'no-store' } });
}
