export type PayrollEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  jobTitle?: string;
  department?: string;
  employmentType: string;
  payType: string;
  hourlyRate: number;
  salary?: number;
  overtimeRate?: number;
  hireDate?: string;
  terminatedAt?: string | null;
  available: boolean;
};

function asList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as { employees?: unknown; techs?: unknown };
  if (Array.isArray(record.employees)) return record.employees;
  if (Array.isArray(record.techs)) return record.techs;
  return [];
}

export function normalizePayrollEmployees(payload: unknown): PayrollEmployee[] {
  return asList(payload)
    .filter((row) => row && row.id)
    .map((row) => ({
      id: String(row.id),
      firstName: String(row.firstName || 'Team'),
      lastName: String(row.lastName || 'Member'),
      email: String(row.email || ''),
      phone: row.phone || undefined,
      role: String(row.role || 'tech'),
      jobTitle: row.jobTitle || undefined,
      department: row.department || undefined,
      employmentType: row.employmentType || 'full-time',
      payType: row.payType || 'hourly',
      hourlyRate: Number(row.hourlyRate || 0),
      salary: row.salary ?? undefined,
      overtimeRate: row.overtimeRate ?? undefined,
      hireDate: row.hireDate,
      terminatedAt: row.terminatedAt ?? null,
      available: row.available !== false,
    }));
}

export function activePayrollEmployees<T extends { terminatedAt?: string | null }>(employees: T[]): T[] {
  return employees.filter((employee) => !employee.terminatedAt);
}
