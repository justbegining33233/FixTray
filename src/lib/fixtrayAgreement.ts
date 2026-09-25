/**
 * Shop agreement lives on ShopSettings.notificationPreferences.fixtrayAgreement.
 * A fresh login has no localStorage flag, so navigation must ask the server
 * before sending every /shop page to Settings.
 */

export function fixtrayAgreementAccepted(agreement: unknown): boolean {
  if (!agreement || typeof agreement !== 'object' || Array.isArray(agreement)) return false;
  return (agreement as { accepted?: unknown }).accepted === true;
}

export function agreementFromNotificationPrefs(prefs: unknown): unknown {
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return undefined;
  return (prefs as Record<string, unknown>).fixtrayAgreement;
}

/** true = accepted, false = explicitly not accepted, null = unknown (do not redirect). */
export async function fetchShopAgreementAccepted(): Promise<boolean | null> {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/shops/settings', {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) return null;
    const data = await response.json();
    const accepted = fixtrayAgreementAccepted(data?.settings?.fixtrayAgreement);
    if (accepted) localStorage.setItem('fixtrayAgreementAccepted', 'true');
    return accepted;
  } catch {
    return null;
  }
}
