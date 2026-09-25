'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { FaBox, FaFileAlt, FaPlus, FaTruck } from 'react-icons/fa';
import { usePhrase } from '@/lib/usePhrase';
import { workOrderStatusLabel, workOrderStatusTone } from '@/lib/workOrderStatus';
import { shortWorkOrderLabel } from '@/lib/notificationCopy';
import { count } from '@/components/mobile/format';
import '@/components/mobile/phone-mock.css';

type Job = {
  id: string;
  sourceId?: string;
  serviceLocation?: string;
  isAppointment?: boolean;
  customer: string;
  vehicle: string;
  status: string;
};

type Bay = { id: string; name: string; jobs: Job[] };

function toneClass(status: string): string {
  const tone = workOrderStatusTone(status);
  if (tone.color.includes('22c55e') || tone.color.includes('4ade80')) return 'pm-b-green';
  if (tone.color.includes('f59e0b') || tone.color.includes('fbbf24')) return 'pm-b-amber';
  if (tone.color.includes('a855f7') || tone.color.includes('c084fc')) return 'pm-b-purple';
  if (tone.color.includes('94a3b8')) return 'pm-b-ghost';
  return 'pm-b-red';
}

export function ShopOpsPhone({
  openJobs,
  completedToday,
  pendingApprovals,
  todayRevenue,
  weekRevenue,
  activeTechs,
  roadcalls,
  appointments,
  walkIns,
  bays,
  queue,
  queueCount,
}: {
  openJobs: number;
  completedToday: number;
  pendingApprovals: number;
  todayRevenue: string;
  weekRevenue: string;
  activeTechs: number;
  roadcalls: number;
  appointments: number;
  walkIns: number;
  bays: Bay[];
  queue: Job[];
  queueCount: number;
}) {
  const say = usePhrase();
  const activeBays = bays.filter((bay) => bay.jobs.length > 0).length;
  const shown = bays.length ? bays : [];
  return (
    <div className="pm">
      <div>
        <h1 className="pm-title">{say('Ops Overview')}</h1>
        <div className="pm-sub">
          {say('Roadcalls')}: {roadcalls} · {say('In-Shop Appointments')}: {appointments} · {say('In-Shop Walk-ins')}: {walkIns}
        </div>
      </div>
      <div className="pm-g3">
        <div className="pm-stat pm-t-red"><span className="lbl">{say('Open Jobs')}</span><span className="val">{count(openJobs)}</span></div>
        <div className="pm-stat pm-t-green"><span className="lbl">{say('Completed Today')}</span><span className="val">{count(completedToday)}</span></div>
        <div className="pm-stat pm-t-amber"><span className="lbl">{say('Pending Approvals')}</span><span className="val">{count(pendingApprovals)}</span></div>
        <div className="pm-stat"><span className="lbl">{say("Today's Revenue")}</span><span className="val" style={{ fontSize: 19 }}>{todayRevenue || '$0'}</span></div>
        <div className="pm-stat"><span className="lbl">{say('This Week')}</span><span className="val" style={{ fontSize: 19 }}>{weekRevenue || '$0'}</span></div>
        <div className="pm-stat pm-t-purple"><span className="lbl">{say('Active Techs')}</span><span className="val">{count(activeTechs)}</span></div>
      </div>
      <div className="pm-card" style={{ padding: 12 }}>
        <h3 style={{ marginBottom: 10 }}>{say('Quick Actions')}</h3>
        <div className="pm-qa">
          <Link href={'/workorders/inshop' as Route}><span className="pm-ico"><FaPlus /></span>{say('New In-Shop Job')}</Link>
          <Link href={'/shop/new-roadside-job' as Route}><span className="pm-ico a"><FaTruck /></span>{say('New Roadside Job')}</Link>
          <Link href={'/shop/estimates' as Route}><span className="pm-ico p"><FaFileAlt /></span>{say('Estimates')}</Link>
          <Link href={'/shop/vendors' as Route}><span className="pm-ico n"><FaBox /></span>{say('Vendors & Parts')}</Link>
        </div>
      </div>
      <div className="pm-card" style={{ padding: 12 }}>
        <h3>{say('Service Bays')} <span className="sub">{shown.length} {say('configured')} ({activeBays} {say('active')})</span></h3>
        {shown.length === 0 ? <div className="pm-empty">{say('No bays configured yet.')}</div> : (
          <div className="pm-g3" style={{ marginTop: 10 }}>
            {shown.map((bay) => {
              const job = bay.jobs[0];
              return (
                <Link key={bay.id} href={(job ? `/workorders/${job.sourceId || job.id}` : '/shop/home') as Route} className={job ? 'pm-bay on' : 'pm-bay'}>
                  <div className="pm-sect" style={{ fontSize: 9.5 }}>{bay.name}</div>
                  {job ? (
                    <>
                      <div style={{ fontSize: 11.5, fontWeight: 700, margin: '4px 0' }}>{job.vehicle || say('Job')}</div>
                      <span className={`pm-badge ${toneClass(job.status)}`} style={{ fontSize: 9, padding: '2px 6px' }}>{say(workOrderStatusLabel(job.status))}</span>
                    </>
                  ) : (
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>{say('No job in this bay')}</div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <div className="pm-card" style={{ padding: '4px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}>
          <h3>{say('Pending Queue')}</h3>
          <span className="pm-badge pm-b-amber">{count(queueCount)}</span>
        </div>
        {queue.length === 0 ? <div className="pm-empty">{say('No jobs waiting.')}</div> : queue.slice(0, 6).map((job) => (
          <Link key={job.id} href={`/workorders/${job.sourceId || job.id}` as Route} className="pm-li">
            <div className="pm-ico a"><FaTruck size={14} /></div>
            <div className="pm-grow">
              <div className="t">{job.vehicle || say('Vehicle')}</div>
              <div className="s">{shortWorkOrderLabel(job.sourceId || job.id)} · {job.customer}</div>
            </div>
            <span className={`pm-badge ${toneClass(job.status)}`}>{say(workOrderStatusLabel(job.status))}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
