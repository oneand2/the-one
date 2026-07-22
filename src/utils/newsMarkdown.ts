/** Remove the lightweight Markdown wrappers accepted by the news editor. */
export function stripNewsHeading(value: string): string {
  return value
    .trim()
    .replace(/^#{1,3}\s+/, '')
    .replace(/^\*\*(.+)\*\*$/, '$1')
    .trim();
}

/** True when the whole line is a Markdown bold span, e.g. **标题**. */
export function isBoldNewsHeading(value: string): boolean {
  return /^\*\*\S(?:.*\S)?\*\*$/.test(value.trim());
}

/** Find whether the next non-empty line is also a bold heading. */
export function nextNonEmptyLineIsBold(lines: string[], index: number): boolean {
  for (let i = index + 1; i < lines.length; i++) {
    if (lines[i].trim()) return isBoldNewsHeading(lines[i]);
  }
  return false;
}

/** Return the next non-empty line, without changing its formatting. */
export function getNextNonEmptyLine(lines: string[], index: number): string | null {
  for (let i = index + 1; i < lines.length; i++) {
    const value = lines[i].trim();
    if (value) return value;
  }
  return null;
}

/** News body paragraphs in this editor normally start with a full publication date. */
export function looksLikeDatedNewsBody(value: string | null): boolean {
  if (!value) return false;
  return /^(?:19|20)\d{2}\s*[年./-]\s*\d{1,2}\s*[月./-]\s*\d{1,2}\s*日?/.test(stripNewsHeading(value));
}
