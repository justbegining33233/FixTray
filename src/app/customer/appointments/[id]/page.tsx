'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import { usePhrase } from '@/lib/usePhrase';

type AppointmentDetail = {
  id: string;
  scheduledDate: string;
  serviceType?: string;
  status?: string;
  notes?: string;
  workOrderId?: string | null;
  shop?: { id: string; shopName?: string; phone?: string; address?: string; city?: string; state?: string };
};

export default function CustomerAppointmentTrackPage() {
  const say = usePhrase();
  useRequireAuth(['customer']);
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('token');
    fetch('/api/appointments', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Could not load this appointment.');
        const match = (body.appointments || []).find((row: AppointmentDetail) => row.id === id);
        if (!match) throw new Error('This appointment was not found.');
        setAppointment(match);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load this appointment.');
      });
  }, [id]);

  const shop = appointment?.shop;
  const address = [shop?.address, shop?.city, shop?.state].filter(Boolean).join(', ');
  const maps = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';

  return (
    <main style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', padding: 24 }}>
      <Link href={'/customer/appointments' as Route} style={{ color: '#f0b4ae' }}>{say('Back to appointments')}</Link>
      <h1 style={{ marginTop: 16 }}>{say('Appointment')}</h1>
      {error ? (
        <div role="alert" style={{ marginTop: 16, background: '#3b1214', border: '1px solid #fca5a5', color: '#fecaca', borderRadius: 12, padding: 14 }}>
          {say(error)}
        </div>
      ) : null}
      {!appointment && !error ? <p>{say('Loading appointment...')}</p> : null}
      {appointment ? (
        <section style={{ marginTop: 16, background: '#241014', border: '1px solid #4a1c22', borderRadius: 14, padding: 16, maxWidth: 640 }}>
          <p>{shop?.shopName || say('Shop')}</p>
          <p>{appointment.serviceType || say('Service')}</p>
          <p>{new Date(appointment.scheduledDate).toLocaleString()}</p>
          <p>{address || say('The shop has not saved an address yet.')}</p>
          {appointment.workOrderId ? (
            <p>
              <Link href={`/customer/jobs/${appointment.workOrderId}/track` as Route} style={{ color: '#93c5fd', fontWeight: 700 }}>
                {say('Open job tracking')}
              </Link>
            </p>
          ) : (
            <div role="status" style={{ marginTop: 12, background: '#1c0d10', border: '1px solid #5c2428', borderRadius: 10, padding: 12 }}>
              {say('No job has been opened for this visit yet, so there is no live job to track. The shop address is below. When the shop opens a work order, Track on Appointments opens that job.')}
            </div>
          )}
          {maps ? (
            <p>
              <a href={maps} target="_blank" rel="noopener noreferrer" style={{ color: '#93c5fd', fontWeight: 700 }}>{say('Open the shop in maps')}</a>
            </p>
          ) : null}
          {shop?.id ? (
            <p>
              <Link href={`/customer/messages?shopId=${shop.id}` as Route} style={{ color: '#d8b4fe', fontWeight: 700 }}>{say('Message the shop')}</Link>
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
