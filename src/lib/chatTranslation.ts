import { chatMessageContent } from '@/lib/messageAttachment';
import { normalizeLocale, type AppLocale } from '@/lib/locale';

/** Google Cloud Translation API v2. Absent or blank means show the original text. */
export const TRANSLATION_API_KEY_ENV = 'TRANSLATION_API_KEY';

const REQUEST_TIMEOUT_MS = 8000;

export type TranslationMap = Partial<Record<AppLocale, string>>;

export type ProviderOutcome =
  | { ok: false }
  | { ok: true; text: string; detectedSource: AppLocale | null; sameLanguage: boolean };

export type ChatDisplay = {
  displayBody: string;
  originalBody: string;
  sourceLocale: string | null;
  translations: string | null;
  changed: boolean;
};

let missingKeyWarned = false;

function warnMissingKey() {
  if (missingKeyWarned) return;
  missingKeyWarned = true;
  console.warn(
    `[chatTranslation] ${TRANSLATION_API_KEY_ENV} is not set. Chat stays in the original language until that variable is set.`,
  );
}

export function translationApiKey(): string | null {
  const key = process.env[TRANSLATION_API_KEY_ENV];
  if (!key || !key.trim()) return null;
  return key.trim();
}

/** Google returns HTML entities even for format=text. Decode &amp; before the rest. */
export function decodeTranslationText(value: string): string {
  const named = value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  return named
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)));
}

export function parseTranslations(raw: string | null | undefined): TranslationMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const map: TranslationMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'string' || !value) continue;
      const locale = normalizeLocale(key);
      map[locale] = value;
    }
    return map;
  } catch {
    return {};
  }
}

/** Caption only. A legacy `{ t, m }` body keeps the media list out of the translator. */
export function chatCaption(body: string): string {
  return chatMessageContent({ body }).text;
}

export function bodyWithCaption(body: string, caption: string): string {
  if (!body.startsWith('{')) return caption;
  try {
    const parsed = JSON.parse(body) as { t?: unknown; m?: unknown };
    if (parsed && typeof parsed.t === 'string' && Array.isArray(parsed.m)) {
      return JSON.stringify({ ...parsed, t: caption });
    }
  } catch {
    /* plain text that happens to start with a brace */
  }
  return caption;
}

export function resolveStoredDisplay(input: {
  body: string;
  sourceLocale?: string | null;
  translations?: string | null;
  viewerLocale: string;
}): {
  originalBody: string;
  displayBody: string;
  caption: string;
  viewer: AppLocale;
  source: AppLocale | null;
  needsProvider: boolean;
} {
  const viewer = normalizeLocale(input.viewerLocale);
  const source = input.sourceLocale?.trim() ? normalizeLocale(input.sourceLocale) : null;
  const caption = chatCaption(input.body);
  const originalBody = input.body;
  if (!caption.trim() || (source && source === viewer)) {
    return { originalBody, displayBody: originalBody, caption, viewer, source, needsProvider: false };
  }
  const cached = parseTranslations(input.translations)[viewer];
  if (cached) {
    return {
      originalBody,
      displayBody: bodyWithCaption(originalBody, cached),
      caption,
      viewer,
      source,
      needsProvider: false,
    };
  }
  return { originalBody, displayBody: originalBody, caption, viewer, source, needsProvider: true };
}

export function applyProviderResult(input: {
  body: string;
  sourceLocale?: string | null;
  translations?: string | null;
  viewerLocale: string;
  outcome: ProviderOutcome;
}): ChatDisplay {
  const viewer = normalizeLocale(input.viewerLocale);
  const originalBody = input.body;
  const priorSource = input.sourceLocale?.trim() ? normalizeLocale(input.sourceLocale) : null;
  if (!input.outcome.ok) {
    return {
      displayBody: originalBody,
      originalBody,
      sourceLocale: priorSource,
      translations: input.translations ?? null,
      changed: false,
    };
  }
  const detected = input.outcome.detectedSource ?? priorSource;
  const sourceLocale = priorSource ?? detected;
  if (input.outcome.sameLanguage || sourceLocale === viewer) {
    return {
      displayBody: originalBody,
      originalBody,
      sourceLocale,
      translations: input.translations ?? null,
      changed: sourceLocale !== priorSource,
    };
  }
  const map = parseTranslations(input.translations);
  map[viewer] = input.outcome.text;
  return {
    displayBody: bodyWithCaption(originalBody, input.outcome.text),
    originalBody,
    sourceLocale,
    translations: JSON.stringify(map),
    changed: true,
  };
}

export async function translateChatText(
  caption: string,
  viewerLocale: string,
  sourceLocale?: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderOutcome> {
  const target = normalizeLocale(viewerLocale);
  const source = sourceLocale?.trim() ? normalizeLocale(sourceLocale) : null;
  if (!caption.trim() || (source && source === target)) {
    return { ok: true, text: caption, detectedSource: source, sameLanguage: true };
  }
  const key = translationApiKey();
  if (!key) {
    warnMissingKey();
    return { ok: false };
  }
  try {
    const response = await fetchImpl(
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: caption,
          target,
          format: 'text',
          ...(source ? { source } : {}),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      console.warn('[chatTranslation] translation request failed', response.status);
      return { ok: false };
    }
    const payload = await response.json() as {
      data?: { translations?: Array<{ translatedText?: unknown; detectedSourceLanguage?: unknown }> };
    };
    const row = payload?.data?.translations?.[0];
    if (!row || typeof row.translatedText !== 'string') return { ok: false };
    const detected = typeof row.detectedSourceLanguage === 'string' && row.detectedSourceLanguage.trim()
      ? normalizeLocale(row.detectedSourceLanguage)
      : source;
    if (detected === target) {
      return { ok: true, text: caption, detectedSource: detected, sameLanguage: true };
    }
    return {
      ok: true,
      text: decodeTranslationText(row.translatedText),
      detectedSource: detected,
      sameLanguage: false,
    };
  } catch {
    console.warn('[chatTranslation] translation request failed');
    return { ok: false };
  }
}

/** What the viewer should see. The stored body is never replaced. */
export async function resolveChatDisplay(input: {
  body: string;
  sourceLocale?: string | null;
  translations?: string | null;
  viewerLocale: string;
  fetchImpl?: typeof fetch;
}): Promise<ChatDisplay> {
  const decision = resolveStoredDisplay(input);
  if (!decision.needsProvider) {
    return {
      displayBody: decision.displayBody,
      originalBody: decision.originalBody,
      sourceLocale: decision.source,
      translations: input.translations ?? null,
      changed: false,
    };
  }
  const outcome = await translateChatText(
    decision.caption,
    decision.viewer,
    decision.source,
    input.fetchImpl,
  );
  return applyProviderResult({ ...input, viewerLocale: decision.viewer, outcome });
}
