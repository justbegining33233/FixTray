import type { ReactNode } from 'react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="role-route-shell">
      <div
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 50,
          width: 'auto',
        }}
      >
        <LanguageSwitcher />
      </div>
      <div data-page-shell>{children}</div>
    </div>
  );
}
