'use client';

export type SupportInboxRow = {
  id: string;
  from: string;
  subject: string;
};

const EMPTY_INBOX = 'No mail in the support@fixtray.app inbox.';

/**
 * Rows render whenever the list has them.
 * The empty sentence appears only after a successful load with nothing to show.
 * A failed load keeps its own message, including when a later refresh fails.
 */
export function SupportInboxList({
  emails,
  loaded,
  error,
  selectedId,
  onOpen,
}: {
  emails: SupportInboxRow[];
  loaded: boolean;
  error: string;
  selectedId: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <>
      {!loaded && !error && <p style={{ color: '#9ca3af' }}>Loading mail...</p>}
      {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
      {loaded && !error && emails.length === 0 && (
        <p style={{ color: '#9ca3af' }}>{EMPTY_INBOX}</p>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {emails.map((email) => (
          <li key={email.id}>
            <button
              type="button"
              onClick={() => onOpen(email.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: selectedId === email.id ? 'rgba(229,51,42,0.18)' : 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                color: '#e5e7eb',
                padding: 12,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 700 }}>{email.subject || '(no subject)'}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                From {email.from || 'unknown'}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
