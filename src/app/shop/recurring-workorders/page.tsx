'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBell, FaBolt, FaCalendarAlt, FaCar, FaDollarSign, FaStopwatch, FaSyncAlt, FaTrash, FaUser } from 'react-icons/fa';

interface RecurringSchedule {
  id: string;
  title: string;
  issueDescription: string;
  frequency: string;
  nextRunAt: string;
  lastRunAt: string | null;
  active: boolean;
  requiresApproval: boolean;
  estimatedCost: number | null;
  notes: string | null;
  customer: { firstName: string; lastName: string; email: string };
  vehicle: { make: string; model: string; year: number } | null;
}

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 Weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
};

export default function RecurringWorkOrders() {
  useRequireAuth(['shop']);
  const router = useRouter();

  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [shopId] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('shopId') || '' : '');

  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<{ id: string; firstName: string; lastName: string; email: string; phone?: string | null }[]>([]);
  const [selectedCustomerName, setSelectedCustomerName] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [form, setForm] = useState({
    customerId: '',
    vehicleId: '',
    title: '',
    issueDescription: '',
    frequency: 'monthly',
    serviceLocation: 'in-shop',
    vehicleType: 'car',
    estimatedCost: '',
    notes: '',
    startDate: '',
    requiresApproval: true,
  });

  const fetchSchedules = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/recurring-workorders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setSchedules(data.schedules);
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchCustomers = async (q: string) => {
    if (q.length < 2) { setCustomerResults([]); return; }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}&shopId=${shopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCustomerResults(data.customers || []);
      setShowCustomerDropdown(true);
    } catch {}
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchCustomers(customerSearch), 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/recurring-workorders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : undefined,
          vehicleId: form.vehicleId || undefined,
          startDate: form.startDate || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSchedules((prev) => [...prev, data.schedule]);
        setShowForm(false);
        setForm({
          customerId: '', vehicleId: '', title: '', issueDescription: '',
          frequency: 'monthly', serviceLocation: 'in-shop', vehicleType: 'car',
          estimatedCost: '', notes: '', startDate: '', requiresApproval: true,
        });
        setCustomerSearch('');
        setSelectedCustomerName('');
        setShowCustomerDropdown(false);
      } else {
        setFormError(data.error || 'Failed to create schedule');
      }
    } catch {
      setFormError('Error creating schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (schedule: RecurringSchedule) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/recurring-workorders/${schedule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !schedule.active }),
      });
      const data = await res.json();
      if (data.success) {
        setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? data.schedule : s)));
      }
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/recurring-workorders/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSchedules((prev) => prev.filter((s) => s.id !== id));
    } catch {} finally { setDeleteConfirmId(null); }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#000000] text-stone-100">
      {/* Header */}
      <header className="bg-[#000000] border-b border-[#1f2937] px-5 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="text-stone-400 hover:text-stone-100 text-sm transition-colors"
            >
              <FaArrowLeft style={{marginRight:4}} /> Back
            </button>
            <h1 className="text-2xl font-semibold"><FaSyncAlt style={{marginRight:4}} /> Recurring Work Orders</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#e5332a] hover:bg-[#c62822] text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            + New Schedule
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8">
        <p className="text-stone-400 text-sm mb-6">
          Set up automatic service reminders for repeat customers. The customer will receive a notification and can confirm before a bay is reserved.
        </p>

        {/* Create Form */}
        {showForm && (
          <div className="bg-[#000000] border border-[#1f2937] rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">New Recurring Schedule</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div style={{ position: 'relative' }}>
                <label className="block text-sm text-stone-400 mb-1">Customer *</label>
                <input
                  required
                  value={selectedCustomerName || customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setSelectedCustomerName('');
                    setForm((f) => ({ ...f, customerId: '' }));
                  }}
                  placeholder="Search by name, phone, or email..."
                  className="w-full bg-[#000000] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-[#e5332a]"
                />
                {showCustomerDropdown && customerResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#000000', border: '1px solid #1f2937', borderRadius: 8, maxHeight: 200, overflowY: 'auto' }}>
                    {customerResults.map((c) => (
                      <button key={c.id} type="button" onClick={() => {
                        setForm((f) => ({ ...f, customerId: c.id }));
                        setSelectedCustomerName(`${c.firstName} ${c.lastName}`);
                        setCustomerSearch('');
                        setShowCustomerDropdown(false);
                      }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', color: '#e5e7eb', fontSize: 14, background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '1px solid #1f2937' }}>
                        <div>{c.firstName} {c.lastName}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>{c.email}{c.phone ? `  ${c.phone}` : ''}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-stone-400 mb-1">Service Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Oil Change"
                  className="w-full bg-[#000000] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-[#e5332a]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-stone-400 mb-1">Description *</label>
                <textarea
                  required
                  value={form.issueDescription}
                  onChange={(e) => setForm((f) => ({ ...f, issueDescription: e.target.value }))}
                  placeholder="What service will be performed?"
                  rows={2}
                  className="w-full bg-[#000000] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-[#e5332a] resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-stone-400 mb-1">Frequency *</label>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                  className="w-full bg-[#000000] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-[#e5332a]"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every 2 Weeks</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-stone-400 mb-1">First Run Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full bg-[#000000] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-[#e5332a]"
                />
              </div>
              <div>
                <label className="block text-sm text-stone-400 mb-1">Estimated Cost ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.estimatedCost}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedCost: e.target.value }))}
                  placeholder="e.g. 79.99"
                  className="w-full bg-[#000000] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-[#e5332a]"
                />
              </div>
              <div>
                <label className="block text-sm text-stone-400 mb-1">Service Location</label>
                <select
                  value={form.serviceLocation}
                  onChange={(e) => setForm((f) => ({ ...f, serviceLocation: e.target.value }))}
                  className="w-full bg-[#000000] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-[#e5332a]"
                >
                  <option value="in-shop">In Shop</option>
                  <option value="roadside">Roadside</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-stone-400 mb-1">Notes</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes for technician"
                  className="w-full bg-[#000000] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-[#e5332a]"
                />
              </div>
              <div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setForm((f) => ({ ...f, requiresApproval: !f.requiresApproval }))}
                    style={{
                      width: 44, height: 24, borderRadius: 12, position: 'relative', cursor: 'pointer',
                      background: form.requiresApproval ? 'rgba(229,51,42,0.7)' : 'rgba(255,255,255,0.15)',
                      transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3, left: form.requiresApproval ? 22 : 3,
                      width: 18, height: 18, borderRadius: '50%', background: 'white',
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }} />
                  </div>
                  <div>
                    <div className="text-sm text-stone-200 font-medium">Require customer approval</div>
                    <div className="text-xs text-stone-500">
                      {form.requiresApproval
                        ? 'Customer will be notified and must confirm before the job is scheduled.'
                        : 'Job is added to the queue automatically without asking the customer.'}
                    </div>
                  </div>
                </label>
              </div>
              {formError && (
                <div className="md:col-span-2 bg-red-900/30 border border-red-500/40 text-red-300 rounded-lg px-4 py-2 text-sm">{formError}</div>
              )}
              <div className="md:col-span-2 flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#e5332a] hover:bg-[#c62822] disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors"
                >
                  {saving ? 'Creating...' : 'Create Schedule'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-[#1f2937] hover:bg-[#374151] text-stone-300 px-6 py-2 rounded-lg font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Schedules List */}
        {loading ? (
          <div className="text-center py-16 text-stone-400">Loading schedules...</div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4"><FaSyncAlt style={{marginRight:4}} /></div>
            <div className="text-stone-300 font-medium text-lg mb-2">No recurring schedules yet</div>
            <div className="text-stone-500 text-sm mb-6">
              Set up recurring work orders for repeat services like oil changes, inspections, or maintenance.
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="bg-[#e5332a] hover:bg-[#c62822] text-white px-6 py-3 rounded-lg font-medium"
            >
              Create Your First Schedule
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {schedules.map((s) => (
              <div
                key={s.id}
                className={`bg-[#000000] border rounded-2xl p-5 ${
                  s.active ? 'border-[#1f2937]' : 'border-[#1f2937] opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-stone-100">{s.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        s.active ? 'bg-green-500/20 text-green-400' : 'bg-stone-500/20 text-stone-400'
                      }`}>
                        {s.active ? 'Active' : 'Paused'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#e5332a]/100/20 text-[#ff6b64]">
                        {FREQUENCY_LABELS[s.frequency] || s.frequency}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        s.requiresApproval ? 'bg-yellow-500/20 text-yellow-400' : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {s.requiresApproval ? <><FaBell style={{marginRight:4}} /> Needs approval</> : <><FaBolt style={{marginRight:4}} /> Auto-create</>}
                      </span>
                    </div>
                    <div className="text-sm text-stone-400 mb-2">{s.issueDescription}</div>
                    <div className="flex flex-wrap gap-4 text-xs text-stone-500">
                      <span><FaUser style={{marginRight:4}} /> {s.customer.firstName} {s.customer.lastName}</span>
                      {s.vehicle && (
                        <span><FaCar style={{marginRight:4}} /> {s.vehicle.year} {s.vehicle.make} {s.vehicle.model}</span>
                      )}
                      {s.estimatedCost && <span><FaDollarSign style={{marginRight:4}} /> ~${s.estimatedCost.toFixed(2)}</span>}
                      <span><FaCalendarAlt style={{marginRight:4}} /> Next: {formatDate(s.nextRunAt)}</span>
                      {s.lastRunAt && <span><FaStopwatch style={{marginRight:4}} /> Last ran: {formatDate(s.lastRunAt)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        s.active
                          ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      }`}
                    >
                      {s.active ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(s.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Delete confirm modal */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 32, maxWidth: 420, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}><FaTrash style={{marginRight:4}} /></div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Delete Recurring Schedule?</h3>
            <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: 14 }}>This will not affect existing work orders.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ flex: 1, padding: '10px', background: '#334155', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', color: '#e2e8f0' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirmId)} style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



