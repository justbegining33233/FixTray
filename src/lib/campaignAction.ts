export function sendNowAppearance(canSend: boolean): {
  background: string;
  color: string;
  cursor: string;
  opacity: number;
} {
  if (canSend) {
    return { background: '#22c55e', color: '#ffffff', cursor: 'pointer', opacity: 1 };
  }
  return { background: '#374151', color: '#9ca3af', cursor: 'not-allowed', opacity: 1 };
}
