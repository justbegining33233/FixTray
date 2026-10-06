/**
 * Shop statements for a date range. Built from the same job facts as Books.
 * Sales tax is its own payable. The FixTray fee is not a line.
 */

import { dayKey } from '@/lib/books/periods';
import {
  postInvoice,
  postPayment,
  postRefund,
  type JournalDraft,
} from '@/lib/books/journal';
import { taxForInvoice, type ShopTaxSettings } from '@/lib/books/shopTax';
import type { ShopJobFacts } from '@/lib/books/truth';

export function journalForFacts(
  facts: ShopJobFacts[],
  start: Date,
  end: Date,
  settings: Partial<ShopTaxSettings> | null | undefined,
  timeZone: string,
): JournalDraft[] {
  const entries: JournalDraft[] = [];
  for (const job of facts) {
    const invoice = job.events.find((event) => event.kind === 'invoice' && new Date(event.at) >= start && new Date(event.at) < end);
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
        date: dayKey(new Date(invoice.at), timeZone),
        laborCents: tax.laborBaseCents,
        partsCents: tax.partsBaseCents,
        taxCents: tax.taxCents,
      }));
      open = tax.laborBaseCents + tax.partsBaseCents + tax.taxCents;
    }
    for (const event of job.events) {
      const when = new Date(event.at);
      if (when < start || when >= end) continue;
      if (event.kind === 'payment' && event.cents > 0) {
        entries.push(postPayment({
          id: event.id,
          workOrderId: job.id,
          date: dayKey(when, timeZone),
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
          date: dayKey(when, timeZone),
          amountCents: event.cents,
        }));
      }
    }
  }
  return entries;
}
