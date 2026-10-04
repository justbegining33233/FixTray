'use client';

import type { FormEvent } from 'react';
import { replyToReceivedMessage } from '@/lib/platformMailbox';

export type OpenMail = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
};

const fieldStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(0,0,0,0.35)',
  color: '#e5e7eb',
  fontSize: 16,
} as const;

/**
 * The open message is its own screen. The reply control replaces that
 * message with the compose box. Nothing is left expanded under the inbox.
 */
export function MailScreen({
  message,
  loading,
  openError,
  composing,
  replyText,
  replyError,
  sending,
  onClose,
  onReply,
  onReplyText,
  onSend,
}: {
  message: OpenMail | null;
  loading: boolean;
  openError: string;
  composing: boolean;
  replyText: string;
  replyError: string;
  sending: boolean;
  onClose: () => void;
  onReply: () => void;
  onReplyText: (value: string) => void;
  onSend: (event: FormEvent) => void;
}) {
  const draft = message ? replyToReceivedMessage(message) : null;
  const title = composing ? 'Reply' : (message?.subject || (loading ? 'Message' : '(no subject)'));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={composing ? 'Reply' : 'Message'}
      data-mail-screen={composing ? 'compose' : 'read'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        width: '100%',
        background: '#000000',
        color: '#e5e7eb',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexShrink: 0,
          padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 12px 12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <h2 style={{ fontSize: 18, lineHeight: 1.3, margin: 0, overflowWrap: 'anywhere' }}>{title}</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            border: 0,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.08)',
            color: '#e5e7eb',
            fontSize: 22,
            lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </header>

      {composing && draft ? (
        <form
          onSubmit={onSend}
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: '16px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)',
          }}
        >
          <p style={{ margin: 0, color: '#9ca3af', fontSize: 13 }}>
            From {draft.from}
          </p>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: 13 }}>
            To {draft.to}
          </p>
          <p style={{ margin: 0, color: '#e5e7eb', fontSize: 14, fontWeight: 700, overflowWrap: 'anywhere' }}>
            {draft.subject}
          </p>
          <label style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            Message
            <textarea
              aria-label="Reply message"
              required
              value={replyText}
              onChange={(event) => onReplyText(event.target.value)}
              style={{ ...fieldStyle, marginTop: 6, flex: 1, minHeight: 120, resize: 'none' }}
            />
          </label>
          {replyError && <p style={{ color: '#fca5a5', margin: 0 }}>{replyError}</p>}
          <button
            type="submit"
            disabled={sending}
            style={{
              background: '#e5332a',
              color: '#fff',
              border: 0,
              borderRadius: 8,
              padding: '14px 16px',
              fontWeight: 700,
              fontSize: 16,
              cursor: sending ? 'wait' : 'pointer',
            }}
          >
            {sending ? 'Sending...' : 'Send reply'}
          </button>
        </form>
      ) : (
        <>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
            {loading && <p style={{ color: '#9ca3af', margin: 0 }}>Loading mail...</p>}
            {openError && <p style={{ color: '#fca5a5', margin: 0 }}>{openError}</p>}
            {message && (
              <>
                <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 12px', overflowWrap: 'anywhere' }}>
                  From {message.from || 'unknown'} to {message.to.join(', ') || 'unknown'}
                </p>
                <p style={{ color: '#e5e7eb', whiteSpace: 'pre-wrap', margin: 0, overflowWrap: 'anywhere' }}>
                  {message.text || 'This message has no text body.'}
                </p>
              </>
            )}
          </div>
          <div
            style={{
              flexShrink: 0,
              padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              background: '#000000',
            }}
          >
            <button
              type="button"
              aria-label="Reply"
              data-reply-box="1"
              onClick={onReply}
              disabled={!draft}
              style={{
                width: '100%',
                minHeight: 48,
                textAlign: 'left',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                color: '#9ca3af',
                padding: '12px 14px',
                fontSize: 16,
                cursor: draft ? 'pointer' : 'not-allowed',
              }}
            >
              Reply
            </button>
          </div>
        </>
      )}
    </div>
  );
}
