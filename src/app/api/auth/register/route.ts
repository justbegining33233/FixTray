import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole, hashPassword } from '@/lib/auth';
import {
  employeeNumberInAllowedRange,
  generateUniqueEmployeeNumber,
  isFixTrayShopId,
  normalizeEmployeeNumber,
} from '@/lib/employeeNumber';

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || 'Team',
    lastName: parts.slice(1).join(' ') || 'Member',
  };
}

// Legacy endpoint retained for backward compatibility.
// Prefer /api/techs for team-member creation.
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) {
    return NextResponse.json({ error: 'Use /api/customers/register or /api/shops/register for public registration' }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = String(body.role || 'tech');
    const rawEmployeeNumber = String(body.employeeNumber || '').trim();
    const employeeNumberInput = rawEmployeeNumber ? normalizeEmployeeNumber(rawEmployeeNumber) : null;

    if (!email || !password) {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
    }

    const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
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
            ? 'FixTray employee numbers must be between 1 and 999999 (first 1000 are reserved first)'
            : 'Employee numbers must be between 1001 and 999999',
        },
        { status: 400 }
      );
    }

    const existing = await prisma.tech.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    if (employeeNumberInput) {
      const existingEmployeeNumber = await prisma.tech.findUnique({
        where: { employeeNumber: employeeNumberInput } as any,
        select: { id: true },
      });

      if (existingEmployeeNumber) {
        return NextResponse.json({ error: 'Employee number already in use' }, { status: 409 });
      }
    }

    const name = String(body.name || '').trim();
    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    const fallback = splitName(name || email.split('@')[0]);

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
        email,
        password: await hashPassword(password),
        firstName: firstName || fallback.firstName,
        lastName: lastName || fallback.lastName,
        phone: body.phone || null,
        role,
      },
      select: { id: true, employeeNumber: true, email: true, firstName: true, lastName: true, role: true },
    });

    return NextResponse.json(tech, { status: 201 });
  } catch (error) {
    console.error('Legacy auth/register error:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
