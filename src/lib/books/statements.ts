/**
 * Shop statements for a date range. Built from the same job facts as Books.
 * Sales tax is its own payable. The FixTray fee is not a line.
 */

import { booksDayKey } from '@/lib/books/periods';
import { civilInRange, type ShopJobFacts } from '@/lib/books/truth';
import {
  postInvoice,
  postPayment,
  postRefund,
  type JournalDraft,
} from '@/lib/books/journal';
import { taxForInvoice, type ShopTaxSettings } from '@/lib/books/shopTax';

export function journalForFacts(
  facts: ShopJobFacts[],
  start: Date,
  end: Date,
  settings: Partial<ShopTaxSettings> | null | undefined,
  timeZone: string,
): JournalDraft[] {
  const entries: JournalDraft[] = [];
  for (const job of facts) {
    const invoice = job.events.find((event) => event.kind === 'invoice' && civilInRange(event.at, start, end, timeZone));
    let open = 0;
    if (invoice && invoice.cents > 0) {
      const tax = taxForInvoice({
        invoiceCents: invoice.cents,
        partsSellCents: job.partsSellCents,
        settings,
        frozen: job.salesTax,
      });
      entries.push(postInvoice({
        workOrderId: job.id,
        date: booksDayKey(new Date(invoice.at), timeZone),
        laborCents: tax.laborBaseCents,
        partsCents: tax.partsBaseCents,
        taxCents: tax.taxCents,
      }));
      open = tax.laborBaseCents + tax.partsBaseCents + tax.taxCents;
    }
    for (const event of job.events) {
      if (!civilInRange(event.at, start, end, timeZone)) continue;
      if (event.kind === 'payment' && event.cents > 0) {
        entries.push(postPayment({
          id: event.id,
          workOrderId: job.id,
          date: booksDayKey(new Date(event.at), timeZone),
          amountCents: event.cents,
          openArCents: open,
          hasInvoice: job.invoiceCents != null,
        }));
        open = Math.max(0, open - event.cents);
      }
      if ((event.kind === 'refund' || event.kind === 'chargeback') && event.cents > 0) {
        entries.push(postRefund({
          id: event.id,
          workOrderId: job.id,
          date: booksDayKey(new Date(event.at), timeZone),
          amountCents: event.cents,
        }));
      }
    }
  }
  return entries;
}

export const CASH_BASIS_NOTE = 'Cash basis. Shop money collected in these dates. The FixTray fee is not included.';

/** Profit and loss that matches Books revenue for the same dates. */
export function cashBasisIncome(input: {
  revenueCents: number;
  cogsCents: number;
  payrollCents: number;
  shopSuppliesCents: number;
}): {
  basis: 'cash';
  revenueCents: number;
  cogsCents: number;
  payrollCents: number;
  shopSuppliesCents: number;
  netIncomeCents: number;
  note: string;
} {
  const revenueCents = Math.round(input.revenueCents);
  const cogsCents = Math.max(0, Math.round(input.cogsCents));
  const payrollCents = Math.max(0, Math.round(input.payrollCents));
  const shopSuppliesCents = Math.max(0, Math.round(input.shopSuppliesCents));
  return {
    basis: 'cash',
    revenueCents,
    cogsCents,
    payrollCents,
    shopSuppliesCents,
    netIncomeCents: revenueCents - cogsCents - payrollCents - shopSuppliesCents,
    note: CASH_BASIS_NOTE,
  };
}
