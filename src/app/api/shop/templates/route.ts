import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getTemplatesByShop, createTemplate } from '@/lib/workorder-templates';
import { findUnconfiguredShopServices } from '@/lib/shopServiceValidation';

// GET /api/shop/templates — List all templates for the shop
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const shopId = auth.shopId ?? auth.id;
  const templates = await getTemplatesByShop(shopId);

  return NextResponse.json({ templates });
}

// POST /api/shop/templates — Create a new template
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const shopId = auth.shopId ?? auth.id;
  let body: Awaited<ReturnType<typeof request.json>>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, serviceType, description, repairs, maintenance, estimatedCost, laborHours, notes } = body;

  if (!name || !serviceType) {
    return NextResponse.json({ error: 'name and serviceType are required' }, { status: 400 });
  }

  const serviceValidation = await findUnconfiguredShopServices(shopId, [String(serviceType)]);
  if (!serviceValidation.hasConfiguredServices) {
    return NextResponse.json(
      { error: 'This shop has no services configured. Add services before creating templates.' },
      { status: 400 }
    );
  }
  if (serviceValidation.invalidServices.length > 0) {
    return NextResponse.json(
      {
        error: 'Template service type must be one of this shop\'s configured services.',
        invalidServices: serviceValidation.invalidServices,
      },
      { status: 400 }
    );
  }

  const template = await createTemplate(shopId, {
    name,
    serviceType,
    description: description ?? '',
    repairs: repairs ?? [],
    maintenance: maintenance ?? [],
    estimatedCost: estimatedCost ?? 0,
    laborHours: laborHours ?? 0,
    notes: notes ?? '',
  });

  return NextResponse.json({ template }, { status: 201 });
}
