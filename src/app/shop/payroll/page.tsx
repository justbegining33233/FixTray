'use client';
import { useState, useEffect, useCallback } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaArrowLeft, FaArrowRight, FaCaretRight, FaCheck, FaCheckCircle, FaClipboardList, FaClock, FaCog, FaDollarSign, FaExclamationTriangle, FaHourglassHalf, FaRegSquare, FaTimes, FaTimesCircle, FaTrash, FaUsers } from 'react-icons/fa';

// --- Types -------------------------------------------------------------------
interface Employee {
  id: string; firstName: string; lastName: string; email: string; phone?: string;
  role: string; jobTitle?: string; department?: string; employmentType: string;
  payType: string; hourlyRate: number; salary?: number; overtimeRate?: number;
  hireDate?: string; terminatedAt?: string; available: boolean;
}
interface Shift {
  id: string; techId: string; date: string; startTime: string; endTime: string;
  shiftType: string; position?: string; status: string; lateMinutes: number;
  notes?: string;
  tech: { id: string; firstName: string; lastName: string; role: string };
}
interface AttendanceRecord {
  shiftId: string | null; techId: string; date: string;
  scheduledStart: string | null; scheduledEnd: string | null;
  actualClockIn: string | null; actualClockOut: string | null;
  hoursWorked: number; lateMinutes: number; status: string;
  timeEntryId: string | null; approved: boolean;
  tech: { id: string; firstName: string; lastName: string };
}
interface LeaveRequest {
  id: string; techId: string; leaveType: string; startDate: string; endDate: string;
  totalHours: number; reason?: string; status: string; approvedById?: string;
  approvedAt?: string; deniedReason?: string;
  tech: { id: string; firstName: string; lastName: string; jobTitle?: string };
}
interface PayPeriod {
  id: string; startDate: string; endDate: string; payDate?: string;
  periodType: string; status: string; totalGross: number; totalNet: number;
  totalTaxes: number; totalOvertimePay: number; employeeCount: number;
  processedAt?: string;
  payStubs?: PayStub[];
}
interface PayStub {
  id: string; techId: string; payPeriodId: string; regularHours: number;
  overtimeHours: number; doubleTimeHours: number; ptoHours: number; sickHours: number;
  regularPay: number; overtimePay: number; doubleTimePay: number; ptoPay: number;
  bonusPay: number; reimbursements: number; grossPay: number;
  federalTax: number; stateTax: number; socialSecurity: number; medicare: number;
  totalDeductions: number; netPay: number; ytdGross: number; ytdNet: number;
  status: string; paidAt?: string; paidVia?: string; checkNumber?: string;
  tech?: { id: string; firstName: string; lastName: string; jobTitle?: string; department?: string };
  payPeriod?: { startDate: string; endDate: string; payDate?: string };
}
interface OvertimeRule {
  weeklyOvertimeEnabled: boolean; weeklyOvertimeThreshold: number; overtimeMultiplier: number;
  dailyOvertimeEnabled: boolean; dailyOvertimeThreshold: number;
  doubleTimeEnabled: boolean; doubleTimeThreshold: number; doubleTimeMultiplier: number;
  seventhDayRule: boolean;
}

// --- Constants ---------------------------------------------------------------
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const THEME = {
  pageBg: '#050505',
  surface: '#0f0f10',
  surfaceAlt: '#151516',
  border: 'rgba(229,51,42,0.28)',
  borderSoft: 'rgba(255,255,255,0.08)',
  text: '#e5e7eb',
  textMuted: '#9ca3af',
  accent: '#e5332a',
};
const DEPT_COLORS: Record<string, string> = {
  service: '#e5332a', parts: '#f59e0b', admin: '#8b5cf6', management: '#10b981', default: '#6b7280',
};
const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  present:     { bg: 'rgba(34,197,94,0.16)', color: '#4ade80', label: 'Present' },
  late:        { bg: 'rgba(245,158,11,0.16)', color: '#fbbf24', label: 'Late' },
  absent:      { bg: 'rgba(229,51,42,0.2)', color: '#f87171', label: 'Absent' },
  unscheduled: { bg: 'rgba(59,130,246,0.16)', color: '#93c5fd', label: 'Unscheduled' },
  scheduled:   { bg: 'rgba(156,163,175,0.2)', color: '#d1d5db', label: 'Scheduled' },
};

function fmt(n: number) { return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}` }
function fmtHrs(h: number) { return `${h.toFixed(1)}h` }
function fmtDate(d?: string) { if (!d) return ' - '; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
function weekStart(d = new Date()) { const s = new Date(d); s.setDate(d.getDate() - d.getDay()); s.setHours(0, 0, 0, 0); return s; }

// --- Main Component ----------------------------------------------------------
export default function PayrollPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [tab, setTab] = useState<'overview' | 'schedule' | 'timecards' | 'attendance' | 'leave' | 'periods' | 'stubs' | 'settings'>('overview');

  // Data state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attSummary, setAttSummary] = useState<any>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([]);
  const [payStubs, setPayStubs] = useState<PayStub[]>([]);
  const [otRule, setOtRule] = useState<OvertimeRule | null>(null);

  // UI state
  const [weekOf, setWeekOf] = useState<Date>(weekStart());
  const [loading, setLoading] = useState(false);
  const [runningPayroll, setRunningPayroll] = useState(false);
  const [showAddShift, setShowAddShift] = useState(false);
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [showEditEmployee, setShowEditEmployee] = useState<Employee | null>(null);
  const [payrollMsg, setPayrollMsg] = useState('');
  const [payrollError, setPayrollError] = useState('');
  const [deleteConfirmShiftId, setDeleteConfirmShiftId] = useState<string | null>(null);
  const [runPayrollConfirmId, setRunPayrollConfirmId] = useState<string | null>(null);
  const [markPaidConfirmId, setMarkPaidConfirmId] = useState<string | null>(null);
  const [denyModal, setDenyModal] = useState<{ id: string; reason: string } | null>(null);

  const [shiftForm, setShiftForm] = useState<any>({ shiftType: 'regular' });
  const [leaveForm, setLeaveForm] = useState<any>({ leaveType: 'pto' });
  const [periodForm, setPeriodForm] = useState<any>({ periodType: 'biweekly' });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [empR, attendR, leaveR, periodsR, otR] = await Promise.all([
        fetch('/api/payroll/employees', { headers }),
        fetch(`/api/payroll/attendance?startDate=${new Date(weekOf).toISOString()}&endDate=${new Date(weekOf.getTime() + 6 * 86400000).toISOString()}`, { headers }),
        fetch('/api/payroll/leave', { headers }),
        fetch('/api/payroll/pay-periods', { headers }),
        fetch('/api/payroll/overtime-rules', { headers }),
      ]);
      if (empR.ok) setEmployees(await empR.json());
      if (attendR.ok) { const d = await attendR.json(); setAttendance(d.records); setAttSummary(d.summary); }
      if (leaveR.ok) setLeaveRequests(await leaveR.json());
      if (periodsR.ok) setPayPeriods(await periodsR.json());
      if (otR.ok) setOtRule(await otR.json());

      // Load shifts for current week
      const shiftEnd = new Date(weekOf.getTime() + 6 * 86400000 + 86399999);
      const shiftR = await fetch(`/api/payroll/schedule?startDate=${weekOf.toISOString()}&endDate=${shiftEnd.toISOString()}`, { headers });
      if (shiftR.ok) setShifts(await shiftR.json());
    } catch {
      setPayrollError('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  }, [user, weekOf]);

  useEffect(() => { load(); }, [load]);

  const loadStubs = async () => {
    const r = await fetch('/api/payroll/paystubs', { headers });
    if (r.ok) setPayStubs(await r.json());
  };
  useEffect(() => { if (tab === 'stubs') loadStubs(); }, [tab]);

  if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: THEME.pageBg }}><div style={{ fontSize: 18, color: THEME.textMuted }}>Loading...</div></div>;

  // --- Computed values ------------------------------------------------------
  const activeEmps = employees.filter((e) => !e.terminatedAt);
  const pendingLeave = leaveRequests.filter((l) => l.status === 'pending');
  const openPeriods = payPeriods.filter((p) => p.status === 'open' || p.status === 'processing');
  const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekOf); d.setDate(weekOf.getDate() + i); return d; });

  const getShiftForTechDay = (techId: string, date: Date) => {
    const ds = date.toISOString().split('T')[0];
    return shifts.find((s) => s.techId === techId && new Date(s.date).toISOString().split('T')[0] === ds);
  };

  const totalPayrollThisMonth = payPeriods.filter((p) => p.status !== 'open').reduce((s, p) => s + (p.totalGross ?? 0), 0);
  const lateToday = attendance.filter((a) => a.status === 'late').length;
  const absentToday = attendance.filter((a) => a.status === 'absent').length;

  // --- Handlers ------------------------------------------------------------
  const addShift = async () => {
    const r = await fetch('/api/payroll/schedule', { method: 'POST', headers, body: JSON.stringify(shiftForm) });
    if (r.ok) { setShowAddShift(false); setShiftForm({ shiftType: 'regular' }); load(); }
    else { const d = await r.json(); setPayrollError(d.error || 'Failed to add shift'); }
  };

  const deleteShift = async (id: string) => {
    await fetch(`/api/payroll/schedule/${id}`, { method: 'DELETE', headers });
    setDeleteConfirmShiftId(null);
    load();
  };

  const approveLeave = async (id: string, status: 'approved' | 'denied', deniedReason?: string) => {
    await fetch(`/api/payroll/leave/${id}`, { method: 'PUT', headers, body: JSON.stringify({ status, deniedReason }) });
    load();
  };

  const addLeave = async () => {
    const r = await fetch('/api/payroll/leave', { method: 'POST', headers, body: JSON.stringify(leaveForm) });
    if (r.ok) { setShowAddLeave(false); setLeaveForm({ leaveType: 'pto' }); load(); }
    else { const d = await r.json(); setPayrollError(d.error || 'Failed to add leave request'); }
  };

  const createPeriod = async () => {
    const r = await fetch('/api/payroll/pay-periods', { method: 'POST', headers, body: JSON.stringify(periodForm) });
    if (r.ok) { setShowAddPeriod(false); setPeriodForm({ periodType: 'biweekly' }); load(); }
    else { const d = await r.json(); setPayrollError(d.error || 'Failed to create pay period'); }
  };

  const runPayroll = async (periodId: string) => {
    setRunPayrollConfirmId(null);
    setRunningPayroll(true);
    try {
      const r = await fetch(`/api/payroll/pay-periods/${periodId}`, { method: 'PUT', headers, body: JSON.stringify({ action: 'run' }) });
      const d = await r.json();
      if (r.ok) {
        setPayrollMsg(` Payroll complete! ${d.summary.employeeCount} employees  -  Gross: ${fmt(d.summary.totalGross)}, Net: ${fmt(d.summary.totalNet)}`);
        setTimeout(() => setPayrollMsg(''), 6000);
        load();
      } else { setPayrollError('Error: ' + (d.error || 'Failed to run payroll')); }
    } finally { setRunningPayroll(false); }
  };

  const markPeriodPaid = async (periodId: string) => {
    await fetch(`/api/payroll/pay-periods/${periodId}`, { method: 'PUT', headers, body: JSON.stringify({ status: 'paid' }) });
    setMarkPaidConfirmId(null);
    load();
  };

  const saveOtRule = async () => {
    const r = await fetch('/api/payroll/overtime-rules', { method: 'PUT', headers, body: JSON.stringify(otRule) });
    if (r.ok) { setPayrollMsg('Overtime rules saved!'); setTimeout(() => setPayrollMsg(''), 3000); }
    else { setPayrollError('Failed to save overtime rules'); }
  };

  const saveEmployee = async () => {
    if (!showEditEmployee) return;
    await fetch(`/api/payroll/employees/${showEditEmployee.id}`, { method: 'PUT', headers, body: JSON.stringify(showEditEmployee) });
    setShowEditEmployee(null);
    load();
  };

  const exportPayStubsCsv = () => {
    if (payStubs.length === 0) return;
    const rows = [
      ['Employee', 'Department', 'Job Title', 'Period Start', 'Period End', 'Regular Hours', 'Overtime Hours', 'Gross Pay', 'Deductions', 'Net Pay', 'YTD Gross', 'Status'],
      ...payStubs.map((s) => [
        `${s.tech?.firstName ?? ''} ${s.tech?.lastName ?? ''}`.trim(),
        s.tech?.department ?? '',
        s.tech?.jobTitle ?? '',
        s.payPeriod?.startDate ? new Date(s.payPeriod.startDate).toISOString().slice(0, 10) : '',
        s.payPeriod?.endDate ? new Date(s.payPeriod.endDate).toISOString().slice(0, 10) : '',
        String(s.regularHours ?? 0),
        String(s.overtimeHours ?? 0),
        String(s.grossPay ?? 0),
        String(s.totalDeductions ?? 0),
        String(s.netPay ?? 0),
        String(s.ytdGross ?? 0),
        s.status ?? '',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payroll-information-paystubs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- Sub-components -------------------------------------------------------
  const TabBtn = ({ id, label, badge }: { id: typeof tab; label: string; badge?: number }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
        background: tab === id ? THEME.accent : 'transparent',
        color: tab === id ? '#fff' : THEME.textMuted,
        position: 'relative',
      }}
    >
      {label}
      {badge ? (
        <span style={{ position: 'absolute', top: 2, right: 2, background: '#e53e3e', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>
      ) : null}
    </button>
  );

  const Card = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) => (
    <div style={{ background: THEME.surface, border: `1px solid ${THEME.borderSoft}`, borderRadius: 12, padding: '20px 24px', flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 13, color: THEME.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? THEME.text }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: THEME.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const BadgeStatus = ({ status }: { status: string }) => {
    const s = STATUS_BADGE[status] ?? STATUS_BADGE.scheduled;
    return <span style={{ background: s.bg, color: s.color, borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{s.label}</span>;
  };

  // --- Tab: Overview --------------------------------------------------------
  const OverviewTab = () => (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <Card label="Active Employees" value={String(activeEmps.length)} sub={`${employees.filter(e => e.terminatedAt).length} terminated`} />
        <Card label="Total Payroll (All Time)" value={fmt(totalPayrollThisMonth)} sub="approved/paid periods" color="#e5332a" />
        <Card label="Late Today" value={String(lateToday)} sub="based on today's schedule" color={lateToday > 0 ? '#d97706' : THEME.text} />
        <Card label="Absent Today" value={String(absentToday)} sub="no clock-in recorded" color={absentToday > 0 ? '#dc2626' : THEME.text} />
        <Card label="Pending Leave Requests" value={String(pendingLeave.length)} sub="awaiting approval" color={pendingLeave.length > 0 ? '#7c3aed' : THEME.text} />
        <Card label="Open Pay Periods" value={String(openPeriods.length)} sub="ready to run" />
      </div>

      {/* Alerts section */}
      {(lateToday > 0 || absentToday > 0 || pendingLeave.length > 0) && (
        <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#f59e0b' }}><FaExclamationTriangle style={{marginRight:4}} /> Alerts</div>
          {attendance.filter(a => a.status === 'late').map(a => (
            <div key={a.timeEntryId} style={{ padding: '6px 0', borderBottom: '1px solid rgba(245,158,11,0.25)', fontSize: 14, color: THEME.text }}>
              <FaClock style={{marginRight:4}} /> <strong>{a.tech.firstName} {a.tech.lastName}</strong> arrived <strong>{a.lateMinutes} min late</strong>
              {a.scheduledStart && ` (scheduled ${a.scheduledStart}`})
            </div>
          ))}
          {attendance.filter(a => a.status === 'absent').map(a => (
            <div key={a.shiftId} style={{ padding: '6px 0', borderBottom: '1px solid rgba(245,158,11,0.25)', fontSize: 14, color: '#f87171' }}>
              <FaTimesCircle style={{marginRight:4}} /> <strong>{a.tech.firstName} {a.tech.lastName}</strong>  -  no clock-in (scheduled {a.scheduledStart})
            </div>
          ))}
          {pendingLeave.slice(0, 3).map(l => (
            <div key={l.id} style={{ padding: '6px 0', fontSize: 14, color: '#fca5a5' }}>
              <FaClipboardList style={{marginRight:4}} /> <strong>{l.tech.firstName} {l.tech.lastName}</strong> requested {l.leaveType.toUpperCase()}  -  {fmtDate(l.startDate)} to {fmtDate(l.endDate)}
            </div>
          ))}
        </div>
      )}

      {/* Recent pay periods */}
      <div style={{ background: THEME.surface, border: `1px solid ${THEME.borderSoft}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 16, color: THEME.text }}>Recent Pay Periods</div>
        {payPeriods.slice(0, 5).map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${THEME.borderSoft}` }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: THEME.text }}>{fmtDate(p.startDate)}  -  {fmtDate(p.endDate)}</div>
              <div style={{ fontSize: 12, color: THEME.textMuted }}>{p.periodType}  {p.employeeCount} employees</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, color: THEME.text }}>{fmt(p.totalGross)}</div>
              <span style={{ background: p.status === 'paid' ? 'rgba(34,197,94,0.16)' : p.status === 'processing' ? 'rgba(229,51,42,0.2)' : 'rgba(156,163,175,0.2)', color: p.status === 'paid' ? '#4ade80' : p.status === 'processing' ? '#f87171' : '#d1d5db', borderRadius: 8, padding: '2px 8px', fontSize: 11 }}>{p.status.toUpperCase()}</span>
            </div>
          </div>
        ))}
        {payPeriods.length === 0 && <div style={{ color: THEME.textMuted, textAlign: 'center', padding: 24 }}>No pay periods yet. Create one to get started.</div>}
      </div>
    </div>
  );

  // --- Tab: Schedule --------------------------------------------------------
  const ScheduleTab = () => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { const d = new Date(weekOf); d.setDate(d.getDate() - 7); setWeekOf(d); }} style={{ padding: '6px 14px', border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, background: THEME.surfaceAlt, color: THEME.text, cursor: 'pointer' }}><FaArrowLeft style={{marginRight:4}} /> Prev</button>
          <div style={{ fontWeight: 700, fontSize: 16, color: THEME.text }}>
            Week of {weekOf.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <button onClick={() => { const d = new Date(weekOf); d.setDate(d.getDate() + 7); setWeekOf(d); }} style={{ padding: '6px 14px', border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, background: THEME.surfaceAlt, color: THEME.text, cursor: 'pointer' }}>Next <FaArrowRight style={{marginRight:4}} /></button>
          <button onClick={() => setWeekOf(weekStart())} style={{ padding: '6px 14px', border: `1px solid ${THEME.accent}`, borderRadius: 8, background: 'rgba(229,51,42,0.12)', color: THEME.accent, cursor: 'pointer', fontSize: 12 }}>Today</button>
        </div>
        {user?.role === 'shop' && (
          <button onClick={() => setShowAddShift(true)} style={{ padding: '8px 18px', background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ Add Shift</button>
        )}
      </div>

      {/* Schedule grid */}
      <div style={{ overflowX: 'auto', background: THEME.surface, border: `1px solid ${THEME.borderSoft}`, borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ background: THEME.surfaceAlt }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: THEME.text, borderBottom: `2px solid ${THEME.borderSoft}`, minWidth: 150 }}>Employee</th>
              {weekDates.map((d, i) => {
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <th key={i} style={{ padding: '12px 8px', textAlign: 'center', borderBottom: `2px solid ${THEME.borderSoft}`, background: isToday ? 'rgba(229,51,42,0.14)' : undefined, minWidth: 120 }}>
                    <div style={{ fontWeight: 700, color: isToday ? THEME.accent : THEME.text }}>{DAYS[d.getDay()]}</div>
                    <div style={{ fontSize: 12, color: THEME.textMuted }}>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {activeEmps.map((emp) => (
              <tr key={emp.id} style={{ borderBottom: `1px solid ${THEME.borderSoft}` }}>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: DEPT_COLORS[emp.department ?? 'default'] ?? '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>
                      {emp.firstName[0]}{emp.lastName[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: THEME.text }}>{emp.firstName} {emp.lastName}</div>
                      <div style={{ fontSize: 11, color: THEME.textMuted }}>{emp.jobTitle ?? emp.role}</div>
                    </div>
                  </div>
                </td>
                {weekDates.map((d, i) => {
                  const shift = getShiftForTechDay(emp.id, d);
                  const isToday = d.toDateString() === new Date().toDateString();
                  return (
                    <td key={i} style={{ padding: 6, textAlign: 'center', background: isToday ? 'rgba(229,51,42,0.08)' : undefined, verticalAlign: 'middle' }}>
                      {shift ? (
                        <div style={{ background: shift.status === 'no-show' ? 'rgba(229,51,42,0.2)' : shift.status === 'late' ? 'rgba(245,158,11,0.2)' : 'rgba(229,51,42,0.12)', border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, padding: '6px 4px', fontSize: 11, position: 'relative' }}>
                          <div style={{ fontWeight: 600, color: THEME.text }}>{shift.startTime}-{shift.endTime}</div>
                          <div style={{ color: THEME.textMuted }}>{shift.shiftType}</div>
                          {shift.lateMinutes > 0 && <div style={{ color: '#b45309', fontSize: 10 }}><FaClock style={{marginRight:4}} /> {shift.lateMinutes}m late</div>}
                          {user?.role === 'shop' && (
                            <button onClick={() => setDeleteConfirmShiftId(shift.id)} style={{ position: 'absolute', top: 2, right: 2, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 12, lineHeight: 1 }}></button>
                          )}
                        </div>
                      ) : (
                        <div style={{ color: '#4b5563', fontSize: 20, lineHeight: 1 }}> - </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add shift modal */}
      {showAddShift && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: THEME.surface, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 32, width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 24 }}>Add Shift</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Employee</label>
                <select value={shiftForm.techId ?? ''} onChange={e => setShiftForm((f: any) => ({ ...f, techId: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8 }}>
                  <option value="">Select employee...</option>
                  {activeEmps.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Date</label>
                <input type="date" value={shiftForm.date ?? ''} onChange={e => setShiftForm((f: any) => ({ ...f, date: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Start Time</label>
                  <input type="time" value={shiftForm.startTime ?? ''} onChange={e => setShiftForm((f: any) => ({ ...f, startTime: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>End Time</label>
                  <input type="time" value={shiftForm.endTime ?? ''} onChange={e => setShiftForm((f: any) => ({ ...f, endTime: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8 }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Shift Type</label>
                <select value={shiftForm.shiftType ?? 'regular'} onChange={e => setShiftForm((f: any) => ({ ...f, shiftType: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8 }}>
                  <option value="regular">Regular</option>
                  <option value="overtime">Overtime</option>
                  <option value="on-call">On-Call</option>
                  <option value="training">Training</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Position (optional)</label>
                <input type="text" value={shiftForm.position ?? ''} onChange={e => setShiftForm((f: any) => ({ ...f, position: e.target.value }))} placeholder="e.g. Lead Tech" style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Notes</label>
                <textarea value={shiftForm.notes ?? ''} onChange={e => setShiftForm((f: any) => ({ ...f, notes: e.target.value }))} rows={2} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, resize: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={addShift} style={{ flex: 1, padding: '10px', background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Save Shift</button>
              <button onClick={() => setShowAddShift(false)} style={{ flex: 1, padding: '10px', background: THEME.surfaceAlt, color: THEME.textMuted, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // --- Tab: Attendance ------------------------------------------------------
  const AttendanceTab = () => (
    <div>
      {attSummary && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <Card label="Present" value={String(attSummary.present)} color="#16a34a" />
          <Card label="Late" value={String(attSummary.late)} color="#d97706" />
          <Card label="Absent" value={String(attSummary.absent)} color="#dc2626" />
          <Card label="Unscheduled" value={String(attSummary.unscheduled)} color="#7c3aed" />
          <Card label="Total Shifts" value={String(attSummary.totalShifts)} />
        </div>
      )}
      <div style={{ background: THEME.surface, border: `1px solid ${THEME.borderSoft}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: THEME.surfaceAlt, borderBottom: `2px solid ${THEME.borderSoft}` }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: THEME.text }}>Employee</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: THEME.text }}>Date</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: THEME.text }}>Scheduled</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: THEME.text }}>Actual Clock In</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: THEME.text }}>Clock Out</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: THEME.text }}>Hours</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: THEME.text }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: THEME.text }}>Approved</th>
            </tr>
          </thead>
          <tbody>
            {attendance.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No attendance records for this week</td></tr>
            )}
            {attendance.map((a, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${THEME.borderSoft}`, background: a.status === 'absent' ? 'rgba(229,51,42,0.14)' : a.status === 'late' ? 'rgba(245,158,11,0.12)' : undefined }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: THEME.text }}>{a.tech.firstName} {a.tech.lastName}</td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: THEME.textMuted }}>{fmtDate(a.date)}</td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: THEME.text }}>{a.scheduledStart ?? ' - '} - {a.scheduledEnd ?? ' - '}</td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: THEME.text }}>
                  {a.actualClockIn ? new Date(a.actualClockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ' - '}
                  {a.lateMinutes > 0 && <span style={{ color: '#b45309', fontSize: 11, marginLeft: 6 }}>+{a.lateMinutes}m</span>}
                </td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: THEME.text }}>
                  {a.actualClockOut ? new Date(a.actualClockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : <span style={{ color: '#9ca3af' }}>Still clocked in</span>}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: THEME.text }}>{fmtHrs(a.hoursWorked)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}><BadgeStatus status={a.status} /></td>
                <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 18 }}>{a.approved ? <FaCheckCircle style={{marginRight:4}} /> : <FaRegSquare style={{marginRight:4}} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // --- Tab: Leave Requests --------------------------------------------------
  const LeaveTab = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Leave Requests</div>
        <button onClick={() => setShowAddLeave(true)} style={{ padding: '8px 18px', background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ New Request</button>
      </div>

      {/* Pending */}
      {pendingLeave.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#fca5a5', marginBottom: 12 }}>Pending Approval ({pendingLeave.length})</div>
          {pendingLeave.map(l => (
            <div key={l.id} style={{ background: 'rgba(229,51,42,0.08)', border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 16, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, color: THEME.text }}>{l.tech.firstName} {l.tech.lastName}</div>
                <div style={{ fontSize: 13, color: THEME.textMuted, marginTop: 4 }}>
                  <span style={{ background: 'rgba(229,51,42,0.2)', color: '#fca5a5', borderRadius: 6, padding: '2px 8px', marginRight: 8, fontSize: 11 }}>{l.leaveType.toUpperCase()}</span>
                  {fmtDate(l.startDate)}  -  {fmtDate(l.endDate)}  {l.totalHours}h
                </div>
                {l.reason && <div style={{ fontSize: 12, color: THEME.textMuted, marginTop: 4 }}>Reason: {l.reason}</div>}
              </div>
              {user?.role === 'shop' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => approveLeave(l.id, 'approved')} style={{ padding: '6px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}><FaCheck style={{marginRight:4}} /> Approve</button>
                  <button onClick={() => setDenyModal({ id: l.id, reason: '' })} style={{ padding: '6px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}><FaTimes style={{marginRight:4}} /> Deny</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* All requests */}
      <div style={{ background: THEME.surface, border: `1px solid ${THEME.borderSoft}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: THEME.surfaceAlt, borderBottom: `2px solid ${THEME.borderSoft}` }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: THEME.text }}>Employee</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: THEME.text }}>Type</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: THEME.text }}>Date Range</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: THEME.text }}>Hours</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: THEME.text }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {leaveRequests.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No leave requests</td></tr>
            )}
            {leaveRequests.map(l => (
              <tr key={l.id} style={{ borderBottom: `1px solid ${THEME.borderSoft}` }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: THEME.text }}>{l.tech.firstName} {l.tech.lastName}</td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ background: 'rgba(229,51,42,0.2)', color: '#fca5a5', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{l.leaveType.toUpperCase()}</span>
                </td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: THEME.text }}>{fmtDate(l.startDate)}  -  {fmtDate(l.endDate)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: THEME.text }}>{l.totalHours}h</td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <span style={{ background: l.status === 'approved' ? 'rgba(34,197,94,0.16)' : l.status === 'denied' ? 'rgba(229,51,42,0.18)' : 'rgba(245,158,11,0.16)', color: l.status === 'approved' ? '#4ade80' : l.status === 'denied' ? '#f87171' : '#fbbf24', borderRadius: 8, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{l.status.toUpperCase()}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddLeave && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: THEME.surface, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 32, width: 480 }}>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 24 }}>New Leave Request</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Employee</label>
                <select value={leaveForm.techId ?? ''} onChange={e => setLeaveForm((f: any) => ({ ...f, techId: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8 }}>
                  <option value="">Select...</option>
                  {activeEmps.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Leave Type</label>
                <select value={leaveForm.leaveType} onChange={e => setLeaveForm((f: any) => ({ ...f, leaveType: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8 }}>
                  {['pto', 'vacation', 'sick', 'personal', 'unpaid', 'bereavement', 'jury'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Start Date</label>
                  <input type="date" value={leaveForm.startDate ?? ''} onChange={e => setLeaveForm((f: any) => ({ ...f, startDate: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>End Date</label>
                  <input type="date" value={leaveForm.endDate ?? ''} onChange={e => setLeaveForm((f: any) => ({ ...f, endDate: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8 }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Total Hours</label>
                <input type="number" value={leaveForm.totalHours ?? ''} onChange={e => setLeaveForm((f: any) => ({ ...f, totalHours: Number(e.target.value) }))} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Reason</label>
                <textarea value={leaveForm.reason ?? ''} onChange={e => setLeaveForm((f: any) => ({ ...f, reason: e.target.value }))} rows={2} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, resize: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={addLeave} style={{ flex: 1, padding: '10px', background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Submit Request</button>
              <button onClick={() => setShowAddLeave(false)} style={{ flex: 1, padding: '10px', background: THEME.surfaceAlt, color: THEME.textMuted, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // --- Tab: Pay Periods -----------------------------------------------------
  const PayPeriodsTab = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Pay Periods</div>
        {user?.role === 'shop' && (
          <button onClick={() => setShowAddPeriod(true)} style={{ padding: '8px 18px', background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ New Period</button>
        )}
      </div>

      {payPeriods.map(p => (
        <div key={p.id} style={{ background: THEME.surface, border: `1px solid ${THEME.borderSoft}`, borderRadius: 12, padding: 20, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: THEME.text }}>{fmtDate(p.startDate)}  -  {fmtDate(p.endDate)}</div>
              <div style={{ fontSize: 13, color: THEME.textMuted, marginTop: 4 }}>
                {p.periodType}  Pay date: {p.payDate ? fmtDate(p.payDate) : 'Not set'}  {p.employeeCount} employees
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: THEME.textMuted }}>Gross</div>
                <div style={{ fontWeight: 800, fontSize: 20, color: THEME.text }}>{fmt(p.totalGross)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: THEME.textMuted }}>Net</div>
                <div style={{ fontWeight: 800, fontSize: 20, color: '#16a34a' }}>{fmt(p.totalNet)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: THEME.textMuted }}>OT</div>
                <div style={{ fontWeight: 700, color: '#d97706' }}>{fmt(p.totalOvertimePay)}</div>
              </div>
            </div>
          </div>
          {user?.role === 'shop' && (
            <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {(p.status === 'open' || p.status === 'processing') && (
                <button onClick={() => setRunPayrollConfirmId(p.id)} disabled={runningPayroll} style={{ padding: '8px 18px', background: runningPayroll ? '#9ca3af' : '#e5332a', color: '#fff', border: 'none', borderRadius: 8, cursor: runningPayroll ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                  {runningPayroll ? <><FaHourglassHalf style={{marginRight:4}} /> Running...</> : <><FaCaretRight style={{marginRight:4}} /> Run Payroll</>}
                </button>
              )}
              {p.status === 'processing' && (
                <button onClick={() => setMarkPaidConfirmId(p.id)} style={{ padding: '8px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}><FaCheck style={{marginRight:4}} /> Mark as Paid</button>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', background: p.status === 'paid' ? 'rgba(34,197,94,0.16)' : p.status === 'processing' ? 'rgba(59,130,246,0.16)' : 'rgba(156,163,175,0.16)', color: p.status === 'paid' ? '#4ade80' : p.status === 'processing' ? '#93c5fd' : '#d1d5db', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13 }}>
                {p.status.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      ))}
      {payPeriods.length === 0 && <div style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>No pay periods yet.</div>}

      {showAddPeriod && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: THEME.surface, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 32, width: 440 }}>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 24 }}>New Pay Period</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Period Type</label>
                <select value={periodForm.periodType} onChange={e => setPeriodForm((f: any) => ({ ...f, periodType: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8 }}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-Weekly (every 2 weeks)</option>
                  <option value="semimonthly">Semi-Monthly (twice/month)</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Start Date</label>
                  <input type="date" value={periodForm.startDate ?? ''} onChange={e => setPeriodForm((f: any) => ({ ...f, startDate: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>End Date</label>
                  <input type="date" value={periodForm.endDate ?? ''} onChange={e => setPeriodForm((f: any) => ({ ...f, endDate: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8 }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Pay Date (optional)</label>
                <input type="date" value={periodForm.payDate ?? ''} onChange={e => setPeriodForm((f: any) => ({ ...f, payDate: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={createPeriod} style={{ flex: 1, padding: '10px', background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Create Period</button>
              <button onClick={() => setShowAddPeriod(false)} style={{ flex: 1, padding: '10px', background: THEME.surfaceAlt, color: THEME.textMuted, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // --- Tab: Pay Stubs -------------------------------------------------------
  const PayStubsTab = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Pay Stubs</div>
        <button
          onClick={exportPayStubsCsv}
          disabled={payStubs.length === 0}
          style={{
            background: payStubs.length === 0 ? '#9ca3af' : '#e5332a',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 700,
            cursor: payStubs.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          Export CSV
        </button>
      </div>
      <div style={{ background: THEME.surface, border: `1px solid ${THEME.borderSoft}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: THEME.surfaceAlt, borderBottom: `2px solid ${THEME.borderSoft}` }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: THEME.text }}>Employee</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: THEME.text }}>Period</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: THEME.text }}>Reg Hrs</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: THEME.text }}>OT Hrs</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: THEME.text }}>Gross</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: THEME.text }}>Taxes</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: THEME.text }}>Net</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: THEME.text }}>YTD Gross</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: THEME.text }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {payStubs.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No pay stubs. Run payroll to generate them.</td></tr>
            )}
            {payStubs.map(s => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${THEME.borderSoft}` }}>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ fontWeight: 600, color: THEME.text }}>{s.tech?.firstName} {s.tech?.lastName}</div>
                  <div style={{ fontSize: 11, color: THEME.textMuted }}>{s.tech?.department ?? ''}  {s.tech?.jobTitle ?? ''}</div>
                </td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: THEME.textMuted }}>
                  {s.payPeriod ? `${fmtDate(s.payPeriod.startDate)}  -  ${fmtDate(s.payPeriod.endDate)}` : ' - '}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: THEME.text }}>{fmtHrs(s.regularHours)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: s.overtimeHours > 0 ? '#d97706' : undefined, fontWeight: s.overtimeHours > 0 ? 700 : 400 }}>{fmtHrs(s.overtimeHours)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: THEME.text }}>{fmt(s.grossPay)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: '#dc2626' }}>{fmt(s.totalDeductions)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{fmt(s.netPay)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: THEME.textMuted }}>{fmt(s.ytdGross)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <span style={{ background: s.status === 'paid' ? 'rgba(34,197,94,0.16)' : s.status === 'approved' ? 'rgba(59,130,246,0.16)' : 'rgba(156,163,175,0.16)', color: s.status === 'paid' ? '#4ade80' : s.status === 'approved' ? '#93c5fd' : '#d1d5db', borderRadius: 8, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{s.status.toUpperCase()}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // --- Tab: Settings --------------------------------------------------------
  const SettingsTab = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
      {/* Overtime Rules */}
      <div style={{ background: THEME.surface, border: `1px solid ${THEME.borderSoft}`, borderRadius: 12, padding: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 20 }}><FaCog style={{marginRight:4}} /> Overtime Rules</div>
        {otRule && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={otRule.weeklyOvertimeEnabled} onChange={e => setOtRule(r => r ? { ...r, weeklyOvertimeEnabled: e.target.checked } : r)} />
              <span style={{ fontWeight: 600 }}>Weekly Overtime</span>
            </label>
            {otRule.weeklyOvertimeEnabled && (
              <div style={{ marginLeft: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, color: THEME.textMuted, display: 'block', marginBottom: 4 }}>OT Threshold (hrs/wk)</label>
                    <input type="number" value={otRule.weeklyOvertimeThreshold} onChange={e => setOtRule(r => r ? { ...r, weeklyOvertimeThreshold: Number(e.target.value) } : r)} style={{ width: '100%', padding: '6px 10px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 6 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: THEME.textMuted, display: 'block', marginBottom: 4 }}>OT Multiplier</label>
                    <input type="number" step="0.1" value={otRule.overtimeMultiplier} onChange={e => setOtRule(r => r ? { ...r, overtimeMultiplier: Number(e.target.value) } : r)} style={{ width: '100%', padding: '6px 10px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 6 }} />
                  </div>
                </div>
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={otRule.dailyOvertimeEnabled} onChange={e => setOtRule(r => r ? { ...r, dailyOvertimeEnabled: e.target.checked } : r)} />
              <span style={{ fontWeight: 600 }}>Daily Overtime (e.g. California)</span>
            </label>
            {otRule.dailyOvertimeEnabled && (
              <div style={{ marginLeft: 24 }}>
                <label style={{ fontSize: 12, color: THEME.textMuted, display: 'block', marginBottom: 4 }}>Daily OT Threshold (hrs/day)</label>
                <input type="number" value={otRule.dailyOvertimeThreshold} onChange={e => setOtRule(r => r ? { ...r, dailyOvertimeThreshold: Number(e.target.value) } : r)} style={{ width: '100%', padding: '6px 10px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 6 }} />
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={otRule.doubleTimeEnabled} onChange={e => setOtRule(r => r ? { ...r, doubleTimeEnabled: e.target.checked } : r)} />
              <span style={{ fontWeight: 600 }}>Double Time</span>
            </label>
            {otRule.doubleTimeEnabled && (
              <div style={{ marginLeft: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: THEME.textMuted, display: 'block', marginBottom: 4 }}>Double Time Threshold (hrs)</label>
                  <input type="number" value={otRule.doubleTimeThreshold} onChange={e => setOtRule(r => r ? { ...r, doubleTimeThreshold: Number(e.target.value) } : r)} style={{ width: '100%', padding: '6px 10px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: THEME.textMuted, display: 'block', marginBottom: 4 }}>Double Time Multiplier</label>
                  <input type="number" step="0.1" value={otRule.doubleTimeMultiplier} onChange={e => setOtRule(r => r ? { ...r, doubleTimeMultiplier: Number(e.target.value) } : r)} style={{ width: '100%', padding: '6px 10px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 6 }} />
                </div>
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={otRule.seventhDayRule} onChange={e => setOtRule(r => r ? { ...r, seventhDayRule: e.target.checked } : r)} />
              <span style={{ fontWeight: 600 }}>7th Consecutive Day Rule</span>
            </label>
            {user?.role === 'shop' && (
              <button onClick={saveOtRule} style={{ padding: '10px', background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Save OT Rules</button>
            )}
          </div>
        )}
      </div>

      {/* Employee pay settings */}
      <div style={{ background: THEME.surface, border: `1px solid ${THEME.borderSoft}`, borderRadius: 12, padding: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 20 }}><FaUsers style={{marginRight:4}} /> Employee Pay Settings</div>
        {activeEmps.map(emp => (
          <div key={emp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${THEME.borderSoft}` }}>
            <div>
              <div style={{ fontWeight: 600, color: THEME.text }}>{emp.firstName} {emp.lastName}</div>
              <div style={{ fontSize: 12, color: THEME.textMuted }}>
                {emp.payType === 'salary' ? `Salary: ${fmt(emp.salary ?? 0)}/yr` : `${fmt(emp.hourlyRate)}/hr`}
                {emp.department && `  ${emp.department}`}
              </div>
            </div>
            {user?.role === 'shop' && (
              <button onClick={() => setShowEditEmployee(emp)} style={{ padding: '6px 14px', border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, background: THEME.surfaceAlt, color: THEME.textMuted, cursor: 'pointer', fontSize: 13 }}>Edit</button>
            )}
          </div>
        ))}

        {showEditEmployee && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: THEME.surface, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 32, width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 24 }}>Edit: {showEditEmployee.firstName} {showEditEmployee.lastName}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Job Title', key: 'jobTitle', type: 'text' },
                  { label: 'Department', key: 'department', type: 'select', opts: ['service', 'parts', 'admin', 'management'] },
                  { label: 'Employment Type', key: 'employmentType', type: 'select', opts: ['full-time', 'part-time', 'contractor'] },
                  { label: 'Pay Type', key: 'payType', type: 'select', opts: ['hourly', 'salary'] },
                  { label: showEditEmployee.payType === 'salary' ? 'Annual Salary ($)' : 'Hourly Rate ($/hr)', key: showEditEmployee.payType === 'salary' ? 'salary' : 'hourlyRate', type: 'number' },
                  { label: 'Custom OT Rate (leave blank for auto)', key: 'overtimeRate', type: 'number' },
                  { label: 'Hire Date', key: 'hireDate', type: 'date' },
                ].map(({ label, key, type, opts }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>{label}</label>
                    {type === 'select' ? (
                      <select value={(showEditEmployee as any)[key] ?? ''} onChange={e => setShowEditEmployee((emp: any) => ({ ...emp, [key]: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8 }}>
                        {opts?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={type} value={(showEditEmployee as any)[key] ?? ''} onChange={e => setShowEditEmployee((emp: any) => ({ ...emp, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8 }} />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button onClick={saveEmployee} style={{ flex: 1, padding: '10px', background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Save Changes</button>
                <button onClick={() => setShowEditEmployee(null)} style={{ flex: 1, padding: '10px', background: THEME.surfaceAlt, color: THEME.textMuted, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // --- Render ---------------------------------------------------------------
  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto', color: THEME.text, background: THEME.pageBg, borderRadius: 18, border: `1px solid ${THEME.borderSoft}` }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, color: THEME.text }}><FaDollarSign style={{marginRight:4}} /> Payroll Information</h1>
        <p style={{ color: THEME.textMuted, marginTop: 6 }}>Scheduling  Time Tracking  Attendance  Pay Periods  Pay Stubs  Export</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: THEME.surfaceAlt, border: `1px solid ${THEME.borderSoft}`, borderRadius: 12, padding: 4, marginBottom: 28, flexWrap: 'wrap' }}>
        <TabBtn id="overview" label=" Overview" />
        <TabBtn id="schedule" label=" Schedule" />
        <TabBtn id="attendance" label=" Attendance" badge={lateToday + absentToday || undefined} />
        <TabBtn id="leave" label=" Leave" badge={pendingLeave.length || undefined} />
        <TabBtn id="periods" label=" Pay Periods" badge={openPeriods.length || undefined} />
        <TabBtn id="stubs" label=" Pay Stubs" />
        <TabBtn id="settings" label=" Settings" />
      </div>

      {/* Loading indicator */}
      {loading && <div style={{ background: 'rgba(229,51,42,0.12)', borderRadius: 8, border: `1px solid ${THEME.border}`, padding: '10px 16px', marginBottom: 16, color: '#fca5a5', fontSize: 14 }}>Loading payroll data...</div>}

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab />}
      {tab === 'schedule' && <ScheduleTab />}
      {tab === 'attendance' && <AttendanceTab />}
      {tab === 'leave' && <LeaveTab />}
      {tab === 'periods' && <PayPeriodsTab />}
      {tab === 'stubs' && <PayStubsTab />}
      {tab === 'settings' && <SettingsTab />}

      {/* Error toast */}
      {payrollError && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'rgba(229,51,42,0.2)', color: '#fca5a5', border: '1px solid rgba(229,51,42,0.45)', borderRadius: 10, padding: '12px 20px', zIndex: 9999, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.35)', maxWidth: 400 }}>
          {payrollError}
          <button onClick={() => setPayrollError('')} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#fca5a5' }}><FaTimes style={{marginRight:4}} /></button>
        </div>
      )}

      {/* Success toast */}
      {payrollMsg && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'rgba(34,197,94,0.2)', color: '#86efac', border: '1px solid rgba(34,197,94,0.45)', borderRadius: 10, padding: '12px 20px', zIndex: 9999, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.35)', maxWidth: 400 }}>
          {payrollMsg}
        </div>
      )}

      {/* Delete shift confirm modal */}
      {deleteConfirmShiftId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: THEME.surface, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 32, maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}><FaTrash style={{marginRight:4}} /></div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Delete Shift?</h3>
            <p style={{ color: THEME.textMuted, marginBottom: 24 }}>This will permanently remove the shift from the schedule.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteConfirmShiftId(null)} style={{ flex: 1, padding: '10px', background: THEME.surfaceAlt, color: THEME.textMuted, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteShift(deleteConfirmShiftId)} style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Run payroll confirm modal */}
      {runPayrollConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: THEME.surface, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 32, maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}><FaDollarSign style={{marginRight:4}} /></div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Run Payroll?</h3>
            <p style={{ color: THEME.textMuted, marginBottom: 24 }}>This will generate pay stubs for all active employees in this period.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setRunPayrollConfirmId(null)} style={{ flex: 1, padding: '10px', background: THEME.surfaceAlt, color: THEME.textMuted, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => runPayroll(runPayrollConfirmId)} disabled={runningPayroll} style={{ flex: 1, padding: '10px', background: runningPayroll ? '#9ca3af' : '#e5332a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: runningPayroll ? 'not-allowed' : 'pointer' }}>{runningPayroll ? 'Processing...' : 'Run Payroll'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Mark period paid confirm modal */}
      {markPaidConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: THEME.surface, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 32, maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}><FaCheckCircle style={{marginRight:4}} /></div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Mark Period as Paid?</h3>
            <p style={{ color: THEME.textMuted, marginBottom: 24 }}>This action is final and cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setMarkPaidConfirmId(null)} style={{ flex: 1, padding: '10px', background: THEME.surfaceAlt, color: THEME.textMuted, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => markPeriodPaid(markPaidConfirmId)} style={{ flex: 1, padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Confirm Paid</button>
            </div>
          </div>
        </div>
      )}

      {/* Deny leave modal */}
      {denyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: THEME.surface, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 32, maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Deny Leave Request</h3>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Reason for denial (optional)</label>
            <textarea value={denyModal.reason} onChange={e => setDenyModal(d => d ? { ...d, reason: e.target.value } : d)} rows={3} style={{ width: '100%', padding: '8px 12px', background: THEME.surfaceAlt, color: THEME.text, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }} placeholder="Enter reason..." />
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={() => setDenyModal(null)} style={{ flex: 1, padding: '10px', background: THEME.surfaceAlt, color: THEME.textMuted, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => { approveLeave(denyModal.id, 'denied', denyModal.reason); setDenyModal(null); }} style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}><FaTimes style={{marginRight:4}} /> Deny</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



