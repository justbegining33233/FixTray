'use client';

import { FaExclamationCircle, FaRedo, FaHome } from 'react-icons/fa';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <div className="mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-6" style={{ background: 'rgba(229,51,42,0.12)', border: '1px solid rgba(229,51,42,0.25)' }}>
          <FaExclamationCircle className="w-12 h-12" style={{ color: '#e5332a' }} />
        </div>

        <h1 className="text-3xl font-bold mb-2" style={{ color: '#f1f5f9' }}>Something went wrong</h1>
        <p className="mb-8" style={{ color: '#94a3b8' }}>
          An unexpected error occurred. You can try again or navigate to a different page.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors"
            style={{ background: '#e5332a', color: '#fff' }}
          >
            <FaRedo className="w-4 h-4" /> Try Again
          </button>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f1f5f9' }}
          >
            <FaHome className="w-4 h-4" /> Go Home
          </Link>
        </div>

        {error.digest && (
          <p className="mt-8 text-xs" style={{ color: '#475569' }}>Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
