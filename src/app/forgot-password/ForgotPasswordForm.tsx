'use client';

import { useState } from 'react';
import { requestPasswordReset, verifyPasswordResetOtp } from '@/app/login/actions';

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [otpPending, setOtpPending] = useState<{ email: string } | null>(null);

  async function handleSendCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      const result = await requestPasswordReset(formData);
      if (result.otpEmail) {
        setOtpPending({ email: result.otpEmail });
        return;
      }
      if (result.error) setError(result.error);
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    if (!otpPending) return;
    setError(null);
    setPending(true);
    const fd = new FormData();
    fd.append('email', otpPending.email);
    try {
      const result = await requestPasswordReset(fd);
      if (result.error) setError(result.error);
    } finally {
      setPending(false);
    }
  }

  async function handleResetSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set('email', otpPending!.email);
    try {
      const result = await verifyPasswordResetOtp(formData);
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      if (result.error) setError(result.error);
    } finally {
      setPending(false);
    }
  }

  if (otpPending) {
    return (
      <form className="space-y-6" onSubmit={handleResetSubmit}>
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-sans text-center">{error}</p>
          </div>
        )}
        <div className="text-center space-y-1">
          <p className="text-sm font-sans text-stone-600">验证码已发送至</p>
          <p className="text-sm font-medium font-sans text-stone-800">{otpPending.email}</p>
          <p className="text-xs text-stone-400 font-sans">收不到请检查垃圾邮件文件夹</p>
        </div>
        <div>
          <label htmlFor="token" className="block text-sm font-sans text-stone-700 mb-2">
            邮箱验证码
          </label>
          <input
            id="token"
            name="token"
            type="text"
            inputMode="numeric"
            maxLength={8}
            required
            autoFocus
            autoComplete="one-time-code"
            className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-lg text-center tracking-[0.3em] focus:outline-none focus:border-stone-700 transition-colors"
            placeholder="请输入验证码"
          />
        </div>
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
            {pending ? '提交中…' : '确认重置密码'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleResend}
            className="w-full py-2 text-sm text-stone-500 hover:text-stone-800 font-sans transition-colors disabled:opacity-60"
          >
            重新发送验证码
          </button>
          <button
            type="button"
            onClick={() => {
              setOtpPending(null);
              setError(null);
            }}
            className="w-full py-2 text-sm text-stone-500 hover:text-stone-800 font-sans transition-colors"
          >
            更换邮箱
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSendCode}>
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
          {pending ? '发送中…' : '发送验证码'}
        </button>
      </div>
    </form>
  );
}
