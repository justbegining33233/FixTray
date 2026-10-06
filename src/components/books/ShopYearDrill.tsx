'use client';

import { useEffect, useState } from 'react';
import type { ShopDayNode, ShopMoneyTotals, ShopMonthNode, ShopWeekNode, ShopYearReport } from '@/lib/books/shopDrill';
import { Crumb, EmptyLine, Metric, PeriodCard, YearSelect, gridStyle, hours, money, shortMonth } from '@/components/books/drillChrome';

type ShopNode = ShopYearReport | ShopMonthNode | ShopWeekNode | ShopDayNode;

function revenueOf(node: ShopNode): ShopMoneyTotals {
  return 'money' in node ? node.money : node.totals.money;
}

function PaymentMetrics({ moneyTotals, showRevenue }: { moneyTotals: ShopMoneyTotals; showRevenue: boolean }) {
  return (
    <div style={gridStyle}>
      {showRevenue ? <Metric label="Jobs invoiced" value={money(moneyTotals.invoicedCents)} /> : null}
      {showRevenue ? <Metric label="Paid" value={money(moneyTotals.paidCents)} /> : null}
      {showRevenue ? (
        <Metric label="Unpaid" value={money(moneyTotals.unpaidCents)} hint="Invoiced minus payments, plus refunds and chargebacks, in this period." />
      ) : null}
      <Metric label="Card" value={money(moneyTotals.cardCents)} />
      <Metric label="Cash" value={money(moneyTotals.cashCents)} />
      <Metric label="Check" value={money(moneyTotals.checkCents)} />
      <Metric label="Other" value={money(moneyTotals.otherCents)} />
      <Metric label="Tips" value={money(moneyTotals.tipsCents)} hint="Tips are not recorded. This is 0, not an estimate." />
      <Metric label="Refunds" value={money(moneyTotals.refundCents)} />
      <Metric label="Chargebacks" value={money(moneyTotals.chargebackCents)} />
      <Metric label="Voids" value={money(moneyTotals.voidCents)} hint="Voids are not recorded. This is 0, not an estimate." />
    </div>
  );
}

function People({ title, people, total }: { title: string; people: Array<{ personId: string; personName: string; minutes: number }>; total: number }) {
  return (
    <div>
      <h3>{title}</h3>
      <p>Sum {hours(total)}</p>
      {people.length === 0 ? <EmptyLine>No hours in this period.</EmptyLine> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {people.map((person) => (
            <div key={person.personId} style={{ background: '#241014', border: '1px solid #4a1c22', borderRadius: 12, padding: 12 }}>
              {person.personName || person.personId}: {hours(person.minutes)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShopYearDrill({
  report,
  onYear,
}: {
  report: ShopYearReport;
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
  const current: ShopNode = day || week || month || report;
  const figures = 'money' in current
    ? current
    : {
      money: current.totals.money,
      fixtrayLines: current.totals.fixtrayLines,
      parts: current.totals.parts,
      purchases: current.months.flatMap((item) => item.purchases),
      staff: current.totals.staff,
      staffMinutes: current.totals.staffMinutes,
      work: current.totals.work,
      workMinutes: current.totals.workMinutes,
      stockValueStartCents: current.totals.stockValueStartCents,
      stockValueEndCents: current.totals.stockValueEndCents,
      stockValueNote: current.totals.stockValueNote,
      tipsNote: current.totals.tipsNote,
      voidsNote: current.totals.voidsNote,
    };
  const showRevenue = report.revenueVisible;

  const crumbs = [
    { id: 'year', label: String(report.year), onClick: () => { setMonthId(null); setWeekId(null); setDayId(null); } },
  ];
  if (month) crumbs.push({ id: month.id, label: shortMonth(month.label), onClick: () => { setWeekId(null); setDayId(null); } });
  if (month && week && weekIndex >= 0) crumbs.push({ id: week.id, label: `Week ${weekIndex + 1}`, onClick: () => setDayId(null) });
  if (day) crumbs.push({ id: day.id, label: day.label, onClick: () => setDayId(day.id) });

  return (
    <section>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Books drill-down</h2>
        <YearSelect year={report.year} onYear={onYear} />
      </div>
      <p style={{ color: '#e7c4bf' }}>{report.weekSplitRule}</p>
      {!showRevenue ? <p style={{ color: '#f0b4ae' }}>Shop revenue is visible to the shop owner only.</p> : null}
      <Crumb items={crumbs} />
      <PaymentMetrics moneyTotals={revenueOf(current)} showRevenue={showRevenue} />
      <h3>FixTray owed</h3>
      <p>{money(figures.money.fixtrayOwedCents)} in this period. The shop kept the full job.</p>
      {figures.fixtrayLines.length === 0 ? <EmptyLine>No in-person FixTray fees in this period.</EmptyLine> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {figures.fixtrayLines.map((line) => (
            <div key={line.workOrderId} style={{ background: '#241014', border: '1px solid #4a1c22', borderRadius: 12, padding: 12 }}>
              Work order {line.workOrderId}: {money(line.feeCents)}
            </div>
          ))}
        </div>
      )}
      <h3>Inventory</h3>
      <div style={gridStyle}>
        <Metric label="Parts used" value={String(figures.parts.usedQty)} />
        <Metric label="Parts returned" value={String(figures.parts.returnedQty)} />
        <Metric label="Parts adjusted" value={String(figures.parts.adjustedQty)} />
        <Metric label="Stock value start" value={money(figures.stockValueStartCents)} hint={figures.stockValueNote} />
        <Metric label="Stock value end" value={money(figures.stockValueEndCents)} hint={figures.stockValueNote} />
      </div>
      <h3>Outside purchases</h3>
      {/* Purchase orders are the outside-purchase source. An empty list means none were recorded in this period. */}
      {figures.purchases.length === 0 ? <EmptyLine>No outside purchases in this period.</EmptyLine> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {figures.purchases.map((line) => (
            <div key={line.id} style={{ background: '#241014', border: '1px solid #4a1c22', borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700 }}>{line.item}</div>
              <div style={{ color: '#e7c4bf', fontSize: 14, marginTop: 4 }}>
                {line.vendor} · qty {line.qty} · {money(line.unitCostCents)} · {money(line.totalCents)}
              </div>
            </div>
          ))}
        </div>
      )}
      <h3>Deposits</h3>
      <div style={gridStyle}>
        <Metric label="Matched" value={money(figures.money.depositsMatchedCents)} />
        <Metric label="Unmatched" value={money(figures.money.depositsUnmatchedCents)} />
        <Metric label="Missing" value={money(figures.money.missingDepositCents)} />
      </div>
      <People title="Staff clock" people={figures.staff} total={figures.staffMinutes} />
      <People title="Work clock" people={figures.work} total={figures.workMinutes} />
      <p style={{ color: '#e7c4bf' }}>{figures.tipsNote} {figures.voidsNote}</p>
      {!month && report.months.map((item) => (
        <PeriodCard key={item.id} title={item.label} subtitle={item.id} onClick={() => setMonthId(item.id)}>
          <PaymentMetrics moneyTotals={item.money} showRevenue={showRevenue} />
        </PeriodCard>
      ))}
      {month && !week && month.weeks.map((item, index) => (
        <PeriodCard
          key={item.id}
          title={`Week ${index + 1}`}
          subtitle={item.splitAtMonthEdge ? `${item.label}. Split at the month edge.` : item.label}
          onClick={() => setWeekId(item.id)}
        >
          <PaymentMetrics moneyTotals={item.money} showRevenue={showRevenue} />
        </PeriodCard>
      ))}
      {week && !day && week.days.map((item) => (
        <PeriodCard key={item.id} title={item.label} subtitle={item.weekday} onClick={() => setDayId(item.id)}>
          <PaymentMetrics moneyTotals={item.money} showRevenue={showRevenue} />
        </PeriodCard>
      ))}
    </section>
  );
}
