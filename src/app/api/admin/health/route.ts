import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';

interface EnvCheck {
  name: string;
  category: string;
  status: 'ok' | 'missing' | 'warning';
  hint: string;
}

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Only shop owners and admins
  if (!['shop', 'admin', 'superadmin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const checks: EnvCheck[] = [
    // Database
    {
      name: 'DATABASE_URL',
      category: 'Database',
      status: process.env.DATABASE_URL ? 'ok' : 'missing',
      hint: 'PostgreSQL connection string',
    },
    // Auth
    {
      name: 'JWT_SECRET',
      category: 'Auth',
      status: process.env.JWT_SECRET ? 'ok' : 'missing',
      hint: 'Secret key for JWT tokens',
    },
    {
      name: 'CSRF_SECRET',
      category: 'Auth',
      status: process.env.CSRF_SECRET ? 'ok' : 'warning',
      hint: 'CSRF protection secret',
    },
    // Email
    {
      name: 'RESEND_API_KEY',
      category: 'Email',
      status: process.env.RESEND_API_KEY ? 'ok' : 'warning',
      hint: 'Resend API key for emails (emails will silently fail without this)',
    },
    {
      name: 'RESEND_FROM_EMAIL',
      category: 'Email',
      status: process.env.RESEND_FROM_EMAIL ? 'ok' : 'warning',
      hint: 'From address for emails',
    },
    // SMS
    {
      name: 'TWILIO_ACCOUNT_SID',
      category: 'SMS',
      status: process.env.TWILIO_ACCOUNT_SID ? 'ok' : 'warning',
      hint: 'Twilio account SID for SMS (SMS will silently fail without this)',
    },
    {
      name: 'TWILIO_AUTH_TOKEN',
      category: 'SMS',
      status: process.env.TWILIO_AUTH_TOKEN ? 'ok' : 'warning',
      hint: 'Twilio auth token',
    },
    {
      name: 'TWILIO_FROM_NUMBER',
      category: 'SMS',
      status: process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID ? 'ok' : 'warning',
      hint: 'Twilio phone number or messaging service SID',
    },
    // Stripe
    {
      name: 'STRIPE_SECRET_KEY',
      category: 'Payments',
      status: process.env.STRIPE_SECRET_KEY ? 'ok' : 'warning',
      hint: 'Stripe secret key for payment processing',
    },
    {
      name: 'STRIPE_WEBHOOK_SECRET',
      category: 'Payments',
      status: process.env.STRIPE_WEBHOOK_SECRET ? 'ok' : 'warning',
      hint: 'Stripe webhook signing secret',
    },
    // Cloudinary
    {
      name: 'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
      category: 'File Upload',
      status: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ? 'ok' : 'warning',
      hint: 'Cloudinary cloud name for photo uploads',
    },
    // Push Notifications
    {
      name: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
      category: 'Push Notifications',
      status: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? 'ok' : 'warning',
      hint: 'VAPID public key for web push notifications',
    },
    {
      name: 'VAPID_PRIVATE_KEY',
      category: 'Push Notifications',
      status: process.env.VAPID_PRIVATE_KEY ? 'ok' : 'warning',
      hint: 'VAPID private key for web push',
    },
    // Monitoring
    {
      name: 'SENTRY_DSN',
      category: 'Monitoring',
      status: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN ? 'ok' : 'warning',
      hint: 'Sentry DSN for error monitoring',
    },
    // Cron
    {
      name: 'CRON_SECRET',
      category: 'Scheduled Tasks',
      status: process.env.CRON_SECRET ? 'ok' : 'warning',
      hint: 'Bearer token for cron job authentication',
    },
    // App URL
    {
      name: 'NEXT_PUBLIC_APP_URL',
      category: 'General',
      status: process.env.NEXT_PUBLIC_APP_URL ? 'ok' : 'warning',
      hint: 'Public app URL for email links and redirects',
    },
  ];

  const summary = {
    total: checks.length,
    ok: checks.filter(c => c.status === 'ok').length,
    missing: checks.filter(c => c.status === 'missing').length,
    warning: checks.filter(c => c.status === 'warning').length,
  };

  // Don't expose actual values ΓÇö just status
  return NextResponse.json({ checks, summary });
}
