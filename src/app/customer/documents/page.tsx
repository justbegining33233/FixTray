'use client';
import { usePhrase } from '@/lib/usePhrase';
export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaFileAlt } from 'react-icons/fa';

type CustomerDocument = {
  id: string;
  type: string;
  name: string;
  url: string;
  fileSize?: number;
  uploadedAt?: string;
};

export default function Documents() {
  const say = usePhrase();
  useRequireAuth(['customer']);
  const fileRef = useRef<HTMLInputElement>(null);
  const [userName, setUserName] = useState('');
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('other');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUserName(localStorage.getItem('userName') || '');
    const token = localStorage.getItem('token');
    fetch('/api/customers/documents', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Could not load documents.');
        setDocuments(Array.isArray(body.documents) ? body.documents : []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load documents.'));
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    window.location.href = '/auth/login';
  };

  const upload = async () => {
    setNotice('');
    setError('');
    if (!file) {
      setError('Choose a file first.');
      fileRef.current?.click();
      return;
    }
    setBusy(true);
    const token = localStorage.getItem('token');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('folder', 'customer-documents');
      const uploaded = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const uploadedBody = await uploaded.json().catch(() => ({}));
      if (!uploaded.ok || typeof uploadedBody.url !== 'string') {
        setError(uploadedBody.error || 'The file was not uploaded.');
        return;
      }
      const saved = await fetch('/api/customers/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: file.name,
          type: docType,
          url: uploadedBody.url,
          fileSize: file.size,
        }),
      });
      const savedBody = await saved.json().catch(() => ({}));
      if (!saved.ok) {
        setError(savedBody.error || 'The file uploaded, but it was not saved to your documents.');
        return;
      }
      setDocuments((current) => [savedBody, ...current]);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setNotice(`${file.name} was uploaded.`);
    } catch {
      setError('Upload did not finish. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <div data-desktop-chrome style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link href="/customer/dashboard" style={{ fontSize: 24, fontWeight: 900, color: '#e5332a', textDecoration: 'none' }}>{say('FixTray')}</Link>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb' }}>{say('Customer Portal')}</div>
            <div style={{ fontSize: 12, color: '#9aa3b2' }}>{say('Documents')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 14, color: '#9aa3b2' }}>{say('Welcome,')} {say(userName)}</span>
          <button type="button" onClick={handleSignOut} style={{ padding: '8px 16px', background: '#e5332a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {say('Sign Out')}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#e5e7eb' }}>{say('My Documents')}</h1>
        <section style={{ margin: '16px 0 28px', background: '#241014', border: '1px solid #4a1c22', borderRadius: 14, padding: 16 }}>
          <h2 style={{ marginTop: 0, color: '#f8ecea', fontSize: 18 }}>{say('Upload a document')}</h2>
          <p style={{ color: '#e7c4bf' }}>{say('Choose a PDF or image, pick the kind of document, then upload it to your account.')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setError('');
              }}
            />
            <select value={docType} onChange={(event) => setDocType(event.target.value)} aria-label={say('Document type')} style={{ background: '#1c0d10', color: '#f8ecea', border: '1px solid #5c2428', borderRadius: 8, padding: '8px 10px' }}>
              <option value="invoice">{say('Invoice')}</option>
              <option value="estimate">{say('Estimate')}</option>
              <option value="warranty">{say('Warranty')}</option>
              <option value="receipt">{say('Receipt')}</option>
              <option value="report">{say('Report')}</option>
              <option value="other">{say('Other')}</option>
            </select>
            <button type="button" onClick={() => { void upload(); }} disabled={busy} style={{ padding: '12px 24px', background: '#e5332a', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? say('Uploading...') : say('Upload Document')}
            </button>
          </div>
          {file ? <p style={{ color: '#f8ecea' }}>{say('Selected:')} {file.name}</p> : null}
          {notice ? <div role="status" style={{ marginTop: 12, background: '#12301c', border: '1px solid #86efac', color: '#bbf7d0', borderRadius: 10, padding: 12 }}>{say(notice)}</div> : null}
          {error ? <div role="alert" style={{ marginTop: 12, background: '#3b1214', border: '1px solid #fca5a5', color: '#fecaca', borderRadius: 10, padding: 12 }}>{say(error)}</div> : null}
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {documents.map((document) => (
            <div key={document.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e5e7eb', margin: 0 }}><FaFileAlt style={{ marginRight: 8 }} />{document.name}</h3>
                  <div style={{ fontSize: 14, color: '#9aa3b2', marginTop: 6 }}>{document.type}{document.uploadedAt ? ` · ${new Date(document.uploadedAt).toLocaleDateString()}` : ''}</div>
                </div>
                {document.url ? (
                  <a href={document.url} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', background: '#e5332a', color: 'white', borderRadius: 6, fontWeight: 700, textDecoration: 'none' }}>
                    {say('View')}
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {documents.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9aa3b2' }}>{say('No documents uploaded yet.')}</div>
        )}

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <Link href="/customer/dashboard" style={{ padding: '12px 24px', background: '#e5332a', color: 'white', borderRadius: 8, fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
            {say('Back to Dashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
