import { NextRequest, NextResponse } from 'next/server';
import { analyzeHexagram } from '@/utils/iching-logic';
import type { YaoValue } from '@/utils/liuyaoLogic';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: { yaos?: number[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '起卦数据格式无效' }, { status: 400 });
  }

  const yaos = body.yaos ?? [];
  if (yaos.length !== 6 || yaos.some((value) => ![6, 7, 8, 9].includes(value))) {
    return NextResponse.json({ error: '必须提供六个有效爻值' }, { status: 400 });
  }

  try {
    // Deliberately call the same function as LiuYaoView so the web, Android and
    // native iOS clients share the exact moving-line interpretation rules.
    return NextResponse.json(analyzeHexagram(yaos as YaoValue[]));
  } catch (error) {
    console.error('native liuyao analysis failed:', error);
    return NextResponse.json({ error: '卦象解析失败' }, { status: 500 });
  }
}
