import { Capacitor } from '@capacitor/core';

/** Capture a JPEG with the Capacitor camera. Returns null on the web so callers can use a file input. */
export async function captureNativePhotoFile(): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const { nativeMobileService } = await import('@/lib/nativeMobileService');
  const photo = await nativeMobileService.capturePhoto({ quality: 85 });
  if (!photo?.base64Data) return null;
  const binary = atob(photo.base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], photo.fileName || `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
}
