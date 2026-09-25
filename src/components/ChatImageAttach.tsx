'use client';

import { useRef, useState } from 'react';
import { FaPaperclip, FaTimes } from 'react-icons/fa';
import { isChatImageUrl } from '@/lib/messageAttachment';
import { usePhrase } from '@/lib/usePhrase';
import { uploadChatImage } from '@/lib/uploadChatImage';
import { captureNativePhotoFile } from '@/lib/nativePhoto';

export function PendingChatImage({ url, onRemove }: { url: string; onRemove: () => void }) {
  const say = usePhrase();
  if (!isChatImageUrl(url)) return null;
  return (
    <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
      <img src={url} alt={say('Selected image')} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6 }} />
      <button
        type="button"
        aria-label={say('Remove image')}
        onClick={onRemove}
        style={{ position: 'absolute', top: -6, right: -6, background: '#e5332a', border: 'none', borderRadius: '50%', width: 18, height: 18, color: '#fff', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
      >
        <FaTimes />
      </button>
    </div>
  );
}

/** Paperclip that uploads a JPEG/PNG/WEBP/GIF and leaves the text draft alone on failure. */
export function ChatImageAttachButton({
  onUploaded,
  onError,
  disabled,
  style,
}: {
  onUploaded: (url: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const say = usePhrase();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file || uploading) return;
          setUploading(true);
          const result = await uploadChatImage(file);
          setUploading(false);
          if ('error' in result) onError(result.error);
          else onUploaded(result.url);
        }}
      />
      <button
        type="button"
        aria-label={say('Attach image')}
        title={say('Attach image')}
        disabled={disabled || uploading}
        onClick={async () => {
          if (disabled || uploading) return;
          try {
            const nativeFile = await captureNativePhotoFile();
            if (nativeFile) {
              setUploading(true);
              const result = await uploadChatImage(nativeFile);
              setUploading(false);
              if ('error' in result) onError(result.error);
              else onUploaded(result.url);
              return;
            }
          } catch {
            // Camera cancelled or unavailable — fall back to the file picker.
          }
          inputRef.current?.click();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 38,
          flexShrink: 0,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8,
          color: uploading ? '#f59e0b' : '#9aa3b2',
          cursor: disabled || uploading ? 'not-allowed' : 'pointer',
          fontSize: 15,
          ...style,
        }}
      >
        {uploading ? '…' : <FaPaperclip />}
      </button>
    </>
  );
}
