import type { ReactNode } from 'react';
import { FaCaretDown } from 'react-icons/fa';

/**
 * Send stays a closed disclosure at the top. The inbox is the next block,
 * so a long form does not sit in front of the mail.
 */
export function EmailsLayout({
  sendOpen,
  onToggleSend,
  form,
  inbox,
}: {
  sendOpen: boolean;
  onToggleSend: () => void;
  form: ReactNode;
  inbox: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <button
          type="button"
          aria-expanded={sendOpen}
          aria-controls="send-message-panel"
          onClick={onToggleSend}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: sendOpen ? '12px 12px 0 0' : 12,
            color: '#e5e7eb',
            padding: '14px 16px',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span>Send a message</span>
          <FaCaretDown
            aria-hidden
            style={{ transform: sendOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
          />
        </button>
        {sendOpen ? (
          <div
            id="send-message-panel"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderTop: 0,
              borderRadius: '0 0 12px 12px',
              padding: 16,
            }}
          >
            {form}
          </div>
        ) : null}
      </div>
      {inbox}
    </div>
  );
}
