'use client';

import { chatMessageContent } from '@/lib/messageAttachment';
import { usePhrase } from '@/lib/usePhrase';

/** Caption plus inline picture (or a legacy video already stored on the thread). */
export default function ChatMessageBody({
  body,
  attachmentUrl,
  textStyle,
}: {
  body?: string | null;
  attachmentUrl?: string | null;
  textStyle?: React.CSSProperties;
}) {
  const say = usePhrase();
  const content = chatMessageContent({ body, attachmentUrl });
  if (!content.text && content.media.length === 0) return null;
  return (
    <>
      {content.text ? (
        <div style={{ whiteSpace: 'pre-wrap', ...textStyle }}>{say(content.text)}</div>
      ) : null}
      {content.media.map((item) => (
        item.kind === 'video' ? (
          <video
            key={item.url}
            src={item.url}
            controls
            style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 6, marginTop: content.text ? 6 : 0, display: 'block' }}
          />
        ) : (
          <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer">
            <img
              src={item.url}
              alt={say('Attached image')}
              style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 6, marginTop: content.text ? 6 : 0, display: 'block' }}
            />
          </a>
        )
      ))}
    </>
  );
}
