import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { validateCsrf } from '@/lib/csrf';
import { uploadToCloudinary } from '@/lib/cloudinary';

export const runtime = 'nodejs';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB (supports video)

function sanitizeFolder(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 50) || 'work-orders';
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  
  try {
    if (!request.headers.get('authorization')) {
      const ok = await validateCsrf(request);
      if (!ok) return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
    }
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const rawFolder = (formData.get('folder') as string) || 'work-orders';
    const folder = sanitizeFolder(rawFolder);
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type '${file.type}' is not allowed. Accepted: JPEG, PNG, WEBP, GIF, PDF` },
        { status: 415 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds maximum allowed size of 10 MB' },
        { status: 413 }
      );
    }
    
    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Upload to Cloudinary
    const result = await uploadToCloudinary(buffer, folder);
    
    return NextResponse.json({
      url: result.url,
      publicId: result.publicId,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
