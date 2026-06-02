import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = authenticateRequest(request);
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const all = await loadAddresses();
    const idx = all.findIndex((item) => item.id === id && item.customerId === user.id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    if (body.isDefault) {
      for (const item of all) {
        if (item.customerId === user.id) item.isDefault = false;
      }
    }

    all[idx] = {
      ...all[idx],
      label: body.label != null ? String(body.label).trim() : all[idx].label,
      address: body.address != null ? String(body.address).trim() : all[idx].address,
      city: body.city != null ? String(body.city).trim() : all[idx].city,
      state: body.state != null ? String(body.state).trim() : all[idx].state,
      zipCode: body.zipCode != null ? String(body.zipCode).trim() : all[idx].zipCode,
      isDefault: body.isDefault != null ? Boolean(body.isDefault) : all[idx].isDefault,
      updatedAt: new Date().toISOString(),
    };

    await saveAddresses(all);
    return NextResponse.json({ address: all[idx] });
  } catch (error) {
    console.error('Address update error:', error);
    return NextResponse.json({ error: 'Failed to update address' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = authenticateRequest(request);
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const all = await loadAddresses();
    const match = all.find((item) => item.id === id && item.customerId === user.id);
    if (!match) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    const filtered = all.filter((item) => !(item.id === id && item.customerId === user.id));

    const customerAddresses = filtered.filter((item) => item.customerId === user.id);
    if (customerAddresses.length > 0 && !customerAddresses.some((item) => item.isDefault)) {
      const firstIdx = filtered.findIndex((item) => item.customerId === user.id);
      if (firstIdx >= 0) filtered[firstIdx].isDefault = true;
    }

    await saveAddresses(filtered);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Address delete error:', error);
    return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 });
  }
}
