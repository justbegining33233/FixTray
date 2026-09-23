'use client';

import { usePhrase } from '@/lib/usePhrase';
import Link from 'next/link';
import type { Route } from 'next';

export default function CustomerBookingFeatures() {
  const say = usePhrase();
  return (
    <div style={{
      minHeight: '100vh',
      background: 'transparent',
      color: '#e5e7eb',
      padding: '48px 20px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: 32 }}>
        {/* Hero */}
        <div style={{ display: 'grid', gap: 16 }}>
          <span style={{ color: '#38bdf8', fontWeight: 700, letterSpacing: 1 }}>{say("Customer Booking Portal")}</span>
          <h1 style={{ fontSize: 36, margin: 0 }}>{say("Let your customers book jobs in minutes")}</h1>
          <p style={{ fontSize: 16, color: '#cbd5e1', maxWidth: 720 }}>
            {say("Offer a frictionless way for customers to request work orders, pick time windows, and get instant confirmations. All bookings sync to your shop schedule so your team stays in lockstep.")}{' '}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href={"/customer/signup" as Route} style={ctaStyle('#38bdf8')}>
              {say("Start accepting bookings")}{' '}</Link>
            <Link href={"/customer/dashboard" as Route} style={ctaStyle('#e5e7eb', true)}>
              {say("View customer portal")}{' '}</Link>
          </div>
        </div>

        {/* Booking highlights */}
        <div style={{ ...cardStyle, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{say("Booking highlights")}</h2>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{say("Everything your customers see in one glance")}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {[
              { title: say("Self-serve scheduling"), copy: say("Customers pick dates and time windows that match your availability.") },
              { title: say("Work order intake"), copy: say("Collect vehicle, equipment, or project details up front to prep parts and labor.") },
              { title: say("Smart routing"), copy: say("Bookings auto-assign to the right shop location or tech queue.") },
              { title: say("Status updates"), copy: say("Customers see confirmations, ETAs, and completion notices without calling.") },
              { title: say("Payments ready"), copy: say("Capture cards on file and collect deposits when needed.") },
              { title: say("Reminders & follow-ups"), copy: say("Reduce no-shows with email/SMS reminders and post-visit notes.") },
            ].map((item) => (
              <div key={item.title} style={{ display: 'grid', gap: 4, alignContent: 'start' }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{say(item.title)}</div>
                <div style={{ color: '#cbd5e1', fontSize: 14 }}>{say(item.copy)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div style={{ ...cardStyle, border: '1px solid rgba(56,189,248,0.4)', padding: 20 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>{say("How customers book")}</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              say("Pick a service and describe the job"),
              say("Choose a preferred date and time window"),
              say("Add photos or documents (optional)"),
              say("Get confirmation and live status updates"),
            ].map((step, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {idx + 1}
                </span>
                <div style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>{say(step)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', padding: 24, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 12 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 24 }}>{say("Ready to open your booking portal?")}</h2>
          <p style={{ margin: '0 0 16px', color: '#cbd5e1' }}>{say("Enable self-serve appointments and keep every job on schedule.")}</p>
          <Link href={"/customer/signup" as Route} style={ctaStyle('#0ea5e9')}>
            {say("Enable customer bookings")}{' '}</Link>
        </div>
      </div>
    </div>
  );
}

const ctaStyle = (color: string, ghost?: boolean) => ({
  display: 'inline-block',
  padding: '12px 18px',
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 14,
  textDecoration: 'none',
  color: ghost ? color : '#0b1220',
  background: ghost ? 'transparent' : color,
  border: ghost ? `1px solid ${color}` : 'none',
});

const cardStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: 12,
  padding: 16,
};
