import { decodeStatusText, workOrderStatusLabel, workOrderStatusTone } from '@/lib/workOrderStatus';

describe('work order status labels', () => {
  it('turns slugs into human labels', () => {
    expect(workOrderStatusLabel('estimate-submitted')).toBe('Estimate Submitted');
    expect(workOrderStatusLabel('en-route')).toBe('En Route');
    expect(workOrderStatusLabel('waiting-for-payment')).toBe('Waiting for Payment');
  });

  it('does not leave HTML entities in a status label', () => {
    expect(decodeStatusText('&nbsp;Estimate Submitted')).toBe('Estimate Submitted');
    expect(workOrderStatusLabel('&nbsp;estimate-submitted')).toBe('Estimate Submitted');
    expect(workOrderStatusLabel('Services &amp; Parts')).toBe('Services & Parts');
  });

  it('uses the estimate-submitted chip color', () => {
    expect(workOrderStatusTone('estimate-submitted').color).toBe('#60a5fa');
  });
});
