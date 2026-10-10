import { positionJobs, type ShopJobFacts } from '@/lib/books/truth';

/**
 * Invoiced amount still owed. Same number as AR Aging and the end-of-day
 * outstanding balance. Estimates that were never invoiced are not included.
 * Deposits do not create a balance by themselves.
 */
export function outstandingArCents(jobs: ShopJobFacts[]): number {
  return positionJobs(jobs).reduce((sum, job) => sum + job.arCents, 0);
}

export function outstandingArDollars(jobs: ShopJobFacts[]): number {
  return Math.round(outstandingArCents(jobs)) / 100;
}

export const OUTSTANDING_DEFINITION =
  'Invoiced amount still owed. Same figure as AR Aging. Estimates that are not invoiced are not included, and deposits are not added on their own.';
