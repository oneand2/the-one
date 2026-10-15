type ChatChunk = {
  choices: Array<{
    delta?: { content?: string | null; reasoning_content?: string | null };
    finish_reason?: string | null;
  }>;
};

type ChatUpstream = AsyncIterable<ChatChunk> & { controller?: AbortController };

export function resolveDeepSeekModel(configured?: string): string {
  const model = configured?.trim();
  return !model || model === 'deepseek-chat' || model === 'deepseek-reasoner'
    ? 'deepseek-flash'
    : model;
}

export function isDeepSeekRequest(model: string, baseURL?: string): boolean {
  if (['deepseek-flash', 'deepseek-v4-pro', 'deepseek-v4-flash'].includes(model)) return true;
  try {
    return new URL(baseURL ?? '').hostname === 'api.deepseek.com';
  } catch {
    return false;
  }
}

export function chatReasoningParams(useMeditation: boolean, useReasoning: boolean, isDeepSeek = true) {
  return !useMeditation && isDeepSeek
    ? { reasoning_effort: useReasoning ? 'high' as const : 'none' as const }
    : {};
}

// Keep tagged reasoning private even when tags cross chunks or the stream ends
// inside a think block. Only a possible tag prefix needs to remain buffered.
function createThinkFilter() {
  let pending = '';
  let thinking = false;
  return {
    push(text: string) {
      let input = pending + text;
      let output = '';
      pending = '';
      while (input) {
        const tag = thinking ? '</think>' : '<think>';
        const index = input.indexOf(tag);
        if (index >= 0) {
          if (!thinking) output += input.slice(0, index);
          input = input.slice(index + tag.length);
          thinking = !thinking;
          continue;
        }
        let keep = Math.min(tag.length - 1, input.length);
        while (keep && !tag.startsWith(input.slice(-keep))) keep--;
        if (!thinking) output += keep ? input.slice(0, -keep) : input;
        pending = keep ? input.slice(-keep) : '';
        break;
      }
      return output;
    },
    finish() {
      return thinking ? '' : pending;
    },
  };
}

export async function streamChatResponse({ signal, timeoutMs, create, onComplete, stripThink = false }: {
  signal: AbortSignal;
  timeoutMs: number;
  create: (signal: AbortSignal) => Promise<ChatUpstream>;
  onComplete: () => Promise<void>;
  stripThink?: boolean;
}): Promise<ReadableStream<Uint8Array>> {
  const abort = new AbortController();
  const encoder = new TextEncoder();
  const filter = createThinkFilter();
  let upstream: ChatUpstream | undefined;
  let closed = false;
  let hasContent = false;
  let firstSettled = false;
  let output: ReadableStreamDefaultController<Uint8Array>;
  let resolveFirst!: () => void;
  let rejectFirst!: (error: unknown) => void;
  let rejectAborted!: (error: unknown) => void;
  const first = new Promise<void>((resolve, reject) => { resolveFirst = resolve; rejectFirst = reject; });
  const aborted = new Promise<never>((_, reject) => { rejectAborted = reject; });
  // Cancellation can arrive before the first iterator.next() is awaiting it.
  void aborted.catch(() => {});
  const cleanup = () => {
    clearTimeout(timer);
    signal.removeEventListener('abort', requestAborted);
  };
  const fail = (error: unknown) => {
    if (closed) return;
    closed = true;
    cleanup();
    if (!firstSettled) {
      firstSettled = true;
      rejectFirst(error);
    }
    output.error(error);
  };
  const cancelUpstream = (reason: unknown) => {
    if (!abort.signal.aborted) abort.abort(reason);
    upstream?.controller?.abort();
    rejectAborted(reason);
  };
  const requestAborted = () => {
    const error = new DOMException('对话已取消', 'AbortError');
    cancelUpstream(error);
    fail(error);
  };
  const timer = setTimeout(() => {
    const error = new DOMException('对话服务响应超时，请稍后再试', 'TimeoutError');
    cancelUpstream(error);
    fail(error);
  }, Math.max(1, timeoutMs));
  const emit = (text: string) => {
    if (!text || closed || abort.signal.aborted) return;
    hasContent ||= Boolean(text.trim());
    output.enqueue(encoder.encode(text));
    if (hasContent && !firstSettled) {
      firstSettled = true;
      resolveFirst();
    }
  };
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      output = controller;
      signal.addEventListener('abort', requestAborted, { once: true });
      if (signal.aborted) { requestAborted(); return; }
      void (async () => {
        try {
          upstream = await Promise.race([
            create(abort.signal).then(value => {
              if (abort.signal.aborted) value.controller?.abort();
              return value;
            }),
            aborted,
          ]);
          const iterator = upstream[Symbol.asyncIterator]();
          let completed = false;
          while (!closed) {
            const item = await Promise.race([iterator.next(), aborted]);
            if (item.done) break;
            const choice = item.value.choices[0];
            // reasoning_content is deliberately never sent to the client.
            const text = choice?.delta?.content ?? '';
            emit(stripThink ? filter.push(text) : text);
            if (choice?.finish_reason) {
              if (choice.finish_reason !== 'stop') throw new Error('对话未完整结束，请稍后再试');
              completed = true;
            }
          }
          if (closed || abort.signal.aborted) return;
          if (stripThink) emit(filter.finish());
          if (!completed || !hasContent) throw new Error('对话未返回完整内容，请稍后再试');
          // The generation deadline must not interrupt an already completed
          // answer while its single billing operation is in progress.
          clearTimeout(timer);
          if (signal.aborted || abort.signal.aborted) { requestAborted(); return; }
          await onComplete();
          if (closed || abort.signal.aborted) return;
          closed = true;
          cleanup();
          output.close();
        } catch (error) {
          cancelUpstream(error);
          fail(error);
        }
      })();
    },
    cancel() {
      if (closed) return;
      closed = true;
      cleanup();
      cancelUpstream(new DOMException('对话已取消', 'AbortError'));
    },
  });
  // Fail before sending HTTP 200 if the provider never produces an answer.
  await first;
  return readable;
}
