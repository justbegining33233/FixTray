import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';

// PUT /api/payroll/employees/[id] - update pay settings for an employee
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 });
  if (auth.role !== 'shop') return NextResponse.json({ error: 'Shop owner only' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  // Only allow updating payroll-safe fields
  const allowed = [
    'payType', 'hourlyRate', 'salary', 'overtimeRate',
    'department', 'jobTitle', 'employmentType',
    'hireDate', 'terminatedAt', 'available',
    'firstName', 'lastName', 'phone',
  ] as const;

  const data: Record<string, any> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) {
      if (key === 'hireDate' || key === 'terminatedAt') {
        data[key] = body[key] ? new Date(body[key]) : null;
      } else {
        data[key] = body[key];
      }
    }
  }

  const tech = await prisma.tech.update({
    where: { id, shopId },
    data,
    select: {
      id: true, employeeNumber: true, firstName: true, lastName: true, email: true,
      role: true, jobTitle: true, department: true, employmentType: true,
      payType: true, hourlyRate: true, salary: true, overtimeRate: true,
      hireDate: true, terminatedAt: true, available: true,
    },
  });

  return NextResponse.json(tech);
}
