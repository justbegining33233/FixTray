"use client";

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState } from 'react';
import { mergeThreadMessages, toThreadMessage, type ThreadMessage } from '@/lib/messageThread';
import { markWorkOrderThreadSeen } from '@/lib/markWorkOrderThreadSeen';
import ChatMessageBody from '@/components/ChatMessageBody';
import { ChatImageAttachButton, PendingChatImage } from '@/components/ChatImageAttach';

const NO_MESSAGES: ThreadMessage[] = [];

export default function CustomerMessaging({
  workOrderId,
  initialMessages = NO_MESSAGES,
  userName: _userName = 'Customer',
  senderRole = 'customer',
}: {
  workOrderId: string;
  initialMessages?: Array<{
    id: string;
    sender: string;
    senderName?: string;
    body: string;
    timestamp?: string | Date;
    createdAt?: string | Date;
    attachmentUrl?: string | null;
    attachmentType?: string | null;
  }>;
  userName?: string;
  senderRole?: 'customer' | 'tech' | 'manager';
}) {
  const say = usePhrase();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [body, setBody] = useState('');
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const incoming = initialMessages
      .map((message) => toThreadMessage(message))
      .filter((message): message is ThreadMessage => Boolean(message));
    if (incoming.length === 0) return;
    setMessages((current) => mergeThreadMessages(current, incoming));
  }, [initialMessages]);

  useEffect(() => {
    if (!workOrderId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const res = await fetch(`/api/workorders/${workOrderId}`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json().catch(() => ({}));
        const rows = Array.isArray(data?.messages) ? data.messages : data?.workOrder?.messages;
        const saved = (Array.isArray(rows) ? rows : [])
          .map((message: { id?: string; sender?: string; senderName?: string; body?: string; createdAt?: string; timestamp?: string; attachmentUrl?: string | null; attachmentType?: string | null }) => toThreadMessage(message))
          .filter((message: ThreadMessage | null): message is ThreadMessage => Boolean(message));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || 'Could not load messages.');
        } else {
          setMessages((current) => mergeThreadMessages(saved, current));
          setError('');
          void markWorkOrderThreadSeen(workOrderId);
        }
      } catch {
        if (!cancelled) setError('Could not load messages.');
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, [workOrderId]);

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    const text = body.trim();
    if ((!text && !pendingUrl) || sending) return;
    setSending(true);
    setError('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`/api/workorders/${workOrderId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ body: text, attachmentUrl: pendingUrl }),
      });
      const data = await res.json().catch(() => ({}));
      const saved = toThreadMessage(data.message || {});
      if (!res.ok || !saved) {
        setError(data.error || 'Message was not saved. Your draft is still here.');
        return;
      }
      setMessages((current) => mergeThreadMessages(current, [saved]));
      setBody('');
      setPendingUrl(null);
    } catch {
      setError('Message was not saved. Your draft is still here.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border rounded p-4" style={{background:'rgba(10,16,32,0.68)',border:'1px solid rgba(255,255,255,0.08)'}}>
      <div className="mb-3">
        <h4 className="font-medium">{say("Messages")}</h4>
      </div>

      <div className="max-h-48 overflow-auto mb-3 space-y-2">
        {!hydrated && messages.length === 0 && <div className="text-sm text-[#64748b]">{say("Loading messages...")}</div>}
        {hydrated && messages.length === 0 && !error && <div className="text-sm text-[#64748b]">{say("No messages yet.")}</div>}
        {messages.map((m) => (
          <div key={m.id} className={`p-2 rounded ${m.sender === 'customer' ? 'bg-[rgba(229,51,42,0.1)]' : 'bg-[rgba(255,255,255,0.05)]'}`}>
            <div className="text-xs text-[#64748b]">{m.senderName ?? m.sender} - {new Date(m.timestamp).toLocaleString()}</div>
            <ChatMessageBody body={m.body} attachmentUrl={m.attachmentUrl} textStyle={{ fontSize: 14, color: '#f1f5f9' }} />
          </div>
        ))}
      </div>

      {pendingUrl && <PendingChatImage url={pendingUrl} onRemove={() => setPendingUrl(null)} />}
      <form onSubmit={sendMessage} className="flex gap-2">
        <ChatImageAttachButton
          disabled={sending}
          onUploaded={(url) => { setPendingUrl(url); setError(''); }}
          onError={(message) => setError(message)}
          style={{ borderRadius: 6 }}
        />
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="flex-1 rounded px-2 py-1"
          style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.14)',color:'#f1f5f9'}}
          placeholder={senderRole === 'customer' ? say("Write a message to the tech/manager...") : say("Write a message to the customer...")}
          disabled={sending}
        />
        <button type="submit" disabled={sending || (!body.trim() && !pendingUrl)} className="text-white px-3 rounded" style={{background:'#e5332a'}}>
          {sending ? say("Sending...") : say("Send")}
        </button>
      </form>
      {error && <div className="text-sm mt-2" style={{color:'#fca5a5'}}>{say(error)}</div>}
    </div>
  );
}
