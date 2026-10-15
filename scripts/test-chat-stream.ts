import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chatReasoningParams,
  isDeepSeekRequest,
  resolveDeepSeekModel,
  streamChatResponse,
} from '../src/lib/chatStream';

type Chunk = {
  choices: Array<{
    delta?: { content?: string | null; reasoning_content?: string | null };
    finish_reason?: string | null;
  }>;
};

const content = (text: string): Chunk => ({ choices: [{ delta: { content: text } }] });
const reasoning = (text: string): Chunk => ({
  choices: [{ delta: { reasoning_content: text } }],
});
const finish = (reason = 'stop'): Chunk => ({ choices: [{ finish_reason: reason }] });

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function readText(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return text + decoder.decode();
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

async function within<T>(promise: Promise<T>, milliseconds = 500): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Test operation did not settle')), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function abortError() {
  return new DOMException('Mock upstream aborted', 'AbortError');
}

function waitForAbort(...signals: AbortSignal[]): Promise<never> {
  return new Promise((_, reject) => {
    const onAbort = () => {
      for (const signal of signals) signal.removeEventListener('abort', onAbort);
      reject(abortError());
    };
    if (signals.some((signal) => signal.aborted)) return onAbort();
    for (const signal of signals) signal.addEventListener('abort', onAbort, { once: true });
  });
}

const shortTest = { timeout: 2_000 };

test('legacy model names and blank configuration resolve to the supported Flash model', () => {
  for (const configured of [undefined, '', '   ', 'deepseek-chat', 'deepseek-reasoner', ' deepseek-chat ']) {
    assert.equal(resolveDeepSeekModel(configured), 'deepseek-flash');
  }
  for (const configured of ['deepseek-flash', 'deepseek-v4-pro', 'custom-model', ' custom-model ']) {
    assert.equal(resolveDeepSeekModel(configured), configured.trim());
  }
});

test('ordinary, deep, and master modes preserve their distinct reasoning settings', () => {
  assert.deepEqual(chatReasoningParams(false, false), { reasoning_effort: 'none' });
  assert.deepEqual(chatReasoningParams(false, true), { reasoning_effort: 'high' });
  assert.deepEqual(chatReasoningParams(false, true, false), {});
  assert.deepEqual(chatReasoningParams(false, false, false), {});
  assert.deepEqual(chatReasoningParams(true, false), {});
  assert.deepEqual(chatReasoningParams(true, true), {});
});

test('DeepSeek-specific settings do not spill into unrelated custom providers or models', () => {
  assert.equal(isDeepSeekRequest('deepseek-flash', 'https://proxy.example/v1'), true);
  assert.equal(isDeepSeekRequest('deepseek-v4-pro'), true);
  assert.equal(isDeepSeekRequest('deepseek-v4-flash'), true);
  assert.equal(isDeepSeekRequest('provider-alias', 'https://api.deepseek.com/v1'), true);
  assert.equal(isDeepSeekRequest('custom-model', 'https://proxy.example/v1'), false);
  assert.equal(isDeepSeekRequest('custom-model', 'https://api.deepseek.com.example/v1'), false);
  assert.equal(isDeepSeekRequest('custom-model', 'not a URL'), false);
  assert.equal(isDeepSeekRequest('custom-model'), false);
});

test('waits for visible content, excludes reasoning, and completes exactly once after stop', shortTest, async () => {
  const request = new AbortController();
  const releaseVisible = deferred<void>();
  const releaseStop = deferred<void>();
  const reasoningSeen = deferred<void>();
  let createCalls = 0;
  let completeCalls = 0;
  let responseResolved = false;
  const pending = streamChatResponse({
    signal: request.signal,
    timeoutMs: 1_000,
    create: async () => {
      createCalls += 1;
      return (async function* () {
        yield reasoning('This private reasoning must never appear in the answer.');
        reasoningSeen.resolve();
        await releaseVisible.promise;
        yield content('你好');
        await releaseStop.promise;
        yield content('，世界。');
        yield finish();
      })();
    },
    onComplete: async () => { completeCalls += 1; },
  }).then((stream) => {
    responseResolved = true;
    return stream;
  });
  await within(reasoningSeen.promise);
  await Promise.resolve();
  assert.equal(responseResolved, false, 'reasoning-only output must not make the response ready');
  assert.equal(completeCalls, 0);
  releaseVisible.resolve();
  const stream = await within(pending);
  assert.equal(completeCalls, 0, 'the first visible token must not trigger completion');
  releaseStop.resolve();
  assert.equal(await within(readText(stream)), '你好，世界。');
  assert.equal(createCalls, 1);
  assert.equal(completeCalls, 1);
});

test('rejects an empty or reasoning-only response before returning a stream', shortTest, async () => {
  for (const chunks of [[finish()], [reasoning('Only reasoning'), finish()], [content(' \n '), finish()]]) {
    let completeCalls = 0;
    await assert.rejects(streamChatResponse({
      signal: new AbortController().signal,
      timeoutMs: 500,
      create: async () => (async function* () { yield* chunks; })(),
      onComplete: async () => { completeCalls += 1; },
    }));
    assert.equal(completeCalls, 0);
  }
});

test('rejects truncation or upstream failure before visible content without completion', shortTest, async () => {
  for (const mode of ['truncated', 'error'] as const) {
    let completeCalls = 0;
    await assert.rejects(streamChatResponse({
      signal: new AbortController().signal,
      timeoutMs: 500,
      create: async () => (async function* () {
        yield reasoning('Not visible');
        if (mode === 'error') throw new Error('Mock upstream failed');
        yield finish('length');
      })(),
      onComplete: async () => { completeCalls += 1; },
    }));
    assert.equal(completeCalls, 0);
  }
});

test('partial content followed by truncation, failure, or missing stop never completes', shortTest, async () => {
  for (const mode of ['truncated', 'error', 'missing-stop'] as const) {
    let completeCalls = 0;
    const stream = await streamChatResponse({
      signal: new AbortController().signal,
      timeoutMs: 500,
      create: async () => (async function* () {
        yield content('A partial answer');
        if (mode === 'error') throw new Error('Mock stream interrupted');
        if (mode === 'truncated') yield finish('length');
      })(),
      onComplete: async () => { completeCalls += 1; },
    });
    await assert.rejects(readText(stream));
    assert.equal(completeCalls, 0, `${mode} must not trigger successful completion`);
  }
});

test('request abort while waiting for the upstream cancels that request', shortTest, async () => {
  const request = new AbortController();
  const started = deferred<void>();
  let upstreamSignal: AbortSignal | undefined;
  let createCalls = 0;
  let completeCalls = 0;
  const pending = streamChatResponse({
    signal: request.signal,
    timeoutMs: 1_000,
    create: async (signal) => {
      createCalls += 1;
      upstreamSignal = signal;
      started.resolve();
      return waitForAbort(signal);
    },
    onComplete: async () => { completeCalls += 1; },
  });
  const rejected = assert.rejects(pending);
  await within(started.promise);
  request.abort();
  await within(rejected);
  assert.equal(upstreamSignal?.aborted, true);
  assert.equal(createCalls, 1);
  assert.equal(completeCalls, 0);
});

test('reader cancellation aborts the upstream stream and does not complete', shortTest, async () => {
  const request = new AbortController();
  const upstreamController = new AbortController();
  const stopped = deferred<void>();
  let upstreamSignal: AbortSignal | undefined;
  let completeCalls = 0;
  const stream = await streamChatResponse({
    signal: request.signal,
    timeoutMs: 1_000,
    create: async (signal) => {
      upstreamSignal = signal;
      return Object.assign((async function* () {
        try {
          yield content('First token');
          await waitForAbort(signal, upstreamController.signal);
        } finally {
          stopped.resolve();
        }
      })(), { controller: upstreamController });
    },
    onComplete: async () => { completeCalls += 1; },
  });
  const reader = stream.getReader();
  const first = await within(reader.read());
  assert.equal(new TextDecoder().decode(first.value), 'First token');
  await within(reader.cancel('Reviewer left the page'));
  await within(stopped.promise);
  assert.ok(upstreamSignal?.aborted || upstreamController.signal.aborted);
  assert.equal(completeCalls, 0);
  reader.releaseLock();
});

test('timeout aborts the upstream once and never retries create', shortTest, async () => {
  let createCalls = 0;
  let completeCalls = 0;
  let upstreamSignal: AbortSignal | undefined;
  await assert.rejects(streamChatResponse({
    signal: new AbortController().signal,
    timeoutMs: 30,
    create: async (signal) => {
      createCalls += 1;
      upstreamSignal = signal;
      return waitForAbort(signal);
    },
    onComplete: async () => { completeCalls += 1; },
  }), (error: unknown) => error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name));
  assert.equal(upstreamSignal?.aborted, true);
  assert.equal(createCalls, 1);
  assert.equal(completeCalls, 0);
});

test('timeout also cancels an established stream that produces only reasoning', shortTest, async () => {
  let createCalls = 0;
  let completeCalls = 0;
  let upstreamSignal: AbortSignal | undefined;
  const stopped = deferred<void>();
  await assert.rejects(streamChatResponse({
    signal: new AbortController().signal,
    timeoutMs: 30,
    create: async (signal) => {
      createCalls += 1;
      upstreamSignal = signal;
      return (async function* () {
        try {
          yield reasoning('Reasoning without a final answer');
          await waitForAbort(signal);
        } finally {
          stopped.resolve();
        }
      })();
    },
    onComplete: async () => { completeCalls += 1; },
  }), (error: unknown) => error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name));
  await within(stopped.promise);
  assert.equal(upstreamSignal?.aborted, true);
  assert.equal(createCalls, 1);
  assert.equal(completeCalls, 0);
});

test('optional think stripping handles tags split across chunks', shortTest, async () => {
  let completeCalls = 0;
  const stream = await streamChatResponse({
    signal: new AbortController().signal,
    timeoutMs: 500,
    stripThink: true,
    create: async () => (async function* () {
      for (const chunk of ['<thi', 'nk>Private chain', '</th', 'ink>Final ', 'answer']) {
        yield content(chunk);
      }
      yield finish();
    })(),
    onComplete: async () => { completeCalls += 1; },
  });
  assert.equal(await readText(stream), 'Final answer');
  assert.equal(completeCalls, 1);
});

test('an already aborted request never creates an upstream request', shortTest, async () => {
  const request = new AbortController();
  request.abort();
  let createCalls = 0;
  let completeCalls = 0;
  await assert.rejects(streamChatResponse({
    signal: request.signal,
    timeoutMs: 500,
    create: async () => {
      createCalls += 1;
      return (async function* () { yield content('Should not be requested'); yield finish(); })();
    },
    onComplete: async () => { completeCalls += 1; },
  }));
  assert.equal(createCalls, 0);
  assert.equal(completeCalls, 0);
});

test('successful completion removes the request abort listener and generation timer', shortTest, async () => {
  const request = new AbortController();
  const upstreamController = new AbortController();
  let upstreamSignal: AbortSignal | undefined;
  let completeCalls = 0;
  const stream = await streamChatResponse({
    signal: request.signal,
    timeoutMs: 30,
    create: async (signal) => {
      upstreamSignal = signal;
      return Object.assign((async function* () {
        yield content('Complete answer');
        yield finish();
      })(), { controller: upstreamController });
    },
    onComplete: async () => { completeCalls += 1; },
  });
  assert.equal(await readText(stream), 'Complete answer');
  request.abort();
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(completeCalls, 1);
  assert.equal(upstreamSignal?.aborted, false);
  assert.equal(upstreamController.signal.aborted, false);
});

test('long unclosed private think blocks never leak or count as an answer', shortTest, async () => {
  const privateText = 'PRIVATE-REASONING-'.repeat(600);
  assert.ok(privateText.length > 8_000);
  for (const visible of ['Public answer.', '']) {
    let completeCalls = 0;
    const pending = streamChatResponse({
      signal: new AbortController().signal,
      timeoutMs: 500,
      stripThink: true,
      create: async () => (async function* () {
        if (visible) yield content(visible);
        yield content('<think>');
        yield content(privateText);
        yield finish();
      })(),
      onComplete: async () => { completeCalls += 1; },
    });
    if (visible) {
      const text = await readText(await pending);
      assert.equal(text, visible);
      assert.equal(text.includes('PRIVATE'), false);
      assert.equal(completeCalls, 1);
    } else {
      await assert.rejects(pending);
      assert.equal(completeCalls, 0);
    }
  }
});

test('generation timeout is cleared before a slower completion callback runs', shortTest, async () => {
  const upstreamController = new AbortController();
  let upstreamSignal: AbortSignal | undefined;
  let completeCalls = 0;
  const stream = await streamChatResponse({
    signal: new AbortController().signal,
    timeoutMs: 20,
    create: async (signal) => {
      upstreamSignal = signal;
      return Object.assign((async function* () {
        yield content('Fully generated answer');
        yield finish();
      })(), { controller: upstreamController });
    },
    onComplete: async () => {
      completeCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 40));
    },
  });
  assert.equal(await within(readText(stream)), 'Fully generated answer');
  assert.equal(completeCalls, 1);
  assert.equal(upstreamSignal?.aborted, false);
  assert.equal(upstreamController.signal.aborted, false);
});

test('a stop marker alone does not complete before the upstream iterator ends', shortTest, async () => {
  const stopSeen = deferred<void>();
  const releaseEnd = deferred<void>();
  let completeCalls = 0;
  const stream = await streamChatResponse({
    signal: new AbortController().signal,
    timeoutMs: 500,
    create: async () => (async function* () {
      yield content('Complete answer');
      yield finish();
      stopSeen.resolve();
      await releaseEnd.promise;
    })(),
    onComplete: async () => { completeCalls += 1; },
  });
  await within(stopSeen.promise);
  assert.equal(completeCalls, 0);
  releaseEnd.resolve();
  assert.equal(await within(readText(stream)), 'Complete answer');
  assert.equal(completeCalls, 1);
});
