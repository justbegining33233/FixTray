'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import '@/styles/sos-theme.css';

export default function ThankYouPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (countdown === 0) {
      const userRole = localStorage.getItem('userRole');
      const token = localStorage.getItem('token');
      // If no token the user just registered — send them to login to sign in
      if (!token) {
        router.push('/auth/login' as Route);
        return;
      }
      switch(userRole) {
        case 'customer':
          router.push('/customer/home' as Route);
          break;
        case 'shop':
          router.push('/shop/admin' as Route);
          break;
        case 'tech':
          router.push('/tech/home' as Route);
          break;
        case 'manager':
          router.push('/manager/home' as Route);
          break;
        case 'admin':
          router.push('/admin/home' as Route);
          break;
        default:
          router.push('/' as Route);
      }
    }
  }, [countdown, router]);

  return (
    <div className="sos-wrap">
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>Registration Complete</h1>
      <div className="sos-card">
        <div className="sos-header">
          <div className="sos-brand">
            <span className="mark">FixTray</span>
          </div>
          <span className="sos-pill">Signed In</span>
        </div>
        <div className="sos-content">
          <div className="sos-pane" style={{gridColumn:'1 / -1'}}>
            <div className="sos-title" style={{textAlign:'center'}}>Thank you!</div>
            <p className="sos-desc" style={{textAlign:'center'}}>Registration successful! Redirecting to dashboard in <span style={{color:'#ff7a59', fontWeight:700}}>{countdown}s</span>...</p>
            <div className="sos-actions" style={{justifyContent:'center'}}>
              <Link
                href={(() => {
                  const userRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : null;
                  switch(userRole) {
                    case 'customer': return '/customer/home';
                    case 'shop': return '/shop/admin';
                    case 'tech': return '/tech/home';
                    case 'manager': return '/manager/home';
                    case 'admin': return '/admin/home';
                    default: return '/';
                  }
                })() as Route}
                className="btn-primary"
              >Go to Dashboard</Link>
              <Link href="/" className="btn-outline">Back to Home</Link>
            </div>
          </div>
        </div>
        <div className="sos-footer">
          <span className="sos-tagline">Run work orders, teams, customers, and multi-shop operations from one platform.</span>
          <div className="accent-bar" style={{width:112, borderRadius:6}} />
        </div>
      </div>
    </div>
  );
}
