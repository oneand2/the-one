'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CalendarRange, Brain, Sparkles, UserCircle, Download } from 'lucide-react';
import { CopperCoinIcon } from './CopperCoinIcon';
import { isLifetimeVip } from '@/utils/vip';
import { clearRecordsCaches } from '@/utils/cache';

export function AuthButton() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [vipExpiresAt, setVipExpiresAt] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
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
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const handleSignOut = async () => {
    clearRecordsCaches();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  };

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
                    ? '终身VIP'
                    : (() => {
                        const now = new Date();
                        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const exp = new Date(vipExpiresAt!).getTime();
                        const days = Math.ceil((exp - startOfToday.getTime()) / 86400000);
                        return days > 0 ? `${days}天 VIP` : 'VIP';
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
            onClick={() => setMenuOpen((o) => !o)}
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
              className="absolute top-full right-0 mt-1 w-52 py-1 bg-white border border-stone-200 rounded-xl shadow-lg z-50"
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
                客户端下载
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
                我的八维结果
              </Link>
              <Link
                href="/my/liuyao"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 font-sans"
              >
                <Sparkles className="w-4 h-4 text-stone-500" />
                我的周易解卦
              </Link>
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
            onClick={() => router.push('/login')}
            className="px-3 py-1.5 bg-stone-800 text-white font-sans text-xs rounded-lg hover:bg-stone-700 active:bg-stone-900 transition-colors md:px-4 md:py-2 md:text-sm"
          >
            登录
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
