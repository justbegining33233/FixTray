'use client';

import { FaCalendarAlt, FaDownload, FaFilePdf, FaSyncAlt, FaUsers } from 'react-icons/fa';

interface PayrollTabProps {
  payrollData: any;
  loading: boolean;
  payrollStartDate: string;
  payrollEndDate: string;
  setPayrollStartDate: (d: string) => void;
  setPayrollEndDate: (d: string) => void;
  generatingPDF: boolean;
  handleRefreshPayroll: () => void;
  downloadPayrollCSV: () => void;
  downloadPayrollPDF: () => void;
}

export default function PayrollTab({
  payrollData,
  loading,
  payrollStartDate,
  payrollEndDate,
  setPayrollStartDate,
  setPayrollEndDate,
  generatingPDF,
  handleRefreshPayroll,
  downloadPayrollCSV,
  downloadPayrollPDF,
}: PayrollTabProps) {
  const employees = payrollData?.employees || [];
  const summary = payrollData?.summary || {};
  const totalEmployees = summary.totalEmployees ?? employees.length;
  const totalHours = summary.totalHours ?? 0;
  const totalPayroll = summary.totalPayroll ?? summary.totalPay ?? 0;

  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ color: '#e5e7eb', fontSize: 24, margin: 0 }}>Payroll Report</h2>
          <div style={{ color: '#9aa3b2', fontSize: 13, marginTop: 4 }}>Live payroll metrics and export controls for this period.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={handleRefreshPayroll}
            disabled={loading}
            style={{ padding: '10px 14px', background: '#e5332a', color: 'white', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <FaSyncAlt /> {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          {employees.length > 0 && (
            <>
              <button
                onClick={downloadPayrollCSV}
                style={{ padding: '10px 14px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <FaDownload /> CSV
              </button>
              <button
                onClick={downloadPayrollPDF}
                disabled={generatingPDF}
                style={{ padding: '10px 14px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, cursor: generatingPDF ? 'not-allowed' : 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <FaFilePdf /> {generatingPDF ? 'Generating...' : 'PDF'}
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 12 }}>
        <div style={{ color: '#9aa3b2', fontSize: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}><FaCalendarAlt /> Date Range</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ color: '#9aa3b2', fontSize: 12, display: 'block', marginBottom: 6 }}>Start Date</label>
            <input
              type="date"
              value={payrollStartDate}
              onChange={(e) => setPayrollStartDate(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
            />
          </div>
          <div>
            <label style={{ color: '#9aa3b2', fontSize: 12, display: 'block', marginBottom: 6 }}>End Date</label>
            <input
              type="date"
              value={payrollEndDate}
              onChange={(e) => setPayrollEndDate(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
            />
          </div>
        </div>
      </div>

      {employees.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 44, marginBottom: 10, color: '#9aa3b2' }}><FaUsers /></div>
          <div style={{ color: '#9aa3b2', fontSize: 16 }}>No completed time entries found</div>
          <div style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>Entries will appear here once employees clock out.</div>
        </div>
      )}

      {employees.length > 0 && (
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: 14, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ color: '#9aa3b2', fontSize: 11 }}>Total Employees</div>
                <div style={{ color: '#e5e7eb', fontSize: 22, fontWeight: 800 }}>{totalEmployees}</div>
              </div>
              <div style={{ background: 'rgba(229,51,42,0.12)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ color: '#9aa3b2', fontSize: 11 }}>Total Hours</div>
                <div style={{ color: '#ff6b64', fontSize: 22, fontWeight: 800 }}>{Number(totalHours).toFixed(1)}</div>
              </div>
              <div style={{ background: 'rgba(34,197,94,0.12)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ color: '#9aa3b2', fontSize: 11 }}>Total Payroll</div>
                <div style={{ color: '#22c55e', fontSize: 22, fontWeight: 800 }}>${Number(totalPayroll).toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 14 }}>
              <thead style={{ background: 'rgba(0,0,0,0.3)' }}>
                <tr>
                  <th style={{ padding: 14, textAlign: 'left', color: '#9aa3b2', fontWeight: 700 }}>Employee</th>
                  <th style={{ padding: 14, textAlign: 'left', color: '#9aa3b2', fontWeight: 700 }}>Role</th>
                  <th style={{ padding: 14, textAlign: 'center', color: '#9aa3b2', fontWeight: 700 }}>Hours</th>
                  <th style={{ padding: 14, textAlign: 'center', color: '#9aa3b2', fontWeight: 700 }}>Rate</th>
                  <th style={{ padding: 14, textAlign: 'center', color: '#9aa3b2', fontWeight: 700 }}>Total Pay</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp: any) => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: 14, color: '#e5e7eb', fontWeight: 700 }}>{emp.name}</td>
                    <td style={{ padding: 14, color: '#9aa3b2' }}>{emp.role === 'manager' ? 'Manager' : 'Technician'}</td>
                    <td style={{ padding: 14, textAlign: 'center', color: '#ff6b64', fontWeight: 700 }}>{(emp.totalHours ?? 0).toFixed(1)}</td>
                    <td style={{ padding: 14, textAlign: 'center', color: '#9aa3b2' }}>${emp.hourlyRate || 0}</td>
                    <td style={{ padding: 14, textAlign: 'center', color: '#22c55e', fontWeight: 800, fontSize: 15 }}>${(emp.totalPay ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

