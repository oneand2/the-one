'use client';

import { useState } from 'react';
import { requestPasswordReset } from '@/app/login/actions';

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      const result = await requestPasswordReset(formData);
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      if (result.error) setError(result.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-sans text-center">{error}</p>
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-sans text-stone-700 mb-2">
          邮箱
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-700 transition-colors"
          placeholder="your@email.com"
        />
      </div>
      <div className="space-y-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="w-full px-6 py-3 bg-stone-800 text-white font-sans text-sm rounded-lg hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-60"
        >
          {pending ? '发送中…' : '发送重置链接'}
        </button>
      </div>
    </form>
  );
}
