'use client';

import Link from 'next/link';
import { FaHome, FaArrowLeft, FaExclamationTriangle } from 'react-icons/fa';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Icon */}
        <div className="mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-6" style={{ background: 'rgba(229,51,42,0.12)', border: '1px solid rgba(229,51,42,0.25)' }}>
          <FaExclamationTriangle className="w-12 h-12" style={{ color: '#e5332a' }} />
        </div>

        {/* Title */}
        <h1 className="text-6xl font-bold mb-2" style={{ color: '#f1f5f9' }}>404</h1>
        <h2 className="text-xl font-semibold mb-3" style={{ color: '#e2e8f0' }}>Page Not Found</h2>
        <p className="mb-8" style={{ color: '#94a3b8' }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Check the URL or navigate back to a known page.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f1f5f9' }}
          >
            <FaArrowLeft className="w-4 h-4" /> Go Back
          </button>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors"
            style={{ background: '#e5332a', color: '#fff' }}
          >
            <FaHome className="w-4 h-4" /> Home
          </Link>
        </div>

        {/* Quick Role Links */}
        <div className="rounded-xl p-6" style={{ background: 'rgba(10,16,32,0.68)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-sm font-medium mb-4" style={{ color: '#94a3b8' }}>Quick navigation by role:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Link href="/customer/dashboard" className="px-3 py-2 rounded-lg text-sm transition-colors" style={{ background: 'rgba(229,51,42,0.12)', color: '#fca5a5' }}>
              Customer
            </Link>
            <Link href="/shop/home" className="px-3 py-2 rounded-lg text-sm transition-colors" style={{ background: 'rgba(34,197,94,0.10)', color: '#86efac' }}>
              Shop
            </Link>
            <Link href="/tech/home" className="px-3 py-2 rounded-lg text-sm transition-colors" style={{ background: 'rgba(229,51,42,0.10)', color: '#ffb4ad' }}>
              Technician
            </Link>
            <Link href="/manager/dashboard" className="px-3 py-2 rounded-lg text-sm transition-colors" style={{ background: 'rgba(168,85,247,0.10)', color: '#d8b4fe' }}>
              Manager
            </Link>
            <Link href="/admin/dashboard" className="px-3 py-2 rounded-lg text-sm transition-colors" style={{ background: 'rgba(245,158,11,0.10)', color: '#fcd34d' }}>
              Admin
            </Link>
            <Link href="/auth/login" className="px-3 py-2 rounded-lg text-sm transition-colors" style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

