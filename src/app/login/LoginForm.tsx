'use client';

import {
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { login, signup, verifySignupOtp } from './actions';
import styles from './login.module.css';

type Props = {
  next: string;
  wechatEnabled: boolean;
  message?: string;
};

type AuthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  label: string;
  action?: ReactNode;
  inputClassName?: string;
};

const AUTH_ACTION_TIMEOUT_MS = 25000;
const AUTH_EASE = [0.32, 0.72, 0, 1] as const;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

function AuthField({ label, action, inputClassName, ...inputProps }: AuthFieldProps) {
  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldMeta}>
        <label htmlFor={inputProps.id} className={styles.fieldLabel}>{label}</label>
        {action}
      </div>
      <input
        {...inputProps}
        className={`${styles.input}${inputClassName ? ` ${inputClassName}` : ''}`}
      />
    </div>
  );
}

function FieldStack({ children }: { children: ReactNode }) {
  return (
    <div className={styles.fieldStack}>
      <div className={styles.fieldCore}>{children}</div>
    </div>
  );
}

function PrimaryButton({
  pending,
  label,
  pendingLabel = '处理中…',
}: {
  pending: boolean;
  label: string;
  pendingLabel?: string;
}) {
  return (
    <button type="submit" disabled={pending} className={styles.primaryButton}>
      <span>{pending ? pendingLabel : label}</span>
    </button>
  );
}

function StateFrame({ stateKey, children }: { stateKey: string; children: ReactNode }) {
  return (
    <motion.div
      key={stateKey}
      className={styles.stateFrame}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.62, ease: AUTH_EASE }}
    >
      {children}
    </motion.div>
  );
}

export function LoginForm({ next, wechatEnabled, message }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [signupChoice, setSignupChoice] = useState<'email' | null>(null);
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
    const formData = new FormData(e.currentTarget);
    const timeoutMsg = '登录请求超时，请检查网络后重试或切换网络（如改用流量）';

    try {
      if (mode === 'signup' && signupChoice === 'email') {
        const password = formData.get('password') as string;
        const confirmPassword = formData.get('confirmPassword') as string;
        if (password !== confirmPassword) {
          setError('两次输入的密码不一致');
          return;
        }
        const result = await withTimeout(
          signup(formData),
          AUTH_ACTION_TIMEOUT_MS,
          '注册请求超时，请检查网络后重试或切换网络（如改用流量）',
        );
        if (result.otpEmail) {
          setOtpPending({
            email: result.otpEmail,
            nickname: (formData.get('nickname') as string) || '',
            inviteCode: (formData.get('invite_code') as string) || '',
            nextUrl: next,
          });
          return;
        }
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
          return;
        }
        if (result.error) setError(result.error);
        return;
      }

      if (mode === 'login') {
        const result = await withTimeout(login(formData), AUTH_ACTION_TIMEOUT_MS, timeoutMsg);
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

  async function handleOtpSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const otp = (e.currentTarget.otp as HTMLInputElement).value.trim();
    const formData = new FormData();
    formData.append('email', otpPending!.email);
    formData.append('token', otp);
    formData.append('nickname', otpPending!.nickname);
    formData.append('invite_code', otpPending!.inviteCode);
    formData.append('next', otpPending!.nextUrl);

    try {
      const result = await withTimeout(verifySignupOtp(formData), AUTH_ACTION_TIMEOUT_MS, '验证超时，请重试');
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

  function selectMode(nextMode: 'login' | 'signup') {
    setMode(nextMode);
    setSignupChoice(null);
    setOtpPending(null);
    setError(null);
  }

  const showSignupChoice = mode === 'signup' && signupChoice === null && !otpPending;
  const showEmailSignupForm = mode === 'signup' && signupChoice === 'email' && !otpPending;
  const wechatStartHref = `/api/auth/wechat/start?mode=login&next=${encodeURIComponent(next)}`;
  const stateKey = otpPending ? 'otp' : mode === 'login' ? 'login' : signupChoice ?? 'signup-choice';
  const title = otpPending ? '验证' : mode === 'login' ? '归来' : '初见';
  const subtitle = otpPending
    ? '一封信，确认此刻是你'
    : mode === 'login'
      ? '世间即道场，人生是修行'
      : '从此刻起，与自己同行';

  return (
    <motion.section
      className={styles.experience}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.85, ease: AUTH_EASE }}
    >
      <header className={styles.brand}>
        <motion.div
          className={styles.emblem}
          initial={false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 210, damping: 22, delay: 0.08 }}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            preserveAspectRatio="xMidYMid meet"
            className={styles.emblemSvg}
          >
            <rect x="0" y="20" width="100" height="20" />
            <rect x="0" y="60" width="100" height="20" />
          </svg>
        </motion.div>
        <p className={styles.eyebrow}>THE ONE · THE TWO</p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${title}-${subtitle}`}
            className={styles.titleState}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.52, ease: AUTH_EASE }}
          >
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </motion.div>
        </AnimatePresence>
      </header>

      {message && <div className={styles.notice}>{message}</div>}

      <div className={styles.shell}>
        <div className={styles.panel}>
          {!otpPending && (
            <div className={styles.modeSwitcher} aria-label="登录或注册">
              <motion.span
                className={styles.modeIndicator}
                animate={{ x: mode === 'login' ? '0%' : '100%' }}
                transition={{ type: 'spring', stiffness: 330, damping: 31 }}
              />
              <button
                type="button"
                className={`${styles.modeButton} ${mode === 'login' ? styles.modeButtonActive : ''}`}
                onClick={() => selectMode('login')}
              >
                登录
              </button>
              <button
                type="button"
                className={`${styles.modeButton} ${mode === 'signup' ? styles.modeButtonActive : ''}`}
                onClick={() => selectMode('signup')}
              >
                注册
              </button>
            </div>
          )}

          <AnimatePresence>{error && <motion.div className={styles.error} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>{error}</motion.div>}</AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            {otpPending && (
              <StateFrame stateKey={stateKey}>
                <form className={styles.form} onSubmit={handleOtpSubmit}>
                  <div className={styles.otpIntro}>
                    <p className={styles.choiceIntro}>验证码已发送至</p>
                    <span className={styles.otpEmail}>{otpPending.email}</span>
                  </div>
                  <FieldStack>
                    <AuthField
                      id="otp"
                      name="otp"
                      label="邮箱验证码"
                      type="text"
                      inputMode="numeric"
                      maxLength={8}
                      required
                      autoFocus
                      autoComplete="one-time-code"
                      placeholder="······"
                      inputClassName={styles.otpInput}
                    />
                  </FieldStack>
                  <PrimaryButton pending={pending} label="完成验证" pendingLabel="验证中…" />
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={() => {
                      setOtpPending(null);
                      setSignupChoice(null);
                      setError(null);
                    }}
                  >
                    返回重新注册
                  </button>
                  <p className={styles.formHint}>收不到验证码时，请检查垃圾邮件文件夹</p>
                </form>
              </StateFrame>
            )}

            {showSignupChoice && (
              <StateFrame stateKey={stateKey}>
                <div className={styles.form}>
                  <p className={styles.choiceIntro}>选择一种适合你的方式。已有用户名账户仍可在登录页进入</p>
                  <div className={styles.choiceGrid}>
                    <button type="button" className={styles.choiceButton} onClick={() => { setSignupChoice('email'); setError(null); }}>
                      <span className={styles.choiceSeal}>邮</span>
                      <span>
                        <span className={styles.choiceTitle}>邮箱注册</span>
                        <span className={styles.choiceDetail}>可验证 · 可找回</span>
                      </span>
                    </button>
                    {wechatEnabled ? (
                      <a href={wechatStartHref} className={styles.choiceButton}>
                        <span className={`${styles.choiceSeal} ${styles.wechatSeal}`}>微</span>
                        <span>
                          <span className={styles.choiceTitle}>微信注册</span>
                          <span className={styles.choiceDetail}>扫码即可建立账户</span>
                        </span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        className={`${styles.choiceButton} ${styles.choiceButtonDisabled}`}
                        onClick={() => setError('微信注册尚未开通，请改用邮箱')}
                      >
                        <span className={`${styles.choiceSeal} ${styles.wechatSeal}`}>微</span>
                        <span>
                          <span className={styles.choiceTitle}>微信注册</span>
                          <span className={styles.choiceDetail}>即将开放</span>
                        </span>
                      </button>
                    )}
                  </div>
                  <button type="button" className={styles.secondaryAction} onClick={() => selectMode('login')}>已有账号，返回登录</button>
                </div>
              </StateFrame>
            )}

            {mode === 'login' && !otpPending && (
              <StateFrame stateKey={stateKey}>
                <form className={styles.form} onSubmit={handleSubmit}>
                  <input type="hidden" name="next" value={next} />
                  <FieldStack>
                    <AuthField
                      id="email"
                      name="email"
                      label="账号"
                      type="text"
                      required
                      autoComplete="username"
                      placeholder="邮箱或用户名"
                    />
                    <AuthField
                      id="password"
                      name="password"
                      label="密码"
                      type="password"
                      required
                      autoComplete="current-password"
                      placeholder="输入密码"
                      action={<a href="/forgot-password" className={styles.fieldAction}>忘记密码？</a>}
                    />
                  </FieldStack>
                  <PrimaryButton pending={pending} label="进入" />
                  <button type="button" className={styles.secondaryAction} onClick={() => selectMode('signup')}>还没有账号？从这里开始</button>
                  {wechatEnabled && (
                    <>
                      <div className={styles.divider}>或使用</div>
                      <a href={wechatStartHref} className={styles.providerButton}>
                        <span className={styles.providerIdentity}>
                          <span className={styles.wechatSeal}>微</span>
                          <span>微信扫码登录</span>
                        </span>
                        <span className={styles.providerArrow} aria-hidden="true">↗</span>
                      </a>
                      <p className={styles.providerHint}>已有账号请先用原方式登录，再到个人设置绑定微信</p>
                    </>
                  )}
                </form>
              </StateFrame>
            )}

            {showEmailSignupForm && (
              <StateFrame stateKey={stateKey}>
                <form className={styles.form} onSubmit={handleSubmit}>
                  <input type="hidden" name="next" value={next} />
                  <FieldStack>
                    <AuthField id="nickname" name="nickname" label="称呼" type="text" autoComplete="nickname" placeholder="选填，用于展示" />
                    <AuthField id="signup-email" name="email" label="邮箱" type="email" required autoComplete="email" placeholder="your@email.com" />
                    <AuthField id="signup-password" name="password" label="设置密码" type="password" required minLength={6} autoComplete="new-password" placeholder="至少 6 位" />
                    <AuthField id="confirmPassword" name="confirmPassword" label="确认密码" type="password" required minLength={6} autoComplete="new-password" placeholder="再次输入密码" />
                    <AuthField id="invite_code" name="invite_code" label="邀请码" type="text" placeholder="选填" />
                  </FieldStack>
                  <PrimaryButton pending={pending} label="发送验证码" />
                  <button type="button" className={styles.secondaryAction} onClick={() => selectMode('login')}>已有账号，返回登录</button>
                  <p className={styles.formHint}>验证码将发送至你的邮箱，验证后即完成注册</p>
                </form>
              </StateFrame>
            )}

          </AnimatePresence>
        </div>
      </div>

      <p className={styles.legal}>
        继续即表示你已阅读并同意 <a href="/terms">《用户协议》</a> 和 <a href="/privacy">《隐私政策》</a>
      </p>
    </motion.section>
  );
}
