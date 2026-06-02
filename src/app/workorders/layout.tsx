import type { ReactNode } from 'react';

export default function WorkordersLayout({ children }: { children: ReactNode }) {
  return (
    <div className="role-route-shell desktop-mode-shell">
      <div data-page-shell>{children}</div>
    </div>
  );
}
