export type PhotoUploadEvent = 'save-success' | 'save-failed' | 'cancel' | 'dismiss';

/** Cancel and dismiss must not report a successful save. */
export function photoUploadMessage(event: PhotoUploadEvent): { type: 'success' | 'error'; text: string } | null {
  if (event === 'save-success') return { type: 'success', text: 'Photo saved successfully.' };
  if (event === 'save-failed') return { type: 'error', text: 'Photo upload failed.' };
  return null;
}
