'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MbtiTestView, TestResult, calculateShadowType } from '@/components/MbtiTestView';

const COGNITIVE_FUNCTIONS = ['Se', 'Si', 'Ne', 'Ni', 'Te', 'Ti', 'Fe', 'Fi'] as const;

function buildTestResult(type: string, function_scores: Record<string, number>): TestResult {
  const scores: Record<string, number> = {};
  COGNITIVE_FUNCTIONS.forEach((f) => {
    scores[f] = typeof function_scores[f] === 'number' ? function_scores[f] : 0;
  });
  return {
    type: type as TestResult['type'],
    score: 0,
    shadowType: calculateShadowType(type as TestResult['type']),
    functionScores: scores as TestResult['functionScores'],
  };
}

function ReportMbtiContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('缺少记录 id');
      setLoading(false);
      return;
    }
    fetch(`/api/records/mbti?id=${encodeURIComponent(id)}`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('未找到或无权查看');
        return r.json();
      })
      .then((data: { type: string; function_scores: Record<string, number> }) => {
        setResult(buildTestResult(data.type, data.function_scores || {}));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex items-center justify-center">
        <p className="text-stone-500 font-sans">加载中…</p>
      </div>
    );
  }
  if (error || !result) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-stone-700 font-sans mb-4">{error || '无法加载该记录'}</p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-sans"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9F4]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <MbtiTestView initialResult={result} onStandaloneReturn={() => router.push('/')} />
      </div>
    </div>
  );
}

export default function ReportMbtiPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FBF9F4] flex items-center justify-center"><p className="text-stone-500 font-sans">加载中…</p></div>}>
      <ReportMbtiContent />
    </Suspense>
  );
}
