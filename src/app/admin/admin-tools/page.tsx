'use client';

import { useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaArrowRight, FaBuilding, FaChartBar, FaCheck, FaClipboardList, FaCog, FaDollarSign, FaEnvelope, FaHourglassHalf, FaLock, FaSave, FaStore, FaUsers, FaWrench } from 'react-icons/fa';

export default function AdminTools() {
  const { user, isLoading } = useRequireAuth(['admin']);
  const [stats, setStats] = useState({
    totalRevenue: '$0',
    activeShops: 0,
    totalUsers: 0,
    pendingApprovals: 0
  });

  useEffect(() => {
    if (!user || isLoading) return;
    
    // Fetch platform statistics
    fetch('/api/admin/stats', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.totalRevenue !== undefined) {
          setStats({
            totalRevenue: data.totalRevenue,
            activeShops: data.totalShops,
            totalUsers: data.activeUsers,
            pendingApprovals: data.pendingShops
          });
        }
      })
      .catch(err => console.error('Error fetching stats:', err));
  }, [user, isLoading]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#e5e7eb',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    );
  }

  // If no user, the useRequireAuth hook will handle redirect
  if (!user) {
    return null;
  }

  const tools: Array<{ name: string; description: string; icon: ReactElement; href: Route; color: string }> = [
    { name: 'Manage Customers', description: 'View and manage all paying customers (shop owners)', icon: <FaUsers style={{marginRight:4}} />, href: '/admin/manage-customers' as Route, color: '#22c55e' },
    { name: 'Manage Tenants', description: 'Manage all tenant organizations', icon: <FaBuilding style={{marginRight:4}} />, href: '/admin/manage-tenants' as Route, color: '#3b82f6' },
    { name: 'Manage Shops', description: 'Manage all auto repair shops in the network', icon: <FaStore style={{marginRight:4}} />, href: '/admin/manage-shops' as Route, color: '#22c55e' },
    { name: 'Financial Reports', description: 'Revenue, payouts, and financial analytics', icon: <FaDollarSign style={{marginRight:4}} />, href: '/admin/financial-reports' as Route, color: '#f59e0b' },
    { name: 'User Management', description: 'Manage all platform users and roles', icon: <FaWrench style={{marginRight:4}} />, href: '/admin/user-management' as Route, color: '#a855f7' },
    { name: 'Approved Shops', description: 'View all verified and active shop partners', icon: <FaCheck style={{marginRight:4}} />, href: '/admin/accepted-shops' as Route, color: '#22c55e' },
    { name: 'Pending Shops', description: 'Review and approve new shop applications', icon: <FaHourglassHalf style={{marginRight:4}} />, href: '/admin/pending-shops' as Route, color: '#e5332a' },
    { name: 'Activity Logs', description: 'Complete system activity history', icon: <FaClipboardList style={{marginRight:4}} />, href: '/admin/activity-logs' as Route, color: '#3b82f6' },
    { name: 'System Settings', description: 'Configure platform settings and preferences', icon: <FaCog style={{marginRight:4}} />, href: '/admin/system-settings' as Route, color: '#6b7280' },
    { name: 'Email Templates', description: 'Manage email notifications and templates', icon: <FaEnvelope style={{marginRight:4}} />, href: '/admin/email-templates' as Route, color: '#8b5cf6' },
    { name: 'Platform Analytics', description: 'Detailed analytics and performance metrics', icon: <FaChartBar style={{marginRight:4}} />, href: '/admin/platform-analytics' as Route, color: '#f59e0b' },
    { name: 'Security Settings', description: 'Manage security policies and permissions', icon: <FaLock style={{marginRight:4}} />, href: '/admin/security-settings' as Route, color: '#e5332a' },
    { name: 'Backup & Restore', description: 'Database backup and restore operations', icon: <FaSave style={{marginRight:4}} />, href: '/admin/backup-restore' as Route, color: '#3b82f6' },
  ];

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:1400, margin:'0 auto'}}>
          <Link href="/admin/home" style={{color:'#3b82f6', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:16, display:'inline-block'}}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
          </Link>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaCog style={{marginRight:4}} /> All Admin Tools</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>Complete admin control center and management tools</p>
        </div>
      </div>

      <div style={{maxWidth:1400, margin:'0 auto', padding:32}}>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:20}}>
          {tools.map((tool, idx) => (
            <Link key={idx} href={tool.href} style={{textDecoration:'none'}}>
              <div style={{background:'rgba(0,0,0,0.3)', border:`1px solid ${tool.color}50`, borderRadius:12, padding:24, cursor:'pointer', transition:'all 0.3s', height:'100%'}}>
                <div style={{fontSize:40, marginBottom:16}}>{tool.icon}</div>
                <h3 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:8}}>{tool.name}</h3>
                <p style={{fontSize:14, color:'#9aa3b2', lineHeight:1.5}}>{tool.description}</p>
                <div style={{marginTop:16, display:'inline-flex', alignItems:'center', gap:8, color:tool.color, fontSize:14, fontWeight:600}}>
                  Open Tool <FaArrowRight style={{marginRight:4}} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Stats */}
        <div style={{marginTop:40, background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
          <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Platform Overview</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16}}>
            <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
              <div style={{fontSize:13, color:'#9aa3b2', marginBottom:4}}>Total Revenue</div>
              <div style={{fontSize:24, fontWeight:700, color:'#22c55e'}}>{stats.totalRevenue}</div>
            </div>
            <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
              <div style={{fontSize:13, color:'#9aa3b2', marginBottom:4}}>Active Shops</div>
              <div style={{fontSize:24, fontWeight:700, color:'#3b82f6'}}>{stats.activeShops}</div>
            </div>
            <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
              <div style={{fontSize:13, color:'#9aa3b2', marginBottom:4}}>Total Users</div>
              <div style={{fontSize:24, fontWeight:700, color:'#a855f7'}}>{stats.totalUsers}</div>
            </div>
            <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
              <div style={{fontSize:13, color:'#9aa3b2', marginBottom:4}}>Pending Approvals</div>
              <div style={{fontSize:24, fontWeight:700, color:'#e5332a'}}>{stats.pendingApprovals}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
