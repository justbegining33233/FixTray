import { NextRequest, NextResponse } from 'next/server';
import { logAdminAction } from '@/lib/auditLog';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';
import { isOwnerAdmin } from '@/lib/owner-access';

type SupportedUserType = 'admin' | 'shop' | 'customer' | 'manager' | 'tech';

type RefreshSessionMetadata = {
  shopId?: string;
  customerId?: string;
  techId?: string;
  ip?: string;
  agent?: string;
  csrfToken?: string;
};

function parseSessionMetadata(raw: string | null): RefreshSessionMetadata {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as RefreshSessionMetadata;
  } catch {
    return {};
  }
}

function isRecentlyActive(_lastLogin: Date | null, hasActiveSession: boolean): boolean {
  return hasActiveSession;
}

function getUserCapabilities(userType: SupportedUserType, options?: { isOwnerAdmin?: boolean }) {
  const isOwner = Boolean(options?.isOwnerAdmin);

  return {
    canEditRole: userType === 'tech' || userType === 'manager',
    canEditStatus: userType === 'shop',
    canEditUsername: userType === 'customer' || userType === 'shop' || (userType === 'admin' && !isOwner),
  };
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const searchQuery = request.nextUrl.searchParams.get('q')?.trim() || '';
    const hasSearch = searchQuery.length > 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const _endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Get all customers with work order data
    const customers = await prisma.customer.findMany({
      ...(hasSearch
        ? {
            where: {
              OR: [
                { email: { contains: searchQuery, mode: 'insensitive' } },
                { username: { contains: searchQuery, mode: 'insensitive' } },
                { firstName: { contains: searchQuery, mode: 'insensitive' } },
                { lastName: { contains: searchQuery, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        workOrders: {
          select: {
            id: true,
            status: true,
            amountPaid: true,
            paymentStatus: true,
            createdAt: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get all techs with work order and time entry data
    const techs = await prisma.tech.findMany({
      ...(hasSearch
        ? {
            where: {
              OR: [
                { email: { contains: searchQuery, mode: 'insensitive' } },
                { firstName: { contains: searchQuery, mode: 'insensitive' } },
                { lastName: { contains: searchQuery, mode: 'insensitive' } },
                { role: { contains: searchQuery } },
              ],
            },
          }
        : {}),
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        available: true,
        createdAt: true,
        shopId: true,
        assignedWorkOrders: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          }
        },
        timeEntries: {
          select: {
            id: true,
            clockIn: true,
            clockOut: true,
          },
          where: {
            clockIn: { gte: thirtyDaysAgo }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get all shops (admins)
    const shops = await prisma.shop.findMany({
      ...(hasSearch
        ? {
            where: {
              OR: [
                { email: { contains: searchQuery, mode: 'insensitive' } },
                { username: { contains: searchQuery, mode: 'insensitive' } },
                { ownerName: { contains: searchQuery, mode: 'insensitive' } },
                { status: { contains: searchQuery } },
              ],
            },
          }
        : {}),
      select: {
        id: true,
        username: true,
        email: true,
        ownerName: true,
        status: true,
        createdAt: true,
        workOrders: {
          select: {
            id: true,
            status: true,
            amountPaid: true,
            paymentStatus: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const admins = await prisma.admin.findMany({
      ...(hasSearch
        ? {
            where: {
              OR: [
                { email: { contains: searchQuery, mode: 'insensitive' } },
                { username: { contains: searchQuery, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        isSuperAdmin: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Real usage signals: login logs + currently valid refresh sessions.
    const [loginEvents, activeRefreshSessions] = await Promise.all([
      prisma.activityLog.findMany({
        where: {
          action: 'login',
          type: 'user',
          createdAt: { gte: ninetyDaysAgo },
        },
        select: {
          createdAt: true,
          email: true,
          shopId: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.refreshToken.findMany({
        where: {
          revoked: false,
          expiresAt: { gt: now },
        },
        select: {
          adminId: true,
          metadata: true,
          createdAt: true,
        },
      }),
    ]);

    const latestLoginByEmail = new Map<string, Date>();
    const latestLoginByShopId = new Map<string, Date>();

    for (const event of loginEvents) {
      if (event.email) {
        const key = event.email.trim().toLowerCase();
        if (!latestLoginByEmail.has(key)) {
          latestLoginByEmail.set(key, event.createdAt);
        }
      }
      if (event.shopId && !latestLoginByShopId.has(event.shopId)) {
        latestLoginByShopId.set(event.shopId, event.createdAt);
      }
    }

    const activeAdminIds = new Set<string>();
    const activeShopIds = new Set<string>();
    const activeCustomerIds = new Set<string>();
    const activeTechIds = new Set<string>();

    for (const session of activeRefreshSessions) {
      if (session.adminId) {
        activeAdminIds.add(session.adminId);
        continue;
      }
      const meta = parseSessionMetadata(session.metadata ?? null);
      if (meta.shopId) activeShopIds.add(meta.shopId);
      if (meta.customerId) activeCustomerIds.add(meta.customerId);
      if (meta.techId) activeTechIds.add(meta.techId);
    }

    // Combine all users with role identification and metrics
    const allUsers = [
      ...customers.map((customer: any) => {
        const totalOrders = customer.workOrders?.length || 0;
        const totalSpent = customer.workOrders
          ?.filter((wo: any) => wo.paymentStatus === 'paid')
          .reduce((sum: number, wo: any) => sum + (wo.amountPaid || 0), 0) || 0;
        const lastOrderDate = customer.workOrders
          ?.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          ?.[0]?.createdAt || null;
        const lastLogin = latestLoginByEmail.get((customer.email || '').toLowerCase()) || null;
        const hasActiveSession = activeCustomerIds.has(customer.id);
        const activityStatus = isRecentlyActive(lastLogin, hasActiveSession) ? 'active' : 'inactive';
        
        return {
          id: customer.id,
          userType: 'customer' as const,
          username: customer.username,
          email: customer.email,
          firstName: customer.firstName || '',
          lastName: customer.lastName || '',
          role: 'customer' as const,
          status: activityStatus,
          accountStatus: 'active',
          activityStatus,
          hasActiveSession,
          capabilities: getUserCapabilities('customer'),
          createdAt: customer.createdAt,
          // Customer-specific metrics
          totalOrders,
          totalSpent,
          lastOrderDate,
          lastLogin,
        };
      }),
      ...techs.map((tech: any) => {
        const completedJobs = tech.assignedWorkOrders?.filter((wo: any) => 
          wo.status === 'closed' || wo.status === 'completed'
        ).length || 0;
        const totalJobs = tech.assignedWorkOrders?.length || 0;
        const recentTimeEntries = tech.timeEntries?.length || 0;
        const lastLogin = latestLoginByEmail.get((tech.email || '').toLowerCase()) || null;
        const hasActiveSession = activeTechIds.has(tech.id);
        const activityStatus = isRecentlyActive(lastLogin, hasActiveSession) ? 'active' : 'inactive';
        
        return {
          id: tech.id,
          userType: tech.role as 'tech' | 'manager',
          username: tech.email,
          email: tech.email,
          firstName: tech.firstName,
          lastName: tech.lastName,
          role: tech.role as 'tech' | 'manager',
          status: activityStatus,
          accountStatus: tech.available ? 'available' : 'away',
          activityStatus,
          hasActiveSession,
          capabilities: getUserCapabilities(tech.role as 'tech' | 'manager'),
          createdAt: tech.createdAt,
          shopId: tech.shopId,
          // Tech-specific metrics
          completedJobs,
          totalJobs,
          completionRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0,
          recentTimeEntries,
          lastLogin,
        };
      }),
      ...shops.map((shop: any) => {
        const totalRevenue = shop.workOrders
          ?.filter((wo: any) => wo.paymentStatus === 'paid')
          .reduce((sum: number, wo: any) => sum + (wo.amountPaid || 0), 0) || 0;
        const totalJobs = shop.workOrders?.length || 0;
        
        const emailKey = (shop.email || '').toLowerCase();
        const lastLogin = latestLoginByShopId.get(shop.id) || latestLoginByEmail.get(emailKey) || null;
        const hasActiveSession = activeShopIds.has(shop.id);
        const activityStatus = isRecentlyActive(lastLogin, hasActiveSession) ? 'active' : 'inactive';

        return {
          id: shop.id,
          userType: 'shop' as const,
          username: shop.username,
          email: shop.email,
          firstName: shop.ownerName?.split(' ')[0] || '',
          lastName: shop.ownerName?.split(' ').slice(1).join(' ') || '',
          role: 'shop' as const,
          status: shop.status,
          accountStatus: shop.status,
          activityStatus,
          hasActiveSession,
          capabilities: getUserCapabilities('shop'),
          createdAt: shop.createdAt,
          // Shop owner metrics
          totalRevenue,
          totalJobs,
          lastLogin,
        };
      }),
      ...admins.map((admin: any) => {
        const ownerAdmin = isOwnerAdmin({ id: admin.id, username: admin.username });
        const lastLogin = latestLoginByEmail.get((admin.email || '').toLowerCase()) || null;
        const hasActiveSession = activeAdminIds.has(admin.id);
        const activityStatus = isRecentlyActive(lastLogin, hasActiveSession) ? 'active' : 'inactive';
        return {
          id: admin.id,
          userType: 'admin' as const,
          username: admin.username,
          email: admin.email,
          firstName: 'FixTray',
          lastName: 'Admin',
          role: 'admin' as const,
          status: activityStatus,
          accountStatus: 'active',
          activityStatus,
          hasActiveSession,
          isOwner: ownerAdmin,
          capabilities: getUserCapabilities('admin', { isOwnerAdmin: ownerAdmin }),
          createdAt: admin.createdAt,
          lastLogin,
        };
      })
    ];

    // Calculate live metrics
    const totalUsers = allUsers.length;
    const totalCustomers = customers.length;
    const totalTechs = techs.length;
    const totalShopOwners = shops.length;

    // New users this month/week
    const newUsersThisMonth = allUsers.filter(u => new Date(u.createdAt) >= startOfMonth).length;
    const newUsersLastMonth = allUsers.filter(u => 
      new Date(u.createdAt) >= startOfLastMonth && new Date(u.createdAt) < startOfMonth
    ).length;
    const newUsersThisWeek = allUsers.filter(u => new Date(u.createdAt) >= sevenDaysAgo).length;

    // User growth
    const userGrowth = newUsersLastMonth > 0 
      ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100)
      : newUsersThisMonth > 0 ? 100 : 0;

    // Active users (those with recent activity - last 7 days)
    const activeUsers = allUsers.filter((u: any) => u.activityStatus === 'active').length;
    const activeRate = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;

    // Techs availability
    const availableTechs = techs.filter((t: any) => t.available).length;
    const techAvailabilityRate = totalTechs > 0 ? Math.round((availableTechs / totalTechs) * 100) : 0;

    // Customer engagement
    const activeCustomers = customers.filter((c: any) => 
      c.workOrders?.some((wo: any) => new Date(wo.createdAt) >= thirtyDaysAgo)
    ).length;
    const customerEngagementRate = totalCustomers > 0 ? Math.round((activeCustomers / totalCustomers) * 100) : 0;

    // Role distribution
    const roleDistribution = {
      customer: totalCustomers,
      tech: techs.filter((t: any) => t.role === 'tech').length,
      manager: techs.filter((t: any) => t.role === 'manager').length,
      shop: totalShopOwners,
    };

    // 7-day user trend
    const userTrend: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = allUsers.filter(u => {
        const created = new Date(u.createdAt);
        return created >= date && created < nextDate;
      }).length;
      userTrend.push(count);
    }

    // Activity heatmap (4 weeks x 7 days) - count logins/activity per day
    const activityHeatmap: number[][] = [];
    for (let week = 3; week >= 0; week--) {
      const weekData: number[] = [];
      for (let day = 0; day < 7; day++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (week * 7 + (6 - day)));
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        // Count users active on this day
        const activeCount = allUsers.filter(u => {
          if (!u.lastLogin) return false;
          const login = new Date(u.lastLogin);
          return login >= date && login < nextDate;
        }).length;
        weekData.push(activeCount);
      }
      activityHeatmap.push(weekData);
    }

    // Additional engagement metrics
    const dailyActiveUsers = allUsers.filter(u => {
      if (!u.lastLogin) return false;
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      return new Date(u.lastLogin) >= today;
    }).length;

    const weeklyActiveUsers = activeUsers; // Already calculated above
    
    const monthlyActiveUsers = allUsers.filter(u => 
      u.lastLogin && new Date(u.lastLogin) >= thirtyDaysAgo
    ).length;

    // Calculate retention rate (users who came back after first week)
    const usersOlderThanWeek = allUsers.filter(u => new Date(u.createdAt) < sevenDaysAgo);
    const retainedUsers = usersOlderThanWeek.filter(u => 
      u.lastLogin && new Date(u.lastLogin) >= sevenDaysAgo
    ).length;
    const retentionRate = usersOlderThanWeek.length > 0 
      ? Math.round((retainedUsers / usersOlderThanWeek.length) * 100) 
      : 0;

    // Calculate churn rate (users with no activity in last 30 days who were previously active)
    const previouslyActiveUsers = allUsers.filter(u => {
      const created = new Date(u.createdAt);
      return created < thirtyDaysAgo;
    });
    const churnedUsers = previouslyActiveUsers.filter(u => {
      if (!u.lastLogin) return true;
      return new Date(u.lastLogin) < thirtyDaysAgo;
    }).length;
    const churnRate = previouslyActiveUsers.length > 0 
      ? Math.round((churnedUsers / previouslyActiveUsers.length) * 100) 
      : 0;

    // Feature adoption - customers who have created at least one work order
    const customersWithOrders = customers.filter((c: any) => c.workOrders?.length > 0).length;
    const featureAdoptionRate = totalCustomers > 0 
      ? Math.round((customersWithOrders / totalCustomers) * 100) 
      : 0;

    // Power users - customers with 3+ orders or techs with 5+ completed jobs
    const powerCustomers = customers.filter((c: any) => (c.workOrders?.length || 0) >= 3).length;
    const powerTechs = techs.filter((t: any) => 
      (t.assignedWorkOrders?.filter((wo: any) => wo.status === 'closed' || wo.status === 'completed').length || 0) >= 5
    ).length;
    const powerUsers = powerCustomers + powerTechs;
    const powerUserRate = totalUsers > 0 ? Math.round((powerUsers / totalUsers) * 100) : 0;

    // Onboarded users (users who completed an action - customer placed order or tech completed job)
    const onboardedCustomers = customersWithOrders;
    const onboardedTechs = techs.filter((t: any) => 
      (t.assignedWorkOrders?.filter((wo: any) => wo.status === 'closed' || wo.status === 'completed').length || 0) > 0
    ).length;
    const onboardedUsers = onboardedCustomers + onboardedTechs + totalShopOwners; // All shop owners are onboarded
    const onboardingRate = totalUsers > 0 ? Math.round((onboardedUsers / totalUsers) * 100) : 0;

    // DAU/MAU ratio
    const dauMauRatio = monthlyActiveUsers > 0 ? Math.round((dailyActiveUsers / monthlyActiveUsers) * 100) : 0;

    // Average customer lifetime value
    const totalCustomerRevenue = customers.reduce((sum: number, c: any) => {
      return sum + (c.workOrders?.filter((wo: any) => wo.paymentStatus === 'paid')
        .reduce((s: number, wo: any) => s + (wo.amountPaid || 0), 0) || 0);
    }, 0);
    const avgCustomerValue = totalCustomers > 0 ? Math.round(totalCustomerRevenue / totalCustomers) : 0;

    // Customer satisfaction from reviews
    const reviews = await prisma.review.aggregate({
      _avg: { rating: true },
      _count: { rating: true }
    });
    const customerSatisfaction = reviews._avg.rating ? Math.round(reviews._avg.rating * 10) / 10 : 0;
    const totalReviewCount = reviews._count.rating || 0;

    // User Health Indicators
    // Email verification is not tracked consistently across every role.
    const accountVerificationRate = null;

    // Profile completion - users with firstName and lastName
    const profileCompletedCustomers = customers.filter((c: any) => c.firstName && c.lastName).length;
    const profileCompletedTechs = techs.filter((t: any) => t.firstName && t.lastName).length;
    const profileCompletedShops = shops.filter((s: any) => s.ownerName).length;
    const profileCompletedUsers = profileCompletedCustomers + profileCompletedTechs + profileCompletedShops;
    const profileCompletionRate = totalUsers > 0 ? Math.round((profileCompletedUsers / totalUsers) * 100) : 0;

    // Security metrics - count active sessions (users active today)
    const activeSessions = activeAdminIds.size + activeShopIds.size + activeCustomerIds.size + activeTechIds.size;

    const failedLogins = null;
    const lockedOutUsers = null;
    const securityAlerts = null;

    return NextResponse.json({ 
      users: allUsers,
      liveMetrics: {
        totalUsers,
        totalCustomers,
        totalTechs,
        totalShopOwners,
        newUsersThisMonth,
        newUsersLastMonth,
        newUsersThisWeek,
        userGrowth: `${userGrowth >= 0 ? '+' : ''}${userGrowth}%`,
        activeUsers,
        activeRate: `${activeRate}%`,
        availableTechs,
        techAvailabilityRate: `${techAvailabilityRate}%`,
        activeCustomers,
        customerEngagementRate: `${customerEngagementRate}%`,
        roleDistribution,
        userTrend,
        activityHeatmap,
        // Engagement metrics (all live data)
        dailyActiveUsers,
        weeklyActiveUsers,
        monthlyActiveUsers,
        retentionRate: `${retentionRate}%`,
        churnRate: `${churnRate}%`,
        // Adoption metrics
        featureAdoptionRate,
        onboardingRate,
        powerUserRate,
        powerUsers,
        onboardedUsers,
        dauMauRatio,
        // Customer metrics
        avgCustomerValue,
        customerSatisfaction,
        totalReviewCount,
        // Computed totals for display
        totalWorkOrders: customers.reduce((sum: number, c: any) => sum + (c.workOrders?.length || 0), 0),
        completedWorkOrders: customers.reduce((sum: number, c: any) => 
          sum + (c.workOrders?.filter((wo: any) => wo.status === 'closed' || wo.status === 'completed').length || 0), 0
        ),
        // User health indicators
        accountVerificationRate,
        profileCompletionRate,
        onboardingCompletionRate: onboardingRate, // Same as onboarding rate
        twoFactorAuthRate: null,
        // Security metrics
        activeSessions,
        failedLogins,
        accountLockouts: lockedOutUsers,
        securityAlerts,
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  if (!auth.isOwner) {
    return NextResponse.json({ error: 'Only FixTray Owner can create FixTray Admin employees.' }, { status: 403 });
  }

  try {
    const { username, email, password } = await request.json();

    const normalizedUsername = typeof username === 'string' ? username.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedUsername || !normalizedEmail || typeof password !== 'string') {
      return NextResponse.json({ error: 'username, email, and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const existing = await prisma.admin.findFirst({
      where: {
        OR: [
          { username: normalizedUsername },
          { email: normalizedEmail },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: 'Username or email already exists' }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);
    const createdAdmin = await prisma.admin.create({
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        password: hashedPassword,
        // Internal staff created from Command Center are FixTray Admin accounts.
        isSuperAdmin: false,
      },
      select: {
        id: true,
        username: true,
        email: true,
        isSuperAdmin: true,
        createdAt: true,
      },
    });

    await logAdminAction(auth.id, 'Created FixTray employee account', `${createdAdmin.username} (${createdAdmin.email})`);

    return NextResponse.json({ success: true, user: createdAdmin }, { status: 201 });
  } catch (error) {
    console.error('Error creating admin user:', error);
    return NextResponse.json({ error: 'Failed to create employee account' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, role, status, userType, email, username, firstName, lastName } = await request.json();
    
    if (!id || !userType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedUserType = userType as SupportedUserType;
    let updated = null;

    if (!['admin', 'shop', 'customer', 'manager', 'tech'].includes(normalizedUserType)) {
      return NextResponse.json({ error: 'Invalid user type' }, { status: 400 });
    }

    let targetOwnerAdmin = false;
    if (normalizedUserType === 'admin') {
      const existingAdmin = await prisma.admin.findUnique({
        where: { id },
        select: { id: true, username: true },
      });

      if (!existingAdmin) {
        return NextResponse.json({ error: 'User not found or update failed' }, { status: 404 });
      }

      targetOwnerAdmin = isOwnerAdmin(existingAdmin);
      if (targetOwnerAdmin && typeof username === 'string' && username.trim() && username.trim() !== existingAdmin.username) {
        return NextResponse.json({ error: 'Owner username is locked and cannot be changed here.' }, { status: 403 });
      }
    }

    const capabilities = getUserCapabilities(normalizedUserType, { isOwnerAdmin: targetOwnerAdmin });

    if (typeof role === 'string' && role.trim() && !capabilities.canEditRole) {
      return NextResponse.json({ error: 'Role cannot be updated for this user type.' }, { status: 400 });
    }

    if (typeof status === 'string' && status.trim() && !capabilities.canEditStatus) {
      return NextResponse.json({ error: 'Status cannot be updated for this user type.' }, { status: 400 });
    }

    if (typeof username === 'string' && username.trim() && !capabilities.canEditUsername) {
      return NextResponse.json({ error: 'Username cannot be updated for this user type.' }, { status: 400 });
    }

    // Update based on user type
    if (normalizedUserType === 'shop') {
      const ownerName = [firstName, lastName].filter(Boolean).join(' ').trim();
      updated = await prisma.shop.update({
        where: { id },
        data: {
          ...(status && { status }),
          ...(email && { email }),
          ...(username && { username }),
          ...(ownerName && { ownerName }),
        },
      });
    } else if (normalizedUserType === 'customer') {
      updated = await prisma.customer.update({
        where: { id },
        data: {
          ...(email && { email }),
          ...(username && { username }),
          ...(typeof firstName === 'string' && { firstName }),
          ...(typeof lastName === 'string' && { lastName }),
        },
      });
    } else if (normalizedUserType === 'tech' || normalizedUserType === 'manager') {
      updated = await prisma.tech.update({
        where: { id },
        data: {
          ...(role && { role }),
          ...(email && { email }),
          ...(typeof firstName === 'string' && { firstName }),
          ...(typeof lastName === 'string' && { lastName }),
        },
      });
    } else if (normalizedUserType === 'admin') {
      updated = await prisma.admin.update({
        where: { id },
        data: {
          ...(email && { email }),
          ...(username && { username }),
        },
      });
    }

    if (!updated) {
      return NextResponse.json({ error: 'User not found or update failed' }, { status: 404 });
    }

    await logAdminAction(auth.id, `Updated user ${id}`, `Type: ${normalizedUserType}, Role: ${role}, Status: ${status}`);
    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, userType } = await request.json();
    
    if (!id || !userType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Delete based on user type
    if (userType === 'shop') {
      await prisma.shop.delete({ where: { id } });
    } else if (userType === 'customer') {
      await prisma.customer.delete({ where: { id } });
    } else if (userType === 'tech' || userType === 'manager') {
      await prisma.tech.delete({ where: { id } });
    } else {
      return NextResponse.json({ error: 'Invalid user type' }, { status: 400 });
    }

    await logAdminAction(auth.id, `Deleted user ${id}`, `Type: ${userType}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
