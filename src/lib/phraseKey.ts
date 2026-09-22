/** Stable catalog id for an English source string. Dots are removed so next-intl does not treat them as nesting. */
export function phraseKey(text: string): string {
  const key = text
    .normalize('NFKD')
    .replace(/['’]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96);
  return key || 'empty';
}
