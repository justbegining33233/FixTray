/**
 * Catalog index keys were captured from source text, so a newline is the two
 * characters "\" and "n". At runtime the same sentence has a real newline.
 * Try the escaped form when the live string does not hit the index.
 */
export function phraseIndexKey(text: string, index: Record<string, string>): string | undefined {
  const direct = index[text];
  if (direct) return direct;
  if (!text.includes('\n')) return undefined;
  return index[text.replaceAll('\n', '\\n')];
}

/** Turn a stored backslash-n back into the line break the UI string uses. */
export function presentPhrase(source: string, translated: string): string {
  if (!source.includes('\n') || !translated.includes('\\n')) return translated;
  return translated.replaceAll('\\n', '\n');
}

/** Browser tab title. The work-order half comes from the active catalog. */
export function appDocumentTitle(workOrderManagement: string): string {
  return `FixTray - ${workOrderManagement}`;
}

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
