import type { ReactNode } from 'react';

export default function PaymentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="role-route-shell">
      <div data-page-shell>{children}</div>
    </div>
  );
}
