import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { authenticateRequest } from '@/lib/auth';

export const runtime = 'nodejs';

interface CustomerAddress {
  id: string;
  customerId: string;
  label: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const FILE_PATH = path.join(process.cwd(), 'data', 'customer-addresses.json');

async function loadAddresses(): Promise<CustomerAddress[]> {
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAddresses(addresses: CustomerAddress[]) {
  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(addresses, null, 2), 'utf8');
}

export async function GET(request: NextRequest) {
  const user = authenticateRequest(request);
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const all = await loadAddresses();
  const addresses = all
    .filter((item) => item.customerId === user.id)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

  return NextResponse.json({ addresses });
}

export async function POST(request: NextRequest) {
  const user = authenticateRequest(request);
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body?.label || !body?.address || !body?.city || !body?.state || !body?.zipCode) {
      return NextResponse.json({ error: 'label, address, city, state, and zipCode are required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newAddress: CustomerAddress = {
      id: randomUUID(),
      customerId: user.id,
      label: String(body.label).trim(),
      address: String(body.address).trim(),
      city: String(body.city).trim(),
      state: String(body.state).trim(),
      zipCode: String(body.zipCode).trim(),
      isDefault: Boolean(body.isDefault),
      createdAt: now,
      updatedAt: now,
    };

    const all = await loadAddresses();

    if (newAddress.isDefault) {
      for (const item of all) {
        if (item.customerId === user.id) item.isDefault = false;
      }
    } else if (!all.some((item) => item.customerId === user.id)) {
      newAddress.isDefault = true;
    }

    all.push(newAddress);
    await saveAddresses(all);

    return NextResponse.json({ address: newAddress }, { status: 201 });
  } catch (error) {
    console.error('Address create error:', error);
    return NextResponse.json({ error: 'Failed to create address' }, { status: 500 });
  }
}
