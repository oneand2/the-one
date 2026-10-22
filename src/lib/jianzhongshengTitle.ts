import { moderateCommunityText } from './communityModeration';

export const JIANZHONGSHENG_TITLE_MAX_LENGTH = 24;

export function normalizeJianzhongshengTitle(input: unknown):
  | { ok: true; text: string }
  | { ok: false; message: string } {
  if (input === undefined) return { ok: true, text: '' };
  if (typeof input !== 'string') return { ok: false, message: '标题格式无效' };

  const title = input.trim();
  const tooLong = { ok: false, message: `标题最多 ${JIANZHONGSHENG_TITLE_MAX_LENGTH} 字` } as const;
  if (Array.from(title).length > JIANZHONGSHENG_TITLE_MAX_LENGTH) return tooLong;
  if (!title) return { ok: true, text: '' };

  // Reuse community safeguards, allowing two UTF-16 units per Unicode code point.
  const moderation = moderateCommunityText(title, {
    minLength: 0,
    maxLength: JIANZHONGSHENG_TITLE_MAX_LENGTH * 2,
  });
  if (!moderation.ok) return moderation;
  if (Array.from(moderation.text).length > JIANZHONGSHENG_TITLE_MAX_LENGTH) return tooLong;
  return moderation;
}

export function isMissingJianzhongshengTitleColumn(error: {
  code?: string;
  message?: string;
} | null): boolean {
  return Boolean(error
    && (error.code === '42703' || error.code === 'PGRST204')
    && /\btitle\b/i.test(error.message ?? ''));
}
