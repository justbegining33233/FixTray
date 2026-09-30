import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  resolveChatDisplay,
  TRANSLATION_API_KEY_ENV,
} from '../src/lib/chatTranslation';

const ORIGINAL_KEY = process.env[TRANSLATION_API_KEY_ENV];

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env[TRANSLATION_API_KEY_ENV];
  else process.env[TRANSLATION_API_KEY_ENV] = ORIGINAL_KEY;
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('chat translation', () => {
  it('shows the original when the sender and reader use the same language', async () => {
    process.env[TRANSLATION_API_KEY_ENV] = 'test-key';
    const fetchImpl = jest.fn<typeof fetch>();
    const shown = await resolveChatDisplay({
      body: 'The brakes are ready',
      sourceLocale: 'en',
      translations: null,
      viewerLocale: 'en',
      fetchImpl,
    });
    expect(shown.displayBody).toBe('The brakes are ready');
    expect(shown.originalBody).toBe('The brakes are ready');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(shown.changed).toBe(false);
  });

  it('uses a stored translation and leaves the original body alone', async () => {
    process.env[TRANSLATION_API_KEY_ENV] = 'test-key';
    const fetchImpl = jest.fn<typeof fetch>();
    const shown = await resolveChatDisplay({
      body: 'Los frenos están listos',
      sourceLocale: 'es',
      translations: JSON.stringify({ en: 'The brakes are ready' }),
      viewerLocale: 'en',
      fetchImpl,
    });
    expect(shown.displayBody).toBe('The brakes are ready');
    expect(shown.originalBody).toBe('Los frenos están listos');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('shows the original when the provider key is missing and does not call the network', async () => {
    delete process.env[TRANSLATION_API_KEY_ENV];
    const fetchImpl = jest.fn<typeof fetch>();
    const shown = await resolveChatDisplay({
      body: 'Los frenos están listos',
      sourceLocale: 'es',
      translations: null,
      viewerLocale: 'en',
      fetchImpl,
    });
    expect(shown.displayBody).toBe('Los frenos están listos');
    expect(shown.originalBody).toBe('Los frenos están listos');
    expect(shown.changed).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('shows the original when the provider request fails', async () => {
    process.env[TRANSLATION_API_KEY_ENV] = 'test-key';
    const fetchImpl = jest.fn<typeof fetch>(async () => jsonResponse({ error: 'nope' }, 500));
    const shown = await resolveChatDisplay({
      body: 'Los frenos están listos',
      sourceLocale: 'es',
      translations: null,
      viewerLocale: 'en',
      fetchImpl,
    });
    expect(shown.displayBody).toBe('Los frenos están listos');
    expect(shown.changed).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('shows the original when detection says the text is already in the reader language', async () => {
    process.env[TRANSLATION_API_KEY_ENV] = 'test-key';
    const fetchImpl = jest.fn<typeof fetch>(async () => jsonResponse({
      data: { translations: [{ translatedText: 'Hello there', detectedSourceLanguage: 'en' }] },
    }));
    const shown = await resolveChatDisplay({
      body: 'Hello there',
      sourceLocale: null,
      translations: null,
      viewerLocale: 'en',
      fetchImpl,
    });
    expect(shown.displayBody).toBe('Hello there');
    expect(shown.originalBody).toBe('Hello there');
    expect(shown.sourceLocale).toBe('en');
    expect(shown.translations).toBeNull();
    expect(shown.changed).toBe(true);
  });

  it('translates only the caption inside a legacy attachment body', async () => {
    process.env[TRANSLATION_API_KEY_ENV] = 'test-key';
    const media = 'https://res.cloudinary.com/demo/image/upload/v1/brake.jpg';
    const body = JSON.stringify({ t: 'Necesito frenos', m: [media] });
    const fetchImpl = jest.fn<typeof fetch>(async (_url, init) => {
      const sent = JSON.parse(String(init?.body));
      expect(sent.q).toBe('Necesito frenos');
      expect(sent.format).toBe('text');
      expect(sent.source).toBe('es');
      expect(sent.target).toBe('en');
      expect(sent.q).not.toContain(media);
      return jsonResponse({
        data: { translations: [{ translatedText: 'I need brakes', detectedSourceLanguage: 'es' }] },
      });
    });
    const shown = await resolveChatDisplay({
      body,
      sourceLocale: 'es',
      translations: null,
      viewerLocale: 'en',
      fetchImpl,
    });
    const displayed = JSON.parse(shown.displayBody) as { t: string; m: string[] };
    expect(displayed.t).toBe('I need brakes');
    expect(displayed.m).toEqual([media]);
    expect(shown.originalBody).toBe(body);
    expect(JSON.parse(shown.translations || '{}')).toEqual({ en: 'I need brakes' });
    const called = String(fetchImpl.mock.calls[0]?.[0]);
    expect(called.startsWith('https://translation.googleapis.com/language/translate/v2?key=')).toBe(true);
  });

  it('decodes HTML entities from the provider and keeps the original', async () => {
    process.env[TRANSLATION_API_KEY_ENV] = 'test-key';
    const fetchImpl = jest.fn<typeof fetch>(async () => jsonResponse({
      data: { translations: [{ translatedText: 'Tom &amp; Jerry&#39;s', detectedSourceLanguage: 'es' }] },
    }));
    const shown = await resolveChatDisplay({
      body: 'Tom y Jerry',
      sourceLocale: 'es',
      translations: null,
      viewerLocale: 'en',
      fetchImpl,
    });
    expect(shown.displayBody).toBe("Tom & Jerry's");
    expect(shown.originalBody).toBe('Tom y Jerry');
  });
});
