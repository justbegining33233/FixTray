'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState, type FormEvent } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useRequireAuth } from '@/contexts/AuthContext';
import { validateRecurringSchedule } from '@/lib/shopFormValidation';
import { FaCalendarAlt, FaSyncAlt } from 'react-icons/fa';

interface RecurringSchedule {
  id: string;
  title: string;
  issueDescription: string;
  frequency: string;
  nextRunAt: string;
  lastRunAt: string | null;
  active: boolean;
  customer: { firstName: string; lastName: string };
  vehicle: { make: string; model: string; year: number } | null;
}

const FREQ_LABELS: Record<string, string> = { weekly: 'Weekly', biweekly: 'Bi-weekly', monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually' };

export default function ManagerRecurringWorkOrdersPage() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['manager']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [items, setItems] = useState<RecurringSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerHits, setCustomerHits] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [form, setForm] = useState({ customerId: '', customerName: '', title: '', issueDescription: '', frequency: 'monthly' });

  const load = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/recurring-workorders', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) {
      const d = await r.json();
      setItems(Array.isArray(d.schedules) ? d.schedules : Array.isArray(d) ? d : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  useEffect(() => {
    if (customerQuery.trim().length < 2) { setCustomerHits([]); return; }
    const timer = setTimeout(async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(customerQuery.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setCustomerHits(data.customers || []);
    }, 250);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  const createSchedule = async (event: FormEvent) => {
    event.preventDefault();
    const check = validateRecurringSchedule(form);
    if (!check.ok) { setFormError(check.error); return; }
    setSaving(true);
    setFormError('');
    const token = localStorage.getItem('token');
    const res = await fetch('/api/recurring-workorders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        customerId: form.customerId,
        title: form.title,
        issueDescription: form.issueDescription,
        frequency: form.frequency,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok || data.success === false) { setFormError(data.error || 'Could not create schedule'); return; }
    setShowForm(false);
    setForm({ customerId: '', customerName: '', title: '', issueDescription: '', frequency: 'monthly' });
    setCustomerQuery('');
    load();
  };

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>{say("Loading...")}</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="manager" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(o => !o)} showMenuButton />
        <main style={{ flex: 1, padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <Breadcrumbs />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 24px' }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: 0 }}>{say("Recurring Work Orders")}</h1>
            <button type="button" onClick={() => { setShowForm((open) => !open); setFormError(''); }} style={{ padding: '10px 16px', background: '#e5332a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>{showForm ? say("Close") : say("Create Schedule")}</button>
          </div>
          {showForm && (
            <form onSubmit={createSchedule} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, marginBottom: 20, display: 'grid', gap: 12 }}>
              <p style={{ margin: 0, color: '#9aa3b2', fontSize: 13 }}>{say("Create a recurring schedule for this shop. Customer, title, and description are required.")}</p>
              <input required aria-label={say("Find customer")} value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder={say("Search customer name")} style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb' }} />
              {form.customerName && <div style={{ color: '#86efac', fontSize: 13 }}>{say("Selected:")}{' '}{say(form.customerName)}</div>}
              {customerHits.length > 0 && (
                <div style={{ display: 'grid', gap: 6 }}>
                  {customerHits.map((customer) => (
                    <button type="button" key={customer.id} onClick={() => { setForm((f) => ({ ...f, customerId: customer.id, customerName: `${customer.firstName} ${customer.lastName}` })); setCustomerHits([]); }} style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#e5e7eb', cursor: 'pointer' }}>
                      {say(customer.firstName)} {say(customer.lastName)}
                    </button>
                  ))}
                </div>
              )}
              <input required aria-label={say("Title")} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={say("Title")} style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb' }} />
              <textarea required aria-label={say("Description")} value={form.issueDescription} onChange={(e) => setForm((f) => ({ ...f, issueDescription: e.target.value }))} placeholder={say("What should be done each visit?")} style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb' }} />
              <select aria-label={say("Frequency")} value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#111', color: '#e5e7eb' }}>
                {Object.entries(FREQ_LABELS).map(([value, label]) => <option key={value} value={value}>{say(label)}</option>)}
              </select>
              {formError && <div style={{ color: '#fca5a5', fontSize: 13 }}>{say(formError)}</div>}
              <button type="submit" disabled={saving} style={{ padding: '10px 16px', background: '#e5332a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>{saving ? say("Saving...") : say("Save Schedule")}</button>
            </form>
          )}
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40 }}>{say("Loading...")}</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 60, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <FaSyncAlt style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
              <p>{say("No recurring work orders set up. Use Create Schedule to add one.")}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map(r => (
                <div key={r.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ background: r.active ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)', color: r.active ? '#22c55e' : '#9ca3af', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, marginRight: 8 }}>{r.active ? say("Active") : say("Paused")}</span>
                      <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{say(r.title)}</span>
                    </div>
                    <span style={{ color: '#9aa3b2', fontSize: 13 }}><FaSyncAlt style={{ marginRight: 4 }} />{FREQ_LABELS[r.frequency] || r.frequency}</span>
                  </div>
                  <p style={{ color: '#9aa3b2', fontSize: 13, marginTop: 8 }}>{say(r.customer.firstName)} {say(r.customer.lastName)} {r.vehicle ? ` ${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}` : ''}</p>
                  <p style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}><FaCalendarAlt style={{ marginRight: 4 }} />{say("Next:")}{' '}{new Date(r.nextRunAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

