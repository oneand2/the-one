import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, type TestContext } from 'node:test';
import ts from 'typescript';
import * as chatStream from '../src/lib/chatStream';

type CreateParams = {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream: boolean;
  thinking?: { type: string };
  output_config?: { effort: string };
  reasoning_effort?: string;
  temperature?: number;
};

type ClientOptions = { apiKey?: string; baseURL?: string };
type CreateCall = {
  client: ClientOptions;
  params: CreateParams;
  options: { signal: AbortSignal; maxRetries: number };
};

const question = '最近工作压力很大，该怎样梳理？';
const answer = '先分清眼前必须完成的事，再给自己留出休息的时间。';
const userId = 'model-selection-test-admin';

function loadRoute(context: TestContext, meditationModel = 'claude-sonnet-4-5-20250929-thinking') {
  const environment = {
    AI_API_KEY: 'test-deepseek-key',
    AI_BASE_URL: 'https://api.deepseek.com',
    AI_MODEL_NAME: 'deepseek-v4-flash',
    AI_REASONER_MODEL_NAME: 'deepseek-v4-pro',
    AI_MEDITATION_FALLBACK_API_KEY: 'test-meditation-key',
    AI_MEDITATION_FALLBACK_BASE_URL: 'https://meditation.example.test/v1',
    AI_MEDITATION_FALLBACK_MODEL_NAME: meditationModel,
    AI_MAX_TOKENS: '256',
  };
  const previous = new Map(Object.keys(environment).map(key => [key, process.env[key]]));
  Object.assign(process.env, environment);
  context.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  context.mock.method(globalThis, 'fetch', async () => {
    assert.fail('Model selection regression tests must never make a network request');
  });

  const calls: CreateCall[] = [];
  const activity: string[] = [];
  class FakeOpenAI {
    constructor(private readonly client: ClientOptions) {}
    chat = {
      completions: {
        create: async (params: CreateParams, options: CreateCall['options']) => {
          calls.push({ client: this.client, params, options });
          return (async function* () {
            yield { choices: [{ delta: { content: answer } }] };
            yield { choices: [{ finish_reason: 'stop' }] };
          })();
        },
      },
    };
  }

  const replacements: Record<string, unknown> = {
    '@/lib/userActivity': { scheduleUserActivity: (id: string) => activity.push(id) },
    'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    openai: FakeOpenAI,
    '@/utils/supabase/server': {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: userId, email: '892777353@qq.com' } } }) },
      }),
    },
    '@/utils/supabase/admin': {
      createAdminClient: () => ({
        from: (table: string) => {
          assert.equal(table, 'user_profiles');
          return { select: (columns: string) => {
            assert.equal(columns, 'coins_balance, vip_expires_at');
            return { eq: (key: string, value: string) => {
              assert.equal(key, 'user_id');
              assert.equal(value, userId);
              return { single: async () => ({ data: { coins_balance: 300, vip_expires_at: null } }) };
            } };
          } };
        },
        rpc: () => assert.fail('Administrator model probes must not consume coins'),
      }),
    },
    '@/utils/vip': { isVip: () => false },
    '@/utils/newsRetrieval': { retrieveRelevantNews: () => assert.fail('Unexpected news lookup') },
    '@/lib/baguaPersonality': {
      baguaDimensionLabel: () => assert.fail('Unexpected imported personality data'),
      personalityName: () => assert.fail('Unexpected imported personality data'),
    },
    '@/lib/chatStream': chatStream,
  };
  const code = ts.transpileModule(readFileSync('src/app/api/chat/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports: { POST?: (req: Request) => Promise<Response> } = {};
  new Function('require', 'exports', code)((name: string) => {
    assert.ok(Object.hasOwn(replacements, name), `Unexpected route dependency: ${name}`);
    return replacements[name];
  }, exports);
  assert.ok(exports.POST);

  return {
    calls,
    activity,
    send: (useMeditation: boolean, useReasoning: boolean) => exports.POST!(new Request('https://app.example.test/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: question }], useMeditation, useReasoning, useSearch: false }),
    })),
  };
}

for (const useReasoning of [false, true]) {
  test(`master route migrates the production 4.5 thinking alias to Sonnet 5.5 without up-front thinking with useReasoning=${useReasoning}`, async context => {
    const route = loadRoute(context);
    const response = await route.send(true, useReasoning);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), answer);
    assert.deepEqual(route.activity, [userId]);
    assert.equal(route.calls.length, 1);
    const { client, params, options } = route.calls[0];
    assert.equal(client.baseURL, 'https://meditation.example.test/v1');
    assert.equal(client.apiKey, 'test-meditation-key');
    assert.equal(params.model, 'claude-sonnet-5-5');
    assert.deepEqual(params.thinking, { type: 'between_tools' });
    assert.deepEqual(params.output_config, { effort: 'high' });
    assert.equal(Object.hasOwn(params, 'reasoning_effort'), false);
    for (const field of ['temperature', 'top_p', 'top_k', 'tools']) {
      assert.equal(Object.hasOwn(params, field), false, `Sonnet 5.5 must omit ${field}`);
    }
    assert.equal(params.stream, true);
    assert.deepEqual(params.messages.at(-1), { role: 'user', content: question });
    assert.equal(options.maxRetries, 0);
  });
}

test('master route defaults blank model configuration to Sonnet 5.5 with compatible thinking controls', async context => {
  const route = loadRoute(context, '');
  const response = await route.send(true, false);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), answer);
  assert.equal(route.calls.length, 1);
  const { params } = route.calls[0];
  assert.equal(params.model, 'claude-sonnet-5-5');
  assert.deepEqual(params.thinking, { type: 'between_tools' });
  assert.deepEqual(params.output_config, { effort: 'high' });
  assert.equal(Object.hasOwn(params, 'temperature'), false);
});

test('an explicitly configured Sonnet 4.6 remains a compatible non-thinking fallback', async context => {
  const route = loadRoute(context, 'claude-sonnet-4-6');
  const response = await route.send(true, true);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), answer);
  assert.equal(route.calls.length, 1);
  const { params } = route.calls[0];
  assert.equal(params.model, 'claude-sonnet-4-6');
  assert.deepEqual(params.thinking, { type: 'disabled' });
  for (const field of ['output_config', 'reasoning_effort', 'temperature', 'top_p', 'top_k', 'tools']) {
    assert.equal(Object.hasOwn(params, field), false, `Sonnet 4.6 fallback must omit ${field}`);
  }
});

for (const useReasoning of [false, true]) {
  test(`${useReasoning ? 'deep' : 'ordinary'} route retains its configured DeepSeek model and reasoning setting`, async context => {
    const route = loadRoute(context);
    const response = await route.send(false, useReasoning);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), answer);
    assert.equal(route.calls.length, 1);
    const { client, params } = route.calls[0];
    assert.equal(client.baseURL, 'https://api.deepseek.com');
    assert.equal(client.apiKey, 'test-deepseek-key');
    assert.equal(params.model, useReasoning ? 'deepseek-v4-pro' : 'deepseek-v4-flash');
    assert.equal(params.reasoning_effort, useReasoning ? 'high' : 'none');
    assert.equal(params.temperature, useReasoning ? 1 : 0.8);
    assert.equal(Object.hasOwn(params, 'thinking'), false);
    assert.equal(Object.hasOwn(params, 'output_config'), false);
  });
}
