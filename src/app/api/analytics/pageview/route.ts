import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { requireAuth } from '@/lib/middleware';
import { checkRateLimit, getClientIP } from '@/lib/rateLimit';

// POST - Track a page view
export async function POST(request: NextRequest) {
  // Rate-limit unauthenticated tracking calls (30 req/min per IP) to prevent DB spam
  const ip = getClientIP(request);
  const rl = await checkRateLimit(`pageview:${ip}`, { maxRequests: 30, windowMs: 60 * 1000 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  try {
    const body = await request.json();
    const { path, sessionId, referrer } = body;
    
    // Get user agent and IP hash (for privacy, we only store a hash)
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0] || realIp || 'Unknown';
    const ipHash = crypto.createHash('sha256').update(ip + (process.env.NEXTAUTH_SECRET || 'salt')).digest('hex').substring(0, 16);
    
    // Create page view record
    const pageView = await prisma.pageView.create({
      data: {
        path: path || '/',
        userAgent,
        ipHash,
        sessionId: sessionId || crypto.randomUUID(),
        referrer: referrer || null
      }
    });

    return NextResponse.json({ 
      success: true, 
      id: pageView.id 
    });
  } catch (error) {
    console.error('Error tracking page view:', error);
    return NextResponse.json(
      { error: 'Failed to track page view' },
      { status: 500 }
    );
  }
}

// GET - Get page view statistics (admin only)
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today);
    thisWeek.setDate(today.getDate() - 7);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalViews, todayViews, weekViews, monthViews, uniqueVisitors] = await Promise.all([
      prisma.pageView.count(),
      prisma.pageView.count({ where: { createdAt: { gte: today } } }),
      prisma.pageView.count({ where: { createdAt: { gte: thisWeek } } }),
      prisma.pageView.count({ where: { createdAt: { gte: thisMonth } } }),
      prisma.pageView.groupBy({
        by: ['ipHash'],
        _count: { ipHash: true }
      }).then(r => r.length)
    ]);

    return NextResponse.json({
      totalViews,
      todayViews,
      weekViews,
      monthViews,
      uniqueVisitors
    });
  } catch (error) {
    console.error('Error fetching page view stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
