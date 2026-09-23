'use client';

import { usePhrase } from '@/lib/usePhrase';
import ShopSettingsPage from '../../settings/page';

export default function ShopAdminSettingsBridgePage() {
  const say = usePhrase();
	return (
		<>
			<h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>{say("Shop Admin Settings")}</h1>
			<ShopSettingsPage />
		</>
	);
}
