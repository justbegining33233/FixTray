'use client';

import { useEffect, useState } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { FaCheckCircle, FaClock, FaDollarSign, FaExclamationTriangle, FaPrint } from 'react-icons/fa';

interface EODReport {
  date: string;
  summary: {
    completedJobsCount: number;
    newJobsCount: number;
    openJobsCount: number;
    appointmentsCount: number;
    outstandingBalance: number;
  };
  paymentBreakdown: {
    cash: number;
    card: number;
    check: number;
    transfer: number;
    other: number;
    total: number;
  };
  completedJobs: Array<{
    id: string;
    customer: string;
    tech: string;
    amount: number;
    vehicleType: string;
    completedAt: string;
  }>;
  outstandingWOs: Array<{
    id: string;
    customer: string;
    owed: number;
  }>;
  techHours: Array<{
    techName: string;
    hours: number;
    clockIn: string;
    clockOut: string | null;
  }>;
}

export default function EODReportPage() {
  useRequireAuth(['shop', 'manager']);
  const [report, setReport] = useState<EODReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchReport(selectedDate);
  }, [selectedDate]);

  const fetchReport = async (date: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/shop/eod-report?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setReport(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch EOD report:', err);
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 20,
  };

  const statStyle = (color: string) => ({
    fontSize: 32,
    fontWeight: 700 as const,
    color,
    lineHeight: 1,
  });

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
      <Sidebar role="shop" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb' }}>End-of-Day Report</h1>
            <p style={{ fontSize: 14, color: '#9aa3b2' }}>Daily close-out summary</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#e5e7eb', fontSize: 14 }}
            />
            <button
              onClick={() => window.print()}
              className="no-print"
              style={{ padding: '8px 16px', background: '#6b7280', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
            >
              <FaPrint style={{marginRight:4}} /> Print
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9aa3b2' }}>Loading report...</div>
        ) : !report ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#e5332a' }}>Failed to load report</div>
        ) : (
          <>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div style={cardStyle}>
                <div style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 8 }}>Completed Jobs</div>
                <div style={statStyle('#22c55e')}>{report.summary.completedJobsCount}</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 8 }}>New Jobs</div>
                <div style={statStyle('#e5332a')}>{report.summary.newJobsCount}</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 8 }}>Still Open</div>
                <div style={statStyle('#f59e0b')}>{report.summary.openJobsCount}</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 8 }}>Appointments</div>
                <div style={statStyle('#a855f7')}>{report.summary.appointmentsCount}</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 8 }}>Outstanding</div>
                <div style={statStyle('#e5332a')}>${report.summary.outstandingBalance.toFixed(2)}</div>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div style={{ ...cardStyle, marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 16 }}><FaDollarSign style={{marginRight:4}} /> Payment Breakdown</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                {(['cash', 'card', 'check', 'transfer', 'other'] as const).map(method => (
                  <div key={method} style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#9aa3b2', textTransform: 'capitalize', marginBottom: 4 }}>{method}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb' }}>${report.paymentBreakdown[method].toFixed(2)}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#e5e7eb' }}>Total Revenue</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#22c55e' }}>${report.paymentBreakdown.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Completed Jobs Table */}
            <div style={{ ...cardStyle, marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 16 }}><FaCheckCircle style={{marginRight:4}} /> Completed Jobs</h2>
              {report.completedJobs.length === 0 ? (
                <div style={{ color: '#9aa3b2', fontSize: 14, textAlign: 'center', padding: 20 }}>No jobs completed today</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#9aa3b2', fontWeight: 600 }}>WO #</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#9aa3b2', fontWeight: 600 }}>Customer</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#9aa3b2', fontWeight: 600 }}>Tech</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#9aa3b2', fontWeight: 600 }}>Vehicle</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 12, color: '#9aa3b2', fontWeight: 600 }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.completedJobs.map(job => (
                        <tr key={job.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: '#e5e7eb' }}>{job.id.slice(0, 8)}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: '#e5e7eb' }}>{job.customer}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: '#e5e7eb' }}>{job.tech}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: '#e5e7eb' }}>{job.vehicleType}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: '#22c55e', textAlign: 'right' }}>${job.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Outstanding Balances */}
            {report.outstandingWOs.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 16 }}><FaExclamationTriangle style={{marginRight:4}} /> Outstanding Balances</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#9aa3b2', fontWeight: 600 }}>WO #</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#9aa3b2', fontWeight: 600 }}>Customer</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 12, color: '#9aa3b2', fontWeight: 600 }}>Owed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.outstandingWOs.map(wo => (
                        <tr key={wo.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: '#e5e7eb' }}>{wo.id.slice(0, 8)}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: '#e5e7eb' }}>{wo.customer}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: '#e5332a', textAlign: 'right', fontWeight: 600 }}>${wo.owed.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tech Hours */}
            {report.techHours.length > 0 && (
              <div style={cardStyle}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 16 }}><FaClock style={{marginRight:4}} /> Tech Hours</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#9aa3b2', fontWeight: 600 }}>Tech</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#9aa3b2', fontWeight: 600 }}>Clock In</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#9aa3b2', fontWeight: 600 }}>Clock Out</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 12, color: '#9aa3b2', fontWeight: 600 }}>Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.techHours.map((entry, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: '#e5e7eb' }}>{entry.techName}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: '#e5e7eb' }}>{new Date(entry.clockIn).toLocaleTimeString()}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: '#e5e7eb' }}>{entry.clockOut ? new Date(entry.clockOut).toLocaleTimeString() : 'Still clocked in'}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: '#e5332a', textAlign: 'right', fontWeight: 600 }}>{entry.hours.toFixed(1)}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

