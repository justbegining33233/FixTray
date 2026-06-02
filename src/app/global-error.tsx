"use client";

import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #000000 0%, #0b0b0f 45%, #111111 100%)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '1rem',
        }}>
          <div style={{ maxWidth: '32rem', width: '100%', textAlign: 'center' }}>
            <div style={{
              width: '5rem', height: '5rem', borderRadius: '50%',
              background: 'rgba(229,51,42,0.12)', border: '1px solid rgba(229,51,42,0.25)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 1.5rem',
              fontSize: '2rem', color: '#e5332a',
            }}>
              &#9888;
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.5rem' }}>
              Something went wrong
            </h1>
            <p style={{ color: '#94a3b8', marginBottom: '2rem', lineHeight: 1.6 }}>
              An unexpected error occurred. This has been logged and we&apos;ll look into it.
              You can try again or go back to the home page.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={reset}
                style={{
                  padding: '0.75rem 1.5rem', background: '#e5332a', color: 'white',
                  border: 'none', borderRadius: '0.75rem', fontWeight: 600,
                  cursor: 'pointer', fontSize: '0.875rem',
                }}
              >
                Try Again
              </button>
              <Link
                href="/"
                style={{
                  padding: '0.75rem 1.5rem', background: 'rgba(255,255,255,0.06)', color: '#f1f5f9',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '0.75rem', fontWeight: 600,
                  textDecoration: 'none', fontSize: '0.875rem',
                }}
              >
                Go Home
              </Link>
            </div>
            {error.digest && (
              <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}

