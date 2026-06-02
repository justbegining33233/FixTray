import { NextRequest, NextResponse } from 'next/server';
import { validatePublicCsrf } from '@/lib/csrf';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/emailService';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  company: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Validate public CSRF token (double-submit)
    const ok = validatePublicCsrf(request);
    if (!ok) return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
    const body = await request.json();

    // Guard: reject shop-like payloads sent to the customer registration
    // endpoint — client should use /api/shops/register for shop owners.
    if (body && (body.shopName || body.ownerName || body.shopType || body.address)) {
      return NextResponse.json({ error: 'Shop registration detected. Use /api/shops/register to register a shop.' }, { status: 400 });
    }

    const data = registerSchema.parse(body);
    const normalizedEmail = data.email.trim().toLowerCase();
    const normalizedUsername = data.username?.trim().toLowerCase();
    
    // Check if customer exists
    const existing = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: { equals: normalizedEmail, mode: 'insensitive' } },
          ...(normalizedUsername
            ? [{ username: { equals: normalizedUsername, mode: 'insensitive' as const } }]
            : [])
        ]
      },
    });
    
    if (existing) {
      if (existing.email.toLowerCase() === normalizedEmail) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
      }
      if (normalizedUsername && existing.username?.toLowerCase() === normalizedUsername) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
      }
    }
    
    // Hash password
    const hashedPassword = await hashPassword(data.password);
    
// Create customer with email pre-verified (no verification step required)
    const customer = await prisma.customer.create({
      data: {
        email: normalizedEmail,
        username: normalizedUsername,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        company: data.company,
        emailVerified: true,
      },
    });

    // Also send welcome email
    sendWelcomeEmail(customer.email, customer.firstName).catch(console.error);
    
    return NextResponse.json({
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = Array.isArray((error.meta as { target?: string[] } | undefined)?.target)
        ? (error.meta as { target?: string[] }).target || []
        : [];
      if (target.includes('username')) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
      }
      if (target.includes('email')) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Account already exists' }, { status: 400 });
    }
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
