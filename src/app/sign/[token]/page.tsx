'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import SignatureCapture from '@/components/SignatureCapture';

interface SignJob {
  workOrderId: string;
  status: string;
  shopName: string;
  vehicle: string;
  services: string[];
  estimateUsd: number | null;
  needsDecision: boolean;
}

export default function CounterSignPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token || '';
  const [job, setJob] = useState<SignJob | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/sign/${token}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(body.error || 'This signature link is not valid.');
          return;
        }
        setJob(body);
      })
      .catch(() => setError('This signature link is not valid.'));
  }, [token]);

  async function decide(response: 'accepted' | 'denied') {
    setError('');
    setBusy(true);
    try {
      const result = await fetch(`/api/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response, signerName: name, signatureData: signature }),
      });
      const body = await result.json().catch(() => ({}));
      if (!result.ok) {
        setError(body.error || 'Could not save the signature.');
        return;
      }
      setDone(response === 'accepted'
        ? 'Accepted and signed. The shop can continue to invoice and payment.'
        : 'Denied. No work authorization was created.');
    } catch {
      setError('Could not save the signature.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>Sign this estimate</h1>
        <p>Walk-in customers can accept or deny and sign on this device. No customer login is required.</p>
        {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
        {done && <p style={{ color: '#86efac' }}>{done}</p>}
        {job && !done && (
          <>
            <p>{job.shopName}</p>
            <p>Vehicle: {job.vehicle}</p>
            <p>Services: {job.services.length ? job.services.join(', ') : 'See the shop for the service list'}</p>
            <p>Estimate: {job.estimateUsd == null ? 'Pending' : `$${job.estimateUsd.toFixed(2)}`}</p>
            {job.needsDecision ? (
              <>
                <label style={{ display: 'block', margin: '12px 0' }}>
                  Your name
                  <input value={name} onChange={(event) => setName(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 6, padding: 8 }} />
                </label>
                <SignatureCapture tone="dark" onChange={setSignature} />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="button" disabled={busy} onClick={() => decide('accepted')}>Accept and sign</button>
                  <button type="button" disabled={busy} onClick={() => decide('denied')}>Deny</button>
                </div>
              </>
            ) : (
              <p>This estimate is no longer waiting for a signature.</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
