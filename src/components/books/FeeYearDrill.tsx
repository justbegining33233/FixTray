'use client';

import { useEffect, useState } from 'react';
import type { FeeChargeLine, FeeShopSlice, FeeTotals, FeeYearReport } from '@/lib/books/feeDrill';
import { Crumb, EmptyLine, Metric, PeriodCard, YearSelect, gridStyle, money, shortMonth } from '@/components/books/drillChrome';

const KIND_LABEL: Record<FeeChargeLine['kind'], string> = {
  online: 'Collected online',
  in_person: 'In-person owed',
  shop_paid: 'Paid by shop',
  refund: 'Fee refund',
  chargeback: 'Fee chargeback',
};

function FeeMetrics({ totals }: { totals: FeeTotals }) {
  return (
    <div style={gridStyle}>
      <Metric label="Fees collected online" value={money(totals.onlineCollectedCents)} />
      <Metric label="In-person fees owed" value={money(totals.inPersonOwedCents)} />
      <Metric label="Fees paid by shops" value={money(totals.shopPaidCents)} />
      <Metric label="Fees still owed" value={money(totals.stillOwedCents)} hint="In-person minus shop payments in this period." />
      <Metric label="Fee refunds" value={money(totals.feeRefundCents)} />
      <Metric label="Net fees" value={money(totals.netFeesCents)} />
    </div>
  );
}

function ShopList({ shops }: { shops: FeeShopSlice[] }) {
  if (shops.length === 0) return <EmptyLine>No shops in this period.</EmptyLine>;
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
      {shops.map((shop) => (
        <div key={shop.shopId} style={{ background: '#1c0d10', border: '1px solid #4a1c22', borderRadius: 12, padding: 12 }}>
          <strong>{shop.shopName || shop.shopId}</strong>
          <div style={{ marginTop: 8 }}>
            <FeeMetrics totals={shop.totals} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Charges({ charges }: { charges: FeeChargeLine[] }) {
  if (charges.length === 0) return <EmptyLine>No fee charges on this day.</EmptyLine>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {charges.map((charge) => (
        <div key={charge.id} style={{ background: '#241014', border: '1px solid #4a1c22', borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700 }}>Work order {charge.workOrderId}</div>
          <div style={{ color: '#e7c4bf', fontSize: 14, marginTop: 4 }}>
            {charge.shopName || charge.shopId} · {KIND_LABEL[charge.kind]} · {money(charge.feeCents)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FeeYearDrill({
  report,
  onYear,
}: {
  report: FeeYearReport;
  onYear: (year: number) => void;
}) {
  const [monthId, setMonthId] = useState<string | null>(null);
  const [weekId, setWeekId] = useState<string | null>(null);
  const [dayId, setDayId] = useState<string | null>(null);

  useEffect(() => {
    setMonthId(null);
    setWeekId(null);
    setDayId(null);
  }, [report.year]);

  const month = report.months.find((item) => item.id === monthId) || null;
  const week = month?.weeks.find((item) => item.id === weekId) || null;
  const weekIndex = month && week ? month.weeks.findIndex((item) => item.id === week.id) : -1;
  const day = week?.days.find((item) => item.id === dayId) || null;
  const current = day || week || month || report;

  const crumbs = [
    { id: 'year', label: String(report.year), onClick: () => { setMonthId(null); setWeekId(null); setDayId(null); } },
  ];
  if (month) crumbs.push({ id: month.id, label: shortMonth(month.label), onClick: () => { setWeekId(null); setDayId(null); } });
  if (month && week && weekIndex >= 0) {
    crumbs.push({ id: week.id, label: `Week ${weekIndex + 1}`, onClick: () => setDayId(null) });
  }
  if (day) crumbs.push({ id: day.id, label: day.label, onClick: () => setDayId(day.id) });

  return (
    <section>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Fee drill-down</h2>
        <YearSelect year={report.year} onYear={onYear} />
      </div>
      <p style={{ color: '#e7c4bf' }}>{report.weekSplitRule}</p>
      <p style={{ color: '#e7c4bf' }}>Shop bay revenue is not on this report. Amounts are the fee stored at checkout.</p>
      <Crumb items={crumbs} />
      <FeeMetrics totals={current.totals} />
      <h3>Per shop</h3>
      <ShopList shops={current.shops} />
      {!month && (
        <div style={{ marginTop: 16 }}>
          {report.months.map((item) => (
            <PeriodCard key={item.id} title={item.label} subtitle={item.id} onClick={() => setMonthId(item.id)}>
              <FeeMetrics totals={item.totals} />
            </PeriodCard>
          ))}
        </div>
      )}
      {month && !week && (
        <div style={{ marginTop: 16 }}>
          {month.weeks.map((item, index) => (
            <PeriodCard
              key={item.id}
              title={`Week ${index + 1}`}
              subtitle={item.splitAtMonthEdge ? `${item.label}. Split at the month edge.` : item.label}
              onClick={() => setWeekId(item.id)}
            >
              <FeeMetrics totals={item.totals} />
            </PeriodCard>
          ))}
        </div>
      )}
      {week && !day && (
        <div style={{ marginTop: 16 }}>
          {week.days.map((item) => (
            <PeriodCard key={item.id} title={item.label} subtitle={item.weekday} onClick={() => setDayId(item.id)}>
              <FeeMetrics totals={item.totals} />
            </PeriodCard>
          ))}
        </div>
      )}
      {day && (
        <div style={{ marginTop: 16 }}>
          <h3>Charges</h3>
          <Charges charges={day.charges} />
        </div>
      )}
    </section>
  );
}
