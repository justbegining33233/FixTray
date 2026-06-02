import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';

// GET /api/payroll/employees - list all employees with payroll info
export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop context' }, { status: 400 });

  const techs = await prisma.tech.findMany({
    where: { shopId },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      jobTitle: true,
      department: true,
      employmentType: true,
      payType: true,
      hourlyRate: true,
      salary: true,
      overtimeRate: true,
      hireDate: true,
      terminatedAt: true,
      available: true,
      createdAt: true,
    },
    orderBy: [{ department: 'asc' }, { firstName: 'asc' }],
  });

  return NextResponse.json(techs);
}
