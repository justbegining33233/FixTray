import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getTemplateById, updateTemplate, deleteTemplate } from '@/lib/workorder-templates';

// GET /api/shop/templates/[id] — Get a single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, ['shop', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const template = await getTemplateById(id);
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  return NextResponse.json({ template });
}

// PUT /api/shop/templates/[id] — Update a template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, ['shop', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await getTemplateById(id);
  if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  const shopId = auth.shopId ?? auth.id;
  if (existing.shopId !== shopId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const template = await updateTemplate(id, body);

  return NextResponse.json({ template });
}

// DELETE /api/shop/templates/[id] — Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, ['shop', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await getTemplateById(id);
  if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  const shopId = auth.shopId ?? auth.id;
  if (existing.shopId !== shopId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await deleteTemplate(id);
  return NextResponse.json({ success: true });
}
