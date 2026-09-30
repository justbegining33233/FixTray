'use client';

import { chatMessageContent } from '@/lib/messageAttachment';
import { usePhrase } from '@/lib/usePhrase';

/** Caption plus inline picture (or a legacy video already stored on the thread). */
export default function ChatMessageBody({
  body,
  displayBody,
  attachmentUrl,
  textStyle,
}: {
  body?: string | null;
  /** Receiver-language caption. Free-typed chat is never passed through say(). */
  displayBody?: string | null;
  attachmentUrl?: string | null;
  textStyle?: React.CSSProperties;
}) {
  const say = usePhrase();
  const stored = chatMessageContent({ body, attachmentUrl });
  const shown = displayBody && displayBody !== body
    ? chatMessageContent({ body: displayBody, attachmentUrl })
    : stored;
  const text = shown.text;
  const media = stored.media.length > 0 ? stored.media : shown.media;
  if (!text && media.length === 0) return null;
  return (
    <>
      {text ? (
        <div style={{ whiteSpace: 'pre-wrap', ...textStyle }}>{text}</div>
      ) : null}
      {media.map((item) => (
        item.kind === 'video' ? (
          <video
            key={item.url}
            src={item.url}
            controls
            style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 6, marginTop: text ? 6 : 0, display: 'block' }}
          />
        ) : (
          <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer">
            <img
              src={item.url}
              alt={say('Attached image')}
              style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 6, marginTop: text ? 6 : 0, display: 'block' }}
            />
          </a>
        )
      ))}
    </>
  );
}
