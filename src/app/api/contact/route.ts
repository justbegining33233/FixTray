import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/emailService';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, company, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Name, email, and message are required' }, { status: 400 });
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const html = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
      <hr />
      <p>${message.replace(/\n/g, '<br />')}</p>
    `;

    const sent = await sendEmail({
      to: process.env.CONTACT_EMAIL || 'team@fixtray.com',
      subject: `[FixTray Contact] Message from ${name}`,
      html,
    });

    if (!sent) {
      logger.error('[contact] Email delivery failed', email);
      return NextResponse.json({ error: 'Failed to deliver message. Please email us directly at team@fixtray.com' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[contact] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
