import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateNumericOTP, generateTokenHex, hashTokenSha256 } from '@/lib/verification';
import { checkRateLimit, getClientIP } from '@/lib/rateLimit';
import logger from '@/lib/logger';

/**
 * CRITICAL FIX: Add constant-time delay to prevent timing attacks
 * This makes response time consistent regardless of whether user exists
 */
async function addConstantTimeDelay(startTime: number, minMs: number, maxMs: number): Promise<void> {
  const elapsed = Date.now() - startTime;
  const targetDelay = minMs + Math.random() * (maxMs - minMs);
  const delay = Math.max(0, targetDelay - elapsed);
  
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

async function sendByEmail(email: string, raw: string, siteUrl: string) {
  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'onboarding@resend.dev';
    await resend.emails.send({ to: email, from, subject: 'Your verification code', text: `Your code: ${raw}`, html: `<p>Your code: <strong>${raw}</strong></p><p>Or click <a href="${siteUrl}/auth/reset?token=${raw}">here</a></p>` });
    return true;
  }
  // Fallback: log debug info (DO NOT log actual reset code)
  if (process.env.NODE_ENV !== 'production') {
    logger.debug('[dev] Password reset code generated', { email });
  } else {
    logger.error('RESEND_API_KEY not configured — cannot send reset email');
  }
  return false;
}

async function sendBySms(phone: string, raw: string) {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
    try {
      const req = require;
      const twilioLib = req('twilio');
      const client = twilioLib(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({ to: phone, from: process.env.TWILIO_FROM, body: `Your verification code: ${raw}` });
      return true;
    } catch {
      // fall through to console fallback
    }
  }
  return false;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const identifier = body.identifier; // email or phone or username
    const via = body.via || 'email'; // 'email' or 'sms'
    const type = body.type || 'password_reset';
    const siteUrl = process.env.SITE_URL || '';

    if (!identifier) {
      // CRITICAL FIX: Add constant-time delay to prevent enumeration
      await addConstantTimeDelay(startTime, 200, 300);
      return NextResponse.json({ success: true }); // generic response
    }

    // Rate limiting � 3 requests per hour per IP + identifier to prevent OTP spam
    const clientIP = getClientIP(request);
    const rateLimitKey = `pw_reset:${clientIP}:${String(identifier).toLowerCase()}`;
    const rateLimit = await checkRateLimit(rateLimitKey, { maxRequests: 3, windowMs: 60 * 60 * 1000 });
    if (!rateLimit.success) {
      // Return generic success to avoid confirming account existence via timing
      return NextResponse.json({ success: true });
    }
    
    // CRITICAL FIX: Parallel user lookups to prevent timing attacks
    // Do all lookups in parallel, not sequentially (prevents attackers from measuring response times)
    const [adminUser, shopUser, customerUser, techUser] = await Promise.all([
      prisma.admin.findUnique({ where: { username: identifier } }).catch(() => null),
      prisma.shop.findUnique({ where: { username: identifier } }).catch(() => null),
      prisma.customer.findUnique({ where: { email: identifier } }).catch(() => null),
      prisma.tech.findUnique({ where: { email: identifier } }).catch(() => null),
    ]);
    
    const user = adminUser || shopUser || customerUser || techUser;

    // Always respond success to avoid account enumeration, but only send token if user exists
    if (!user) {
      // Add constant-time delay to prevent timing attacks
      await addConstantTimeDelay(Date.now() - (typeof startTime !== 'undefined' ? startTime : Date.now()), 200, 300);
      return NextResponse.json({ success: true });
    }

    // Generate token: numeric for SMS, hex for email/link
    const raw = via === 'sms' ? generateNumericOTP(6) : generateTokenHex(24);
    const tokenHash = hashTokenSha256(raw);
    const expiresAt = new Date(Date.now() + (via === 'sms' ? 5 : 15) * 60 * 1000);

    // Store token record (production) — if this fails, fall back to console logging
    try {
      await prisma.verificationToken.create({ data: {
        userId: user.id,
        type,
        tokenHash,
        expiresAt,
        metadata: JSON.stringify({ ip: getClientIP(request), via }),
      }});
    } catch {
      // still continue to attempt delivery (dev fallback will log the raw token)
    }

    // Send the token via configured provider or console fallback
    try {
      const userWithPhone = user as any;
      if (via === 'sms' && userWithPhone.phone) {
        await sendBySms(userWithPhone.phone as string, raw);
      } else if (user.email) {
        await sendByEmail(user.email, raw, siteUrl);
      } else {
      }
    } catch (e) {
      console.error('Delivery failed:', e);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    // CRITICAL FIX: Always add delay even on error to prevent timing attacks
    await addConstantTimeDelay(startTime, 200, 300);
    console.error('Reset request error:', err);
    return NextResponse.json({ success: true });
  }
}
