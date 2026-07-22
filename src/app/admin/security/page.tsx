'use client';

import { useEffect, useState } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaLock, FaExclamationTriangle, FaCheckCircle, FaUsers, FaServer } from 'react-icons/fa';

interface SecurityMetrics {
  successfulLogins24h: number;
  failedLogins24h: number;
  accountLockouts24h: number;
  unauthorizedAttempts24h: number;
  suspiciousIPs: string[];
  twoFAEnabled: number;
  twoFADisabled: number;
  apiHealthy: boolean;
  databaseHealthy: boolean;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface SecurityAlert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
}

const riskColors = {
  low: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', text: 'Low Risk' },
  medium: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', text: 'Medium Risk' },
  high: { bg: 'rgba(229,51,42,0.15)', color: '#e5332a', text: 'High Risk' },
  critical: { bg: 'rgba(139,0,0,0.2)', color: '#ff1744', text: 'Critical Risk' },
};

const severityColors = {
  info: '#3b82f6',
  warning: '#f59e0b',
  error: '#e5332a',
  critical: '#ff1744',
};

export default function AdminSecurityPage() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadSecurityData();
    const interval = setInterval(loadSecurityData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [user]);

  const loadSecurityData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/security/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch security data');
      const data = await res.json();
      
      setMetrics(data.metrics);
      setAlerts(data.alerts || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load security data');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  const riskStyle = metrics ? riskColors[metrics.riskLevel] : riskColors.low;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="admin" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
        <main style={{ flex: 1, padding: '24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: '#e5e7eb', margin: '0 0 8px' }}>
              <FaLock style={{ marginRight: 12, verticalAlign: 'middle' }} />
              Security Dashboard
            </h1>
            <p style={{ color: '#9ca3af', margin: 0, fontSize: 14 }}>Real-time security monitoring and threat detection</p>
          </div>

          {error && (
            <div style={{ background: 'rgba(229,51,42,0.15)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 12, padding: 16, marginBottom: 24, color: '#fca5a5' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading security data...</div>
          ) : metrics ? (
            <>
              {/* Risk Score Card */}
              <div style={{
                background: riskStyle.bg,
                border: `1px solid ${riskStyle.color}20`,
                borderRadius: 12,
                padding: 24,
                marginBottom: 32,
                display: 'flex',
                alignItems: 'center',
                gap: 24,
              }}>
                <div>
                  <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 8 }}>Platform Risk Score</div>
                  <div style={{ fontSize: 48, fontWeight: 700, color: riskStyle.color }}>
                    {metrics.riskScore}/100
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{
                    background: riskStyle.bg,
                    color: riskStyle.color,
                    padding: '12px 20px',
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 700,
                    display: 'inline-block',
                  }}>
                    {riskStyle.text}
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
                {[
                  { label: 'Successful Logins (24h)', value: metrics.successfulLogins24h, icon: <FaCheckCircle />, color: '#22c55e' },
                  { label: 'Failed Logins (24h)', value: metrics.failedLogins24h, icon: <FaLock />, color: '#f59e0b' },
                  { label: 'Account Lockouts', value: metrics.accountLockouts24h, icon: <FaExclamationTriangle />, color: '#e5332a' },
                  { label: 'Unauthorized Attempts', value: metrics.unauthorizedAttempts24h, icon: <FaExclamationTriangle />, color: '#e5332a' },
                  { label: 'Suspicious IPs', value: metrics.suspiciousIPs.length, icon: <FaServer />, color: '#f59e0b' },
                  { label: '2FA Enabled', value: metrics.twoFAEnabled, icon: <FaLock />, color: '#3b82f6' },
                ].map((stat, i) => (
                  <div key={i} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ color: stat.color, fontSize: 20 }}>{stat.icon}</span>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{stat.label}</div>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* System Health */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
                {[
                  { label: 'API Status', healthy: metrics.apiHealthy },
                  { label: 'Database Status', healthy: metrics.databaseHealthy },
                ].map((health, i) => (
                  <div key={i} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>{health.label}</div>
                    <div style={{
                      background: health.healthy ? 'rgba(34,197,94,0.15)' : 'rgba(229,51,42,0.15)',
                      color: health.healthy ? '#22c55e' : '#e5332a',
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontWeight: 600,
                      textAlign: 'center',
                    }}>
                      {health.healthy ? '✓ Healthy' : '✗ Issues'}
                    </div>
                  </div>
                ))}
              </div>

              {/* Suspicious IPs */}
              {metrics.suspiciousIPs.length > 0 && (
                <div style={{ background: 'rgba(229,51,42,0.15)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 12, padding: 20, marginBottom: 32 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fca5a5', marginBottom: 16 }}>
                    ⚠️ Suspicious IP Addresses Detected
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {metrics.suspiciousIPs.map((ip, i) => (
                      <code key={i} style={{
                        background: 'rgba(229,51,42,0.25)',
                        color: '#fca5a5',
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                      }}>
                        {ip}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Alerts */}
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 16 }}>
                  Recent Security Alerts ({alerts.length})
                </h2>
                {alerts.length === 0 ? (
                  <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                    No recent alerts
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {alerts.slice(0, 10).map(alert => (
                      <div key={alert.id} style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: `1px solid ${severityColors[alert.severity]}40`,
                        borderLeft: `4px solid ${severityColors[alert.severity]}`,
                        borderRadius: 8,
                        padding: 16,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <div>
                          <div style={{ color: '#e5e7eb', fontWeight: 600, marginBottom: 4 }}>{alert.type}</div>
                          <div style={{ color: '#9ca3af', fontSize: 13 }}>{alert.message}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            background: `${severityColors[alert.severity]}20`,
                            color: severityColors[alert.severity],
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                          }}>
                            {alert.severity.toUpperCase()}
                          </span>
                          <div style={{ color: '#6b7280', fontSize: 11, marginTop: 6 }}>
                            {new Date(alert.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
