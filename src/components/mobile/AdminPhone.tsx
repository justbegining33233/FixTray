'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePhrase } from '@/lib/usePhrase';
import { BarChart, Donut, Legend, LineChart } from '@/components/mobile/charts';
import { count, money } from '@/components/mobile/format';
import '@/components/mobile/phone-mock.css';

const SLICE_GREEN = '#22c55e';
const SLICE_RED = '#e5332a';
const SLICE_AMBER = '#f59e0b';
const SLICE_PURPLE = '#a855f7';

/** API titles statuses ("In Progress"). Bucket them onto the four legend colors. */
function statusSliceColor(status: string): string {
  const key = status.toLowerCase().replace(/[\s_]+/g, '-');
  if (key === 'closed' || key === 'completed' || key === 'paid') return SLICE_GREEN;
  if (key === 'in-progress' || key === 'assigned' || key === 'en-route') return SLICE_RED;
  if (key === 'waiting-for-payment') return SLICE_PURPLE;
  return SLICE_AMBER;
}

function statusSlices(rows: { status: string; count: number }[]): Array<[number, string]> {
  const order = [SLICE_GREEN, SLICE_RED, SLICE_AMBER, SLICE_PURPLE];
  const totals = new Map(order.map((color) => [color, 0]));
  for (const row of rows) {
    if (row.count <= 0) continue;
    const color = statusSliceColor(row.status);
    totals.set(color, (totals.get(color) || 0) + row.count);
  }
  return order
    .filter((color) => (totals.get(color) || 0) > 0)
    .map((color) => [totals.get(color) || 0, color] as [number, string]);
}

export function AdminOverviewPhone({
  isOwner,
  pendingApprovals,
  totalShops,
  customers,
  approvedShops,
  monthlyRevenue,
  revenueGrowth,
  revenueTrend,
  funnel,
  pulse,
}: {
  isOwner: boolean;
  pendingApprovals: number;
  totalShops: number;
  customers: number;
  approvedShops: number;
  monthlyRevenue: string;
  revenueGrowth: string;
  revenueTrend: number[];
  funnel: { visits: number; trials: number; members: number; customers: number };
  pulse: { api: string; db: string; active: string };
}) {
  const say = usePhrase();
  const trend = revenueTrend.length ? revenueTrend : [0];
  const maxFunnel = Math.max(funnel.visits, funnel.trials, funnel.members, funnel.customers, 1);
  const growthOk = revenueGrowth && revenueGrowth !== 'Unavailable';
  const bars: Array<[string, number]> = [
    [say('Website Visits'), funnel.visits],
    [say('Trials'), funnel.trials],
    [say('Members'), funnel.members],
    [say('Customers'), funnel.customers],
  ];
  const colors = ['#e5332a', '#ff6b5e', '#ff948d', '#22c55e'];
  return (
    <div className="pm">
      <div className="pm-row">
        <div>
          <h1 className="pm-title">{isOwner ? say('FixTray Owner') : say('Super Admin')}</h1>
          <div className="pm-sub">{say('Platform control center and account recovery tools.')}</div>
        </div>
        <span className="pm-badge pm-b-green">● {say('Live')}</span>
      </div>
      <div className="pm-g2">
        <Link href={'/admin/pending-shops' as Route} className="pm-stat pm-t-amber">
          <span className="lbl">{say('Pending approvals')}</span>
          <span className="val">{count(pendingApprovals)}</span>
          <span className="hint" style={{ color: '#fbbf24' }}>{say('Review →')}</span>
        </Link>
        <Link href={'/admin/manage-shops' as Route} className="pm-stat pm-t-red">
          <span className="lbl">{say('Total shops')}</span>
          <span className="val">{count(totalShops)}</span>
          <span className="hint">{say('View →')}</span>
        </Link>
        <Link href={'/admin/manage-customers' as Route} className="pm-stat pm-t-green">
          <span className="lbl">{say('Customers')}</span>
          <span className="val">{count(customers)}</span>
          <span className="hint">{say('Manage →')}</span>
        </Link>
        <Link href={'/admin/accepted-shops' as Route} className="pm-stat pm-t-purple">
          <span className="lbl">{say('Approved shops')}</span>
          <span className="val">{count(approvedShops)}</span>
          <span className="hint">{say('Open →')}</span>
        </Link>
      </div>
      <div className="pm-card">
        <h3>
          {say('Monthly Revenue')}
          {growthOk ? <span className="pm-badge pm-b-green">{revenueGrowth}</span> : null}
        </h3>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', margin: '4px 0 2px' }}>
          {monthlyRevenue && monthlyRevenue !== 'Unavailable' ? monthlyRevenue : money(0)}
        </div>
        {revenueTrend.length === 0 ? <div className="pm-empty">{say('No monthly revenue recorded yet.')}</div> : null}
        <LineChart values={trend} />
      </div>
      <div className="pm-card">
        <h3>{say('Platform Pulse')} <span className="sub">{say('Auto-refreshing')}</span></h3>
        <div className="pm-g3" style={{ marginTop: 8 }}>
          {[[say('API'), pulse.api], [say('DB'), pulse.db], [say('Active'), pulse.active]].map(([label, value]) => (
            <div key={label}>
              <div className="pm-sect" style={{ fontSize: 10 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="pm-card">
        <h3>{say('Sales Funnel')} <span className="pm-badge pm-b-green">{say('Live')}</span></h3>
        {bars.every(([, value]) => value === 0) ? <div className="pm-empty">{say('No funnel activity yet.')}</div> : null}
        {bars.map(([label, value], index) => (
          <div key={label} style={{ marginTop: 8 }}>
            <div className="pm-kv" style={{ padding: 0 }}><span>{label}</span><b>{count(value)}</b></div>
            <div className="pm-bar"><i style={{ width: `${Math.max(4, Math.round((value / maxFunnel) * 100))}%`, background: colors[index] }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminAnalyticsPhone({
  data,
  loading,
}: {
  loading: boolean;
  data: {
    totalWorkOrders: number;
    completedWorkOrders: number;
    pendingWorkOrders: number;
    inProgressWorkOrders: number;
    totalRevenue: number;
    totalShops: number;
    totalCustomers: number;
    revenue: { month: string; amount: number }[];
    monthlyTrends: { month: string; jobs: number; revenue: number }[];
    statusDistribution: { status: string; count: number }[];
    completionTimes: { time: string; count: number }[];
  };
}) {
  const say = usePhrase();
  const show = (n: number) => (loading ? '…' : count(n));
  const rate = data.totalWorkOrders > 0 ? Math.round((data.completedWorkOrders / data.totalWorkOrders) * 100) : 0;
  const revenue = data.revenue.length ? data.revenue : [];
  const statusParts = statusSlices(data.statusDistribution);
  return (
    <div className="pm">
      <div>
        <Link href={'/admin/home' as Route} className="pm-back">← {say('Back')}</Link>
        <h1 className="pm-title" style={{ marginTop: 4 }}>{say('Platform Analytics')}</h1>
        <div className="pm-sub">{say('Platform-wide metrics & insights')}</div>
      </div>
      <div className="pm-g4">
        {[
          [say('Total Users'), show(data.totalCustomers), '#e5332a'],
          [say('Total Shops'), show(data.totalShops), '#a855f7'],
          [say('Work Orders'), show(data.totalWorkOrders), '#22c55e'],
          [say('Revenue'), loading ? '…' : money(data.totalRevenue), '#f59e0b'],
        ].map(([label, value, color]) => (
          <div key={label} className="pm-stat" style={{ padding: 9, gap: 3 }}>
            <div style={{ color, fontSize: 15, fontWeight: 800 }}>●</div>
            <span className="val" style={{ fontSize: 17 }}>{value}</span>
            <span className="lbl" style={{ fontSize: 8.5, letterSpacing: '0.02em' }}>{label}</span>
          </div>
        ))}
      </div>
      <div className="pm-card" style={{ padding: 12 }}>
        <h3>{say('Revenue')} <span className="sub">{say('Recent periods')}</span></h3>
        {revenue.length === 0 ? <div className="pm-empty">{say('No revenue recorded yet.')}</div> : null}
        <LineChart values={revenue.map((row) => row.amount)} labels={revenue.map((row) => row.month)} height={92} />
      </div>
      <div className="pm-g2">
        <div className="pm-card pm-chart-card">
          <h3 style={{ fontSize: 12.5 }}>{say('Completion Rate')}</h3>
          <div className="pm-donut">
            <Donut parts={[[rate, '#22c55e'], [Math.max(100 - rate, 0), 'rgba(255,255,255,0.07)']]} center={`${rate}%`} sub={say('completed')} />
          </div>
        </div>
        <div className="pm-card pm-chart-card">
          <h3 style={{ fontSize: 12.5 }}>{say('Status Distribution')}</h3>
          <div className="pm-donut">
            {statusParts.length === 0 ? <div className="pm-empty">{say('No jobs yet.')}</div> : <Donut parts={statusParts} thickness={26} />}
          </div>
        </div>
      </div>
      <Legend items={[
        [say('Completed'), '#22c55e'],
        [say('In progress'), '#e5332a'],
        [say('Pending'), '#f59e0b'],
        [say('Waiting for payment'), '#a855f7'],
      ]} />
      <div className="pm-card" style={{ padding: 12 }}>
        <h3>{say('Completion Times')} <span className="sub">{say('jobs by hours')}</span></h3>
        {data.completionTimes.length === 0 ? <div className="pm-empty">{say('No completed jobs to time yet.')}</div> : null}
        <BarChart
          values={data.completionTimes.map((row) => row.count)}
          labels={data.completionTimes.map((row) => row.time)}
          height={84}
        />
      </div>
      <div className="pm-card" style={{ padding: 12 }}>
        <h3>{say('Monthly Trends')}</h3>
        {data.monthlyTrends.length === 0 ? <div className="pm-empty">{say('No monthly trend yet.')}</div> : null}
        <LineChart
          values={scale(data.monthlyTrends.map((row) => row.jobs))}
          values2={scale(data.monthlyTrends.map((row) => row.revenue))}
          labels={data.monthlyTrends.map((row) => row.month)}
          height={80}
        />
        <Legend items={[[say('Work orders'), '#e5332a'], [say('Revenue'), '#22c55e']]} />
      </div>
    </div>
  );
}

function scale(values: number[]): number[] {
  const max = Math.max(...values, 0);
  if (max <= 0) return values.map(() => 0);
  return values.map((value) => value / max);
}
