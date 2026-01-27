'use client';

import { useState } from 'react';
import { login, signup, verifyOtp } from './actions';

type Props = { next: string };

export function LoginForm({ next }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup' | 'verifyCode'>('login');
  const [registeredEmail, setRegisteredEmail] = useState<string>('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      if (mode === 'signup') {
        const password = formData.get('password') as string;
        const confirmPassword = formData.get('confirmPassword') as string;
        if (password !== confirmPassword) {
          setError('两次输入的密码不一致');
          setPending(false);
          return;
        }
        const result = await signup(formData);
        if (result.error) {
          setError(result.error);
        } else {
          // 注册成功，切换到验证码输入模式
          const email = formData.get('email') as string;
          setRegisteredEmail(email);
          setMode('verifyCode');
        }
      } else if (mode === 'verifyCode') {
        const result = await verifyOtp(formData);
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
          return;
        }
        if (result.error) {
          setError(result.error);
        }
      } else {
        const result = await login(formData);
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
          return;
        }
        if (result.error) {
          setError(result.error);
        }
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <input type="hidden" name="next" value={next} />
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-sans text-center">{error}</p>
        </div>
      )}
      {mode === 'verifyCode' ? (
        <>
          <input type="hidden" name="email" value={registeredEmail} />
          <div className="text-center mb-6">
            <p className="text-sm text-stone-600 font-sans mb-2">
              验证码已发送至
            </p>
            <p className="text-base text-stone-800 font-sans font-medium">
              {registeredEmail}
            </p>
            <p className="text-xs text-stone-500 font-sans mt-2">
              请查收邮件并输入 6 位数字验证码
            </p>
          </div>
          <div>
            <label htmlFor="token" className="block text-sm font-sans text-stone-700 mb-2">
              验证码
            </label>
            <input
              id="token"
              name="token"
              type="text"
              required
              maxLength={6}
              pattern="[0-9]{6}"
              className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-sm text-center tracking-widest focus:outline-none focus:border-stone-700 transition-colors"
              placeholder="000000"
              autoComplete="off"
            />
          </div>
          <div className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="w-full px-6 py-3 bg-stone-800 text-white font-sans text-sm rounded-lg hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-60"
            >
              {pending ? '验证中…' : '验证'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className="w-full py-2 text-sm text-stone-500 hover:text-stone-800 font-sans transition-colors"
            >
              ← 返回注册
            </button>
          </div>
        </>
      ) : (
        <>
          {mode === 'signup' && (
        <div>
          <label htmlFor="nickname" className="block text-sm font-sans text-stone-700 mb-2">
            昵称
          </label>
          <input
            id="nickname"
            name="nickname"
            type="text"
            className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-700 transition-colors"
            placeholder="选填，用于展示"
          />
        </div>
      )}
      {mode === 'signup' && (
        <div>
          <label htmlFor="invite_code" className="block text-sm font-sans text-stone-700 mb-2">
            邀请码
          </label>
          <input
            id="invite_code"
            name="invite_code"
            type="text"
            className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-700 transition-colors"
            placeholder="选填，填写后邀请人将获 200 铜币"
          />
        </div>
      )}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-sans text-stone-700 mb-2"
        >
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
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-sans text-stone-700 mb-2"
        >
          密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-700 transition-colors"
          placeholder="••••••••"
        />
      </div>
      {mode === 'signup' && (
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-sans text-stone-700 mb-2"
          >
            确认密码
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-700 transition-colors"
            placeholder="再次输入密码"
          />
        </div>
      )}
          <div className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="w-full px-6 py-3 bg-stone-800 text-white font-sans text-sm rounded-lg hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-60"
            >
              {pending ? '处理中…' : mode === 'login' ? '登录' : '注册'}
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="w-full py-2 text-sm text-stone-500 hover:text-stone-800 font-sans transition-colors"
            >
              {mode === 'login' ? '还没有账号？去注册' : '已有账号？去登录'}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
