/** Picture attached to a customer↔shop chat line. */

export const CHAT_IMAGE_TYPE = 'image';
const MAX_BODY = 5000;
const MAX_IMAGES = 6;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|avi)$/i;

export type ChatMedia = { url: string; kind: 'image' | 'video' };

export type ResolvedChatAttachment = {
  body: string;
  attachmentUrl: string | null;
  attachmentType: typeof CHAT_IMAGE_TYPE | null;
};

/** HTTPS Cloudinary URL, matching the work-order photos route. */
export function isCloudinaryHttpsUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'cloudinary.com' || host.endsWith('.cloudinary.com');
  } catch {
    return false;
  }
}

/** JPEG/PNG/WEBP/GIF hosted on Cloudinary (or an /image/upload path). */
export function isChatImageUrl(raw: string): boolean {
  if (!isCloudinaryHttpsUrl(raw)) return false;
  try {
    const path = new URL(raw).pathname.toLowerCase();
    if (path.includes('/video/') || path.includes('/raw/')) return false;
    return IMAGE_EXT.test(path) || path.includes('/image/');
  } catch {
    return false;
  }
}

function legacyMediaKind(url: string): ChatMedia['kind'] | null {
  if (!isCloudinaryHttpsUrl(url)) return null;
  try {
    const path = new URL(url).pathname;
    if (VIDEO_EXT.test(path) || path.toLowerCase().includes('/video/')) return 'video';
  } catch {
    return null;
  }
  return isChatImageUrl(url) ? 'image' : null;
}

/**
 * Caption plus inline media.
 * New rows use attachmentUrl. Older shop sends stored `{ t, m }` in the body.
 */
export function chatMessageContent(message: {
  body?: string | null;
  attachmentUrl?: string | null;
}): { text: string; media: ChatMedia[] } {
  const media: ChatMedia[] = [];
  const seen = new Set<string>();
  const add = (url: string, kind: ChatMedia['kind']) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    media.push({ url, kind });
  };

  if (typeof message.attachmentUrl === 'string' && isChatImageUrl(message.attachmentUrl)) {
    add(message.attachmentUrl, 'image');
  }

  const body = typeof message.body === 'string' ? message.body : '';
  if (body.startsWith('{')) {
    try {
      const parsed = JSON.parse(body) as { t?: unknown; m?: unknown };
      if (parsed && typeof parsed.t === 'string' && Array.isArray(parsed.m)) {
        for (const item of parsed.m) {
          if (typeof item !== 'string') continue;
          const kind = legacyMediaKind(item);
          if (kind) add(item, kind);
        }
        return { text: parsed.t, media };
      }
    } catch {
      /* plain text */
    }
  }

  return { text: body, media };
}

/** Inbox row preview. Image-only lines read as "Photo" instead of a raw URL or JSON blob. */
export function messageListPreview(body?: string | null, attachmentUrl?: string | null): string {
  const content = chatMessageContent({ body, attachmentUrl });
  const text = content.text.trim();
  if (text) return text;
  if (content.media.length > 0) return 'Photo';
  return '';
}

function pushImage(urls: string[], value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !value.trim()) return 'Invalid attachment';
  const url = value.trim();
  if (!isChatImageUrl(url)) return 'Only HTTPS Cloudinary image URLs are allowed';
  if (!urls.includes(url)) urls.push(url);
  if (urls.length > MAX_IMAGES) return `You can attach up to ${MAX_IMAGES} images`;
  return null;
}

/**
 * Turn a send payload into the columns we store.
 * A single picture keeps the caption in `body`. Several pictures also keep the
 * `{ t, m }` body the shop work-order thread already knows how to draw.
 */
export function resolveChatAttachment(input: {
  body?: unknown;
  attachmentUrl?: unknown;
  attachmentUrls?: unknown;
}): { ok: true; value: ResolvedChatAttachment } | { ok: false; error: string } {
  const rawBody = typeof input.body === 'string' ? input.body.trim() : '';
  if (rawBody.length > MAX_BODY) {
    return { ok: false, error: 'Message exceeds 5000 characters' };
  }

  const urls: string[] = [];
  if (Array.isArray(input.attachmentUrls)) {
    for (const item of input.attachmentUrls) {
      const error = pushImage(urls, item);
      if (error) return { ok: false, error };
    }
  } else if (input.attachmentUrls != null) {
    return { ok: false, error: 'Invalid attachment' };
  }

  const singleError = pushImage(urls, input.attachmentUrl);
  if (singleError) return { ok: false, error: singleError };

  let caption = rawBody;
  let legacyVideos: string[] = [];
  if (rawBody.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawBody) as { t?: unknown; m?: unknown };
      if (parsed && typeof parsed.t === 'string' && Array.isArray(parsed.m)) {
        caption = parsed.t.trim();
        if (caption.length > MAX_BODY) {
          return { ok: false, error: 'Message exceeds 5000 characters' };
        }
        for (const item of parsed.m) {
          if (typeof item !== 'string' || !item.trim()) {
            return { ok: false, error: 'Only HTTPS Cloudinary image URLs are allowed' };
          }
          const url = item.trim();
          const kind = legacyMediaKind(url);
          if (!kind) return { ok: false, error: 'Only HTTPS Cloudinary image URLs are allowed' };
          if (kind === 'video') {
            if (!legacyVideos.includes(url)) legacyVideos.push(url);
          } else {
            const error = pushImage(urls, url);
            if (error) return { ok: false, error };
          }
        }
      }
    } catch {
      legacyVideos = [];
    }
  }

  if (!caption && urls.length === 0 && legacyVideos.length === 0) {
    return { ok: false, error: 'Message body is required' };
  }

  const attachmentUrl = urls[0] ?? null;
  const attachmentType = attachmentUrl ? CHAT_IMAGE_TYPE : null;

  if (urls.length > 1 || legacyVideos.length > 0) {
    return {
      ok: true,
      value: {
        body: JSON.stringify({ t: caption, m: [...urls, ...legacyVideos] }),
        attachmentUrl,
        attachmentType,
      },
    };
  }

  return {
    ok: true,
    value: {
      body: caption,
      attachmentUrl,
      attachmentType,
    },
  };
}
