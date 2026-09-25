'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { FaCar } from 'react-icons/fa';
import { useState } from 'react';
import { usePhrase } from '@/lib/usePhrase';
import { shortWorkOrderLabel } from '@/lib/notificationCopy';
import { count, initials, money } from '@/components/mobile/format';
import '@/components/mobile/phone-mock.css';

export function ManagerDashboardPhone({
  alerts,
  stats,
  team,
  finance,
}: {
  alerts: Array<{ id?: string; title?: string; message?: string }>;
  stats: { activeJobs: number; pendingAssignments: number; overdueJobs: number; completedToday: number };
  team: Array<{ id?: string; name?: string; isActive?: boolean; completedJobs?: number; hoursToday?: number }>;
  finance: { todayRevenue: number; weeklyRevenue: number; monthlyRevenue: number; outstandingInvoices: number };
}) {
  const say = usePhrase();
  const summary = alerts.length
    ? alerts.map((alert) => alert.message || alert.title).filter(Boolean).slice(0, 2).join(' · ')
    : say('No urgent alerts.');
  return (
    <div className="pm">
      <div>
        <h1 className="pm-title">{say('Manager Dashboard')}</h1>
        <div className="pm-sub">{say('Live shop jobs, team, and revenue.')}</div>
      </div>
      <div className="pm-alert">
        <div className="pm-ico" style={{ width: 28, height: 28 }}>!</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{say('Urgent Alerts')}</div>
          <div className="pm-sub" style={{ fontSize: 11 }}>{summary}</div>
        </div>
      </div>
      <div className="pm-card" style={{ padding: 12 }}>
        <h3>{say('Work Orders Overview')}</h3>
        <div className="pm-g2" style={{ marginTop: 8 }}>
          <div className="pm-stat pm-t-red" style={{ padding: 10 }}><span className="lbl">{say('Active Jobs')}</span><span className="val" style={{ fontSize: 20 }}>{count(stats.activeJobs)}</span></div>
          <div className="pm-stat pm-t-amber" style={{ padding: 10 }}><span className="lbl">{say('Awaiting Clock-In')}</span><span className="val" style={{ fontSize: 20 }}>{count(stats.pendingAssignments)}</span></div>
          <div className="pm-stat pm-t-purple" style={{ padding: 10 }}><span className="lbl">{say('Overdue')}</span><span className="val" style={{ fontSize: 20 }}>{count(stats.overdueJobs)}</span></div>
          <div className="pm-stat pm-t-green" style={{ padding: 10 }}><span className="lbl">{say('Completed Today')}</span><span className="val" style={{ fontSize: 20 }}>{count(stats.completedToday)}</span></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Link href={'/manager/assignments' as Route} className="pm-btn pm-btn-primary" style={{ flex: 1 }}>{say('Open Job Queue')}</Link>
          <Link href={'/manager/dashboard' as Route} className="pm-btn pm-btn-secondary" style={{ flex: 1 }}>{say('View All Jobs')}</Link>
        </div>
      </div>
      <div className="pm-card" style={{ padding: '4px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}>
          <h3>{say('Team Performance')}</h3>
          <Link href={'/shop/manage-team' as Route} className="sub" style={{ fontSize: 11, color: '#475569', fontWeight: 600, textDecoration: 'none' }}>{say('View Full Team')}</Link>
        </div>
        {team.length === 0 ? <div className="pm-empty">{say('No team performance data yet.')}</div> : team.slice(0, 5).map((member) => {
          const name = member.name || say('Technician');
          return (
            <div key={member.id || name} className="pm-li">
              <div className="pm-av">{initials(name)}</div>
              <div className="pm-grow">
                <div className="t">{name}</div>
                <div className="s">{say('Jobs')}: {member.completedJobs || 0} · {say('Hours')}: {member.hoursToday || 0}</div>
              </div>
              <span className={`pm-badge ${member.isActive ? 'pm-b-green' : 'pm-b-ghost'}`}>● {member.isActive ? say('Active') : say('Away')}</span>
            </div>
          );
        })}
      </div>
      <div className="pm-card" style={{ padding: 12 }}>
        <h3>{say('Financial Summary')}</h3>
        <div className="pm-g2" style={{ marginTop: 6 }}>
          <div className="pm-kv"><span>{say("Today's Revenue")}</span><b>{money(finance.todayRevenue, 0)}</b></div>
          <div className="pm-kv"><span>{say('This Week')}</span><b>{money(finance.weeklyRevenue, 0)}</b></div>
          <div className="pm-kv"><span>{say('This Month')}</span><b>{money(finance.monthlyRevenue, 0)}</b></div>
          <div className="pm-kv"><span>{say('Outstanding')}</span><b>{money(finance.outstandingInvoices, 0)}</b></div>
        </div>
      </div>
    </div>
  );
}

type QueueOrder = {
  id: string;
  vehicleType?: string;
  serviceLocation?: string;
  customer?: { firstName?: string; lastName?: string };
  assignedTo?: { id: string; firstName?: string; lastName?: string };
};

type QueueTech = { id: string; firstName: string; lastName: string; assignedCount: number };

export function ManagerQueuePhone({
  awaiting,
  clocked,
  techs,
}: {
  awaiting: QueueOrder[];
  clocked: QueueOrder[];
  techs: QueueTech[];
}) {
  const say = usePhrase();
  const [tab, setTab] = useState<'awaiting' | 'clocked'>('awaiting');
  const rows = tab === 'awaiting' ? awaiting : clocked;
  const onJob = new Map<string, string>();
  clocked.forEach((order) => {
    if (order.assignedTo?.id) onJob.set(order.assignedTo.id, order.id);
  });
  return (
    <div className="pm">
      <div>
        <Link href={'/manager/home' as Route} className="pm-back">← {say('Back to Dashboard')}</Link>
        <h1 className="pm-title" style={{ marginTop: 4 }}>{say('Job Queue')}</h1>
        <div className="pm-sub">{say('Clock-in is assignment. Open a work order so a technician can clock in — no separate assign step is required.')}</div>
      </div>
      <div className="pm-seg">
        <button type="button" className={tab === 'awaiting' ? 'on' : ''} onClick={() => setTab('awaiting')}>{say('Awaiting Clock-In')} ({awaiting.length})</button>
        <button type="button" className={tab === 'clocked' ? 'on' : ''} onClick={() => setTab('clocked')}>{say('Clocked In')} ({clocked.length})</button>
      </div>
      <div className="pm-card" style={{ padding: '4px 12px' }}>
        <div className="pm-sub" style={{ fontSize: 11, paddingTop: 10 }}>
          {tab === 'awaiting' ? say('Open jobs with no technician clocked in yet.') : say('Jobs with a technician clocked in.')}
        </div>
        {rows.length === 0 ? <div className="pm-empty">{say('No jobs in this list.')}</div> : rows.map((order) => {
          const customer = [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ') || say('Customer');
          const kind = order.serviceLocation === 'road-call' || order.serviceLocation === 'roadside' ? say('Road Call') : say('In-Shop');
          return (
            <div key={order.id} className="pm-li">
              <div className="pm-ico a"><FaCar size={14} /></div>
              <div className="pm-grow">
                <div className="t">{order.vehicleType || say('Vehicle')}</div>
                <div className="s">{shortWorkOrderLabel(order.id)} · {customer} · {say('Type')}: {kind}</div>
              </div>
              <Link href={`/workorders/${order.id}` as Route} className="pm-btn pm-btn-ghost" style={{ padding: '5px 9px', fontSize: 11 }}>{say('Open details')}</Link>
            </div>
          );
        })}
      </div>
      <div className="pm-sect">{say('Technicians')}</div>
      <div className="pm-card" style={{ padding: '4px 12px' }}>
        {techs.length === 0 ? <div className="pm-empty">{say('No technicians on this shop.')}</div> : techs.map((tech) => {
          const name = `${tech.firstName} ${tech.lastName}`.trim();
          const jobId = onJob.get(tech.id);
          return (
            <div key={tech.id} className="pm-li">
              <div className="pm-av">{initials(name)}</div>
              <div className="pm-grow">
                <div className="t">{name}</div>
                <div className="s">{jobId ? `${say('Clocked in')} · ${shortWorkOrderLabel(jobId)}` : say('Not clocked in')}</div>
              </div>
              <span className={`pm-badge ${jobId ? 'pm-b-green' : 'pm-b-ghost'}`}>{jobId ? say('On job') : say('Available')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
