'use client';

import ShopSettingsPage from '../../settings/page';

export default function ShopAdminSettingsBridgePage() {
	return (
		<>
			<h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>Shop Admin Settings</h1>
			<ShopSettingsPage />
		</>
	);
}
