/** Tell the inbox this work-order chat was opened. Failures leave the thread on screen. */
export async function markWorkOrderThreadSeen(workOrderId: string): Promise<void> {
  if (!workOrderId || typeof window === 'undefined') return;
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    await fetch(`/api/workorders/${workOrderId}/messages`, {
      method: 'PUT',
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // The messages stay visible. A later open retries the mark.
  }
}
