export function hourlyRateIsSet(hourlyRate: number | null | undefined): boolean {
  return typeof hourlyRate === 'number' && Number.isFinite(hourlyRate) && hourlyRate > 0;
}

export function techWageLabel(hourlyRate: number | null | undefined): { text: string; unset: boolean } {
  if (!hourlyRateIsSet(hourlyRate)) {
    return { text: 'No hourly rate set yet. Ask your shop', unset: true };
  }
  return { text: `$${hourlyRate!.toFixed(2)}/hr`, unset: false };
}

/** Clock status wins over the available flag. A clocked-in tech is Active. */
export function techClockStatusLabel(clockedIn: boolean): 'Active' | 'Inactive' {
  return clockedIn ? 'Active' : 'Inactive';
}
