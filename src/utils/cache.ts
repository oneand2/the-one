/**
 * 客户端缓存工具：内存 + sessionStorage，带 TTL
 * 用户第二次进入或刷新时先展示缓存，再后台更新，减少卡顿
 */

const CACHE_PREFIX = 'app_cache:';
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 分钟

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

function storageKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

function isExpired(entry: CacheEntry<unknown>): boolean {
  return Date.now() > entry.expiresAt;
}

/** 从 sessionStorage 读取（仅浏览器环境） */
function getFromStorage<T>(key: string): CacheEntry<T> | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (isExpired(entry as CacheEntry<unknown>)) {
      window.sessionStorage.removeItem(storageKey(key));
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

/** 写入 sessionStorage */
function setToStorage(key: string, entry: CacheEntry<unknown>): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // quota exceeded or disabled
  }
}

/**
 * 获取缓存：先内存再 sessionStorage
 * @param key 缓存键
 * @returns 未过期则返回数据，否则 null
 */
export function getCached<T>(key: string): T | null {
  const mem = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (mem && !isExpired(mem)) return mem.data as T;

  const stored = getFromStorage<T>(key);
  if (stored) {
    memoryCache.set(key, stored as CacheEntry<unknown>);
    return stored.data;
  }
  return null;
}

/**
 * 设置缓存：同时写入内存和 sessionStorage
 * @param key 缓存键
 * @param data 可 JSON 序列化的数据
 * @param ttlMs 过期时间（毫秒），默认 10 分钟
 */
export function setCached<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  const entry: CacheEntry<T> = {
    data,
    expiresAt: Date.now() + ttlMs,
  };
  memoryCache.set(key, entry as CacheEntry<unknown>);
  setToStorage(key, entry as CacheEntry<unknown>);
}

/**
 * 清除指定 key 的缓存
 */
export function clearCached(key: string): void {
  memoryCache.delete(key);
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(storageKey(key));
    } catch {}
  }
}

/** 缓存 key 与 TTL 常量 */
export const CACHE_KEYS = {
  WORLD_NEWS: 'world_news_list',
  RECORDS_CLASSICAL: 'records_classical',
  RECORDS_MBTI: 'records_mbti',
  RECORDS_LIUYAO: 'records_liuyao',
  RECORDS_LIUYAO_DETAIL_PREFIX: 'records_liuyao_detail_',
} as const;

/** 记录类接口 TTL：3 分钟，便于「上传/更新后」几分钟内同步到页面 */
export const RECORDS_TTL_MS = 3 * 60 * 1000;

export function recordsLiuyaoDetailKey(id: string): string {
  return `${CACHE_KEYS.RECORDS_LIUYAO_DETAIL_PREFIX}${id}`;
}

const RECORDS_DETAIL_STORAGE_PREFIX = storageKey(CACHE_KEYS.RECORDS_LIUYAO_DETAIL_PREFIX);

/**
 * 清除所有记录相关缓存（登出或需要强制刷新时调用，保证换账号/更新后能同步）
 */
export function clearRecordsCaches(): void {
  [CACHE_KEYS.RECORDS_CLASSICAL, CACHE_KEYS.RECORDS_MBTI, CACHE_KEYS.RECORDS_LIUYAO].forEach(clearCached);
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i);
        if (k && k.startsWith(RECORDS_DETAIL_STORAGE_PREFIX)) toRemove.push(k);
      }
      toRemove.forEach((k) => window.sessionStorage.removeItem(k));
    } catch {}
  }
  const memKeysToDelete = Array.from(memoryCache.keys()).filter(
    (key) =>
      key === CACHE_KEYS.RECORDS_CLASSICAL ||
      key === CACHE_KEYS.RECORDS_MBTI ||
      key === CACHE_KEYS.RECORDS_LIUYAO ||
      key.startsWith(CACHE_KEYS.RECORDS_LIUYAO_DETAIL_PREFIX)
  );
  memKeysToDelete.forEach((key) => memoryCache.delete(key));
}
