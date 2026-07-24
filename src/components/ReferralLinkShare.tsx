'use client';

import { useState } from 'react';
import { FaShare, FaCheck, FaCopy, FaPhone, FaEnvelope } from 'react-icons/fa';

interface ReferralLinkShareProps {
  customerId?: string;
  referralCode?: string;
  referralLink?: string;
}

export default function ReferralLinkShare({
  customerId = 'customer-123',
  referralCode = 'REF' + Math.random().toString(36).substr(2, 9).toUpperCase(),
  referralLink = `${typeof window !== 'undefined' ? window.location.origin : 'https://fixtray.app'}/referral/${referralCode}`,
}: ReferralLinkShareProps) {
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareVia = (method: 'sms' | 'email' | 'whatsapp') => {
    const shareText = `Check out FixTray - the best work order management system! Use my referral code: ${referralCode} to get started. ${referralLink}`;
    
    switch (method) {
      case 'sms':
        window.location.href = `sms:?body=${encodeURIComponent(shareText)}`;
        break;
      case 'email':
        window.location.href = `mailto:?subject=Try FixTray&body=${encodeURIComponent(shareText)}`;
        break;
      case 'whatsapp':
        window.location.href = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        break;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg border border-slate-700 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <FaShare className="text-cyan-400" />
        <h3 className="text-lg font-semibold text-white">Share & Earn</h3>
      </div>

      <p className="text-sm text-slate-400 mb-4">
        Share your unique referral code and earn rewards when friends sign up.
      </p>

      {/* Referral Code Display */}
      <div className="mb-4">
        <label className="text-xs text-slate-500 uppercase tracking-wider">Your Referral Code</label>
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={referralCode}
            readOnly
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-600 rounded text-white text-sm font-mono"
          />
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded font-medium text-sm transition flex items-center gap-2"
          >
            {copied ? <FaCheck size={14} /> : <FaCopy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Referral Link */}
      <div className="mb-4">
        <label className="text-xs text-slate-500 uppercase tracking-wider">Your Referral Link</label>
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={referralLink}
            readOnly
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-600 rounded text-white text-xs font-mono truncate"
          />
          <button
            onClick={handleCopy}
            className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded font-medium text-sm transition"
          >
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Share Methods */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => handleShareVia('email')}
          className="flex flex-col items-center gap-2 p-3 bg-slate-950/50 hover:bg-slate-950 rounded border border-slate-700 hover:border-cyan-500 transition"
        >
          <FaEnvelope className="text-cyan-400" size={20} />
          <span className="text-xs text-slate-400">Email</span>
        </button>

        <button
          onClick={() => handleShareVia('sms')}
          className="flex flex-col items-center gap-2 p-3 bg-slate-950/50 hover:bg-slate-950 rounded border border-slate-700 hover:border-cyan-500 transition"
        >
          <FaPhone className="text-cyan-400" size={20} />
          <span className="text-xs text-slate-400">Text</span>
        </button>

        <button
          onClick={() => handleShareVia('whatsapp')}
          className="flex flex-col items-center gap-2 p-3 bg-slate-950/50 hover:bg-slate-950 rounded border border-slate-700 hover:border-cyan-500 transition"
        >
          <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-9.746 9.776c0 2.615.738 5.17 2.134 7.404L2.885 22l7.894-2.078a9.857 9.857 0 004.784 1.219h.005c5.396 0 9.747-4.363 9.747-9.776 0-2.6-.738-5.157-2.134-7.39A9.856 9.856 0 0012.051 6.979z"/>
          </svg>
          <span className="text-xs text-slate-400">WhatsApp</span>
        </button>
      </div>

      {/* Referral Stats */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-cyan-400">0</p>
            <p className="text-xs text-slate-500">Referrals Sent</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-400">$0</p>
            <p className="text-xs text-slate-500">Rewards Earned</p>
          </div>
        </div>
      </div>
    </div>
  );
}
