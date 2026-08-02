import Link from 'next/link';

export function LegalPage({
  eyebrow,
  title,
  updated = '2026年8月2日',
  children,
}: {
  eyebrow: string;
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#FBF9F4] px-4 py-12">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="mb-10 inline-block text-sm text-stone-500 hover:text-stone-800">← 返回首页</Link>
        <header className="mb-10 border-b border-stone-200 pb-8">
          <p className="mb-3 text-xs tracking-[0.28em] text-stone-500">{eyebrow}</p>
          <h1 className="text-3xl font-serif text-stone-900">{title}</h1>
          <p className="mt-3 text-xs text-stone-400">更新日期：{updated}</p>
        </header>
        <div className="space-y-8 text-sm leading-7 text-stone-700 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-serif [&_h2]:text-stone-900 [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3">
          {children}
        </div>
      </article>
    </main>
  );
}
