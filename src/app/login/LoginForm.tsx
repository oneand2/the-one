'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { fetchWithRetry } from '@/utils/fetchWithRetry';
import { login, signup, verifySignupOtp } from './actions';

type Props = { next: string };

const NO_EMAIL_SUFFIX = '@no-email.app';

/** 登录/注册请求超时（毫秒），弱网下给出明确提示 */
const AUTH_ACTION_TIMEOUT_MS = 25000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

export function LoginForm({ next }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  /** 注册子模式：未选 / 邮箱注册 / IP 注册 */
  const [signupChoice, setSignupChoice] = useState<'email' | 'ip' | null>(null);
  /** 等待 OTP 验证的注册信息 */
  const [otpPending, setOtpPending] = useState<{
    email: string;
    nickname: string;
    inviteCode: string;
    nextUrl: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const timeoutMsg = '登录请求超时，请检查网络后重试或切换网络（如改用流量）';
    try {
      if (mode === 'signup' && signupChoice === 'email') {
        const password = formData.get('password') as string;
        const confirmPassword = formData.get('confirmPassword') as string;
        if (password !== confirmPassword) {
          setError('两次输入的密码不一致');
          setPending(false);
          return;
        }
        const result = await withTimeout(
          signup(formData),
          AUTH_ACTION_TIMEOUT_MS,
          '注册请求超时，请检查网络后重试或切换网络（如改用流量）'
        );
        if (result.otpEmail) {
          setOtpPending({
            email: result.otpEmail,
            nickname: (formData.get('nickname') as string) || '',
            inviteCode: (formData.get('invite_code') as string) || '',
            nextUrl: next,
          });
          setPending(false);
          return;
        }
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
          return;
        }
        if (result.error) setError(result.error);
        setPending(false);
        return;
      }
      if (mode === 'login') {
        const result = await withTimeout(
          login(formData),
          AUTH_ACTION_TIMEOUT_MS,
          timeoutMsg
        );
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
          return;
        }
        if (result.error) setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : timeoutMsg);
    } finally {
      setPending(false);
    }
  }

  async function handleIpSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const username = (form.username as HTMLInputElement).value.trim();
    const nickname = (form.nickname as HTMLInputElement | undefined)?.value?.trim() ?? '';
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
      await withTimeout(
        (async () => {
          const fpPromise = import('@fingerprintjs/fingerprintjs').then((m) => m.load());
          const { get } = await fpPromise;
          const result = await get();
          const visitorId = result.visitorId;

          const res = await fetchWithRetry('/api/auth/ip-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, nickname, password, visitorId }),
            timeoutMs: 15000,
            retries: 1,
          });
          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            setError(data.error || '注册失败，请重试');
            setPending(false);
            return;
          }

          const supabase = createClient();
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: `${username}${NO_EMAIL_SUFFIX}`,
            password,
          });

          if (signInError) {
            setError('注册成功，但自动登录失败，请使用用户名和密码登录');
            setPending(false);
            return;
          }

          window.location.href = next || '/';
        })(),
        AUTH_ACTION_TIMEOUT_MS,
        '注册请求超时，请检查网络后重试或切换网络（如改用流量）'
      );
    } catch (err) {
      console.error('IP signup error', err);
      setError(err instanceof Error ? err.message : '获取设备标识失败或网络异常，请重试');
    } finally {
      setPending(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const otp = (form.otp as HTMLInputElement).value.trim();

    const fd = new FormData();
    fd.append('email', otpPending!.email);
    fd.append('token', otp);
    fd.append('nickname', otpPending!.nickname);
    fd.append('invite_code', otpPending!.inviteCode);
    fd.append('next', otpPending!.nextUrl);

    try {
      const result = await withTimeout(
        verifySignupOtp(fd),
        AUTH_ACTION_TIMEOUT_MS,
        '验证超时，请重试'
      );
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      if (result.error) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证失败，请重试');
    } finally {
      setPending(false);
    }
  }

  const showSignupChoice = mode === 'signup' && signupChoice === null && !otpPending;
  const showEmailSignupForm = mode === 'signup' && signupChoice === 'email' && !otpPending;
  const showIpSignupForm = mode === 'signup' && signupChoice === 'ip' && !otpPending;

  return (
    <>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-serif text-stone-800 tracking-wider mb-2">
          {otpPending ? '验证邮箱' : mode === 'login' ? '登录' : '注册'}
        </h2>
      </div>

      {/* OTP 验证步骤 */}
      {otpPending && (
        <form className="space-y-6" onSubmit={handleOtpSubmit}>
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 font-sans text-center">{error}</p>
            </div>
          )}
          <div className="text-center space-y-1">
            <p className="text-sm font-sans text-stone-600">
              验证码已发送至
            </p>
            <p className="text-sm font-medium font-sans text-stone-800">{otpPending.email}</p>
            <p className="text-xs text-stone-400 font-sans">收不到请检查垃圾邮件文件夹</p>
          </div>
          <div>
            <label htmlFor="otp" className="block text-sm font-sans text-stone-700 mb-2">
              邮箱验证码
            </label>
            <input
              id="otp"
              name="otp"
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
          <div className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="w-full px-6 py-3 bg-stone-800 text-white font-sans text-sm rounded-lg hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-60"
            >
              {pending ? '验证中…' : '完成注册'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOtpPending(null);
                setSignupChoice(null);
                setError(null);
              }}
              className="w-full py-2 text-sm text-stone-500 hover:text-stone-800 font-sans transition-colors"
            >
              返回重新注册
            </button>
          </div>
        </form>
      )}

      {/* 注册方式二选一 */}
      {showSignupChoice && (
        <div className="space-y-6">
          <p className="text-sm font-sans text-stone-600 text-center">
            请优先选择邮箱注册，IP 注册遗忘密码后将无法找回
          </p>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setSignupChoice('email')}
              className="px-4 py-3 rounded-lg border border-stone-300 bg-white text-stone-800 font-sans text-sm hover:border-stone-500 hover:bg-stone-50 transition-colors"
            >
              邮箱注册
            </button>
            <button
              type="button"
              onClick={() => setSignupChoice('ip')}
              className="px-4 py-3 rounded-lg border border-stone-300 bg-white text-stone-800 font-sans text-sm hover:border-stone-500 hover:bg-stone-50 transition-colors"
            >
              IP 注册
            </button>
          </div>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setSignupChoice(null);
                setError(null);
              }}
              className="py-2 text-sm text-stone-500 hover:text-stone-800 font-sans"
            >
              已有账号？去登录
            </button>
          </div>
        </div>
      )}

      {/* 邮箱注册表单 */}
      {(mode === 'login' || showEmailSignupForm) && !showSignupChoice && !otpPending && (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <input type="hidden" name="next" value={next} />
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 font-sans text-center">{error}</p>
            </div>
          )}
          {showEmailSignupForm && (
            <>
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
            </>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-sans text-stone-700 mb-2">
              {showEmailSignupForm ? '邮箱' : '邮箱或用户名'}
            </label>
            <input
              id="email"
              name="email"
              type={showEmailSignupForm ? 'email' : 'text'}
              required
              className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-700 transition-colors"
              placeholder={showEmailSignupForm ? 'your@email.com' : '邮箱或用户名'}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-sans text-stone-700 mb-2">
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
            {mode === 'login' && (
              <p className="mt-2 text-right">
                <a
                  href="/forgot-password"
                  className="text-sm text-stone-500 hover:text-stone-800 font-sans"
                >
                  忘记密码？
                </a>
              </p>
            )}
          </div>
          {showEmailSignupForm && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-sans text-stone-700 mb-2">
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
              onClick={() => {
                setError(null);
                if (showEmailSignupForm) {
                  setSignupChoice(null);
                  setMode('login');
                } else {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  if (mode === 'login') setSignupChoice(null);
                }
              }}
              className="w-full py-2 text-sm text-stone-500 hover:text-stone-800 font-sans transition-colors"
            >
              {mode === 'login' ? '还没有账号？去注册' : '已有账号？去登录'}
            </button>
          </div>
          {showEmailSignupForm && (
            <p className="text-xs text-stone-400 font-sans text-center mt-4">
              点击注册后，验证码将发送到您的邮箱
            </p>
          )}
        </form>
      )}

      {/* IP 注册表单 */}
      {showIpSignupForm && (
        <form className="space-y-6" onSubmit={handleIpSignup}>
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 font-sans text-center">{error}</p>
            </div>
          )}
          <div>
            <label htmlFor="ip-username" className="block text-sm font-sans text-stone-700 mb-2">
              用户名
            </label>
            <input
              id="ip-username"
              name="username"
              type="text"
              required
              autoComplete="username"
              className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-700 transition-colors"
              placeholder="2～32 位字母、数字、下划线或中文"
            />
          </div>
          <div>
            <label htmlFor="ip-nickname" className="block text-sm font-sans text-stone-700 mb-2">
              昵称
            </label>
            <input
              id="ip-nickname"
              name="nickname"
              type="text"
              autoComplete="nickname"
              className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-700 transition-colors"
              placeholder="选填，用于展示"
            />
          </div>
          <div>
            <label htmlFor="ip-password" className="block text-sm font-sans text-stone-700 mb-2">
              密码
            </label>
            <input
              id="ip-password"
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
            <label htmlFor="ip-confirmPassword" className="block text-sm font-sans text-stone-700 mb-2">
              确认密码
            </label>
            <input
              id="ip-confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-700 transition-colors"
              placeholder="再次输入密码"
            />
          </div>
          <div className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="w-full px-6 py-3 bg-stone-800 text-white font-sans text-sm rounded-lg hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-60"
            >
              {pending ? '处理中…' : '注册'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSignupChoice(null);
                setError(null);
              }}
              className="w-full py-2 text-sm text-stone-500 hover:text-stone-800 font-sans transition-colors"
            >
              返回选择注册方式
            </button>
          </div>
          <p className="text-xs text-amber-700/90 font-sans text-center mt-4">
            请优先选择邮箱注册，IP 注册遗忘密码后将无法找回
          </p>
        </form>
      )}
    </>
  );
}
