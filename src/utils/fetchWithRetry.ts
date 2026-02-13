/**
 * 带超时与重试的 fetch，用于弱网（如部分 Wi-Fi）下减少“已丢失网络连接”等偶发失败。
 * 超时或网络错误时会自动重试，仍失败再抛出。
 */

const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type FetchWithRetryOptions = RequestInit & {
  /** 单次请求超时（毫秒），默认 20000 */
  timeoutMs?: number;
  /** 失败后重试次数（不含首次），默认 2，即最多共 3 次请求 */
  retries?: number;
  /** 重试前等待（毫秒），默认 1500 */
  retryDelayMs?: number;
};

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: FetchWithRetryOptions
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    retryDelayMs = RETRY_DELAY_MS,
    ...fetchInit
  } = init ?? {};

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const signal = controller.signal;

    try {
      const res = await fetch(input, {
        ...fetchInit,
        signal: fetchInit.signal ?? signal,
      });
      clearTimeout(timeoutId);
      return res;
    } catch (e) {
      clearTimeout(timeoutId);
      lastError = e;
      if (attempt < retries) {
        await delay(retryDelayMs);
      } else {
        break;
      }
    }
  }

  if (lastError instanceof Error) {
    if (lastError.name === 'AbortError') {
      throw new Error('网络请求超时，请检查网络后重试或切换网络（如改用流量）');
    }
    throw new Error(
      lastError.message || '网络连接异常，请重试或切换网络（如改用流量）'
    );
  }
  throw lastError;
}
