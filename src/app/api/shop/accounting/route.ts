import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { booksAccess, shopIdForBooks } from '@/lib/books/access';
import { loadShopFacts, shopTimeZone } from '@/lib/books/loadTruth';
import { shopDateSpan } from '@/lib/books/periods';
import { cashBasisIncome, bankDepositEvents, buildShopStatement, periodCogsCents } from '@/lib/books/statements';
import { assignPartReturns, closedPayrollGrossCents, inventoryOnHandValueCents, jobPartsCostCents, partMovementFromAudit } from '@/lib/books/floor';
import { feeCashHeld, usdToCents } from '@/lib/books/money';
import { isInvoicedJobStatus } from '@/lib/books/jobStatus';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'accountant']);
  if (auth instanceof NextResponse) return auth;
  if (!booksAccess(auth.role).shopRevenue) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'Choose from and to dates' }, { status: 400 });
  }
  const zone = await shopTimeZone(shopId);
  const span = shopDateSpan(from, to, zone);
  const facts = await loadShopFacts(shopId);
  const [stock, items, orders, punches, bills, billPays, bankRows, taxRows, audits, feeRows, links] = await Promise.all([
    prisma.inventoryStock.findMany({ where: { shopId }, select: { id: true, sku: true, quantity: true, unitCost: true } }).catch(() => []),
    prisma.inventoryItem.findMany({ where: { shopId }, select: { id: true, sku: true, quantity: true, costCents: true } }).catch(() => []),
    prisma.workOrder.findMany({
      where: { shopId },
      select: { id: true, status: true, completedAt: true, partsUsed: true, createdAt: true },
    }).catch(() => []),
    prisma.timeEntry.findMany({
      where: { shopId, clockOut: { not: null } },
      select: { id: true, techId: true, clockOut: true, hoursWorked: true, tech: { select: { hourlyRate: true } } },
    }).catch(() => []),
    prisma.vendorBill.findMany({
      where: { shopId },
      select: { id: true, billDate: true, lines: { select: { amountCents: true, inventoryItemId: true } } },
    }).catch(() => []),
    prisma.billPayment.findMany({
      where: { shopId },
      select: { id: true, paidAt: true, amountCents: true },
    }).catch(() => []),
    prisma.bankDeposit.findMany({
      where: { shopId },
      select: { id: true, depositedAt: true, amountCents: true },
    }).catch(() => []),
    prisma.journalEntry.findMany({
      where: { shopId, sourceType: 'sales_tax' },
      select: {
        id: true,
        entryDate: true,
        lines: { select: { accountKey: true, creditCents: true, workOrderId: true } },
      },
    }).catch(() => []),
    prisma.auditLog.findMany({
      where: { shopId, action: { startsWith: 'parts.' } },
      select: { id: true, action: true, details: true, targetId: true, targetType: true, createdAt: true },
    }).catch(() => []),
    prisma.booksEntry.findMany({
      where: { shopId, appliesTo: 'fee', status: { not: 'open' } },
      select: { id: true, workOrderId: true, amountCents: true, note: true, createdAt: true },
    }).catch(() => []),
    prisma.paymentLink.findMany({
      where: { shopId, description: { startsWith: 'Invoice for work order' } },
      select: { workOrderId: true, status: true, amount: true },
    }).catch(() => []),
  ]);
  const catalog = [
    ...stock.map((item) => ({ id: item.id, sku: item.sku, costCents: usdToCents(item.unitCost) })),
    ...items.map((item) => ({ id: item.id, sku: item.sku, costCents: item.costCents })),
  ];
  const movements = assignPartReturns({
    jobs: orders.map((order) => ({ id: order.id, partsUsed: order.partsUsed })),
    movements: audits.flatMap((row) => {
      const movement = partMovementFromAudit(row);
      return movement ? [movement] : [];
    }),
  });
  const invoiceAt = new Map(facts.filter((job) => job.invoiceAt).map((job) => [job.id, job.invoiceAt as string]));
  const partsCost = orders
    .filter((order) => isInvoicedJobStatus(order.status) || invoiceAt.has(order.id))
    .map((order) => ({
      id: `cogs:${order.id}`,
      workOrderId: order.id,
      at: invoiceAt.get(order.id) || (order.completedAt || order.createdAt).toISOString(),
      cents: jobPartsCostCents({
        workOrderId: order.id,
        partsUsed: order.partsUsed,
        catalog,
        movements,
      }),
    }))
    .filter((row) => row.cents > 0);
  const writeOffs = audits.flatMap((row) => {
    const movement = partMovementFromAudit(row);
    if (!movement || movement.kind !== 'adjust' || movement.qty >= 0) return [];
    const item = catalog.find((entry) => entry.id === movement.itemId);
    const cents = Math.abs(movement.qty) * (item?.costCents || 0);
    if (cents <= 0) return [];
    return [{ id: row.id, at: row.createdAt.toISOString(), cents }];
  });
  const taxByJob = new Map<string, number>();
  for (const entry of taxRows) {
    const jobId = entry.lines.find((line) => line.workOrderId)?.workOrderId;
    if (!jobId) continue;
    const cents = entry.lines.filter((line) => line.accountKey === 'salesTaxPayable').reduce((sum, line) => sum + line.creditCents, 0);
    taxByJob.set(jobId, (taxByJob.get(jobId) || 0) + cents);
  }
  const linkByJob = new Map(links.filter((link) => link.workOrderId).map((link) => [link.workOrderId as string, link]));
  const paidByJob = new Map<string, number>();
  for (const job of facts) {
    let paid = 0;
    for (const event of job.events) {
      if (event.kind === 'payment') paid += event.cents;
      else if (event.kind === 'refund' || event.kind === 'chargeback') paid -= event.cents;
    }
    paidByJob.set(job.id, Math.max(0, paid));
  }
  const feeHeld = feeRows.flatMap((row) => {
    const link = linkByJob.get(row.workOrderId);
    const cents = feeCashHeld({
      feeCents: row.amountCents,
      jobPaidCents: paidByJob.get(row.workOrderId) || 0,
      taxCollectedCents: taxByJob.get(row.workOrderId) || 0,
      linkStatus: link?.status,
      linkAmountCents: link ? usdToCents(link.amount) : null,
      note: row.note,
    });
    if (cents <= 0) return [];
    return [{ id: `fee-held:${row.id}`, workOrderId: row.workOrderId, at: row.createdAt.toISOString(), cents }];
  });
  const payroll = punches
    .filter((row) => row.clockOut)
    .map((row) => ({
      id: `payroll:${row.id}`,
      personId: row.techId,
      at: row.clockOut ? row.clockOut.toISOString() : to,
      cents: closedPayrollGrossCents([{ clockOut: row.clockOut, hoursWorked: row.hoursWorked, hourlyRate: row.tech.hourlyRate }]),
    }))
    .filter((row) => row.cents > 0);
  const billLines = bills.map((bill) => ({
    id: bill.id,
    at: bill.billDate.toISOString(),
    cents: bill.lines.reduce((sum, line) => sum + line.amountCents, 0),
    toInventory: bill.lines.some((line) => Boolean(line.inventoryItemId)),
  }));
  const bankDeposits = bankRows.length > 0
    ? bankRows.map((row) => ({ id: row.id, at: row.depositedAt.toISOString(), cents: row.amountCents }))
    : bankDepositEvents(facts);
  const collectedTax = taxRows.map((entry) => ({
    id: entry.id,
    workOrderId: entry.lines.find((line) => line.workOrderId)?.workOrderId || entry.id,
    at: entry.entryDate.toISOString(),
    cents: entry.lines
      .filter((line) => line.accountKey === 'salesTaxPayable')
      .reduce((sum, line) => sum + line.creditCents, 0),
  })).filter((row) => row.cents > 0);
  const statement = buildShopStatement({
    jobs: facts,
    timeZone: zone,
    from: span.start,
    to: span.end,
    partsCost,
    payroll,
    bills: billLines,
    billPayments: billPays.map((row) => ({ id: row.id, at: row.paidAt.toISOString(), cents: row.amountCents })),
    bankDeposits,
    collectedTax,
    writeOffs,
    feeHeld,
    inventoryValueCents: inventoryOnHandValueCents([
      ...stock.map((item) => ({ quantity: item.quantity, unitCostCents: usdToCents(item.unitCost) })),
      ...items.map((item) => ({ quantity: item.quantity, unitCostCents: item.costCents })),
    ]),
  });
  const books = statement.books;
  const periodCogs = periodCogsCents(partsCost, span.start, span.end, zone);
  const periodPayroll = payroll.reduce((sum, row) => {
    const at = new Date(row.at);
    return at >= span.start && at < span.end ? sum + row.cents : sum;
  }, 0);
  const cash = cashBasisIncome({
    revenueCents: books.revenueCents,
    cogsCents: periodCogs,
    payrollCents: periodPayroll,
    shopSuppliesCents: statement.period.shopSuppliesCents,
  });
  const sheet = statement.sheet;
  const balance = statement.trial;
  return NextResponse.json({
    from,
    to,
    timeZone: zone,
    basis: cash.basis,
    basisNote: cash.note,
    books: {
      invoicedCents: books.invoicedCents,
      paidCents: books.paidCents,
      revenueCents: books.revenueCents,
      arCents: books.arCents,
      customerCreditCents: books.customerCreditCents,
    },
    profitAndLoss: {
      basis: 'accrual',
      revenueCents: cash.revenueCents,
      cogsCents: periodCogs,
      payrollCents: periodPayroll,
      shopSuppliesCents: statement.period.shopSuppliesCents,
      salesTaxCents: statement.period.salesTaxCents,
      inventoryShrinkCents: statement.period.inventoryShrinkCents,
      arCents: statement.arCents,
      customerCreditCents: statement.customerCreditCents,
      cashNetIncomeCents: cash.netIncomeCents,
      netIncomeCents: statement.period.netIncomeCents,
      retainedEarningsCents: statement.asOf.retainedEarningsCents,
      accrualInvoicedCents: statement.period.laborIncomeCents + statement.period.partsIncomeCents + statement.period.subletIncomeCents,
      accrualNetIncomeCents: statement.period.netIncomeCents,
      note: 'Net income is revenue minus cost and expenses in these dates. Retained earnings on the balance sheet is net income through the end of the range. The FixTray fee is not shop revenue.',
    },
    balanceSheet: sheet,
    balanceSheetBalances: sheet.balanced,
    trialBalance: balance,
    readOnly: booksAccess(auth.role).accountantRead,
  });
}
