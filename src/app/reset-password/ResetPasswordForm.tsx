'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export function ResetPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const password = (form.password as HTMLInputElement).value;
    const confirmPassword = (form.confirmPassword as HTMLInputElement).value;

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      setPending(false);
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 位');
      setPending(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || '设置失败，请重试');
        setPending(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.push('/login?message=密码已更新，请使用新密码登录');
      }, 1500);
    } catch (err) {
      setError('设置失败，请重试');
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="py-6 text-center">
        <p className="text-stone-700 font-sans">密码已更新，正在跳转到登录页…</p>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-sans text-center">{error}</p>
        </div>
      )}
      <div>
        <label htmlFor="password" className="block text-sm font-sans text-stone-700 mb-2">
          新密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-700 transition-colors"
          placeholder="至少 6 位"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-sans text-stone-700 mb-2">
          确认新密码
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-700 transition-colors"
          placeholder="再次输入新密码"
        />
      </div>
      <div className="space-y-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="w-full px-6 py-3 bg-stone-800 text-white font-sans text-sm rounded-lg hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-60"
        >
          {pending ? '提交中…' : '确认并登录'}
        </button>
      </div>
    </form>
  );
}
