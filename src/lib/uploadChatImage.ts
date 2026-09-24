import { isChatImageUrl } from './messageAttachment';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Upload one chat picture through the existing Cloudinary route. Does not send the message. */
export async function uploadChatImage(file: File): Promise<{ url: string } | { error: string }> {
  if (!IMAGE_TYPES.includes(file.type)) {
    return { error: 'Choose a JPEG, PNG, WEBP, or GIF image.' };
  }
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const form = new FormData();
  form.append('file', file);
  form.append('folder', 'workorder-messages');
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data?.url !== 'string' || !isChatImageUrl(data.url)) {
      return { error: data?.error || 'Upload failed. Your draft is still here.' };
    }
    return { url: data.url };
  } catch {
    return { error: 'Upload failed. Your draft is still here.' };
  }
}
