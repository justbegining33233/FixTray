import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/middleware';
import { hashPassword } from '@/lib/auth';
import {
  employeeNumberInAllowedRange,
  generateUniqueEmployeeNumber,
  isFixTrayShopId,
  normalizeEmployeeNumber,
} from '@/lib/employeeNumber';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;
  
  try {
    // Get shopId from query parameter or from auth
    const { searchParams } = new URL(request.url);
    const queryShopId = searchParams.get('shopId');
    
    let shopId: string | undefined;
    if (queryShopId) {
      // Prevent IDOR: non-admin callers can only query their own shop
      if (auth.role !== 'superadmin') {
        const callerShopId = auth.role === 'shop' ? auth.id : auth.shopId;
        if (!callerShopId || callerShopId !== queryShopId) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
      shopId = queryShopId;
    } else {
      shopId = auth.role === 'shop' ? auth.id : auth.shopId;
    }
    
    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
    }
    
    const techs = await prisma.tech.findMany({
      where: { shopId },
      select: {
        id: true,
        employeeNumber: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        available: true,
        createdAt: true,
        _count: {
          select: {
            assignedWorkOrders: {
              where: {
                status: { in: ['assigned', 'in-progress'] },
              },
            },
          },
        },
      },
      orderBy: { firstName: 'asc' },
    });
    
    return NextResponse.json({ techs });
  } catch (error) {
    console.error('Error fetching techs:', error);
    return NextResponse.json({ error: 'Failed to fetch techs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;
  if (!request.headers.get('authorization')) {
    const ok = await (await import('@/lib/csrf')).validateCsrf(request);
    if (!ok) return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }
  try {
    const data = await request.json();
    const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
    const normalizedEmail = String(data.email || '').trim().toLowerCase();
    const rawPhone = String(data.phone || '').trim();
    const normalizedPhone = rawPhone.replace(/\D/g, '');
    const rawEmployeeNumber = String(data.employeeNumber || '').trim();
    const employeeNumberInput = rawEmployeeNumber ? normalizeEmployeeNumber(rawEmployeeNumber) : null;

    if (!normalizedEmail || !data.password || !data.firstName || !data.lastName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!shopId) {
      return NextResponse.json({ error: 'Shop context required' }, { status: 400 });
    }

    const isFixTrayEmployee = await isFixTrayShopId(prisma, shopId);

    if (rawEmployeeNumber && !employeeNumberInput) {
      return NextResponse.json({ error: 'Employee number must contain digits only' }, { status: 400 });
    }

    if (employeeNumberInput && !employeeNumberInAllowedRange(employeeNumberInput, isFixTrayEmployee)) {
      return NextResponse.json(
        {
          error: isFixTrayEmployee
            ? 'FixTray employee numbers must be between 1 and 999999999 (first 1000 are reserved first)'
            : 'Employee numbers must be between 1001 and 999999999',
        },
        { status: 400 }
      );
    }

    // Check if email exists
    const existing = await prisma.tech.findUnique({
      where: { email: normalizedEmail },
    });
    
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
    }

    if (employeeNumberInput) {
      const existingEmployeeNumber = await prisma.tech.findUnique({
        where: { employeeNumber: employeeNumberInput },
        select: { id: true },
      });

      if (existingEmployeeNumber) {
        return NextResponse.json({ error: 'Employee number already in use' }, { status: 400 });
      }
    }
    
    const hashedPassword = await hashPassword(data.password);
    
    
    let employeeNumber = employeeNumberInput;
    if (!employeeNumber) {
      try {
        employeeNumber = await generateUniqueEmployeeNumber(prisma, isFixTrayEmployee);
      } catch (generationError) {
        return NextResponse.json(
          { error: (generationError as Error)?.message || 'Failed to allocate employee number' },
          { status: 409 }
        );
      }
    }

    const tech = await prisma.tech.create({
      data: {
        shopId,
        employeeNumber,
        email: normalizedEmail,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: normalizedPhone || rawPhone,
        role: data.role || 'tech',
      },
      select: {
        id: true,
        employeeNumber: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
    
    
    return NextResponse.json(tech, { status: 201 });
  } catch (error) {
    console.error('Error creating tech:', error);
    return NextResponse.json({ error: 'Failed to create tech' }, { status: 500 });
  }
}
