'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState } from 'react';
import { FaCheckCircle, FaDesktop, FaLock, FaUnlock } from 'react-icons/fa';

type Step = 'idle' | 'verify' | 'disable';

type SessionRow = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ip?: string;
  agent?: string;
  isCurrent?: boolean;
};

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export default function ShopSecurityPanel({ focus = 'all' }: { focus?: 'all' | 'sessions' | 'twoFactor' }) {
  const say = usePhrase();
  const [enabled, setEnabled] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [fetching, setFetching] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/2fa/status', { headers: authHeaders() })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setEnabled(Boolean(data.enabled));
      })
      .catch(() => {});
    fetch('/api/sessions', { headers: authHeaders() })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setSessions(data.sessions || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSessionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshSessions() {
    const response = await fetch('/api/sessions', { headers: authHeaders() });
    if (!response.ok) return;
    const data = await response.json();
    setSessions(data.sessions || []);
  }

  async function handleSetup() {
    setFetching(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const response = await fetch('/api/auth/2fa/setup', { method: 'POST', headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Setup failed');
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep('verify');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Setup failed');
    } finally {
      setFetching(false);
    }
  }

  async function handleVerify() {
    if (tokenInput.length !== 6) return;
    setFetching(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ token: tokenInput }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Verification failed');
      setEnabled(true);
      setStep('idle');
      setQrCode(null);
      setSecret(null);
      setTokenInput('');
      setStatusMsg('Two-factor authentication is now enabled.');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setFetching(false);
    }
  }

  async function handleDisable() {
    if (tokenInput.length !== 6) return;
    setFetching(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ token: tokenInput }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to disable');
      setEnabled(false);
      setStep('idle');
      setTokenInput('');
      setStatusMsg('Two-factor authentication has been disabled.');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Failed to disable');
    } finally {
      setFetching(false);
    }
  }

  async function revokeSession(id: string) {
    setRevoking(id);
    try {
      await fetch(`/api/sessions?sessionId=${id}`, { method: 'DELETE', headers: authHeaders() });
      await refreshSessions();
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}>
        <FaLock style={{ marginRight: 8 }} />
        {focus === 'sessions' ? say("Sessions") : focus === 'twoFactor' ? say("Two-Factor Auth") : say("Security")}{' '}</h2>
      <p style={{ color: '#9aa3b2', marginBottom: 24, lineHeight: 1.5 }}>
        {focus === 'sessions'
          ? say("Review devices that are signed in to this shop.")
          : focus === 'twoFactor'
            ? say("Turn on an authenticator code for this shop login.")
            : say("Two-factor authentication and session review live here so shop navigation does not open admin-only addresses.")}{' '}</p>

      {(focus === 'all' || focus === 'twoFactor') && (
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ color: enabled ? '#86efac' : '#fca5a5', fontWeight: 700, marginBottom: 12 }}>
          {enabled ? <FaCheckCircle style={{ marginRight: 6 }} /> : null}
          {say("Two-factor authentication is")}{' '}{enabled ? 'on' : 'off'}
        </div>
        {statusMsg && <div style={{ color: '#86efac', marginBottom: 12 }}>{say(statusMsg)}</div>}
        {errorMsg && <div style={{ color: '#fca5a5', marginBottom: 12 }}>{say(errorMsg)}</div>}

        {step === 'verify' && qrCode && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ color: '#e5e7eb', marginBottom: 8 }}>{say("Scan this code, then enter the 6-digit code from your authenticator app.")}</p>
            <img src={qrCode} alt={say("Two-factor QR code")} style={{ width: 160, height: 160, borderRadius: 8, background: '#fff' }} />
            {secret && <p style={{ color: '#9aa3b2', fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{say(secret)}</p>}
            <input
              inputMode="numeric"
              maxLength={6}
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              aria-label={say("Authenticator code")}
              style={{ width: '100%', maxWidth: 220, marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" onClick={handleVerify} disabled={fetching || tokenInput.length !== 6} style={{ padding: '10px 14px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                {say("Activate")}{' '}</button>
              <button type="button" onClick={() => { setStep('idle'); setTokenInput(''); }} style={{ padding: '10px 14px', background: 'transparent', color: '#9aa3b2', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer' }}>
                {say("Cancel")}{' '}</button>
            </div>
          </div>
        )}

        {step === 'disable' && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ color: '#e5e7eb' }}>{say("Enter the current authenticator code to turn two-factor authentication off.")}</p>
            <input
              inputMode="numeric"
              maxLength={6}
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              aria-label={say("Authenticator code to disable")}
              style={{ width: '100%', maxWidth: 220, marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" onClick={handleDisable} disabled={fetching || tokenInput.length !== 6} style={{ padding: '10px 14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                {say("Confirm disable")}{' '}</button>
              <button type="button" onClick={() => { setStep('idle'); setTokenInput(''); }} style={{ padding: '10px 14px', background: 'transparent', color: '#9aa3b2', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer' }}>
                {say("Cancel")}{' '}</button>
            </div>
          </div>
        )}

        {step === 'idle' && !enabled && (
          <button type="button" onClick={handleSetup} disabled={fetching} style={{ padding: '12px 16px', background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
            <FaLock style={{ marginRight: 6 }} />
            {fetching ? say("Generating…") : say("Enable two-factor authentication")}
          </button>
        )}
        {step === 'idle' && enabled && (
          <button type="button" onClick={() => { setStep('disable'); setTokenInput(''); setErrorMsg(null); }} style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
            <FaUnlock style={{ marginRight: 6 }} />
            {say("Disable two-factor authentication")}{' '}</button>
        )}
      </div>
      )}

      {(focus === 'all' || focus === 'sessions') && (
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
        <h3 style={{ margin: '0 0 12px', color: '#e5e7eb', fontSize: 16 }}>
          <FaDesktop style={{ marginRight: 8 }} />
          {say("Active sessions")}{' '}</h3>
        {sessionsLoading ? (
          <p style={{ color: '#9aa3b2' }}>{say("Loading sessions…")}</p>
        ) : sessions.length === 0 ? (
          <p style={{ color: '#9aa3b2' }}>{say("No active sessions found.")}</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {sessions.map((session) => (
              <div key={session.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: 12, borderRadius: 8, background: 'rgba(0,0,0,0.25)' }}>
                <div>
                  <div style={{ color: '#e5e7eb', fontWeight: 600 }}>{session.isCurrent ? say("This device") : (session.agent || say("Active session"))}</div>
                  <div style={{ color: '#9aa3b2', fontSize: 12 }}>
                    {session.ip ? `${session.ip} · ` : ''}
                    {say("Started")}{' '}{new Date(session.createdAt).toLocaleString()}
                  </div>
                </div>
                {!session.isCurrent && (
                  <button type="button" onClick={() => revokeSession(session.id)} disabled={revoking === session.id} style={{ padding: '8px 12px', background: 'transparent', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, cursor: 'pointer' }}>
                    {revoking === session.id ? say("Revoking…") : say("Revoke")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
