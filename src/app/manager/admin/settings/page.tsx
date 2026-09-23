'use client';

import { usePhrase } from '@/lib/usePhrase';
import ManagerSettingsPage from '../../settings/page';

export default function ManagerAdminSettingsPage() {
  const say = usePhrase();
  return (
    <>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>{say("Manager Admin Settings")}</h1>
      <ManagerSettingsPage />
    </>
  );
}
