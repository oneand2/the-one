'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CalendarRange, Brain, Sparkles, UserCircle, Download, LifeBuoy } from 'lucide-react';
import { CopperCoinIcon } from './CopperCoinIcon';
import { isLifetimeVip } from '@/utils/vip';
import { clearRecordsCaches } from '@/utils/cache';
import { SITE_INFO } from '@/config/siteInfo';
import { requestAppLogin } from '@/utils/iosEmbed';

export function AuthButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [vipExpiresAt, setVipExpiresAt] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const previousUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    let pendingNullTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      const supabase = createClient();

      const applyUser = (u: User | null) => {
        if (pendingNullTimer) {
          clearTimeout(pendingNullTimer);
          pendingNullTimer = null;
        }
        setUser(u);
      };

      const getUser = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          setUser(user);
        } catch {
          setUser(null);
        } finally {
          setLoading(false);
        }
      };

      getUser().catch(() => {
        setUser(null);
        setLoading(false);
      });

      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          const u = session?.user ?? null;
          if (u) {
            applyUser(u);
            return;
          }
          // 未登录：延迟再确认一次，避免 token 刷新时短暂为 null 导致「反复横跳」
          if (pendingNullTimer) clearTimeout(pendingNullTimer);
          pendingNullTimer = setTimeout(() => {
            pendingNullTimer = null;
            supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
          }, 400);
        }
      );
      subscription = sub;
    } catch (_e) {
      setUser(null);
      setLoading(false);
    }

    return () => {
      subscription?.unsubscribe();
      if (pendingNullTimer) clearTimeout(pendingNullTimer);
    };
  }, []);

  const fetchProfile = () => {
    if (!user) return;
    fetch('/api/user/profile', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p != null) {
          setNickname(p.nickname ?? '');
          setCoins(p.coins_balance ?? 0);
          setVipExpiresAt(p.vip_expires_at ?? null);
        } else {
          setNickname(null);
          setCoins(null);
          setVipExpiresAt(undefined);
        }
      })
      .catch(() => {
        setNickname(null);
        setCoins(null);
        setVipExpiresAt(undefined);
      });
  };

  useEffect(() => {
    if (!user) {
      setNickname(null);
      setCoins(null);
      setVipExpiresAt(undefined);
      return;
    }
    fetchProfile();
  }, [user]);

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    if (previousUserIdRef.current === undefined) {
      previousUserIdRef.current = nextUserId;
      return;
    }
    if (previousUserIdRef.current === nextUserId) return;
    previousUserIdRef.current = nextUserId;
    clearRecordsCaches();
    try {
      window.localStorage.removeItem('guanxin-daily-hexagram');
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('theone:auth-changed'));
  }, [user]);

  useEffect(() => {
    const onRefresh = () => {
      fetch('/api/user/profile', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((p) => {
          if (p != null) {
            setNickname(p.nickname ?? '');
            setCoins(p.coins_balance ?? 0);
            setVipExpiresAt(p.vip_expires_at ?? null);
          }
        })
        .catch(() => {});
    };
    window.addEventListener('coins-should-refresh', onRefresh);
    return () => window.removeEventListener('coins-should-refresh', onRefresh);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setSupportOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const handleSignOut = async () => {
    clearRecordsCaches();
    try {
      window.localStorage.removeItem('guanxin-daily-hexagram');
    } catch {
      // ignore
    }
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      router.refresh();
    }
  };

  if (pathname === '/login') return null;

  // 不阻塞首屏：登录态在后台拉取，先展示按钮/登录入口，避免等 getUser 导致整页“卡住”
  return (
    <AnimatePresence mode="wait">
      {user ? (
        <motion.div
          key="authenticated"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          ref={menuRef}
          className="relative flex items-center gap-2"
        >
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-get-coins'))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-transparent hover:bg-stone-100/50 transition-colors cursor-pointer"
            title={isLifetimeVip(vipExpiresAt) ? '终身 VIP' : vipExpiresAt && new Date(vipExpiresAt).getTime() > Date.now() ? 'VIP 会员' : '铜币余额，点击获取铜币'}
          >
            {isLifetimeVip(vipExpiresAt) || (vipExpiresAt && new Date(vipExpiresAt).getTime() > Date.now()) ? (
              <>
                <span className="text-sm font-sans text-stone-700 tabular-nums min-w-[2rem] text-right">
                  {isLifetimeVip(vipExpiresAt)
                    ? 'VIP'
                    : (() => {
                        const now = new Date();
                        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const exp = new Date(vipExpiresAt!).getTime();
                        const days = Math.ceil((exp - startOfToday.getTime()) / 86400000);
                        // 只有不足30天才显示倒计时
                        return days > 0 && days < 30 ? `${days}天VIP` : 'VIP';
                      })()}
                </span>
              </>
            ) : (
              <>
                <CopperCoinIcon className="w-4 h-4 text-amber-700/80 shrink-0" />
                <span className="text-sm font-sans text-stone-700 tabular-nums min-w-[1.5rem] text-right">
                  {coins !== null ? coins : '…'}
                </span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen((open) => {
                if (open) setSupportOpen(false);
                return !open;
              });
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-stone-100 transition-colors font-sans text-sm text-stone-700"
          >
            <span className="hidden sm:inline max-w-[140px] truncate">
              {nickname != null && nickname.trim() ? nickname.trim() : (user.email ?? '用户')}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-stone-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
              key="auth-menu"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full right-0 mt-2 w-64 overflow-hidden rounded-2xl bg-white/95 py-1.5 shadow-[0_18px_50px_rgba(68,64,60,0.14)] ring-1 ring-stone-900/8 z-50"
            >
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 font-sans"
              >
                <UserCircle className="w-4 h-4 text-stone-500" />
                个人设置
              </Link>
              <Link
                href="/download"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 font-sans"
              >
                <Download className="w-4 h-4 text-stone-500" />
                添加到主屏幕
              </Link>
              <Link
                href="/my/classical"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 font-sans"
              >
                <CalendarRange className="w-4 h-4 text-stone-500" />
                我的八字排盘
              </Link>
              <Link
                href="/my/mbti"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 font-sans"
              >
                <Brain className="w-4 h-4 text-stone-500" />
                我的八卦人格
              </Link>
              <Link
                href="/my/liuyao"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 font-sans"
              >
                <Sparkles className="w-4 h-4 text-stone-500" />
                我的周易解卦
              </Link>
              <div className="mx-3 my-1 border-t border-stone-100" />
              <button
                type="button"
                aria-expanded={supportOpen}
                aria-controls="auth-support-menu"
                onClick={() => setSupportOpen((open) => !open)}
                className="group flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-stone-700 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-stone-50 font-sans"
              >
                <LifeBuoy className="w-4 h-4 text-stone-500" />
                <span className="flex-1">服务与支持</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-stone-400 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${supportOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {supportOpen && (
                  <motion.div
                    id="auth-support-menu"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                    className="mx-2 mb-1 rounded-xl bg-stone-50/90 px-2 py-1 ring-1 ring-stone-900/5"
                  >
                    {[
                      ['/service', '服务与计费'],
                      ['/refund', '退款与售后'],
                      ['/terms', '用户协议'],
                      ['/privacy', '隐私政策'],
                      ['/operator', '经营者信息'],
                    ].map(([href, label]) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => {
                          setSupportOpen(false);
                          setMenuOpen(false);
                        }}
                        className="block rounded-lg px-3 py-2 text-[13px] text-stone-600 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white hover:text-stone-900"
                      >
                        {label}
                      </Link>
                    ))}
                    <a
                      href={`mailto:${SITE_INFO.customerServiceEmail}`}
                      onClick={() => {
                        setSupportOpen(false);
                        setMenuOpen(false);
                      }}
                      className="block rounded-lg px-3 py-2 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white"
                    >
                      <span className="block text-[13px] text-stone-600">联系客服</span>
                      <span className="mt-0.5 block truncate text-[11px] text-stone-400">
                        {SITE_INFO.customerServiceEmail}
                      </span>
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="my-1 border-t border-stone-100" />
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  handleSignOut();
                }}
                className="w-full flex items-center px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50 font-sans text-left"
              >
                退出
              </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          key="unauthenticated"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <button
            onClick={() => {
              if (!requestAppLogin()) router.push('/login');
            }}
            className="px-3 py-1.5 bg-stone-800 text-white font-sans text-xs rounded-lg hover:bg-stone-700 active:bg-stone-900 transition-colors md:px-4 md:py-2 md:text-sm"
          >
            登录
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
