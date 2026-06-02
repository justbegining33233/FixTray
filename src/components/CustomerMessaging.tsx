"use client";

import { useState } from 'react';
import { Message } from '@/types/workorder';

export default function CustomerMessaging({
  workOrderId,
  initialMessages = [],
  userName = 'Customer',
  senderRole = 'customer',
}: {
  workOrderId: string;
  initialMessages?: Message[];
  userName?: string;
  senderRole?: 'customer' | 'tech' | 'manager';
}) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  );
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    const newMsg: Message = {
      id: Date.now().toString(),
      sender: senderRole,
      senderName: userName,
      body: body.trim(),
      timestamp: new Date(),
    };

    // Optimistic UI
    setMessages((prev) => {
      const next = [...prev, newMsg];
      // send the updated array to the server
        (async () => {
          try {
            const role = typeof window !== 'undefined' ? (localStorage.getItem('userRole') || 'customer') : 'customer';
            const csrf = typeof document !== 'undefined' ? document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('csrf_token='))?.split('=')[1] : null;
            await fetch(`/api/workorders/${workOrderId}`, {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json', 'x-user-role': role, 'x-csrf-token': csrf || '' },
              body: JSON.stringify({ messages: next }),
            });
          } catch (err) {
            console.error('Failed to send message', err);
          }
        })();
      return next;
    });
    setBody('');

    try {
      // no-op here; sending is performed optimistically above
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border rounded p-4" style={{background:'rgba(10,16,32,0.68)',border:'1px solid rgba(255,255,255,0.08)'}}>
      <div className="mb-3">
        <h4 className="font-medium">Messages</h4>
      </div>

      <div className="max-h-48 overflow-auto mb-3 space-y-2">
        {messages.length === 0 && <div className="text-sm text-[#64748b]">No messages yet.</div>}
        {messages.map((m) => (
          <div key={m.id} className={`p-2 rounded ${m.sender === 'customer' ? 'bg-[rgba(229,51,42,0.1)]' : 'bg-[rgba(255,255,255,0.05)]'}`}>
            <div className="text-xs text-[#64748b]">{m.senderName ?? m.sender} - {new Date(m.timestamp).toLocaleString()}</div>
            <div className="text-sm text-[#f1f5f9]">{m.body}</div>
          </div>
        ))}
      </div>

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="flex-1 rounded px-2 py-1"
          style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.14)',color:'#f1f5f9'}}
          placeholder={senderRole === 'customer' ? 'Write a message to the tech/manager...' : 'Write a message to the customer...'}
        />
        <button type="submit" disabled={sending} className="text-white px-3 rounded" style={{background:'#e5332a'}}>
          Send
        </button>
      </form>
    </div>
  );
}
