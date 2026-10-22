export type JianZhongShengDraft = {
  title: string;
  body: string;
  pending?: boolean;
};

/** Older devices stored only the body at the same localStorage key. */
export function readJianZhongShengDraft(stored: string | null): JianZhongShengDraft {
  if (!stored) return { title: '', body: '' };
  try {
    const value: unknown = JSON.parse(stored);
    if (
      value && typeof value === 'object' &&
      'version' in value && value.version === 1 &&
      'title' in value && typeof value.title === 'string' &&
      'body' in value && typeof value.body === 'string'
    ) {
      return {
        title: value.title.trim(), body: value.body.trim(),
        ...('pending' in value && typeof value.pending === 'boolean' ? { pending: value.pending } : {}),
      };
    }
  } catch {
    // A legacy body is ordinary text, not a serialized draft.
  }
  return { title: '', body: stored.trim() };
}

export function writeJianZhongShengDraft(draft: JianZhongShengDraft): string {
  return JSON.stringify({ version: 1, ...draft, title: draft.title.trim(), body: draft.body.trim() });
}
