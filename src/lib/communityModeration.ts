export type CommunityContentKind = 'answer' | 'comment';

type ModerationResult =
  | { ok: true; text: string }
  | { ok: false; message: string };

const BLOCKED_PATTERNS: RegExp[] = [
  /(?:约炮|援交|卖淫|嫖娼|招嫖|成人视频|色情直播|裸聊)/i,
  /(?:杀了你|弄死你|砍死你|炸死你|灭你全家|人肉搜索|开盒曝光)/i,
  /(?:操你妈|草你妈|去你妈|死全家|妈的智障|傻逼东西)/i,
  /(?:自杀教程|如何自杀|自杀方法|割腕方法|轻生教程)/i,
  /(?:纳粹万岁|种族清洗|仇恨(?:少数民族|同性恋|残障人士))/i,
  /(?:代开发票|刷单返利|博彩平台|赌场代理|出售账号|低价代充)/i,
];

const CONTACT_SPAM = /(?:加|联系|私聊|咨询).{0,8}(?:微信|vx|v信|qq|电报|telegram).{0,12}[a-z0-9_-]{5,}/i;
const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/gi;
const LONG_CONTACT_NUMBER = /\b(?:1\d{10}|[1-9]\d{7,11})\b/g;
const EXCESSIVE_REPEAT = /(.)\1{11,}/u;

export function moderateCommunityText(
  input: unknown,
  { minLength, maxLength }: { minLength: number; maxLength: number },
): ModerationResult {
  if (typeof input !== 'string') {
    return { ok: false, message: '内容格式无效' };
  }

  const text = input
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim();

  if (text.length < minLength || text.length > maxLength) {
    return { ok: false, message: `内容需要在 ${minLength}—${maxLength} 字之间` };
  }
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(text))) {
    return { ok: false, message: '内容包含不适合公开发布的信息，请修改后再试' };
  }
  if (CONTACT_SPAM.test(text)) {
    return { ok: false, message: '请勿发布引流或私下联系方式' };
  }
  if ((text.match(URL_PATTERN) ?? []).length > 1 || (text.match(LONG_CONTACT_NUMBER) ?? []).length > 1) {
    return { ok: false, message: '内容包含过多链接或联系方式，请精简后再试' };
  }
  if (EXCESSIVE_REPEAT.test(text)) {
    return { ok: false, message: '内容包含大量重复字符，请修改后再试' };
  }

  return { ok: true, text };
}

export function isCommunityUUID(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
