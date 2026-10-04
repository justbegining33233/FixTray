'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { FaEnvelope } from 'react-icons/fa';
import Sidebar from '@/components/Sidebar';
import TopNavBar from '@/components/TopNavBar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { EmailsLayout } from '@/app/admin/emails/EmailsLayout';
import { SupportInboxList } from '@/app/admin/emails/SupportInboxList';
import { PLATFORM_FROM_CHOICES, isPlatformEmailAccount } from '@/lib/platformEmailAccess';
import { useSessionUsername } from '@/lib/useSessionUsername';

type MailRow = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  createdAt: string;
  lastEvent: string;
};

type MailDetail = MailRow & { text: string };

const fieldStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(0,0,0,0.35)',
  color: '#e5e7eb',
  fontSize: 14,
} as const;

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function PlatformEmailsPage() {
  const router = useRouter();
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const session = useSessionUsername();
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [emails, setEmails] = useState<MailRow[]>([]);
  const [selected, setSelected] = useState<MailDetail | null>(null);
  const [listError, setListError] = useState('');
  const [listLoaded, setListLoaded] = useState(false);
  const [from, setFrom] = useState<string>(PLATFORM_FROM_CHOICES[0].from);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [sendError, setSendError] = useState('');
  const [sendNotice, setSendNotice] = useState('');
  const [sending, setSending] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const requestId = useRef<string | null>(null);
  const allowed = isPlatformEmailAccount(session.username);

  useEffect(() => {
    if (isLoading || !session.ready) return;
    setReady(true);
  }, [isLoading, session.ready, session.username]);

  useEffect(() => {
    if (!ready || isLoading || !user) return;
    if (!allowed) router.replace('/admin/home' as Route);
  }, [ready, isLoading, user, allowed, router]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    const load = () => {
      fetch('/api/admin/emails', { cache: 'no-store', credentials: 'include', headers: authHeaders() })
        .then(async (response) => {
          const body = await response.json().catch(() => null);
          if (!response.ok) {
            const message = body && typeof body.error === 'string' ? body.error : 'The support inbox could not be loaded.';
            throw new Error(message);
          }
          if (!body || !Array.isArray(body.emails)) {
            throw new Error('The support inbox could not be loaded.');
          }
          return body.emails as MailRow[];
        })
        .then((rows) => {
          if (cancelled) return;
          setEmails(rows);
          setListError('');
          setListLoaded(true);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          const serverMessage = error instanceof Error && !(error instanceof TypeError) ? error.message : '';
          setListError(serverMessage || 'The support inbox could not be loaded.');
        });
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [allowed]);

  const openMail = (id: string) => {
    setSelected(null);
    fetch(`/api/admin/emails/${encodeURIComponent(id)}`, { cache: 'no-store', credentials: 'include', headers: authHeaders() })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Could not open that message');
        return body.email as MailDetail;
      })
      .then((email) => setSelected(email))
      .catch((error: unknown) => setListError(error instanceof Error ? error.message : 'Could not open that message'));
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!requestId.current) requestId.current = crypto.randomUUID();
    setSending(true);
    setSendError('');
    setSendNotice('');
    try {
      const response = await fetch('/api/admin/emails', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({ from, to, subject, text, requestId: requestId.current }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Could not send the message');
      requestId.current = null;
      setTo('');
      setSubject('');
      setText('');
      setSendNotice('Message sent.');
      const refresh = await fetch('/api/admin/emails', { cache: 'no-store', credentials: 'include', headers: authHeaders() });
      const listed = await refresh.json().catch(() => null);
      if (refresh.ok && listed && Array.isArray(listed.emails)) {
        setEmails(listed.emails);
        setListError('');
        setListLoaded(true);
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Could not send the message');
    } finally {
      setSending(false);
    }
  };

  if (isLoading || !ready || !user || !allowed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="admin" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
        <main style={{ flex: 1, padding: 24, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: '0 0 8px' }}>
            <FaEnvelope style={{ marginRight: 10 }} aria-hidden />
            Emails
          </h1>
          <p style={{ color: '#9ca3af', margin: '0 0 24px', fontSize: 14 }}>
            Inbox for support@fixtray.app, and a message you can send from that address. New mail appears here after it arrives.
          </p>

          <EmailsLayout
            sendOpen={sendOpen}
            onToggleSend={() => setSendOpen((open) => !open)}
            form={(
              <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>
                  From
                  <select aria-label="From" value={from} onChange={(event) => setFrom(event.target.value)} style={{ ...fieldStyle, marginTop: 6 }}>
                    {PLATFORM_FROM_CHOICES.map((choice) => (
                      <option key={choice.address} value={choice.from}>{choice.from}</option>
                    ))}
                  </select>
                </label>
                <label style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>
                  To
                  <input aria-label="To" type="email" required value={to} onChange={(event) => setTo(event.target.value)} style={{ ...fieldStyle, marginTop: 6 }} />
                </label>
                <label style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>
                  Subject
                  <input aria-label="Subject" required value={subject} onChange={(event) => setSubject(event.target.value)} style={{ ...fieldStyle, marginTop: 6 }} />
                </label>
                <label style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>
                  Message
                  <textarea aria-label="Message" required value={text} onChange={(event) => setText(event.target.value)} rows={8} style={{ ...fieldStyle, marginTop: 6, resize: 'vertical' }} />
                </label>
                {sendError && <p style={{ color: '#fca5a5', margin: 0 }}>{sendError}</p>}
                {sendNotice && <p style={{ color: '#86efac', margin: 0 }}>{sendNotice}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  style={{
                    background: '#e5332a',
                    color: '#fff',
                    border: 0,
                    borderRadius: 8,
                    padding: '12px 16px',
                    fontWeight: 700,
                    cursor: sending ? 'wait' : 'pointer',
                  }}
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </form>
            )}
            inbox={(
            <section style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
              <h2 style={{ fontSize: 16, color: '#e5e7eb', margin: '0 0 12px' }}>Inbox</h2>
              <SupportInboxList
                emails={emails}
                loaded={listLoaded}
                error={listError}
                selectedId={selected?.id ?? null}
                onOpen={openMail}
              />
              {selected && (
                <article style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <h3 style={{ color: '#e5e7eb', fontSize: 16, margin: '0 0 8px' }}>{selected.subject || '(no subject)'}</h3>
                  <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 8px' }}>
                    From {selected.from || 'FixTray'} to {selected.to.join(', ') || 'unknown'}
                  </p>
                  <p style={{ color: '#e5e7eb', whiteSpace: 'pre-wrap', margin: 0 }}>{selected.text || 'This message has no text body.'}</p>
                </article>
              )}
            </section>
            )}
          />
        </main>
      </div>
    </div>
  );
}
