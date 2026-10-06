import { intuitConfig, isQboRealmId, requestQboToken } from '@/lib/books/qbo';
import { readQboConnection, saveQboTokens } from '@/lib/books/qboStore';

export async function accessTokenFor(shopId: string): Promise<
  | { token: string; realmId: string; apiHost: string }
  | { error: string; status: number }
> {
  const configured = intuitConfig();
  if (!configured.ok) return { error: 'QuickBooks Online is not configured', status: 503 };
  const connection = await readQboConnection(shopId);
  if (!connection.connected || !connection.accessToken || !isQboRealmId(connection.realmId)) {
    return { error: 'Connect QuickBooks Online first', status: 400 };
  }
  const expired = connection.tokenExpiry != null && connection.tokenExpiry.getTime() <= Date.now();
  if (!expired) {
    return { token: connection.accessToken, realmId: connection.realmId, apiHost: configured.config.apiHost };
  }
  if (!connection.refreshToken) return { error: 'Connect QuickBooks Online again', status: 400 };
  const refreshed = await requestQboToken({
    clientId: configured.config.clientId,
    clientSecret: configured.config.clientSecret,
    grant: { type: 'refresh_token', refreshToken: connection.refreshToken },
  });
  if (!refreshed.ok) return { error: 'Connect QuickBooks Online again', status: 400 };
  await saveQboTokens({
    shopId,
    realmId: connection.realmId,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresIn: refreshed.expiresIn,
  });
  return { token: refreshed.accessToken, realmId: connection.realmId, apiHost: configured.config.apiHost };
}
