type LogoutCheck = { pending: number; warn: boolean; clearCache: boolean; message: string };

type OfflineEngine = {
  logoutCheck?: () => Promise<LogoutCheck>;
  clearSynced?: () => Promise<void>;
  downloadJob?: (workOrderId: string) => Promise<unknown>;
  setStatus?: (workOrderId: string, baseStatus: string, status: string) => Promise<unknown>;
  syncNow?: () => Promise<unknown>;
  startBridge?: () => void;
};

function engine(): OfflineEngine | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { FixTrayOffline?: OfflineEngine }).FixTrayOffline;
}

/** Warn and keep unsynced work. Clear the local cache only when nothing is waiting. */
export async function guardOfflineLogout(): Promise<boolean> {
  const offline = engine();
  if (!offline?.logoutCheck) return true;
  const check = await offline.logoutCheck();
  if (!check.pending) {
    await offline.clearSynced?.();
    return true;
  }
  const ok = window.confirm(check.message);
  if (!ok) return false;
  return true;
}
